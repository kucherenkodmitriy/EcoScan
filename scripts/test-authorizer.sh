#!/bin/bash
# Quick test script for authorizer and auth endpoint
# This script assumes infrastructure is already deployed

set -e

ENVIRONMENT=${1:-local}
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Testing Authorizer with Auth Endpoint ==="
echo "Environment: $ENVIRONMENT"
echo ""

# Get API Gateway endpoint
cd "$PROJECT_ROOT/infrastructure/layers/03-api"
if [ "$ENVIRONMENT" = "local" ]; then
    API_GATEWAY_ID=$(terraform output -raw api_gateway_id 2>/dev/null || echo "")
    if [ -z "$API_GATEWAY_ID" ]; then
        echo "Error: API Gateway not deployed. Please run: ./infrastructure/scripts/init-environment.sh local"
        exit 1
    fi
    API_ENDPOINT="http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_"
else
    API_ENDPOINT=$(terraform output -raw api_gateway_invoke_url 2>/dev/null || echo "")
    if [ -z "$API_ENDPOINT" ]; then
        echo "Error: API Gateway not deployed"
        exit 1
    fi
fi

echo "API Endpoint: $API_ENDPOINT"
echo ""

# Test 1: Login to get JWT token
echo "🔍 Test 1: Login to get JWT token"
LOGIN_RESPONSE=$(curl -s -X POST "${API_ENDPOINT}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@ecoscan.local", "password": "admin123"}')

echo "Response: $LOGIN_RESPONSE"

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty' 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Failed to get JWT token"
    echo "Full response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Got JWT token: ${TOKEN:0:50}..."
echo ""

# Test 2: Access protected endpoint with token
echo "🔍 Test 2: Access protected endpoint with JWT token"
PROTECTED_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "${API_ENDPOINT}/admin/bins" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$PROTECTED_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PROTECTED_RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP Code: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Protected endpoint returned $HTTP_CODE (expected 200)"
    exit 1
fi

echo "✅ Protected endpoint accessible with JWT token"
echo ""

# Test 3: Access protected endpoint without token (should fail)
echo "🔍 Test 3: Access protected endpoint without token (should fail)"
UNAUTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "${API_ENDPOINT}/admin/bins" \
    -H "Content-Type: application/json")

UNAUTH_HTTP_CODE=$(echo "$UNAUTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

echo "HTTP Code: $UNAUTH_HTTP_CODE"

if [ "$UNAUTH_HTTP_CODE" = "200" ]; then
    echo "❌ Unauthorized request succeeded (should have failed)"
    exit 1
fi

echo "✅ Unauthorized request correctly rejected"
echo ""

# Test 4: Access protected endpoint with invalid token (should fail)
echo "🔍 Test 4: Access protected endpoint with invalid token (should fail)"
INVALID_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "${API_ENDPOINT}/admin/bins" \
    -H "Authorization: Bearer invalid-token-12345" \
    -H "Content-Type: application/json")

INVALID_HTTP_CODE=$(echo "$INVALID_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

echo "HTTP Code: $INVALID_HTTP_CODE"

if [ "$INVALID_HTTP_CODE" = "200" ]; then
    echo "❌ Invalid token request succeeded (should have failed)"
    exit 1
fi

echo "✅ Invalid token correctly rejected"
echo ""

echo "=========================================="
echo "✅ All authorizer tests passed!"
echo "=========================================="
