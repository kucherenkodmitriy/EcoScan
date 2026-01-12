#!/bin/bash
# seed-data.sh: Seeds initial data for local development
#
# Usage:
#   ./seed-data.sh [ENVIRONMENT]
#
# Environment variables:
#   ENVIRONMENT - local, dev, or prod (default: local)
#   ENDPOINT_URL - LocalStack endpoint (default: http://localhost:4566)

set -e

# Set AWS credentials for local testing
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}

# Set environment
ENVIRONMENT=${1:-${ENVIRONMENT:-local}}
ENDPOINT_URL=${ENDPOINT_URL:-http://localhost:4566}

# Table names
BINS_TABLE="${ENVIRONMENT}-ecoscan-trash-bins"
USERS_TABLE="${ENVIRONMENT}-ecoscan-admin-users"

echo "=== Seeding Data for Environment: $ENVIRONMENT ==="
echo "Endpoint: $ENDPOINT_URL"
echo ""

# --- Seed Trash Bins ---
echo "--- Seeding Trash Bins ---"

# Test bin 1
echo "Creating test bin 1..."
aws --endpoint-url="$ENDPOINT_URL" dynamodb put-item \
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
aws --endpoint-url="$ENDPOINT_URL" dynamodb put-item \
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
aws --endpoint-url="$ENDPOINT_URL" dynamodb put-item \
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

# Pre-computed bcrypt hash for password "admin123" (cost 12)
# Generated with: python3 -c "import bcrypt; print(bcrypt.hashpw(b'admin123', bcrypt.gensalt(12)).decode())"
ADMIN_PASSWORD_HASH='$2b$12$pENkNjUH0JkUYN6RFEReIei1a2ybCXNE.Y4v97xk5XbWVsQxpA6OS'

echo "Creating default admin user..."
aws --endpoint-url="$ENDPOINT_URL" dynamodb put-item \
    --table-name "$USERS_TABLE" \
    --item '{
        "email": {"S": "admin@ecoscan.local"},
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
echo "  - admin@ecoscan.local (password: admin123)"
echo ""
echo "To test login:"
echo "  curl -X POST http://localhost:4566/.../auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\": \"admin@ecoscan.local\", \"password\": \"admin123\"}'"
echo ""
echo "Seeding complete!"
