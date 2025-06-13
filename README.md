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
│   ├── bin-status-reporter/  # Handles submission from QR-scan (REST endpoint)
│   ├── admin-dashboard-api/  # Authenticated Admin API for bin/location management
│   ├── notifier/             # Push/email notifications when bin is full
│   └── shared/               # Shared Rust modules (types, utils, logging)
├── frontend/                 # React TypeScript app for admin dashboard
├── scripts/                  # Deployment helpers, CI/CD tools
├── tests/                    # E2E (Playwright), integration tests
├── docs/                     # Architecture diagrams, system design docs
├── .github/                  # GitHub Actions workflows
└── README.md
```

## Architecture

- **AWS Lambda**: Multiple microservices handling different aspects
  - `bin-status-reporter`: Updates bin status from sensor data
  - `admin-dashboard-api`: Admin interface for managing bins and locations
  - `notifier`: Sends alerts when bins are full
- **DynamoDB**: Stores bin status and reports
  - `trash-bins` table: Current status and average calculations
  - `status-reports` table: Historical status reports

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
3. The result is stored as the current status in the trash-bins table

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
TRASH_BINS_TABLE=trash-bins
STATUS_REPORTS_TABLE=status-reports
```

## Testing

The project includes:
- Unit tests for domain logic
- Integration tests with LocalStack
- Test events in `lambda/test-events/`