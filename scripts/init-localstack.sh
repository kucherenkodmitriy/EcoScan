#!/bin/bash

# Set AWS credentials for local testing
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}

# Set environment
ENVIRONMENT=${ENVIRONMENT:-dev}

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

# Create TrashBinsTable
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name ${ENVIRONMENT}-ecoscan-bin-status \
    --attribute-definitions \
        AttributeName=BinId,AttributeType=S \
    --key-schema \
        AttributeName=BinId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

# Create StatusReportsTable
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name ${ENVIRONMENT}-ecoscan-bin-status-reports \
    --attribute-definitions \
        AttributeName=BinId,AttributeType=S \
        AttributeName=CreatedAt,AttributeType=S \
    --key-schema \
        AttributeName=BinId,KeyType=HASH \
        AttributeName=CreatedAt,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST

# Create LocationTable
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name ${ENVIRONMENT}-ecoscan-location \
    --attribute-definitions \
        AttributeName=LocationId,AttributeType=S \
    --key-schema \
        AttributeName=LocationId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

# Create QRCodeTable
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name ${ENVIRONMENT}-ecoscan-qrcode \
    --attribute-definitions \
        AttributeName=QRCodeId,AttributeType=S \
    --key-schema \
        AttributeName=QRCodeId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

# Create default trash bin
echo "Creating default trash bin..."
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
    --table-name ${ENVIRONMENT}-ecoscan-bin-status \
    --item '{
        "BinId": {"S": "default-bin"},
        "Name": {"S": "Default Bin"},
        "Status": {"N": "0"},
        "LastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "ReportsCount": {"N": "0"}
    }'

echo "Tables and default bin created successfully!" 