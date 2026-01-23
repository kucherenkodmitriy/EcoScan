# Contact Form Handler Lambda

Serverless Lambda function for contact form and demo requests with **server-side reCAPTCHA v3 validation**.

## Features

- ✅ Server-side reCAPTCHA validation (secure, can't be bypassed)
- ✅ Score-based bot detection (configurable threshold)
- ✅ DynamoDB storage with 90-day TTL
- ✅ CORS support for web apps
- ✅ Structured logging for CloudWatch

## API

**Endpoint:** `POST /contact`

**Request:**
```json
{
  "email": "user@company.com",
  "recaptchaToken": "03AGdBq...",
  "requestType": "demo",
  "companyName": "Acme Corp",          // For demo requests
  "name": "John Doe",                  // For contact forms
  "organization": "Acme Corp",         // For contact forms
  "message": "Interested in EcoScan"   // For contact forms
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Thank you! We've received your request...",
  "score": 0.9
}
```

**Errors:**
- `400` - reCAPTCHA failed or score too low
- `500` - DynamoDB error

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEMO_REQUESTS_TABLE` | Yes | `local-ecoscan-demo-requests` | DynamoDB table |
| `RECAPTCHA_SECRET_KEY` | Yes | - | Google reCAPTCHA secret |
| `RECAPTCHA_MIN_SCORE` | No | `0.5` | Minimum score (0.0-1.0) |

## Building

```bash
# Install target
rustup target add x86_64-unknown-linux-musl

# Build
./build.sh

# Output: ../target/contact-form-handler.zip
```

## Deployment

```bash
cd ../../infrastructure

# Set reCAPTCHA secret
export TF_VAR_recaptcha_secret_key="your-secret-key"

# Deploy
terraform apply -var-file=environments/dev.tfvars
```

## Testing

```bash
# Test with curl
curl -X POST https://your-api.../contact \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "companyName": "Test Corp",
    "recaptchaToken": "test-token"
  }'

# Check submissions
aws dynamodb scan --table-name dev-ecoscan-demo-requests --max-items 5

# View logs
aws logs tail /aws/lambda/dev-ecoscan-contact-form --follow
```

## DynamoDB Schema

**Table:** `demo_requests`

| Field | Type | Description |
|-------|------|-------------|
| `requestId` (PK) | String | UUID v4 |
| `createdAt` (SK) | String | RFC3339 timestamp |
| `email` (GSI) | String | User email |
| `requestType` | String | "demo" or "contact" |
| `recaptchaScore` | Number | 0.0 - 1.0 |
| `status` | String | "pending", "contacted", etc. |
| `ttl` | Number | Auto-delete after 90 days |

## Security

### Why Server-Side Validation?

❌ **Frontend only** (can be bypassed):
```typescript
const token = await grecaptcha.execute()
if (token) { submitForm() }  // Insecure!
```

✅ **Server-side** (secure):
```rust
let response = verify_with_google(token, secret).await?;
if !response.success || response.score < 0.5 {
    return Err("Invalid")
}
```

### reCAPTCHA Score Guidelines
- **0.9+**: Very likely human
- **0.7-0.9**: Probably human
- **0.5-0.7**: Unclear (accept with caution)
- **0.3-0.5**: Probably bot
- **0.0-0.3**: Very likely bot

Adjust threshold in `infrastructure/lambda.tf`:
```bash
RECAPTCHA_MIN_SCORE = "0.3"  # More lenient
RECAPTCHA_MIN_SCORE = "0.7"  # More strict
```

## Cost

**Per request:** ~$0.0000014 (Lambda + DynamoDB)
**Monthly (1000 submissions):** ~$0.005 (~half a cent!)

Main cost is WAF ($5/month) which protects all endpoints.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "reCAPTCHA failed" | Check `RECAPTCHA_SECRET_KEY` in Lambda |
| "Security check failed" | User score too low, check CloudWatch logs |
| DynamoDB error | Check IAM role has `dynamodb:PutItem` |
| High latency | Increase Lambda timeout (currently 15s) |

## Dependencies

```toml
aws_lambda_events = "0.15"    # Lambda events
lambda_runtime = "0.13"       # Runtime
reqwest = "0.12"              # reCAPTCHA API
aws-sdk-dynamodb = "1.0"      # Storage
uuid = "1.0"                  # IDs
chrono = "0.4"                # Timestamps
```

