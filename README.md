# EcoScan

A serverless application for monitoring trash bin status using AWS Lambda and DynamoDB.

## Project Structure

```
ecoscan/
├── infrastructure/           # All IaC (CloudFormation, CDK, Terraform, etc.)
│   ├── backend/              # API Gateway, Lambda, DynamoDB, Cognito
│   ├── frontend/             # React TypeScript app for admin dashboard
│   ├── shared/               # Common infra modules (IAM roles, policies)
│   └── templates/            # Parameterized templates for deployment
├── services/                 # Rust Lambda microservices workspace
│   ├── bin-status-reporter/  # Handles submission from QR-scan (REST endpoint)
│   ├── admin-dashboard-api/  # Authenticated Admin API for bin/location management
│   ├── notifier/             # Push/email notifications when bin is full
│   └── shared/               # Shared Rust modules (types, utils, logging)
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
- **Frontend**: React TypeScript application
  - Citizen Scanner: QR code scanning for bin status updates
  - Admin Dashboard: Management interface for bins and analytics
  - Landing Page: Public information about the service

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
- Node.js 18+ and pnpm

### Backend Setup

1. Start LocalStack:

```bash
make local-up
```

2. Initialize LocalStack with tables and default bin:

```bash
./scripts/init-localstack.sh
```

3. Build and test the Lambda function:

```bash
make build
make test-lambda
```

### Frontend Setup

1. Install frontend dependencies:

```bash
make frontend-install
```

2. Start frontend development server:

```bash
make frontend-dev
```

Or use the dedicated script:

```bash
./scripts/start-frontend.sh
```

3. Access the frontend at: http://localhost:5173

### Full Stack Development

Start both backend and frontend together:

```bash
make dev-full
```

### Environment Variables

The frontend uses Vite environment variables. Create a `.env.local` file in `infrastructure/frontend/`:

```env
VITE_API_ENDPOINT=http://localhost:4566
VITE_AWS_REGION=eu-central-1
VITE_USER_POOL_ID=us-east-1_example
VITE_USER_POOL_CLIENT_ID=example
VITE_OAUTH_DOMAIN=example.auth.us-east-1.amazoncognito.com
VITE_APP_URL=http://localhost:5173
```

## Frontend Features

### Pages

- **Landing Page** (`/`): Public information about EcoScan
- **Citizen Scanner** (`/scan`): QR code scanner for bin status updates
- **Admin Dashboard** (`/admin`): Management interface (requires authentication)
- **Login Page** (`/login`): Authentication for admin access

### Components

- QR Code Scanner with camera access
- Real-time bin status updates
- Admin dashboard with analytics
- Responsive design with Tailwind CSS

## Testing

The project includes:

- Unit tests for domain logic
- Integration tests with LocalStack
- Test events in `lambda/test-events/`
- Frontend linting and type checking

## Available Commands

```bash
# Backend
make build          # Build Lambda functions
make test           # Run backend tests
make local-up       # Start LocalStack
make local-down     # Stop LocalStack

# Frontend
make frontend-dev   # Start frontend development server
make frontend-build # Build frontend for production
make frontend-lint  # Lint frontend code

# Full Stack
make dev-full       # Start both backend and frontend
make help           # Show all available commands
```
