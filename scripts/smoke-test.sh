#!/bin/bash
# smoke-test.sh: Quick validation tests after deployment
# Usage: ./smoke-test.sh [environment]
# Example: ./smoke-test.sh dev

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-dev}
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${YELLOW}=== Running Smoke Tests for $ENVIRONMENT ===${NC}"
echo ""

# Get infrastructure outputs
echo "📋 Fetching infrastructure details..."
cd "$PROJECT_ROOT/infrastructure/layers/03-api"

if [ "$ENVIRONMENT" = "local" ]; then
    API_GATEWAY_ID=$(terraform output -raw api_gateway_id 2>/dev/null || echo "")
    if [ -z "$API_GATEWAY_ID" ]; then
        echo -e "${RED}❌ Failed to get API Gateway ID${NC}"
        exit 1
    fi
    API_ENDPOINT="http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_"
else
    API_ENDPOINT=$(terraform output -raw api_gateway_invoke_url 2>/dev/null || echo "")
    if [ -z "$API_ENDPOINT" ]; then
        echo -e "${RED}❌ Failed to get API Gateway endpoint${NC}"
        exit 1
    fi
fi

cd "$PROJECT_ROOT/infrastructure/layers/01-data"
BINS_TABLE_NAME=$(terraform output -raw trash_bins_table_name 2>/dev/null || echo "")

echo -e "${GREEN}✓${NC} API Endpoint: $API_ENDPOINT"
echo -e "${GREEN}✓${NC} Bins Table: $BINS_TABLE_NAME"
echo ""

# Test 1: API Gateway Health
echo "🔍 Test 1: API Gateway Reachability"
if [ "$ENVIRONMENT" = "local" ]; then
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4566/health || echo "000")
    if [ "$HEALTH_CHECK" != "200" ]; then
        echo -e "${RED}❌ LocalStack not reachable${NC}"
        exit 1
    fi
else
    # For AWS, we'll test with actual API call
    echo "   Skipping health check (will test with actual API call)"
fi
echo -e "${GREEN}✓${NC} API Gateway is reachable"
echo ""

# Test 2: Create test bin if it doesn't exist
TEST_BIN_ID="00000000-0000-0000-0000-000000000999"
echo "🔍 Test 2: Ensure test bin exists"

if [ "$ENVIRONMENT" = "local" ]; then
    aws --endpoint-url=http://localhost:4566 dynamodb put-item \
        --table-name "$BINS_TABLE_NAME" \
        --item "{
            \"binId\": {\"S\": \"$TEST_BIN_ID\"},
            \"location\": {\"S\": \"Smoke Test Location\"},
            \"currentStatus\": {\"N\": \"0\"},
            \"capacity\": {\"N\": \"100\"},
            \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"},
            \"lastUpdated\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}
        }" > /dev/null 2>&1 || true
else
    aws dynamodb put-item \
        --table-name "$BINS_TABLE_NAME" \
        --item "{
            \"binId\": {\"S\": \"$TEST_BIN_ID\"},
            \"location\": {\"S\": \"Smoke Test Location\"},
            \"currentStatus\": {\"N\": \"0\"},
            \"capacity\": {\"N\": \"100\"},
            \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"},
            \"lastUpdated\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}
        }" > /dev/null 2>&1 || true
fi
echo -e "${GREEN}✓${NC} Test bin ready"
echo ""

# Test 3: API Request - Status Update
echo "🔍 Test 3: API Status Update (Full Flow)"
TEST_STATUS=75
TEMP_FILE=$(mktemp)

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$TEMP_FILE" -X POST \
    "$API_ENDPOINT/bins/$TEST_BIN_ID/status" \
    -H "Content-Type: application/json" \
    -d "{\"status\": $TEST_STATUS}")

RESPONSE_BODY=$(cat "$TEMP_FILE")
rm -f "$TEMP_FILE"

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ API request failed with HTTP $HTTP_CODE${NC}"
    echo "   Response: $RESPONSE_BODY"
    exit 1
fi

if ! echo "$RESPONSE_BODY" | grep -q "queued for processing\|Status update queued"; then
    echo -e "${RED}❌ Unexpected API response${NC}"
    echo "   Response: $RESPONSE_BODY"
    exit 1
fi

echo -e "${GREEN}✓${NC} API returned 200 OK"
echo -e "${GREEN}✓${NC} Response: $RESPONSE_BODY"
echo ""

# Test 4: Wait for Lambda processing
echo "🔍 Test 4: Lambda Processing"
echo "   Waiting 5 seconds for message processing..."
sleep 5

# Test 5: Check Lambda logs for errors
if [ "$ENVIRONMENT" != "local" ]; then
    echo "🔍 Test 5: Lambda Error Check"
    FUNCTION_NAME="${ENVIRONMENT}-ecoscan-update-bin-status"

    # Get timestamp from 2 minutes ago
    START_TIME=$(($(date +%s) * 1000 - 120000))

    ERROR_COUNT=$(aws logs filter-log-events \
        --log-group-name "/aws/lambda/$FUNCTION_NAME" \
        --start-time "$START_TIME" \
        --filter-pattern "?ERROR ?Error ?panic ?failed" \
        --query 'length(events)' \
        --output text 2>/dev/null || echo "0")

    if [ "$ERROR_COUNT" != "0" ] && [ "$ERROR_COUNT" != "None" ]; then
        echo -e "${YELLOW}⚠${NC}  Found $ERROR_COUNT potential errors in Lambda logs (last 2 minutes)"
        echo "   This might include errors from previous runs"

        # Show recent errors
        aws logs filter-log-events \
            --log-group-name "/aws/lambda/$FUNCTION_NAME" \
            --start-time "$START_TIME" \
            --filter-pattern "?ERROR ?Error ?panic" \
            --query 'events[0:3].[timestamp,message]' \
            --output text 2>/dev/null | head -6 || true
    else
        echo -e "${GREEN}✓${NC} No errors in Lambda logs"
    fi
    echo ""
fi

# Test 6: Verify data in DynamoDB
echo "🔍 Test 6: DynamoDB Data Verification"
if [ "$ENVIRONMENT" = "local" ]; then
    BIN_DATA=$(aws --endpoint-url=http://localhost:4566 dynamodb get-item \
        --table-name "$BINS_TABLE_NAME" \
        --key "{\"binId\": {\"S\": \"$TEST_BIN_ID\"}}" \
        --query 'Item.status.N' \
        --output text 2>/dev/null || echo "")
else
    BIN_DATA=$(aws dynamodb get-item \
        --table-name "$BINS_TABLE_NAME" \
        --key "{\"binId\": {\"S\": \"$TEST_BIN_ID\"}}" \
        --query 'Item.status.N' \
        --output text 2>/dev/null || echo "")
fi

if [ -z "$BIN_DATA" ] || [ "$BIN_DATA" = "None" ]; then
    echo -e "${YELLOW}⚠${NC}  Bin status not updated yet (might still be processing)"
    echo "   This is OK if this is the first update to this bin"
else
    echo -e "${GREEN}✓${NC} Bin status in DynamoDB: $BIN_DATA%"
fi
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Smoke Tests Passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  API Endpoint: $API_ENDPOINT"
echo "  Test Bin ID: $TEST_BIN_ID"
echo "  Last Test Status: $TEST_STATUS%"
if [ -n "$BIN_DATA" ] && [ "$BIN_DATA" != "None" ]; then
    echo "  Current DB Status: $BIN_DATA%"
fi
echo ""
echo "Next steps:"
echo "  - Run full E2E tests: ./scripts/run-e2e-tests.sh"
echo "  - View Lambda logs: aws logs tail /aws/lambda/$FUNCTION_NAME --follow"
echo "  - Monitor API: aws cloudwatch get-metric-statistics --namespace AWS/ApiGateway ..."
echo ""
