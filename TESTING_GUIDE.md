# EcoScan Testing Guide

## ✅ Completed Tasks

### 1. **Created Fullness Calculation Module** (`services/bin-status-reporter/src/domain/fullness.rs`)
- Implements weighted average calculation for bin status
- More recent reports have higher weight (linear weighting)
- Default window size: 10 most recent reports
- Full test coverage (16 tests)

**Key Features:**
```rust
// Most recent report gets weight N, oldest gets weight 1
calculate_fullness_default(&reports) -> i32  // Returns 0-100
```

### 2. **Implemented get_recent_reports in DynamoDB Repository**
- Fetches N most recent status reports for a bin
- Ordered from newest to oldest
- Used by update_status to calculate weighted average
- Replaces simple moving average with more accurate calculation

### 3. **Added Comprehensive API Gateway Security**

#### Rate Limiting & Throttling:
- **Local (LocalStack):** 100 requests/sec, burst: 50, daily quota: 10,000
- **AWS Dev:** 1,000 requests/sec, burst: 500, daily quota: 100,000
- Prevents spam and abuse attacks

#### Request Validation:
- JSON Schema validation for request body
- Required field: `status` (integer, 0-100)
- Validates both body and parameters
- Returns 400 Bad Request for invalid inputs

#### Monitoring & Logging:
- CloudWatch access logs with detailed request info
- X-Ray tracing enabled for debugging
- Metrics collection for performance monitoring
- Error tracking and alerting

#### Files Modified:
- `infrastructure/layers/03-api/apigateway.tf`

**New Resources Added:**
```terraform
- aws_api_gateway_request_validator
- aws_api_gateway_model (JSON schema)
- aws_api_gateway_method_settings (throttling)
- aws_api_gateway_usage_plan
- aws_cloudwatch_log_group
```

### 4. **All Unit Tests Passing**
```bash
29 tests passed:
✅ Domain layer tests (BinStatus, fullness calculation)
✅ Application layer tests (handle_status_update)
✅ Request/Response serialization tests
```

---

## 🧪 Manual Testing Steps (Run on Your Local Machine)

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

## 📝 Summary of Changes

### Code Changes:
1. ✅ Added `services/bin-status-reporter/src/domain/fullness.rs` (271 lines, 16 tests)
2. ✅ Modified `src/infrastructure/dynamodb.rs` - Implemented weighted average calculation
3. ✅ Modified `src/domain/mod.rs` - Added fullness module exports
4. ✅ All unit tests passing (29 tests total)

### Infrastructure Changes:
1. ✅ Added rate limiting to API Gateway (100/1000 req/sec)
2. ✅ Added request validation with JSON schema
3. ✅ Added CloudWatch logging and X-Ray tracing
4. ✅ Added usage plan with daily quotas
5. ✅ Added method settings for throttling

### Security Features Added:
- ✅ Rate limiting (prevents spam)
- ✅ Request validation (prevents invalid data)
- ✅ CloudWatch logging (audit trail)
- ✅ X-Ray tracing (debugging)
- ✅ Throttling (burst protection)

---

## ✅ Next Steps

Run these commands on your local machine to complete the testing:

```bash
# 1. Build Lambda
./scripts/build-lambda.sh

# 2. Deploy to LocalStack
./infrastructure/scripts/init-environment.sh local

# 3. Run E2E tests
./scripts/run-e2e-tests.sh

# 4. Test rate limiting (manual)
# (Use curl commands from Step 4 above)

# 5. Validate DynamoDB data (manual)
# (Use aws CLI commands from Step 5 above)
```

**When everything works:**
- ✅ API Gateway accepts valid requests
- ✅ API Gateway rejects invalid requests (400)
- ✅ API Gateway throttles excessive requests (429)
- ✅ SQS queues messages correctly
- ✅ Lambda processes messages in batches
- ✅ DynamoDB shows weighted average calculation
- ✅ CloudWatch logs show request details
- ✅ No messages in Dead Letter Queue

Then you can deploy to AWS Dev:
```bash
./infrastructure/scripts/init-environment.sh dev
```

---

## 📚 Documentation

For more details, see:
- **Infrastructure README:** `infrastructure/README.md`
- **Project README:** `README.md`
- **Makefile:** Common development tasks
- **E2E Tests:** `services/e2e-tests/tests/bin_status_test.rs`
