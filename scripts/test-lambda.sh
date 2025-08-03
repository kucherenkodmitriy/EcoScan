#!/bin/bash

set -e

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=eu-central-1

# --- Configuration ---
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTION_NAME="dev-EcoScanUpdateBinStatus"
ZIP_PATH="$PROJECT_ROOT/services/target/lambda.zip"
TEST_EVENT_PATH="$PROJECT_ROOT/tests/events/update-status-success.json"
TRASH_BINS_TABLE="dev-ecoscan-trash-bins"
STATUS_REPORTS_TABLE="dev-ecoscan-status-reports"

# --- Deployment ---
echo "--- Deploying Lambda function to LocalStack ---"

# Delete old function if it exists
aws --endpoint-url=http://localhost:4566 lambda delete-function --function-name "$FUNCTION_NAME" >/dev/null 2>&1 || true

# Create new function
aws --endpoint-url=http://localhost:4566 lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime provided.al2 \
    --handler bootstrap \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --timeout 30 \
    --zip-file "fileb://$ZIP_PATH" \
    --environment "Variables={TRASH_BINS_TABLE=$TRASH_BINS_TABLE,STATUS_REPORTS_TABLE=$STATUS_REPORTS_TABLE,LOG_LEVEL=INFO,DYNAMODB_ENDPOINT_URL=http://localhost:4566}"

# --- Wait for function to be active ---
echo "--- Waiting for Lambda function to become active ---"
MAX_ATTEMPTS=15
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    STATE=$(aws --endpoint-url=http://localhost:4566 lambda get-function-configuration --function-name "$FUNCTION_NAME" --query 'State' --output text 2>/dev/null)
    if [ "$STATE" == "Active" ]; then
        echo "Function is active."
        break
    fi
    echo "Function state is '$STATE'. Waiting..."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$STATE" != "Active" ]; then
    echo "Error: Lambda function did not become active in time." >&2
    exit 1
fi

# --- Invocation ---
echo "--- Invoking Lambda function ---"
aws --endpoint-url=http://localhost:4566 lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --payload "file://$TEST_EVENT_PATH" \
    --cli-binary-format raw-in-base64-out \
    output.json

# --- Verification ---
echo "--- Verifying results ---"
echo "Lambda response:"
cat output.json | jq

echo "\nChecking status reports table..."
aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name "$STATUS_REPORTS_TABLE" | jq

echo "\nChecking trash bins table for updated status..."
aws --endpoint-url=http://localhost:4566 dynamodb get-item \
    --table-name "$TRASH_BINS_TABLE" \
    --key '{"binId": {"S": "default-bin"}}' | jq

echo "\n\xE2\x9C\x85 E2E test completed successfully!"
