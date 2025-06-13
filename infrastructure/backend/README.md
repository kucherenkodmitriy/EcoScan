# API Gateway Infrastructure

This directory contains the API Gateway configuration for the EcoScan application.

## Files

- `openapi.yaml`: OpenAPI 3.0 specification defining the API endpoints, request/response schemas, and rate limiting
- `template.yaml`: AWS SAM/CloudFormation template for deploying the API Gateway and related resources

## API Endpoints

### Update Bin Status
- **Path**: `/bins/{binId}/status`
- **Method**: PUT
- **Description**: Updates the status of a specific trash bin
- **Rate Limit**: 10 requests/second with burst of 5
- **Request Body**:
  ```json
  {
    "status": {
      "value": 7  // Integer between 0 and 10
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Bin status updated to 70%",
    "updated_at": "2024-03-20T12:00:00Z"
  }
  ```

## Deployment

### Prerequisites
1. AWS CLI installed and configured
2. AWS SAM CLI installed
3. Rust toolchain installed (for Lambda function)

### Steps

1. Build the Lambda function:
   ```bash
   cd lambda
   cargo build --release
   ```

2. Deploy using SAM:
   ```bash
   cd infrastructure/api
   sam build
   sam deploy --guided
   ```

3. Follow the guided deployment prompts:
   - Stack Name: ecoscan-api
   - AWS Region: eu-central-1
   - Environment: [dev/staging/prod]
   - Rate Limit: 10
   - Burst Limit: 5

### Environment Variables

The following environment variables are set during deployment:
- `TRASH_BINS_TABLE`: DynamoDB table for bin data
- `STATUS_REPORTS_TABLE`: DynamoDB table for status reports
- `LOG_LEVEL`: Logging level (default: INFO)

## Security

The API is protected with:
1. Rate limiting (10 requests/second with burst of 5)
2. Request validation
3. CORS protection
4. Usage plans with monthly quotas
5. IAM roles and policies

## Monitoring

The API Gateway provides:
- Request/response metrics
- Error rates
- Latency statistics
- Throttle counts

These can be viewed in the AWS CloudWatch console. 