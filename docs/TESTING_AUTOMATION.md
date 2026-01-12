# Testing Automation Guide

This guide describes the automated testing infrastructure for EcoScan to prevent deployment issues and catch bugs early.

## Overview

EcoScan has multiple layers of automated tests:

1. **Unit Tests** - Test individual Rust functions and modules
2. **Integration Tests** - Test DynamoDB repository layer
3. **Smoke Tests** - Quick validation of deployed infrastructure
4. **E2E Tests** - Full end-to-end flow testing (Client → API → SQS → Lambda → DynamoDB)

## Smoke Tests

Smoke tests are quick validation checks that run after deployment to ensure the system is operational.

### What They Test

- ✅ API Gateway reachability
- ✅ API endpoint accepts requests (HTTP 200)
- ✅ SQS message queuing
- ✅ Lambda function execution (no errors)
- ✅ DynamoDB data persistence

### Running Smoke Tests

```bash
# Local environment
./scripts/smoke-test.sh local

# AWS dev environment
./scripts/smoke-test.sh dev

# With AWS credentials
export AWS_ACCESS_KEY_ID=<your-key>
export AWS_SECRET_ACCESS_KEY=<your-secret>
export AWS_REGION=eu-central-1
./scripts/smoke-test.sh dev
```

### When to Run

- ✅ After any infrastructure deployment
- ✅ After changing API Gateway configuration
- ✅ After Lambda function updates
- ✅ Before running full E2E tests
- ✅ In CI/CD pipeline (automatic)

### Expected Output

```
=== Running Smoke Tests for dev ===

✓ API Endpoint: https://xxx.execute-api.eu-central-1.amazonaws.com/dev
✓ Bins Table: dev-ecoscan-trash-bins
✓ API Gateway is reachable
✓ Test bin ready
✓ API returned 200 OK
✓ No errors in Lambda logs
✓ Bin status in DynamoDB: 75%

✅ Smoke Tests Passed!
```

## E2E Tests

End-to-end tests validate the complete flow from API request to database update.

### Running E2E Tests

```bash
# Local environment (deploys LocalStack automatically)
ENVIRONMENT=local ./scripts/run-e2e-tests.sh

# AWS dev environment
ENVIRONMENT=dev ./scripts/run-e2e-tests.sh

# Using Terraform outputs directly
cd infrastructure/layers/03-api
export API_ENDPOINT=$(terraform output -raw api_gateway_invoke_url)
cd ../../..
cd services/e2e-tests
cargo test --release -- --nocapture
```

### Test Scenarios

Current E2E tests validate:

1. **Status Update Flow**
   - POST request to `/bins/{bin_id}/status`
   - Message queued in SQS
   - Lambda processes message
   - DynamoDB updated with new status
   - Response matches expected format

### Test Data

Tests use a dedicated test bin ID:
- **Local**: `00000000-0000-0000-0000-000000000001`
- **AWS**: `00000000-0000-0000-0000-000000000999`

## CI/CD Integration

### GitHub Actions Workflow

The CI/CD pipeline automatically runs tests on every push to `dev` branch:

```
┌─────────────────────────────────────────────┐
│ 1. Code Changes Detected                    │
└───────────────┬─────────────────────────────┘
                │
                ├─→ Rust changed? → Lint & Unit Tests
                ├─→ Infrastructure changed? → Terraform Validate
                │
                ↓
┌─────────────────────────────────────────────┐
│ 2. Build & Deploy                           │
│   - Build Lambda (x86_64)                   │
│   - Deploy Foundation → Data → API → Compute│
└───────────────┬─────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────┐
│ 3. Smoke Tests (Automatic)                  │
│   - Quick validation of deployment          │
│   - Runs on every deployment                │
└───────────────┬─────────────────────────────┘
                │
                ↓ (if smoke tests pass)
┌─────────────────────────────────────────────┐
│ 4. E2E Tests (Conditional)                  │
│   - Only if code or infra changed           │
│   - Full flow validation                    │
└───────────────┬─────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────┐
│ 5. Deployment Summary                       │
│   - All test results in one view            │
└─────────────────────────────────────────────┘
```

### When Tests Run

| Test Type | Trigger | Branch | Condition |
|-----------|---------|--------|-----------|
| Unit Tests | Push/PR | all | Rust code changed |
| Lint | Push/PR | all | Rust code changed |
| Terraform Validate | Push/PR | all | Infrastructure changed |
| Smoke Tests | Push | dev only | After successful deployment |
| E2E Tests (AWS) | Push | dev only | After smoke tests pass + code/infra changed |

### Test Results in GitHub

After each workflow run, you'll see:

```markdown
## Deployment Summary

| Component | Changed | Status |
|-----------|---------|--------|
| Rust Code | true | Lint: success, Test: success, Build: success |
| Foundation | false | skipped |
| Data | false | skipped |
| API | true | success |
| Compute | true | success |
| **Smoke Tests** | - | success |
| **E2E Tests (AWS)** | - | success |
```

## Troubleshooting Failed Tests

### Smoke Test Failures

**Symptom**: `❌ API request failed with HTTP 500`

**Common Causes**:
1. API Gateway VTL template syntax error
2. IAM role permissions missing
3. SQS queue not accessible

**Debug**:
```bash
# Test API Gateway integration
aws apigateway test-invoke-method \
  --rest-api-id <api-id> \
  --resource-id <resource-id> \
  --http-method POST \
  --path-with-query-string '/bins/test-id/status' \
  --body '{"status": 50}'

# Check execution logs
aws logs tail "API-Gateway-Execution-Logs_<api-id>/dev" --follow
```

---

**Symptom**: `⚠ Bin status not updated yet`

**Common Causes**:
1. Lambda function error
2. Architecture mismatch (arm64 vs x86_64)
3. Environment variable misconfiguration

**Debug**:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/dev-ecoscan-update-bin-status --since 5m --follow

# Check Lambda configuration
aws lambda get-function-configuration \
  --function-name dev-ecoscan-update-bin-status \
  --query 'Environment.Variables'
```

### E2E Test Failures

**Symptom**: Test fails with connection timeout

**Solution**:
1. Check API endpoint is correct
2. Verify AWS credentials are valid
3. Ensure security groups allow traffic

**Symptom**: Test fails with "Invalid bin_id format"

**Solution**:
- Bin IDs must be UUIDs
- Update test data to use proper UUID format

## Best Practices

### 1. Always Run Smoke Tests First

```bash
# Before running expensive E2E tests
./scripts/smoke-test.sh dev

# If smoke tests pass, then run E2E
if [ $? -eq 0 ]; then
  ENVIRONMENT=dev ./scripts/run-e2e-tests.sh
fi
```

### 2. Test Locally Before AWS

```bash
# Start LocalStack
docker-compose up -d

# Deploy and test locally
make local-up
./scripts/smoke-test.sh local

# Then deploy to AWS if local works
cd infrastructure && ./scripts/init-environment.sh dev
./scripts/smoke-test.sh dev
```

### 3. Check Logs on Failure

Both scripts automatically fetch logs on failure, but you can also:

```bash
# Lambda logs (last 10 minutes)
aws logs tail /aws/lambda/dev-ecoscan-update-bin-status --since 10m

# API Gateway logs
aws logs tail "API-Gateway-Execution-Logs_<api-id>/dev" --since 10m

# SQS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name NumberOfMessagesSent \
  --dimensions Name=QueueName,Value=dev-ecoscan-status-updates \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### 4. Use Test Bins for Development

Don't use production bin IDs for testing. Use:
- Local: `00000000-0000-0000-0000-000000000001`
- Dev: `00000000-0000-0000-0000-000000000999`

## Future Enhancements

Planned improvements to test automation:

- [ ] Performance tests (load testing with K6)
- [ ] Security tests (OWASP ZAP integration)
- [ ] Chaos engineering (random failure injection)
- [ ] Multi-region testing
- [ ] Automated rollback on test failure
- [ ] Test coverage reporting
- [ ] Screenshot comparison tests (for dashboard)

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design and components
- [Infrastructure README](../infrastructure/README.md) - Deployment guide
- [Testing Guide](TESTING_GUIDE.md) - Detailed testing strategy
- [Troubleshooting](../README.md#troubleshooting) - Common issues

## Quick Reference

```bash
# Run all checks before deploying
make validate-infrastructure  # Terraform validation
cargo test                     # Unit tests
./scripts/smoke-test.sh dev   # Smoke tests
ENVIRONMENT=dev ./scripts/run-e2e-tests.sh  # E2E tests

# Monitor production
aws logs tail /aws/lambda/dev-ecoscan-update-bin-status --follow
aws cloudwatch get-dashboard --dashboard-name EcoScan-Dev
```
