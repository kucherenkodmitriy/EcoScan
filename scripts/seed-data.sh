#!/bin/bash

# Set AWS credentials for local testing
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}

# Set environment
ENVIRONMENT=${ENVIRONMENT:-dev}

# Create default trash bin
echo "Creating default trash bin..."
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
    --table-name dev-ecoscan-trash-bins \
    --item '{
        "binId": {"S": "00000000-0000-0000-0000-000000000001"},
        "Name": {"S": "Default Bin"},
        "Status": {"N": "0"},
        "LastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "ReportsCount": {"N": "0"}
    }'

echo "Default data seeded successfully!"
