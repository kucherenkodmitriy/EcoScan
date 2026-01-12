# Test Events

This directory contains sample Lambda event payloads for testing the bin-status-reporter function.

## Current Events (SQS-based)

### sqs-event.json
**Status**: ✅ **Active - Use this**

SQS event with a single message for testing the current SQS handler.

```json
{
  "Records": [{
    "body": "{\"binId\":\"00000000-0000-0000-0000-000000000001\",\"status\":90}"
  }]
}
```

**Usage:**
```bash
# Test Lambda locally with AWS CLI
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name local-ecoscan-update-bin-status \
  --payload file://services/bin-status-reporter/test-events/sqs-event.json \
  /tmp/output.json

# Or use SAM Local
sam local invoke UpdateBinStatusFunction \
  --event services/bin-status-reporter/test-events/sqs-event.json
```

## Legacy Events (Deprecated)

The following events were for the old API Gateway direct integration and are **no longer used** in the current SQS-based architecture:

### ❌ api-gateway-request.json (DEPRECATED)
Old API Gateway proxy request format. The system now uses SQS, so API Gateway doesn't directly invoke Lambda.

### ❌ direct-invocation.json (DEPRECATED)
Old format for direct Lambda invocation. Use `sqs-event.json` instead.

### ❌ update-status-*.json (DEPRECATED)
Old status update payloads. These were designed for direct invocation and don't include the SQS message wrapper.

## Migration Notes

If you have scripts or tests using the old events:

**Old (API Gateway direct):**
```bash
aws lambda invoke --payload file://test-events/api-gateway-request.json ...
```

**New (SQS-based):**
```bash
aws lambda invoke --payload file://services/bin-status-reporter/test-events/sqs-event.json ...
```

## Creating New Test Events

For SQS-based events, use this template:

```json
{
  "Records": [
    {
      "messageId": "test-message-id",
      "receiptHandle": "test-receipt-handle",
      "body": "{\"binId\":\"YOUR-UUID-HERE\",\"status\":75}",
      "attributes": {
        "ApproximateReceiveCount": "1",
        "SentTimestamp": "1673017200000"
      },
      "messageAttributes": {},
      "md5OfBody": "test-md5",
      "eventSource": "aws:sqs",
      "eventSourceARN": "arn:aws:sqs:eu-central-1:000000000000:local-ecoscan-status-updates",
      "awsRegion": "eu-central-1"
    }
  ]
}
```

## Testing Batch Processing

To test batch processing (multiple messages):

```json
{
  "Records": [
    {
      "body": "{\"binId\":\"00000000-0000-0000-0000-000000000001\",\"status\":50}",
      ...
    },
    {
      "body": "{\"binId\":\"00000000-0000-0000-0000-000000000002\",\"status\":75}",
      ...
    },
    {
      "body": "{\"binId\":\"00000000-0000-0000-0000-000000000003\",\"status\":90}",
      ...
    }
  ]
}
```

## Testing Error Scenarios

### Invalid UUID
```json
{
  "Records": [{
    "body": "{\"binId\":\"invalid-uuid\",\"status\":50}"
  }]
}
```

### Invalid Status (out of range)
```json
{
  "Records": [{
    "body": "{\"binId\":\"00000000-0000-0000-0000-000000000001\",\"status\":150}"
  }]
}
```

### Malformed JSON
```json
{
  "Records": [{
    "body": "{\"binId\":\"00000000-0000-0000-0000-000000000001\",\"status\":"
  }]
}
```

## See Also

- [Lambda Handler Documentation](../README.md)
- [E2E Tests](../../e2e-tests/tests/)
- [API Gateway → SQS → Lambda Flow](../../../docs/api-sqs-lambda-flow.md)

