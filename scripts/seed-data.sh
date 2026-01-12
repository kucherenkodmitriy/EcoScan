#!/bin/bash
# seed-data.sh: Seeds initial data for local or AWS environments
#
# Usage:
#   ./seed-data.sh [ENVIRONMENT]
#
# Environment variables:
#   ENVIRONMENT    - local, dev, or prod (default: local)
#   ENDPOINT_URL   - LocalStack endpoint (only for local, default: http://localhost:4566)
#   ADMIN_PASSWORD - Optional: set admin password for AWS environments
#                    If not set, a random password is generated and displayed once
#
# Security:
#   - Local: Uses known test password "admin123" for convenience
#   - AWS:   Generates random password or uses ADMIN_PASSWORD env var
#            Password is hashed with bcrypt before storage

set -e

# Set environment
ENVIRONMENT=${1:-${ENVIRONMENT:-local}}

# Configure AWS CLI options based on environment
if [[ "$ENVIRONMENT" == "local" ]]; then
    # LocalStack credentials and endpoint
    export AWS_ACCESS_KEY_ID=test
    export AWS_SECRET_ACCESS_KEY=test
    export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}
    ENDPOINT_URL=${ENDPOINT_URL:-http://localhost:4566}
    AWS_OPTS="--endpoint-url=$ENDPOINT_URL"
    echo "=== Seeding Data for Environment: $ENVIRONMENT (LocalStack) ==="
    echo "Endpoint: $ENDPOINT_URL"
else
    # AWS environment - use configured credentials
    export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}
    AWS_OPTS=""
    echo "=== Seeding Data for Environment: $ENVIRONMENT (AWS) ==="
    echo "Region: $AWS_DEFAULT_REGION"
fi

# Table names
BINS_TABLE="${ENVIRONMENT}-ecoscan-trash-bins"
USERS_TABLE="${ENVIRONMENT}-ecoscan-admin-users"

echo ""

# --- Seed Trash Bins ---
echo "--- Seeding Trash Bins ---"

# Test bin 1
echo "Creating test bin 1..."
aws $AWS_OPTS dynamodb put-item \
    --table-name "$BINS_TABLE" \
    --item '{
        "binId": {"S": "00000000-0000-0000-0000-000000000001"},
        "Name": {"S": "Main Street Bin"},
        "status": {"N": "0"},
        "lastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "reportsCount": {"N": "0"},
        "isActive": {"BOOL": true}
    }' 2>/dev/null || echo "  (bin may already exist)"

# Test bin 2
echo "Creating test bin 2..."
aws $AWS_OPTS dynamodb put-item \
    --table-name "$BINS_TABLE" \
    --item '{
        "binId": {"S": "00000000-0000-0000-0000-000000000002"},
        "Name": {"S": "Park Entrance Bin"},
        "status": {"N": "25"},
        "lastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "reportsCount": {"N": "5"},
        "isActive": {"BOOL": true}
    }' 2>/dev/null || echo "  (bin may already exist)"

# Test bin 3
echo "Creating test bin 3..."
aws $AWS_OPTS dynamodb put-item \
    --table-name "$BINS_TABLE" \
    --item '{
        "binId": {"S": "00000000-0000-0000-0000-000000000003"},
        "Name": {"S": "Shopping Center Bin"},
        "status": {"N": "75"},
        "lastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "reportsCount": {"N": "15"},
        "isActive": {"BOOL": true}
    }' 2>/dev/null || echo "  (bin may already exist)"

echo "Trash bins seeded."
echo ""

# --- Seed Admin User ---
echo "--- Seeding Admin User ---"

ADMIN_EMAIL="admin@ecoscan.local"

if [[ "$ENVIRONMENT" == "local" ]]; then
    # For local development: use known test password
    ADMIN_PASSWORD="admin123"
    # Pre-computed bcrypt hash for "admin123" (cost 12)
    ADMIN_PASSWORD_HASH='$2b$12$pENkNjUH0JkUYN6RFEReIei1a2ybCXNE.Y4v97xk5XbWVsQxpA6OS'
else
    # For AWS environments: generate random password and hash it
    # Check if ADMIN_PASSWORD is provided via environment variable
    if [[ -n "$ADMIN_PASSWORD" ]]; then
        echo "Using password from ADMIN_PASSWORD environment variable"
    else
        # Generate a random 16-character password
        ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)
        echo "Generated random admin password"
    fi

    # Hash password using Python bcrypt
    if ! command -v python3 &> /dev/null; then
        echo "Error: python3 is required to hash passwords for AWS environments"
        exit 1
    fi

    ADMIN_PASSWORD_HASH=$(python3 -c "
import sys
try:
    import bcrypt
    password = sys.argv[1].encode('utf-8')
    hash = bcrypt.hashpw(password, bcrypt.gensalt(12))
    print(hash.decode('utf-8'))
except ImportError:
    print('ERROR: bcrypt module not installed. Run: pip install bcrypt', file=sys.stderr)
    sys.exit(1)
" "$ADMIN_PASSWORD")

    if [[ $? -ne 0 ]] || [[ -z "$ADMIN_PASSWORD_HASH" ]]; then
        echo "Error: Failed to hash password"
        exit 1
    fi
fi

echo "Creating admin user: $ADMIN_EMAIL"
aws $AWS_OPTS dynamodb put-item \
    --table-name "$USERS_TABLE" \
    --item '{
        "email": {"S": "'"$ADMIN_EMAIL"'"},
        "passwordHash": {"S": "'"$ADMIN_PASSWORD_HASH"'"},
        "name": {"S": "Admin User"},
        "role": {"S": "admin"},
        "createdAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "isActive": {"BOOL": true}
    }' 2>/dev/null || echo "  (user may already exist)"

echo "Admin user seeded."
echo ""

# --- Summary ---
echo "=== Seed Data Summary ==="
echo ""
echo "Trash Bins Table: $BINS_TABLE"
echo "  - 00000000-0000-0000-0000-000000000001 (Main Street Bin)"
echo "  - 00000000-0000-0000-0000-000000000002 (Park Entrance Bin)"
echo "  - 00000000-0000-0000-0000-000000000003 (Shopping Center Bin)"
echo ""
echo "Admin Users Table: $USERS_TABLE"
echo "  - $ADMIN_EMAIL"
echo ""

if [[ "$ENVIRONMENT" == "local" ]]; then
    echo "Admin credentials (local testing):"
    echo "  Email: $ADMIN_EMAIL"
    echo "  Password: $ADMIN_PASSWORD"
    echo ""
    echo "To test login:"
    echo "  curl -X POST http://localhost:4566/.../auth/login \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}'"
else
    echo "=========================================="
    echo "  ADMIN CREDENTIALS (SAVE THESE NOW!)"
    echo "=========================================="
    echo "  Email:    $ADMIN_EMAIL"
    echo "  Password: $ADMIN_PASSWORD"
    echo "=========================================="
    echo ""
    echo "WARNING: This password will not be shown again!"
    echo "Store it securely (e.g., in a password manager)"
fi
echo ""
echo "Seeding complete!"
