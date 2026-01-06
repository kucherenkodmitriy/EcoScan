# EcoScan Distributed Tracing & Logging Guide

## 🎯 Overview

This guide explains how to trace a request through the entire EcoScan flow using AWS X-Ray and CloudWatch Logs.

## 📊 Request Flow with Tracing

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. API Gateway                                                              │
│    ├─ Generates: requestId (e.g., "abc123...")                            │
│    ├─ Generates: X-Ray traceId (e.g., "Root=1-...")                       │
│    └─ Logs to: /aws/apigateway/local-ecoscan                              │
└─────────────────────────┬──────────────────────────────────────────────────┘
                          │ Passes: requestId, traceId, sourceIp as SQS attributes
┌─────────────────────────▼──────────────────────────────────────────────────┐
│ 2. SQS Queue                                                                │
│    ├─ Message Body: {"binId":"...", "status":75}                          │
│    ├─ Message Attributes:                                                  │
│    │  ├─ RequestId: "abc123..."                                           │
│    │  ├─ TraceId: "Root=1-..."                                            │
│    │  └─ SourceIp: "192.168.1.1"                                          │
│    └─ Generates: messageId (e.g., "msg-xyz...")                           │
└─────────────────────────┬──────────────────────────────────────────────────┘
                          │ Batch of up to 10 messages
┌─────────────────────────▼──────────────────────────────────────────────────┐
│ 3. Lambda Function                                                          │
│    ├─ Extracts correlation IDs from message attributes                     │
│    ├─ Creates structured log span with:                                    │
│    │  ├─ message_id: "msg-xyz..."                                         │
│    │  ├─ request_id: "abc123..."                                          │
│    │  ├─ trace_id: "Root=1-..."                                           │
│    │  └─ source_ip: "192.168.1.1"                                         │
│    ├─ Generates: lambda_request_id (AWS Lambda request ID)                │
│    ├─ Logs to: /aws/lambda/local-ecoscan-update-bin-status (JSON format) │
│    └─ Sends X-Ray segments                                                 │
└─────────────────────────┬──────────────────────────────────────────────────┘
                          │ Updates
┌─────────────────────────▼──────────────────────────────────────────────────┐
│ 4. DynamoDB                                                                 │
│    ├─ Updates: trash-bins table (current status)                          │
│    ├─ Inserts: status-reports table (history)                             │
│    └─ Traced by X-Ray automatically                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key Correlation ID:** The `requestId` from API Gateway flows through the entire system and appears in all logs.

---

## 🔍 How to Trace a Request

### Method 1: Using X-Ray Service Map (Visual)

1. **Open AWS X-Ray Console:**
   ```
   https://console.aws.amazon.com/xray/home?region=eu-central-1
   ```

2. **View Service Map:**
   - Click "Service map" in the left navigation
   - You'll see a visual diagram:
     ```
     Client → API Gateway → SQS → Lambda → DynamoDB
     ```
   - Each node shows:
     - Request count
     - Average latency
     - Error rate
     - Throttle rate

3. **Analyze a Specific Trace:**
   - Click "Traces" in the left navigation
   - Filter by:
     - Time range
     - HTTP status code
     - URL path (e.g., `/bins/*/status`)
   - Click on a trace to see the timeline:
     ```
     API Gateway: 5ms
     └─ SQS: 2ms
        └─ Lambda: 150ms
           └─ DynamoDB GetItem: 10ms
           └─ DynamoDB Query: 15ms
           └─ DynamoDB UpdateItem: 12ms
     ```

4. **Find the Request ID:**
   - In the trace details, look for the API Gateway segment
   - Click "Raw data" → find `requestId` in the HTTP headers

---

### Method 2: Using CloudWatch Logs Insights (Querying)

#### Find All Logs for a Specific Request ID

**Query 1: Trace by API Gateway Request ID**

```sql
fields @timestamp, @message, @logStream
| filter @message like /abc123/
| sort @timestamp asc
| limit 100
```

Replace `abc123` with your actual request ID from the API Gateway log.

#### Query API Gateway Logs

**Query 2: Find API Gateway Request**

```sql
# Search in log group: /aws/apigateway/local-ecoscan
fields @timestamp, requestId, httpMethod, resourcePath, status, ip, responseLength
| filter resourcePath = "/bins/{bin_id}/status"
| filter status = 200
| sort @timestamp desc
| limit 20
```

**Sample Output:**
```
@timestamp            requestId   httpMethod  resourcePath            status  ip              responseLength
2026-01-05 10:30:15   abc123...   POST        /bins/.../status       200     192.168.1.1     58
```

**Copy the `requestId` value** (e.g., `abc123...`) for the next queries.

---

#### Query Lambda Logs (Structured JSON)

**Query 3: Find Lambda Processing by Request ID**

```sql
# Search in log group: /aws/lambda/local-ecoscan-update-bin-status
fields @timestamp, fields.message, fields.request_id, fields.message_id, fields.bin_id
| filter fields.request_id = "abc123..."
| sort @timestamp asc
| limit 50
```

**Sample Output (JSON logs):**
```json
{
  "@timestamp": "2026-01-05T10:30:15.500Z",
  "level": "INFO",
  "message": "Processing SQS message body: {\"binId\":\"...\",\"status\":75}",
  "span": {
    "name": "process_message",
    "message_id": "msg-xyz...",
    "request_id": "abc123...",
    "trace_id": "Root=1-67...",
    "source_ip": "192.168.1.1"
  }
}
```

**Query 4: Track Success/Failure for Request**

```sql
# Search in log group: /aws/lambda/local-ecoscan-update-bin-status
fields @timestamp, fields.level, fields.message, fields.request_id
| filter fields.request_id = "abc123..."
| filter fields.level = "ERROR" or fields.message like /Successfully processed/
| sort @timestamp asc
```

---

#### Query SQS Metrics

**Query 5: SQS Queue Depth Over Time**

```sql
# CloudWatch Metrics (not Insights)
# Navigate to: CloudWatch → Metrics → SQS
# Select: ApproximateNumberOfMessagesVisible
# Queue: local-ecoscan-status-updates
```

**Query 6: Check Dead Letter Queue**

```bash
# Using AWS CLI
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/local-ecoscan-status-updates-dlq \
  --attribute-names All \
  --message-attribute-names All
```

---

### Method 3: End-to-End Query (All Services)

**Query 7: Complete Request Flow**

This query requires querying multiple log groups. Use CloudWatch Logs Insights with multiple log groups selected:

1. Select log groups:
   - `/aws/apigateway/local-ecoscan`
   - `/aws/lambda/local-ecoscan-update-bin-status`

2. Run this query:

```sql
fields @timestamp, @logStream, @message
| filter @message like /abc123/
| sort @timestamp asc
| limit 100
```

**Sample Output Timeline:**
```
10:30:15.000  /aws/apigateway/...  {"requestId":"abc123...","status":200,...}
10:30:15.050  /aws/lambda/...      {"message":"Received SQS event","request_id":"abc123..."}
10:30:15.100  /aws/lambda/...      {"message":"Processing message","request_id":"abc123..."}
10:30:15.200  /aws/lambda/...      {"message":"Successfully processed","request_id":"abc123..."}
```

---

## 🎯 Common Troubleshooting Queries

### Find All Failed Requests in the Last Hour

```sql
# API Gateway failures
fields @timestamp, requestId, resourcePath, status, errorMessage
| filter status >= 400
| filter @timestamp > ago(1h)
| sort @timestamp desc
| limit 50
```

### Find All Lambda Errors

```sql
# Lambda failures
fields @timestamp, fields.request_id, fields.message, fields.error
| filter fields.level = "ERROR"
| filter @timestamp > ago(1h)
| sort @timestamp desc
| limit 50
```

### Find Slow Requests (Latency > 500ms)

```sql
# Lambda execution duration
filter @type = "REPORT"
| fields @requestId, @duration, @billedDuration, @memorySize, @maxMemoryUsed
| filter @duration > 500
| sort @duration desc
| limit 20
```

### Count Requests by Bin ID

```sql
# Lambda requests grouped by bin
fields fields.bin_id
| filter fields.message like /Status update successful for bin/
| stats count() by fields.bin_id
| sort count() desc
| limit 10
```

### Find Requests from Specific IP Address

```sql
# API Gateway requests by IP
fields @timestamp, requestId, ip, resourcePath
| filter ip = "192.168.1.1"
| sort @timestamp desc
| limit 50
```

---

## 📈 CloudWatch Dashboards

### Create a Custom Dashboard

1. **Navigate to CloudWatch → Dashboards → Create dashboard**

2. **Add widgets:**

**Widget 1: Request Count (Line graph)**
```
Metric: AWS/ApiGateway → Count
Statistic: Sum
Period: 1 minute
```

**Widget 2: Lambda Duration (Line graph)**
```
Metric: AWS/Lambda → Duration
Statistic: Average
Period: 1 minute
```

**Widget 3: SQS Queue Depth (Number)**
```
Metric: AWS/SQS → ApproximateNumberOfMessagesVisible
Statistic: Average
Period: 1 minute
```

**Widget 4: Error Rate (Line graph)**
```
Metric: AWS/Lambda → Errors
Statistic: Sum
Period: 5 minutes
```

**Widget 5: API Gateway Latency (Heatmap)**
```
Metric: AWS/ApiGateway → Latency
Statistic: p99
Period: 1 minute
```

---

## 🔔 CloudWatch Alarms

### Set Up Alerts

**Alarm 1: High Error Rate**
```yaml
Metric: AWS/Lambda → Errors
Statistic: Sum
Period: 5 minutes
Threshold: > 10 errors
Actions: Send SNS notification
```

**Alarm 2: Queue Depth Too High**
```yaml
Metric: AWS/SQS → ApproximateNumberOfMessagesVisible
Statistic: Average
Period: 1 minute
Threshold: > 100 messages
Actions: Send SNS notification
```

**Alarm 3: Dead Letter Queue Has Messages**
```yaml
Metric: AWS/SQS → ApproximateNumberOfMessagesVisible (DLQ)
Statistic: Sum
Period: 5 minutes
Threshold: > 0 messages
Actions: Send SNS notification (critical!)
```

---

## 🧪 Testing Distributed Tracing

### Step 1: Send a Test Request

```bash
export API_GATEWAY_ID="<your-api-id>"
export BIN_ID="550e8400-e29b-41d4-a716-446655440000"

# Send request and capture response
curl -v -X POST \
  "http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 75}' \
  2>&1 | tee /tmp/curl_output.txt
```

### Step 2: Extract Request ID from API Gateway Logs

```bash
# Get the most recent API Gateway log stream
awslocal logs describe-log-streams \
  --log-group-name /aws/apigateway/local-ecoscan \
  --order-by LastEventTime \
  --descending \
  --max-items 1

# Tail the logs
awslocal logs tail /aws/apigateway/local-ecoscan --follow
```

**Look for JSON like:**
```json
{
  "requestId": "abc123-def456-ghi789",
  "ip": "192.168.1.1",
  "httpMethod": "POST",
  "resourcePath": "/bins/{bin_id}/status",
  "status": 200
}
```

**Copy the `requestId` value.**

### Step 3: Find Lambda Logs with That Request ID

```bash
# Query Lambda logs (requires jq for JSON parsing)
awslocal logs tail /aws/lambda/local-ecoscan-update-bin-status \
  --follow \
  --format short \
  | jq 'select(.request_id == "abc123-def456-ghi789")'
```

### Step 4: Verify Data in DynamoDB

```bash
# Check if the bin status was updated
awslocal dynamodb get-item \
  --table-name local-ecoscan-trash-bins \
  --key "{\"binId\":{\"S\":\"${BIN_ID}\"}}"
```

**Expected:** The `status` field should reflect the weighted average including your new status value.

---

## 📊 Sample Trace Visualization

Here's what a complete trace looks like in X-Ray:

```
Trace ID: Root=1-67890abc-def123456789
Duration: 180ms

├─ API Gateway (5ms)
│  ├─ HTTP POST /bins/{bin_id}/status
│  ├─ Status: 200 OK
│  └─ Request ID: abc123-def456-ghi789
│
└─ SQS SendMessage (2ms)
   └─ Queue: local-ecoscan-status-updates
      └─ Message ID: msg-xyz-123
         └─ Attributes:
            ├─ RequestId: abc123-def456-ghi789
            ├─ TraceId: Root=1-67890abc-def123456789
            └─ SourceIp: 192.168.1.1

(After ~1 second, Lambda is triggered by SQS)

Lambda Invocation (173ms total)
├─ Lambda Request ID: lambda-abc-123
├─ SQS Batch: 1 message
├─ Initialize DynamoDB client (50ms)
├─ Query status-reports table (15ms)
│  └─ Fetched 10 recent reports
├─ Calculate weighted average (1ms)
├─ UpdateItem trash-bins table (12ms)
└─ PutItem status-reports table (10ms)

Total End-to-End: ~1.18 seconds
```

---

## 🔧 Advanced: Custom Metrics

### Emit Custom CloudWatch Metrics from Lambda

Add this to your Lambda code (Rust example):

```rust
// In infrastructure/dynamodb.rs
use aws_sdk_cloudwatch::{Client as CloudWatchClient, types::MetricDatum};

// After successful update_status:
let cloudwatch = CloudWatchClient::new(&config);
cloudwatch
    .put_metric_data()
    .namespace("EcoScan/Bins")
    .metric_data(
        MetricDatum::builder()
            .metric_name("StatusUpdate")
            .value(1.0)
            .unit(StandardUnit::Count)
            .build(),
    )
    .send()
    .await?;
```

Then query this metric in CloudWatch:
```
Namespace: EcoScan/Bins
Metric: StatusUpdate
Statistic: Sum
Period: 1 minute
```

---

## 🎓 Best Practices

### 1. Always Log with Context

**Bad:**
```rust
info!("Processing message");
```

**Good:**
```rust
info!(
    request_id = %request_id,
    bin_id = %bin_id,
    "Processing status update"
);
```

### 2. Use Structured Logging (JSON)

CloudWatch Insights can only query JSON fields efficiently.

### 3. Include Correlation IDs in All Logs

Every log statement within the span automatically includes:
- `message_id`
- `request_id`
- `trace_id`
- `source_ip`

### 4. Set Up Alarms for Critical Paths

- Dead Letter Queue has messages → Page on-call engineer
- Error rate > 5% → Send Slack notification
- Latency p99 > 1 second → Investigate performance

### 5. Use X-Ray Sampling

For high-traffic systems, configure X-Ray sampling rules:
```json
{
  "version": 2,
  "rules": [
    {
      "description": "Sample 10% of requests",
      "service_name": "*",
      "http_method": "*",
      "url_path": "*",
      "fixed_target": 1,
      "rate": 0.10
    }
  ]
}
```

---

## 📚 Reference

### Log Group Names

| Service | Log Group | Format |
|---------|-----------|--------|
| API Gateway | `/aws/apigateway/local-ecoscan` | JSON |
| Lambda | `/aws/lambda/local-ecoscan-update-bin-status` | JSON |

### Correlation ID Fields

| Field | Source | Description |
|-------|--------|-------------|
| `requestId` | API Gateway | Unique request identifier |
| `traceId` | X-Ray | Distributed trace identifier |
| `messageId` | SQS | Queue message identifier |
| `lambdaRequestId` | Lambda | Function invocation identifier |

### Useful AWS CLI Commands

```bash
# List log groups
awslocal logs describe-log-groups

# Tail API Gateway logs
awslocal logs tail /aws/apigateway/local-ecoscan --follow

# Tail Lambda logs
awslocal logs tail /aws/lambda/local-ecoscan-update-bin-status --follow --format json

# Get SQS queue attributes
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/local-ecoscan-status-updates \
  --attribute-names All

# Purge SQS queue (testing only!)
awslocal sqs purge-queue \
  --queue-url http://localhost:4566/000000000000/local-ecoscan-status-updates
```

---

## 🎯 Quick Start Checklist

To verify distributed tracing is working:

- [ ] X-Ray enabled on API Gateway ✅ (already done)
- [ ] X-Ray enabled on Lambda ✅ (already done)
- [ ] IAM permissions for X-Ray ✅ (already done)
- [ ] Correlation IDs in SQS messages ✅ (already done)
- [ ] Structured JSON logging in Lambda ✅ (already done)
- [ ] CloudWatch log groups created automatically
- [ ] Test request sent and traced end-to-end

**After deployment, run:**
```bash
# Deploy with new tracing features
./infrastructure/scripts/init-environment.sh local

# Send test request
curl -X POST "http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_/bins/${BIN_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 75}'

# Find request ID in API Gateway logs
awslocal logs tail /aws/apigateway/local-ecoscan --follow

# Trace request through Lambda logs
awslocal logs tail /aws/lambda/local-ecoscan-update-bin-status --follow --format json | jq 'select(.request_id)'
```

---

## 🚀 Summary

**Yes, you CAN easily trace requests end-to-end!**

1. **X-Ray provides visual service map** showing the entire flow
2. **Request ID flows through all services** as a correlation ID
3. **CloudWatch Logs Insights** lets you query by request ID across all logs
4. **Structured JSON logging** makes queries fast and powerful
5. **AWS handles most of this automatically** - you just need to enable it

The key is the **`requestId`** that originates from API Gateway and flows through SQS (as a message attribute) to Lambda (as a log field), connecting all the dots!
