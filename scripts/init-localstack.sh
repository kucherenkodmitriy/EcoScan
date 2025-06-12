#!/bin/bash

# Set AWS credentials for local testing
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=eu-central-1

# Create S3 bucket for health checks if it doesn't exist
echo "Checking S3 bucket for health checks..."
if ! aws --endpoint-url=http://localhost:4566 s3 ls s3://health 2>&1 | grep -q "NoSuchBucket"; then
    echo "Bucket already exists"
else
    echo "Creating S3 bucket for health checks..."
    aws --endpoint-url=http://localhost:4566 s3 mb s3://health
fi

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
while ! curl -s http://localhost:4566/health | grep -q "<Name>health</Name>"; do
    sleep 1
done

# Create DynamoDB tables
echo "Creating DynamoDB tables..."

# Create trash bins table
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name trash-bins \
    --attribute-definitions \
        AttributeName=binId,AttributeType=S \
        AttributeName=status,AttributeType=N \
    --key-schema \
        AttributeName=binId,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"status-index\",
                \"KeySchema\": [
                    {\"AttributeName\":\"status\",\"KeyType\":\"HASH\"}
                ],
                \"Projection\": {
                    \"ProjectionType\":\"ALL\"
                },
                \"ProvisionedThroughput\": {
                    \"ReadCapacityUnits\": 5,
                    \"WriteCapacityUnits\": 5
                }
            }
        ]"

# Create status reports table
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name status-reports \
    --attribute-definitions \
        AttributeName=binId,AttributeType=S \
        AttributeName=createdAt,AttributeType=S \
    --key-schema \
        AttributeName=binId,KeyType=HASH \
        AttributeName=createdAt,KeyType=RANGE \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5

# Create default trash bin
echo "Creating default trash bin..."
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
    --table-name trash-bins \
    --item '{
        "binId": {"S": "default-bin"},
        "name": {"S": "Default Bin"},
        "status": {"N": "0"},
        "lastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "reportsCount": {"N": "0"}
    }'

echo "Tables and default bin created successfully!" 