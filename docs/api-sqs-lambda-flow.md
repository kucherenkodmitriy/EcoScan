# API Gateway → SQS → Lambda Flow Verification

## Architecture Overview

```
Client Request
    ↓
API Gateway (POST /bins/{bin_id}/status)
    ↓ (transforms request)
SQS Queue (local-ecoscan-status-updates)
    ↓ (event source mapping)
Lambda Function (local-ecoscan-update-bin-status)
    ↓
DynamoDB (local-ecoscan-trash-bins)
```

## Message Flow

### 1. Client Request
```http
POST /bins/{bin_id}/status
Content-Type: application/json

{
  "status": 75
}
```

### 2. API Gateway Integration

The API Gateway integration template transforms the request:

```velocity
Action=SendMessage&MessageBody={
  "binId": "$util.urlEncode($input.params('bin_id'))",
  "status": $input.json('$.status')
}
```

**Result:**
- Extracts `bin_id` from the URL path parameter
- Extracts `status` from the JSON body
- Combines them into a single JSON message
- Sends to SQS queue

**Response to Client:**
```json
{
  "message": "Status update queued for processing"
}
```

### 3. SQS Message Format

The message sent to SQS:
```json
{
  "binId": "00000000-0000-0000-0000-000000000001",
  "status": 75
}
```

### 4. Lambda Event Source Mapping

Configuration in `infrastructure/layers/02-compute/lambda.tf`:
```terraform
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn                = local.sqs_queue_arn
  function_name                   = aws_lambda_function.update_bin_status.arn
  batch_size                      = 10
  maximum_batching_window_in_seconds = 0
  function_response_types         = ["ReportBatchItemFailures"]
  enabled                         = true
}
```

### 5. Lambda Handler

The Lambda function (`sqs_handler`) processes SQS events:

```rust
pub async fn sqs_handler(
    event: LambdaEvent<SqsEvent>,
) -> Result<SqsBatchResponse, Error>
```

**Processing:**
1. Receives batch of SQS messages
2. Parses each message body as `SqsMessageBody`
3. Validates `binId` and `status`
4. Updates DynamoDB
5. Returns batch response with any failures

**Message Structure:**
```rust
struct SqsMessageBody {
    #[serde(rename = "binId")]
    bin_id: String,
    status: i32,
}
```

## Verification Tests

### Test 1: API Gateway Response
✅ API Gateway returns immediately with queued confirmation
✅ Response time < 2 seconds (async processing)

### Test 2: Message Format
✅ API Gateway correctly extracts `binId` from path
✅ API Gateway correctly includes `status` from body
✅ Message format matches Lambda expectations

Sample test event available at: `services/bin-status-reporter/test-events/sqs-event.json`

### Test 3: Error Handling
✅ Lambda reports batch item failures for invalid messages
✅ Failed messages go to Dead Letter Queue after retries

## Benefits of This Architecture

1. **Decoupling**: API Gateway and Lambda can scale independently
2. **Resilience**: Messages aren't lost if Lambda is unavailable
3. **Cost-Effective**: Failed processing retries without re-invoking API Gateway
4. **Performance**: API Gateway returns immediately, processing is async
5. **Observability**: SQS metrics show queue depth and processing rate

## LocalStack Testing

All components work correctly with LocalStack:
- ✅ API Gateway integration with SQS
- ✅ SQS queue message delivery
- ✅ Lambda event source mapping
- ✅ DynamoDB updates

## E2E Test Results

```
running 3 tests
test test_update_bin_status_e2e ... ok
test test_api_gateway_returns_immediately ... ok
test test_full_async_flow ... ok

test result: ok. 3 passed; 0 failed
```

All tests verify:
1. API Gateway accepts requests and returns queued confirmation
2. Messages are properly formatted with binId and status
3. Async processing works end-to-end

