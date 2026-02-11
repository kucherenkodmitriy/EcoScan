# EcoScan Testing Guide

This guide covers manual testing steps, E2E testing, and validation procedures for the EcoScan system.

## Overview

EcoScan has multiple layers of tests:
- **Unit Tests** - Test individual Rust functions and modules (`cargo test`)
- **Integration Tests** - Test DynamoDB repository layer
- **Smoke Tests** - Quick validation after deployment (`./scripts/smoke-test.sh`)
- **E2E Tests** - Full end-to-end flow testing (`./scripts/run-e2e-tests.sh`)
- **Frontend Tests** - React component and integration tests (`npm test`)

**Tested Components:**
- Bin status updates (IoT/QR reporting)
- Admin authentication (login, forgot/reset password)
- API keys management (create, list, update, delete)
- Webhooks (create, list, update, delete, delivery)
- CSV data export
- Map integration and route planning
- Multi-language support

For CI/CD testing automation, see [Testing Automation Guide](docs/TESTING_AUTOMATION.md).

---

## Manual Testing Steps (Run on Your Local Machine)

Since Docker is not available in this environment, please run these commands on your local machine where Docker is installed:

### Step 1: Build the Lambda Function

```bash
cd /home/dmytro/RustroverProjects/EcoScan

# Build Lambda (requires Docker)
./scripts/build-lambda.sh

# Verify the build
ls -lh services/target/lambda.zip
```

**Expected Output:**
```
services/target/lambda.zip (should be ~8-15 MB)
```

---

### Step 2: Deploy to LocalStack

```bash
# Start LocalStack and deploy all layers
./infrastructure/scripts/init-environment.sh local
```

**What This Does:**
1. Starts LocalStack containers (if not running)
2. Waits for LocalStack to be healthy
3. Deploys 4 infrastructure layers in order:
   - 00-foundation (S3 buckets)
   - 01-data (DynamoDB tables)
   - 03-api (API Gateway + SQS + **new security features**)
   - 02-compute (Lambda function)
4. Seeds test data
5. Outputs API Gateway URL

**Expected Output:**
```
=== Infrastructure deployment complete! ===
Environment: local
API Gateway URL: http://localhost:4566/restapis/{api-id}/local/_user_request_
```

**Save the API Gateway ID from the output!**

---

### Step 3: Run E2E Tests

```bash
# Run end-to-end tests
./scripts/run-e2e-tests.sh

# Or use Make
make test-e2e
```

**What This Tests:**
1. API Gateway accepts valid POST requests
2. Request validation works (rejects invalid status values)
3. Messages are queued in SQS
4. Lambda processes messages from SQS
5. DynamoDB tables are updated correctly
6. Weighted average calculation works

**Expected Output:**
```bash
✅ Posting status update... OK
✅ Verifying DynamoDB data... OK
All tests passed!
```

---

### Step 4: Test Rate Limiting

Open a new terminal and test the rate limiting:

```bash
# Get the API Gateway ID from Step 2
export API_GATEWAY_ID="<your-api-id>"
export BIN_ID="550e8400-e29b-41d4-a716-446655440000"

# Single request (should succeed)
curl -X POST \
  "http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 75}'

# Expected response:
# {"message": "Status update queued for processing"}
```

**Test Request Validation** (should fail with 400):
```bash
# Invalid status (out of range)
curl -X POST \
  "http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 150}'

# Expected: 400 Bad Request (validation error)

# Missing required field
curl -X POST \
  "http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 Bad Request (missing status field)
```

**Test Rate Limiting** (spam test):
```bash
# Send 150 requests rapidly (exceeds 100 req/sec limit for local)
for i in {1..150}; do
  curl -s -X POST \
    "http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_/bins/${BIN_ID}/status" \
    -H "Content-Type: application/json" \
    -d "{\"status\": $((RANDOM % 100))}" &
done
wait

# Expected: Some requests will receive 429 Too Many Requests
```

---

### Step 5: Validate Data in DynamoDB

#### Check Trash Bins Table (Current Status):

```bash
# Using AWS CLI with LocalStack
aws dynamodb scan \
  --table-name local-ecoscan-trash-bins \
  --endpoint-url http://localhost:4566 \
  --region eu-central-1

# Or use LocalStack's awslocal wrapper
awslocal dynamodb scan --table-name local-ecoscan-trash-bins
```

**Expected Fields:**
```json
{
  "Items": [
    {
      "binId": {"S": "550e8400-e29b-41d4-a716-446655440000"},
      "Name": {"S": "Test Bin"},
      "status": {"N": "67"},  // ← Weighted average of recent reports
      "lastUpdated": {"S": "2026-01-05T..."},
      "reportsCount": {"N": "10"}
    }
  ]
}
```

#### Check Status Reports Table (Historical Data):

```bash
aws dynamodb query \
  --table-name local-ecoscan-status-reports \
  --key-condition-expression "binId = :bin_id" \
  --expression-attribute-values '{":bin_id":{"S":"550e8400-e29b-41d4-a716-446655440000"}}' \
  --endpoint-url http://localhost:4566 \
  --region eu-central-1 \
  --scan-index-forward false \
  --limit 10
```

**Expected:** Returns up to 10 most recent status reports ordered by timestamp (descending).

#### Verify Weighted Average Calculation:

```bash
# Example: If recent reports are [80, 70, 60] (newest to oldest)
# Weighted calculation:
#   weighted_sum = 80*3 + 70*2 + 60*1 = 240 + 140 + 60 = 440
#   weight_sum   = 3 + 2 + 1 = 6
#   average      = 440 / 6 = 73.33 ≈ 73

# The "status" field in trash-bins table should reflect this weighted average
```

---

### Step 6: Check SQS Queues

```bash
# Check queue depth (number of messages waiting)
aws sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/local-ecoscan-status-updates \
  --attribute-names ApproximateNumberOfMessages \
  --endpoint-url http://localhost:4566

# Check Dead Letter Queue (failed messages)
aws sqs receive-message \
  --queue-url http://localhost:4566/000000000000/local-ecoscan-status-updates-dlq \
  --endpoint-url http://localhost:4566
```

**Expected:** Queue should be empty or near-empty (messages processed quickly).

---

### Step 7: Monitor CloudWatch Logs

```bash
# API Gateway access logs
awslocal logs tail /aws/apigateway/local-ecoscan --follow

# Lambda execution logs
awslocal logs tail /aws/lambda/local-ecoscan-bin-status-reporter --follow
```

**Look For:**
- Request IDs, source IPs, response times
- Status codes (200 = success, 400 = validation error, 429 = rate limited)
- Lambda invocation logs showing batch processing
- Any errors or exceptions

---

## 📊 What to Validate

### 1. **Weighted Average Works Correctly**

Send multiple status updates and verify the calculation:

```bash
BIN_ID="550e8400-e29b-41d4-a716-446655440000"
API_URL="http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_"

# Send 5 status updates
for status in 100 90 80 70 60; do
  curl -X POST "${API_URL}/bins/${BIN_ID}/status" \
    -H "Content-Type: application/json" \
    -d "{\"status\": ${status}}"
  sleep 2  # Wait for Lambda processing
done

# Check the final weighted average in DynamoDB
awslocal dynamodb get-item \
  --table-name local-ecoscan-trash-bins \
  --key '{"binId":{"S":"550e8400-e29b-41d4-a716-446655440000"}}'

# Expected status calculation:
# Reports (newest to oldest): [60, 70, 80, 90, 100]
# Weighted: (60*5 + 70*4 + 80*3 + 90*2 + 100*1) / (5+4+3+2+1)
#         = (300 + 280 + 240 + 180 + 100) / 15
#         = 1100 / 15 = 73.33 ≈ 73
```

### 2. **Rate Limiting Prevents Spam**

```bash
# Rapid fire test (should trigger throttling)
time for i in {1..200}; do
  curl -s -X POST "${API_URL}/bins/${BIN_ID}/status" \
    -H "Content-Type: application/json" \
    -d '{"status": 50}' > /dev/null &
done
wait

# Expected: Some requests receive 429 Too Many Requests
# Check CloudWatch logs to see throttling in action
```

### 3. **Request Validation Blocks Invalid Input**

```bash
# Test cases that should fail with 400 Bad Request:

# 1. Status out of range (negative)
curl -v -X POST "${API_URL}/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": -10}'

# 2. Status out of range (too high)
curl -v -X POST "${API_URL}/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 150}'

# 3. Missing status field
curl -v -X POST "${API_URL}/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Wrong data type
curl -v -X POST "${API_URL}/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "full"}'

# All should return 400 with validation error message
```

### 4. **SQS Integration Works End-to-End**

1. **POST request** → API Gateway returns 200 immediately
2. **Check SQS queue** → Message is queued
3. **Wait 5 seconds** → Lambda processes message
4. **Check DynamoDB** → Tables updated correctly
5. **Check DLQ** → No messages (all succeeded)

---

## 🚀 Performance Benchmarks

### LocalStack Configuration:
- **Rate Limit:** 100 requests/second
- **Burst Capacity:** 50 requests
- **Daily Quota:** 10,000 requests
- **Lambda Batch Size:** 10 messages
- **Lambda Concurrency:** 5

### AWS Dev Configuration:
- **Rate Limit:** 1,000 requests/second
- **Burst Capacity:** 500 requests
- **Daily Quota:** 100,000 requests
- **Lambda Batch Size:** 10 messages
- **Lambda Concurrency:** 100

---

## 🐛 Troubleshooting

### Issue: API Gateway returns 500 Internal Server Error

**Check:**
```bash
# Verify SQS queue exists
awslocal sqs list-queues

# Check IAM role permissions
awslocal iam get-role --role-name local-ecoscan-apigateway-sqs-role

# View API Gateway logs
awslocal logs tail /aws/apigateway/local-ecoscan --follow
```

### Issue: Lambda not processing messages

**Check:**
```bash
# Verify Lambda function exists
awslocal lambda get-function --function-name local-ecoscan-bin-status-reporter

# Check event source mapping (SQS → Lambda)
awslocal lambda list-event-source-mappings \
  --function-name local-ecoscan-bin-status-reporter

# View Lambda logs
awslocal logs tail /aws/lambda/local-ecoscan-bin-status-reporter --follow
```

### Issue: DynamoDB not updating

**Check:**
```bash
# Verify tables exist
awslocal dynamodb list-tables

# Check Lambda IAM permissions
awslocal iam list-attached-role-policies \
  --role-name local-ecoscan-lambda-role

# Check for errors in DLQ
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/local-ecoscan-status-updates-dlq
```

---

## Quick Start

```bash
# 1. Build Lambda
./scripts/build-lambda.sh

# 2. Deploy to LocalStack
./infrastructure/scripts/init-environment.sh local

# 3. Run E2E tests
./scripts/run-e2e-tests.sh

# 4. Deploy to AWS Dev (after local testing passes)
./infrastructure/scripts/init-environment.sh dev
```

**Expected results when everything works:**
- API Gateway accepts valid requests (200)
- API Gateway rejects invalid requests (400)
- API Gateway throttles excessive requests (429)
- SQS queues messages correctly
- Lambda processes messages in batches
- DynamoDB shows weighted average calculation
- CloudWatch logs show request details
- No messages in Dead Letter Queue

---

## Testing New Features

### API Keys Management

```bash
# Login to get JWT token
TOKEN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ecoscan.local","password":"admin123"}' | jq -r '.token')

# Create API key
API_KEY_RESPONSE=$(curl -s -X POST "${BASE_URL}/admin/api-keys" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Integration","scopes":["bins:read"]}')

echo "$API_KEY_RESPONSE" | jq

# Extract API key
API_KEY=$(echo "$API_KEY_RESPONSE" | jq -r '.apiKey')

# Use API key to list bins (external API)
curl "${BASE_URL}/api/external/bins" -H "X-API-Key: ${API_KEY}"

# List all API keys
curl "${BASE_URL}/admin/api-keys" -H "Authorization: Bearer ${TOKEN}"

# Delete API key
KEY_ID=$(echo "$API_KEY_RESPONSE" | jq -r '.keyId')
curl -X DELETE "${BASE_URL}/admin/api-keys/${KEY_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Webhooks

```bash
# Create webhook
WEBHOOK_RESPONSE=$(curl -s -X POST "${BASE_URL}/admin/webhooks" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/your-unique-url",
    "eventTypes": ["bin.status.changed"],
    "authType": "bearer",
    "authValue": "test_secret",
    "isActive": true
  }')

echo "$WEBHOOK_RESPONSE" | jq

# List webhooks
curl "${BASE_URL}/admin/webhooks" -H "Authorization: Bearer ${TOKEN}"

# Trigger webhook by updating bin status
curl -X POST "${BASE_URL}/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 85}'

# Wait a few seconds, then check webhook delivery stats
WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.webhookId')
curl "${BASE_URL}/admin/webhooks/${WEBHOOK_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Password Reset Flow

```bash
# Request password reset
curl -X POST "${BASE_URL}/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ecoscan.local"}'
# Response: {"message":"If an account with that email exists..."}

# Check DynamoDB for reset token (for testing only)
awslocal dynamodb get-item \
  --table-name local-ecoscan-admin-users \
  --key '{"email":{"S":"admin@ecoscan.local"}}' \
  | jq '.Item | {resetToken, resetTokenExpiry}'

# In production, user would receive email with reset link
# Reset password with token (token from email/DynamoDB)
RESET_TOKEN="..." # from email or DynamoDB
curl -X POST "${BASE_URL}/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@ecoscan.local",
    "token":"'"$RESET_TOKEN"'",
    "newPassword":"newpassword123"
  }'

# Try logging in with new password
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ecoscan.local","password":"newpassword123"}'
```

### Contact Form

```bash
# Submit contact form (requires reCAPTCHA token in production)
curl -X POST "${BASE_URL}/api/contact" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "organization": "Test Org",
    "message": "Testing contact form",
    "recaptchaToken": "test_token_local",
    "requestType": "contact"
  }'

# Check submissions in DynamoDB
awslocal dynamodb scan \
  --table-name local-ecoscan-demo-requests \
  | jq '.Items[] | {name: .name.S, email: .email.S, requestType: .requestType.S}'
```

### Frontend Features

**Map View:**
1. Navigate to Dashboard
2. Toggle "Map View" button
3. Verify bins appear as markers with correct colors
4. Click "Create Route" and select multiple bins
5. Verify route appears on map

**QR Printing:**
1. Navigate to `/qr-print`
2. Apply filters (type, status, active)
3. Select multiple bins
4. Click "Print" and verify print layout

**Multi-Language:**
1. Click language selector (top right)
2. Switch between EN, CS, DE
3. Verify all UI text updates
4. Verify URL parameter updates

**Data Export:**
1. Navigate to Settings > Data Export
2. Click "Download CSV"
3. Verify CSV file downloads with timestamp
4. Open CSV and verify all columns present

---

## Related Documentation

- [Infrastructure README](infrastructure/README.md) - Deployment guide
- [Testing Automation](docs/TESTING_AUTOMATION.md) - CI/CD testing
- [Architecture](docs/ARCHITECTURE.md) - System design
- [Distributed Tracing Guide](DISTRIBUTED_TRACING_GUIDE.md) - Observability
