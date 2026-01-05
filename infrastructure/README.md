# EcoScan Infrastructure

This directory contains the Terraform infrastructure for EcoScan, organized in layers for better isolation and maintainability.

## Architecture

The infrastructure is divided into 4 layers with asynchronous message processing:

```
Client → API Gateway → SQS Queue → Lambda → DynamoDB
                         ↓
                    Dead Letter Queue (DLQ)
```

**Layers:**

1. **00-foundation**: S3 buckets for Lambda deployments and artifacts
2. **01-data**: DynamoDB tables (`trash-bins`, `status-reports`)
3. **03-api**: API Gateway REST API + SQS queues (main queue + DLQ)
4. **02-compute**: Lambda function (Rust), IAM roles, SQS event source mapping

**Note:** Layers 02 and 03 are deployed in reverse numerical order (03 before 02) because the compute layer needs the SQS queue ARN created in the API layer to configure the Lambda event source mapping.

Each layer has its own state file and can be deployed independently. Layers reference each other using Terraform remote state data sources.

### Message Flow

1. **Client** sends HTTP POST to API Gateway
2. **API Gateway** transforms request and sends message to SQS
3. **SQS Queue** stores message reliably (up to 4 days)
4. **Lambda** polls SQS and processes messages in batches
5. **DynamoDB** stores the updated bin status
6. **DLQ** captures failed messages after 3 retry attempts

### Why SQS?

The architecture uses SQS between API Gateway and Lambda for:
- **Resilience**: Messages aren't lost if Lambda is temporarily unavailable
- **Scalability**: Queue absorbs traffic spikes automatically
- **Cost optimization**: Failed processing retries without re-invoking API Gateway
- **Decoupling**: API layer and compute layer can scale independently
- **Observability**: SQS metrics show queue depth, age, and processing rate

## Environments

- **local**: LocalStack for local development
- **dev**: AWS development environment

## Quick Start

### Local Development (LocalStack)

```bash
# Initialize and deploy all layers
./infrastructure/scripts/init-environment.sh local

# Run E2E tests
./scripts/run-e2e-tests.sh
```

### AWS Development

#### First-time Setup

1. Bootstrap the AWS backend (one-time):
   ```bash
   ./infrastructure/scripts/bootstrap-aws-backend.sh dev
   ```

2. Deploy all layers:
   ```bash
   ./infrastructure/scripts/init-environment.sh dev
   ```

#### Subsequent Deployments

```bash
# Deploy all layers
./infrastructure/scripts/init-environment.sh dev

# Deploy single layer
./infrastructure/scripts/deploy-layer.sh 03-api dev -auto-approve
```

## Directory Structure

```
infrastructure/
├── README.md              # This file
├── backend/              # Backend configurations (S3 for AWS, local for LocalStack)
│   ├── local.tfbackend
│   └── dev.tfbackend
├── environments/         # Environment-specific tfvars
│   ├── README.md         # Environment configuration guide
│   ├── local.tfvars      # LocalStack config (committed)
│   ├── dev.tfvars        # AWS dev config (committed)
│   └── override.tfvars.example  # Example for personal overrides
├── layers/              # Infrastructure layers
│   ├── 00-foundation/   # S3 buckets
│   ├── 01-data/        # DynamoDB tables
│   ├── 02-compute/     # Lambda, IAM
│   └── 03-api/         # API Gateway, SQS
└── scripts/            # Deployment scripts
    ├── bootstrap-aws-backend.sh
    ├── init-environment.sh
    ├── deploy-layer.sh
    └── cleanup-local.sh
```

## Environment Configuration

Environment-specific settings are stored in `infrastructure/environments/*.tfvars`:

- **Committed to git**: Base configuration files (`local.tfvars`, `dev.tfvars`)
  - Non-sensitive configuration
  - Standard resource settings
  - Default values for the environment

- **Git-ignored**: Override files for personal customization
  - `*-override.tfvars` - Personal preferences
  - `*-secrets.tfvars` - Sensitive data (if needed)
  
See [environments/README.md](./environments/README.md) for detailed configuration guide.

**Example: Using overrides**
```bash
# Create personal override
cp environments/override.tfvars.example environments/dev-override.tfvars

# Apply with both files (override takes precedence)
terraform apply \
  -var-file="../../environments/dev.tfvars" \
  -var-file="../../environments/dev-override.tfvars"
```

## State Management

### LocalStack (local)
- Uses local file backend
- State files: `layers/*/terraform-local.tfstate`
- State preserved between docker-compose restarts
- No remote state storage

### AWS (dev)
- Uses S3 backend
- State bucket: `ecoscan-terraform-state-dev`
- Lock table: `ecoscan-terraform-locks-dev`
- Encryption enabled
- One state file per layer

## Deployment Order

Layers must be deployed in this specific order due to dependencies:

1. **00-foundation** → Creates S3 buckets for deployments
2. **01-data** → Creates DynamoDB tables (depends on foundation outputs)
3. **03-api** → Creates API Gateway + SQS queues (depends on data outputs)
4. **02-compute** → Creates Lambda + event source mapping (depends on api outputs for SQS ARN)

**Why this order?**
- Data layer needs S3 bucket references from foundation
- API layer needs DynamoDB table names from data layer
- **Compute layer needs SQS queue ARN from API layer** to configure the Lambda event source mapping
- This is why layer 03 is deployed before layer 02!

The `init-environment.sh` script handles this automatically.

**Destroy Order:** Compute → API → Data → Foundation (reverse of deployment)

## Common Tasks

### Update Single Layer (e.g., API changes)

```bash
# For local environment
./infrastructure/scripts/deploy-layer.sh 03-api local

# For dev environment
./infrastructure/scripts/deploy-layer.sh 03-api dev -auto-approve
```

### Update Lambda Function

```bash
# Build new Lambda
./scripts/build-lambda.sh

# Deploy compute layer
./infrastructure/scripts/deploy-layer.sh 02-compute local
```

### Add New DynamoDB Table

1. Edit `infrastructure/layers/01-data/dynamodb.tf`
2. Add output in `infrastructure/layers/01-data/outputs.tf`
3. Deploy data layer:
   ```bash
   ./infrastructure/scripts/deploy-layer.sh 01-data local
   ```

### Update Environment Configuration

1. Edit `infrastructure/environments/local.tfvars` or `dev.tfvars`
2. Redeploy affected layers:
   ```bash
   ./infrastructure/scripts/init-environment.sh local
   ```

## API Gateway Security Features

The API Gateway layer (03-api) includes comprehensive security measures to prevent abuse:

### Rate Limiting & Throttling

**LocalStack (local environment):**
- Rate limit: 100 requests/second
- Burst capacity: 50 requests
- Daily quota: 10,000 requests

**AWS Dev environment:**
- Rate limit: 1,000 requests/second
- Burst capacity: 500 requests
- Daily quota: 100,000 requests

When limits are exceeded, API Gateway returns `429 Too Many Requests`.

### Request Validation

All POST requests to `/bins/{bin_id}/status` are validated against a JSON schema:

```json
{
  "required": ["status"],
  "properties": {
    "status": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100
    }
  }
}
```

Invalid requests receive `400 Bad Request` with error details.

### Monitoring & Logging

- **CloudWatch Logs**: Detailed access logs for all requests (IP, timestamp, status code, etc.)
- **X-Ray Tracing**: Request tracing for debugging and performance analysis
- **Metrics**: CloudWatch metrics for request count, latency, errors
- **Retention**: 1 day (local), 7 days (dev)

### Usage Plan

A usage plan enforces quotas and throttling limits. Future enhancement: API keys for admin access.

## Cleaning Up

### Local Environment

```bash
# Clean Terraform state (keeps LocalStack data)
./infrastructure/scripts/cleanup-local.sh

# Completely reset LocalStack (destroys data)
docker-compose down -v
docker-compose up -d
./infrastructure/scripts/init-environment.sh local
```

### AWS Dev Environment

```bash
# Destroy layers in reverse order
cd infrastructure/layers/03-api
terraform destroy -var-file="../../environments/dev.tfvars"

cd ../02-compute
terraform destroy -var-file="../../environments/dev.tfvars"

cd ../01-data
terraform destroy -var-file="../../environments/dev.tfvars"

cd ../00-foundation
terraform destroy -var-file="../../environments/dev.tfvars"
```

## Troubleshooting

### LocalStack Connection Issues

```bash
# Check LocalStack health
curl http://localhost:4566/health

# Restart LocalStack
docker-compose restart localstack

# View logs
docker-compose logs -f localstack
```

### State File Issues

```bash
# Re-initialize with backend config
cd infrastructure/layers/<layer-name>
terraform init -reconfigure \
  -backend-config="path=terraform-local.tfstate"
```

### Remote State Not Found

Make sure previous layers are deployed:

```bash
# Check foundation layer
cd infrastructure/layers/00-foundation
terraform output

# Check data layer
cd ../01-data
terraform output
```

### Lambda Deployment Issues

```bash
# Verify Lambda zip exists
ls -lh services/target/lambda.zip

# Rebuild Lambda
./scripts/build-lambda.sh

# Redeploy compute layer
./infrastructure/scripts/deploy-layer.sh 02-compute local
```

## Best Practices

1. **Always deploy layers in order** (foundation → data → compute → api)
2. **Use init-environment.sh for full deployments** to ensure consistency
3. **Test in LocalStack first** before deploying to AWS
4. **Run E2E tests after deployment** to verify functionality
5. **Use deploy-layer.sh for targeted updates** to minimize changes
6. **Keep environment tfvars up to date** with your configuration
7. **Don't manually edit state files** - let Terraform manage them

## Environment Variables

When working with different environments, these variables are set automatically by the deployment scripts:

- `BINS_TABLE_NAME`: Name of the trash bins table
- `API_GATEWAY_URL`: API Gateway invoke URL
- `API_GATEWAY_ID`: API Gateway ID (used for LocalStack URL construction)

## Scripts Reference

### bootstrap-aws-backend.sh

Creates S3 bucket and DynamoDB table for Terraform state backend.

```bash
./infrastructure/scripts/bootstrap-aws-backend.sh dev
```

Only needs to be run once per environment before first deployment.

### init-environment.sh

Deploys all 4 infrastructure layers in order.

```bash
./infrastructure/scripts/init-environment.sh <environment> [-auto-approve]
```

For LocalStack, also:
- Starts Docker Compose (if not running)
- Builds Lambda function
- Seeds test data

### deploy-layer.sh

Deploys a single infrastructure layer.

```bash
./infrastructure/scripts/deploy-layer.sh <layer> <environment> [-auto-approve]
```

Use this for targeted updates to specific layers.

### cleanup-local.sh

Cleans up Terraform state files for LocalStack environment without destroying data.

```bash
./infrastructure/scripts/cleanup-local.sh
```

Useful when you want to re-initialize Terraform while keeping LocalStack data intact.

## Adding a New Environment (e.g., prod)

1. Create `infrastructure/environments/prod.tfvars` with production configuration
2. Create `infrastructure/backend/prod.tfbackend` with production backend config
3. Bootstrap the backend:
   ```bash
   ./infrastructure/scripts/bootstrap-aws-backend.sh prod
   ```
4. Deploy:
   ```bash
   ./infrastructure/scripts/init-environment.sh prod
   ```

## Contributing

When making infrastructure changes:

1. Test locally first using LocalStack
2. Document any new variables in tfvars files
3. Update this README if adding new features
4. Run E2E tests to verify deployment
5. Create a PR with infrastructure changes
