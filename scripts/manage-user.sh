#!/bin/bash
# manage-user.sh: Add or update users in DynamoDB with secure password hashing
#
# Usage:
#   ./manage-user.sh [ENVIRONMENT] [ACTION] [EMAIL] [PASSWORD] [NAME]
#
# Examples:
#   ./manage-user.sh local add test@ecoscan.local mysecret "Test User"
#   ./manage-user.sh local update test@ecoscan.local newsecret
#
# Environment variables:
#   ENVIRONMENT    - local, dev, or prod (default: local)
#   ENDPOINT_URL   - LocalStack endpoint (only for local, default: http://localhost:4566)

set -e
set +H 2>/dev/null || true  # Disable history expansion for special chars like !

# Arguments
ENVIRONMENT=${1:-local}
ACTION=${2}
EMAIL=${3}
PASSWORD=${4}
NAME=${5:-"Admin User"}

if [[ -z "$ACTION" ]] || [[ -z "$EMAIL" ]] || [[ -z "$PASSWORD" ]]; then
    echo "Usage: $0 [ENVIRONMENT] [ACTION] [EMAIL] [PASSWORD] [NAME]"
    echo "  ACTION: add | update"
    exit 1
fi

# Configure AWS CLI options
if [[ "$ENVIRONMENT" == "local" ]]; then
    export AWS_ACCESS_KEY_ID=test
    export AWS_SECRET_ACCESS_KEY=test
    export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}
    ENDPOINT_URL=${ENDPOINT_URL:-http://localhost:4566}
    AWS_OPTS="--endpoint-url=$ENDPOINT_URL"
    echo "=== Environment: $ENVIRONMENT (LocalStack) ==="
else
    # For AWS environments, try to source credentials from .env file if it exists
    ENV_FILE=".env.${ENVIRONMENT}"
    if [[ -f "$ENV_FILE" ]]; then
        echo "Loading credentials from $ENV_FILE..."
        # Export all variables from the env file for aws commands
        set -a
        # shellcheck disable=SC1090
        source "$ENV_FILE"
        set +a
    fi

    export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}
    AWS_OPTS=""
    echo "=== Environment: $ENVIRONMENT (AWS) ==="
fi

USERS_TABLE="${ENVIRONMENT}-ecoscan-admin-users"

# Hash password using Python bcrypt
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is required to hash passwords"
    exit 1
fi

echo "Hashing password..."
# Pass password via stdin to avoid shell expansion issues with special characters
PASSWORD_HASH=$(python3 -c "
import sys
try:
    import bcrypt
    # Strip trailing newline from here-string
    password = sys.stdin.read().rstrip('\n').encode('utf-8')
    hash = bcrypt.hashpw(password, bcrypt.gensalt(12))
    print(hash.decode('utf-8'))
except ImportError:
    print('ERROR: bcrypt module not installed. Run: pip install bcrypt', file=sys.stderr)
    sys.exit(1)
" <<< "$PASSWORD")

if [[ $? -ne 0 ]] || [[ -z "$PASSWORD_HASH" ]]; then
    echo "Error: Failed to hash password"
    exit 1
fi

if [[ "$ACTION" == "add" ]]; then
    echo "Adding user: $EMAIL"
    aws $AWS_OPTS dynamodb put-item \
        --table-name "$USERS_TABLE" \
        --item "{
            \"email\": {\"S\": \"$EMAIL\"},
            \"passwordHash\": {\"S\": \"$PASSWORD_HASH\"},
            \"name\": {\"S\": \"$NAME\"},
            \"role\": {\"S\": \"admin\"},
            \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"},
            \"isActive\": {\"BOOL\": true}
        }"
    echo "User added successfully."

elif [[ "$ACTION" == "update" ]]; then
    echo "Updating password for: $EMAIL"
    # Verify user exists first
    EXISTING=$(aws $AWS_OPTS dynamodb get-item --table-name "$USERS_TABLE" --key "{\"email\": {\"S\": \"$EMAIL\"}}" --query 'Item' --output text)
    if [[ "$EXISTING" == "None" ]] || [[ -z "$EXISTING" ]]; then
        echo "Error: User $EMAIL not found in $USERS_TABLE"
        exit 1
    fi

    aws $AWS_OPTS dynamodb update-item \
        --table-name "$USERS_TABLE" \
        --key "{\"email\": {\"S\": \"$EMAIL\"}}" \
        --update-expression "SET passwordHash = :p" \
        --expression-attribute-values "{ \":p\": {\"S\": \"$PASSWORD_HASH\"} }"
    echo "Password updated successfully."
else
    echo "Error: Unknown action '$ACTION'. Use 'add' or 'update'."
    exit 1
fi
