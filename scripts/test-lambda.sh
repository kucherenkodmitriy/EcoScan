#!/bin/bash

set -e

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=eu-central-1

# Go to workspace root for Docker build
cd "$(dirname "$0")/../services"

echo "Building Lambda binary using Docker cross-compilation (from workspace root)..."
docker run --rm -v "$PWD":/code -w /code messense/rust-musl-cross:x86_64-musl \
    cargo build --release --target x86_64-unknown-linux-musl -p bin-status-reporter

# Copy the binary to the expected location for zipping
cp target/x86_64-unknown-linux-musl/release/bootstrap bin-status-reporter/target/lambda/bootstrap
cd bin-status-reporter/target/lambda
zip lambda.zip bootstrap
cd ../../../../

# Delete old function
aws --endpoint-url=http://localhost:4566 lambda delete-function \
    --function-name dev-EcoScanUpdateBinStatus || true

echo "Creating Lambda function..."
aws --endpoint-url=http://localhost:4566 lambda create-function \
    --function-name dev-EcoScanUpdateBinStatus \
    --runtime provided.al2 \
    --handler bootstrap \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --zip-file fileb://services/bin-status-reporter/target/lambda/lambda.zip

echo "Updating function environment..."
aws --endpoint-url=http://localhost:4566 lambda update-function-configuration \
    --function-name dev-EcoScanUpdateBinStatus \
    --environment '{"Variables":{"TRASH_BINS_TABLE":"dev-ecoscan-bin-status","STATUS_REPORTS_TABLE":"dev-ecoscan-bin-status-reports","LOG_LEVEL":"INFO","DYNAMODB_ENDPOINT_URL":"http://localhost:4566"}}'

# Confirm envs
aws --endpoint-url=http://localhost:4566 lambda get-function-configuration \
    --function-name dev-EcoScanUpdateBinStatus

echo "Invoking Lambda function..."
aws --endpoint-url=http://localhost:4566 lambda invoke \
    --function-name dev-EcoScanUpdateBinStatus \
    --payload fileb://services/bin-status-reporter/test-events/api-gateway-request.json \
    --cli-binary-format raw-in-base64-out \
    --log-type Tail \
    output.json

echo "Lambda execution result:"
cat output.json

echo -e "\nChecking status reports table:"
aws --endpoint-url=http://localhost:4566 dynamodb scan \
    --table-name dev-ecoscan-bin-status-reports

echo -e "\nChecking trash bins table:"
aws --endpoint-url=http://localhost:4566 dynamodb get-item \
    --table-name dev-ecoscan-bin-status \
    --key '{"BinId": {"S": "default-bin"}}'
