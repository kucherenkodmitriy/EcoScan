#!/bin/bash
# This script automates the process of running end-to-end tests against LocalStack.

set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- 1. Initialize Environment with Terraform ---
echo "--- Initializing LocalStack environment with Terraform ---"
# The init script now handles Docker, building, Terraform, and seeding.
# We capture the output to get the API endpoint.
INIT_OUTPUT=$("$PROJECT_ROOT/scripts/init-terraform.sh")
echo "$INIT_OUTPUT"

# --- 2. Export API Endpoint for Tests ---
echo "--- Exporting API Gateway Endpoint for E2E tests ---"
# After `init-terraform.sh` runs, the infrastructure is up.
# We need to get the API Gateway ID to construct the correct local URL.
cd "$PROJECT_ROOT/infrastructure"
API_GATEWAY_ID=$(terraform output -raw api_gateway_id)

# Construct the correct LocalStack endpoint URL, including the special _user_request_ path
export API_ENDPOINT="http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_"
if [ -z "$API_ENDPOINT" ]; then
    echo "Error: API_ENDPOINT could not be determined from the init script output."
    exit 1
fi
echo "API Gateway Endpoint for testing: $API_ENDPOINT"

# --- 3. Run E2E Integration Test ---
echo "--- Running End-to-End Integration Test ---"
cd "$PROJECT_ROOT/services/e2e-tests"
# The test now uses the API_ENDPOINT environment variable
if ! cargo test -- --nocapture; then
    echo "--- E2E test failed. Fetching Lambda logs from LocalStack... ---"
    LOG_GROUP_NAME="/aws/lambda/local-ecoscan-update-bin-status"

    # Give logs a moment to propagate
    sleep 5

    # Get the latest log stream, using the localstack profile
    LATEST_LOG_STREAM=$(aws --profile localstack --endpoint-url=http://localhost:4566 logs describe-log-streams --log-group-name "$LOG_GROUP_NAME" --order-by LastEventTime --descending --limit 1 --query 'logStreams[0].logStreamName' --output text)

    if [ "$LATEST_LOG_STREAM" != "None" ] && [ -n "$LATEST_LOG_STREAM" ]; then
        echo "--- Logs from stream: $LATEST_LOG_STREAM ---"
        aws --profile localstack --endpoint-url=http://localhost:4566 logs get-log-events --log-group-name "$LOG_GROUP_NAME" --log-stream-name "$LATEST_LOG_STREAM" --query 'events[*].message' --output text
    else
        echo "Could not find any log streams for the Lambda function."
    fi
    exit 1
fi

echo -e "\n\xE2\x9C\x85 E2E tests completed successfully!"
