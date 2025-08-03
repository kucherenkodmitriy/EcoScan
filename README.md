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
  - `dev-ecoscan-trash-bins` table: Current status and average calculations
  - `dev-ecoscan-status-reports` table: Historical status reports

## Data Model

### Trash Bins Table (`dev-ecoscan-trash-bins`)
- `binId` (String, Hash Key): Unique identifier for the bin
- `name` (String): Bin name
- `status` (Number): Current average status (0-10)
- `lastUpdated` (String): Last update timestamp
- `reportsCount` (Number): Number of status reports

### Status Reports Table (`dev-ecoscan-status-reports`)
- `binId` (String, Hash Key): Bin identifier
- `createdAt` (String, Range Key): Report timestamp
- `status` (Number): Status value (0-10)

## Status Calculation

The system maintains a running average of bin status:
1. Each status update is stored in the reports table
2. The average is calculated using: `((current_status * reports_count) + new_status) / (reports_count + 1)`
3. The result is stored as the current status in the `dev-ecoscan-trash-bins` table.

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

Create a `.env` file in the root directory for local development and AWS deployment. For local development, use `.env.local` which is git-ignored.

**For Local Development (`.env.local`):**
```env
DYNAMODB_ENDPOINT_URL=http://localhost:4566
TRASH_BINS_TABLE=dev-ecoscan-trash-bins
STATUS_REPORTS_TABLE=dev-ecoscan-status-reports
```

**For AWS Deployment (`.env`):**
```env
AWS_ACCESS_KEY_ID=<Your_AWS_Access_Key_ID>
AWS_SECRET_ACCESS_KEY=<Your_AWS_Secret_Access_Key>
AWS_REGION=eu-central-1
TRASH_BINS_TABLE=dev-ecoscan-trash-bins
STATUS_REPORTS_TABLE=dev-ecoscan-status-reports
```

## Testing

The project includes unit tests for domain logic and a comprehensive end-to-end integration test that runs against a local LocalStack environment.

### Running End-to-End Tests

To run the entire end-to-end test suite, use the provided script. This command will automatically:
1. Start the LocalStack Docker container.
2. Initialize the database with the necessary tables and seed data.
3. Run the Rust integration tests from the `services` workspace.

From the project root, run:
```bash
./scripts/run-e2e-tests.sh
```

This is the recommended way to verify the application's core logic and its integration with AWS services locally.