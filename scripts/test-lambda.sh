#!/bin/bash

# Set AWS credentials for local testing
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=eu-central-1

# Change to bin-status-reporter directory
cd "$(dirname "$0")/../services/bin-status-reporter" || exit

# Build the Lambda function
echo "Building Lambda function..."
cargo build --release

# Create the Lambda function in LocalStack
echo "Creating Lambda function..."
aws --endpoint-url=http://localhost:4566 lambda create-function \
    --function-name update-bin-status \
    --runtime provided.al2 \
    --handler bootstrap \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --zip-file fileb://target/lambda.zip

# Invoke the Lambda function with test event
echo "Invoking Lambda function..."
aws --endpoint-url=http://localhost:4566 lambda invoke \
    --function-name update-bin-status \
    --payload file://test-events/update-status-50-percent.json \
    --log-type Tail \
    output.json

# Display the result
echo "Lambda execution result:"
cat output.json

# Check the status reports table
echo -e "\nChecking status reports table:"
aws --endpoint-url=http://localhost:4566 dynamodb scan \
    --table-name status-reports

# Check the trash bins table
echo -e "\nChecking trash bins table:"
aws --endpoint-url=http://localhost:4566 dynamodb get-item \
    --table-name trash-bins \
    --key '{"binId": {"S": "default-bin"}}' 