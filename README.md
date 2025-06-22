# EcoScan

A serverless application for monitoring trash bin status using AWS Lambda and DynamoDB.

## Project Structure

```
ecoscan/
├── infrastructure/           # All IaC (CloudFormation, CDK, Terraform, etc.)
│   ├── backend/              # API Gateway, Lambda, DynamoDB, Cognito
│   ├── frontend/             # Amplify hosting config, CloudFront, Route53
│   ├── shared/               # Common infra modules (IAM roles, policies)
│   └── templates/            # Parameterized templates for deployment
├── services/                 # Rust Lambda microservices workspace
│   ├── bin-status-reporter/  # Handles bin status updates from QR-scan (REST endpoint, main business logic)
│   ├── admin-dashboard-api/  # Authenticated Admin API for bin/location management (skeleton, extendable)
│   ├── notifier/             # Push/email notifications when bin is full (skeleton, extendable)
│   └── shared/               # Shared Rust modules (domain models, DTOs, utils, logging)
├── frontend/                 # React TypeScript app for admin dashboard
├── scripts/                  # Deployment helpers, CI/CD tools
├── tests/                    # E2E (Playwright), integration tests
├── docs/                     # Architecture diagrams, system design docs
├── .github/                  # GitHub Actions workflows
└── README.md
```

## Architecture

- **AWS Lambda (Rust)**: Multiple microservices, each in its own crate:
  - `bin-status-reporter`: Main service for updating bin status from QR-scan or sensor data
  - `admin-dashboard-api`: Admin API for managing bins and locations (currently a skeleton for future extension)
  - `notifier`: Sends push/email alerts when bins are full (currently a skeleton for future extension)
  - `shared`: Common models and utilities used by all services
- **DynamoDB**: Stores bin status and reports
  - `dev-ecoscan-bin-status` table: Current status and average calculations
  - `dev-ecoscan-bin-status-reports` table: Historical status reports

## Data Model

### Trash Bins Table
- `binId` (String, Hash Key): Unique identifier for the bin
- `name` (String): Bin name
- `status` (Number): Current average status (0-10)
- `lastUpdated` (String): Last update timestamp
- `reportsCount` (Number): Number of status reports

### Status Reports Table
- `binId` (String, Hash Key): Bin identifier
- `createdAt` (String, Range Key): Report timestamp
- `status` (Number): Status value (0-10)

## Status Calculation

The system maintains a running average of bin status:
1. Each status update is stored in the reports table
2. The average is calculated using: `((current_status * reports_count) + new_status) / (reports_count + 1)`
3. The result is stored as the current status in the dev-ecoscan-bin-status table

## Deployment Artifacts S3 Bucket

All AWS Lambda deployments for EcoScan use the S3 bucket:

```
dev-ecoscan-lambda-deployments
```

This bucket **must exist** in your AWS account and region before deploying. All deployment artifacts (Lambda packages, CloudFormation templates) will be uploaded here. This is required for both local development and CI/CD workflows. If the bucket does not exist, create it with:

```
aws s3 mb s3://dev-ecoscan-lambda-deployments --region <your-region>
```

Replace `<your-region>` with your target AWS region (e.g., `eu-central-1`).

## Multi-Stack Deployment Approach

EcoScan uses a multi-stack architecture. Each microservice or major component is deployed as a separate CloudFormation stack, named using the convention:

```
<env>-ecoscan-<service>
```

**Examples:**
- `dev-ecoscan-bin-status-reporter`
- `dev-ecoscan-notifier`
- `dev-ecoscan-admin-dashboard-api`
- `dev-ecoscan-shared` (for shared resources, if needed)

### Deploying a Service Stack

From the service directory (e.g., `services/bin-status-reporter`):

```sh
aws cloudformation deploy \
  --template-file packaged.yaml \
  --stack-name dev-ecoscan-bin-status-reporter \
  --capabilities CAPABILITY_IAM \
  --region <your-region>
```

Repeat for each service or component as needed. Update the stack name and template path accordingly.

## Local Development

### Prerequisites
- Docker
- AWS CLI
- Rust toolchain

### Setup

1. Start LocalStack:
```bash
docker-compose up -d
```

2. Initialize LocalStack with tables and default bin:
```bash
./scripts/init-localstack.sh
```

3. Build and test the Lambda function:
```bash
./scripts/build-lambda.sh
./scripts/test-lambda.sh
```

### Environment Variables

Create a `.env.local` file for local development:
```env
DYNAMODB_ENDPOINT_URL=http://localhost:4566
TRASH_BINS_TABLE=dev-ecoscan-bin-status
STATUS_REPORTS_TABLE=dev-ecoscan-bin-status-reports
```

## Testing

The project includes:
- Unit tests for domain logic
- Integration tests with LocalStack
- Test events in `lambda/test-events/`