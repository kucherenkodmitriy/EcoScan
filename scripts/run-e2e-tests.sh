#!/bin/bash
# run-e2e-tests.sh: Run E2E tests against deployed infrastructure

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVIRONMENT=${ENVIRONMENT:-local}

echo "=== Running E2E Tests ==="
echo "Environment: $ENVIRONMENT"

# For local environment, ensure infrastructure is deployed
if [[ "$ENVIRONMENT" == "local" ]]; then
    echo "--- Deploying local infrastructure ---"
    "$PROJECT_ROOT/infrastructure/scripts/init-environment.sh" local -auto-approve

    # Get API Gateway ID for LocalStack URL
    cd "$PROJECT_ROOT/infrastructure/layers/03-api"
    API_GATEWAY_ID=$(terraform output -raw api_gateway_id)

    # LocalStack uses special URL format
    export API_ENDPOINT="http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_"
else
    # For AWS environments, use standard invoke URL
    cd "$PROJECT_ROOT/infrastructure/layers/03-api"
    export API_ENDPOINT=$(terraform output -raw api_gateway_invoke_url)
fi

if [ -z "$API_ENDPOINT" ]; then
    echo "Error: API_ENDPOINT could not be determined"
    exit 1
fi

echo "API Gateway Endpoint: $API_ENDPOINT"

# Run E2E tests
echo "--- Running E2E Integration Tests ---"
cd "$PROJECT_ROOT/services/e2e-tests"

if ! cargo test -- --nocapture; then
    echo "--- E2E test failed. Fetching Lambda logs ---"

    if [[ "$ENVIRONMENT" == "local" ]]; then
        LOG_GROUP_NAME="/aws/lambda/local-ecoscan-update-bin-status"

        sleep 5

        LATEST_LOG_STREAM=$(aws --profile localstack --endpoint-url=http://localhost:4566 logs describe-log-streams --log-group-name "$LOG_GROUP_NAME" --order-by LastEventTime --descending --limit 1 --query 'logStreams[0].logStreamName' --output text)

        if [ "$LATEST_LOG_STREAM" != "None" ] && [ -n "$LATEST_LOG_STREAM" ]; then
            echo "--- Logs from stream: $LATEST_LOG_STREAM ---"
            aws --profile localstack --endpoint-url=http://localhost:4566 logs get-log-events --log-group-name "$LOG_GROUP_NAME" --log-stream-name "$LATEST_LOG_STREAM" --query 'events[*].message' --output text
        else
            echo "Could not find any log streams"
        fi
    else
        # For AWS environments, fetch Lambda logs
        LOG_GROUP_NAME="/aws/lambda/${ENVIRONMENT}-ecoscan-update-bin-status"

        sleep 5

        echo "--- Recent Lambda logs (last 2 minutes) ---"
        START_TIME=$(($(date +%s) * 1000 - 120000))

        aws logs tail "$LOG_GROUP_NAME" --since 2m --format short 2>/dev/null || \
            echo "Could not fetch Lambda logs. Check CloudWatch manually."
    fi
    exit 1
fi

echo ""
echo "✅ E2E tests completed successfully!"
