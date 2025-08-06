#!/bin/bash

# Set AWS credentials for local testing
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}

# Set environment
ENVIRONMENT=${ENVIRONMENT:-dev}

# Table name from environment variable, with a default for local testing
TABLE_NAME=${BINS_TABLE_NAME:-${ENVIRONMENT}-ecoscan-trash-bins}

if [ -z "$TABLE_NAME" ]; then
    echo "Error: BINS_TABLE_NAME environment variable is not set." >&2
    exit 1
fi

# Create default trash bin
echo "Creating default trash bin in table: $TABLE_NAME..."
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
    --table-name "$TABLE_NAME" \
    --item '{
        "binId": {"S": "00000000-0000-0000-0000-000000000001"},
        "Name": {"S": "Default Bin"},
        "Status": {"N": "0"},
        "LastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "ReportsCount": {"N": "0"}
    }'

echo "Default data seeded successfully!"
