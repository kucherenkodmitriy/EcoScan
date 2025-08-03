#!/bin/bash
# This script automates the process of running end-to-end tests against LocalStack.

set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Project root: $PROJECT_ROOT"

# --- 1. Start LocalStack ---
echo "--- Starting LocalStack environment ---"
cd "$PROJECT_ROOT"
docker-compose up -d

# --- 2. Initialize LocalStack ---
echo "--- Initializing LocalStack resources ---"
# The init script already waits for LocalStack to be ready
INIT_OUTPUT=$("$PROJECT_ROOT/scripts/init-localstack.sh")
echo "$INIT_OUTPUT"

# Export the API Gateway endpoint for the E2E test
export API_ENDPOINT=$(echo "$INIT_OUTPUT" | grep 'API Gateway URL:' | awk '{print $4}')
if [ -z "$API_ENDPOINT" ]; then
    echo "Error: API_ENDPOINT could not be determined."
    exit 1
fi
echo "API Gateway Endpoint for testing: $API_ENDPOINT"

# --- 3. Run E2E Integration Test ---
echo "--- Running End-to-End Integration Test ---"
cd "$PROJECT_ROOT/services"
cargo test --test localstack_test -- --nocapture

echo -e "\n\xE2\x9C\x85 E2E tests completed successfully!"
