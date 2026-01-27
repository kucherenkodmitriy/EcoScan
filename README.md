# EcoScan

A serverless trash bin monitoring system with React admin dashboard, built on AWS Lambda, DynamoDB, API Gateway, CloudFront, and SQS with Terraform infrastructure as code.

## Architecture

EcoScan uses an event-driven architecture with a React SPA frontend:

```
┌─────────────────────────────────────────────────────────────────┐
│                CloudFront (CDN + HTTPS)                          │
├─────────────────────────────┬───────────────────────────────────┤
│  /* → S3 (React SPA)        │  /api/* → API Gateway             │
└─────────────────────────────┴──────────────────┬────────────────┘
                                                 │
┌────────────────────────────────────────────────▼────────────────┐
│                        API Gateway                               │
├─────────────────┬───────────────────────┬───────────────────────┤
│ POST /bins/{id}/status │ POST /auth/login │ GET/POST /admin/*   │
│ (IoT devices)          │ (No auth)        │ (JWT required)       │
└────────┬───────────────┴────────┬────────┴──────────┬───────────┘
         │                        │                    │
         ▼                        │         ┌─────────▼─────────┐
    ┌─────────┐                   │         │ Lambda Authorizer │
    │   SQS   │                   │         └─────────┬─────────┘
    └────┬────┘                   ▼                   │
         │              ┌──────────────────┐          │
         ▼              │ admin-dashboard- │◄─────────┘
┌─────────────────┐     │ api Lambda       │
│ bin-status-     │     └────────┬─────────┘
│ reporter Lambda │              │
└────────┬────────┘              │
         └───────────┬───────────┘
                     ▼
              ┌───────────┐
              │ DynamoDB  │
              └───────────┘
```

**Key Features:**
- 🖥️ React admin dashboard with bin management
- 🚀 Async processing with SQS for resilience and scalability
- 📦 Rust Lambda functions for high performance
- 🔐 JWT authentication for admin endpoints
- 🌐 CloudFront CDN for global static file delivery
- 🏗️ Multi-layer Terraform infrastructure (5 layers)
- 🧪 LocalStack for local development
- ✅ Comprehensive E2E testing

## Getting Started

This project is managed using a `Makefile` to simplify common development tasks.

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose
- [Terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli) (>= 1.6)
- [Rust Toolchain](https://www.rust-lang.org/tools/install) (>= 1.92)
- [AWS CLI](https://aws.amazon.com/cli/) (>= 2.0)
- `libssl-dev` and `pkg-config` for building Rust dependencies

### Quick Start

```bash
# Start LocalStack and deploy infrastructure
make local-up

# Run all tests (unit and E2E)
make test

# Run E2E tests only
make test-e2e

# Tear down the local environment
make reset-local
```

### Manual Setup

If you prefer manual setup:

```bash
# 1. Start LocalStack
docker-compose up -d

# 2. Build Lambda function
./scripts/build-lambda.sh

# 3. Deploy infrastructure
./infrastructure/scripts/init-environment.sh local

# 4. Seed test data
./scripts/seed-data.sh

# 5. Run E2E tests
./scripts/run-e2e-tests.sh
```

### Frontend Development

```bash
# Install dependencies
cd frontend
npm install

# Start dev server (proxies /api to LocalStack)
npm run dev
# Open http://localhost:3000

# Build for production
npm run build
# Output in frontend/dist/
```

**Login credentials (LocalStack):** `admin@ecoscan.local` / `admin123`

## Project Structure

```
EcoScan/
├── frontend/                      # React SPA (Admin Dashboard)
│   ├── src/
│   │   ├── api/                  # API client with JWT auth
│   │   ├── context/              # Auth context
│   │   └── pages/                # Login, Dashboard, BinDetail, BinForm, Report
│   ├── package.json
│   └── vite.config.ts            # Dev proxy to LocalStack
├── services/                      # Rust microservices
│   ├── bin-status-reporter/      # SQS-triggered status processor
│   ├── lambda-authorizer/        # JWT token validator
│   ├── admin-dashboard-api/      # Admin CRUD API
│   ├── e2e-tests/                # End-to-end integration tests
│   └── shared/                   # Shared domain models (stub)
├── infrastructure/               # Terraform IaC
│   ├── layers/                   # Multi-layer architecture
│   │   ├── 00-foundation/       # S3 buckets, GitHub Actions IAM
│   │   ├── 01-data/             # DynamoDB, Secrets Manager, SQS
│   │   ├── 02-compute/          # Lambda functions, SQS event mapping
│   │   ├── 03-api/              # API Gateway, Lambda authorizer config
│   │   └── 04-frontend/         # CloudFront CDN, S3 static hosting
│   ├── environments/            # Environment configs (local/dev/prod)
│   └── scripts/                 # Deployment scripts
├── scripts/                      # Build and utility scripts
├── docs/                         # Documentation
└── docker-compose.yml           # LocalStack configuration
```

## Documentation

All documentation is in the `docs/` folder:

- **[Architecture](docs/ARCHITECTURE.md)** - System design and data model
- **[Build Guide](docs/BUILD_GUIDE.md)** - Lambda build instructions
- **[Testing Guide](docs/TESTING_GUIDE.md)** - Manual testing procedures
- **[Testing Automation](docs/TESTING_AUTOMATION.md)** - CI/CD and automated tests
- **[Distributed Tracing](docs/DISTRIBUTED_TRACING_GUIDE.md)** - X-Ray and CloudWatch
- **[GitHub Actions Setup](docs/GITHUB_ACTIONS_SETUP.md)** - CI/CD IAM configuration
- **[API Flow](docs/api-sqs-lambda-flow.md)** - API Gateway → SQS → Lambda flow
- **[LocalStack Debugging](docs/localstack-debugging-insights.md)** - LocalStack tips

## Security & Contact Forms

### reCAPTCHA v3 Integration

All public forms (contact, demo requests, bin status reports) are protected with **server-side reCAPTCHA v3 validation**:

```
User Form → reCAPTCHA (invisible) → API Gateway → WAF → Lambda (validates) → DynamoDB
```

**Setup** (2 minutes):
```bash
# 1. Get keys: https://www.google.com/recaptcha/admin (create v3 site)

# 2. Build Lambda
cd services/contact-form-handler && ./build.sh

# 3. Deploy
cd ../../infrastructure
export TF_VAR_recaptcha_secret_key="YOUR_SECRET_KEY"
terraform apply -var-file=environments/dev.tfvars

# 4. Configure frontend
echo "VITE_RECAPTCHA_SITE_KEY=YOUR_SITE_KEY" >> frontend/.env
```

**Protection layers:**
- ✅ Server-side validation (can't be bypassed)
- ✅ WAF rate limiting (10 requests/5min per IP)
- ✅ API Gateway throttling (500/day)
- ✅ reCAPTCHA score check (≥0.5 required)
- ✅ DynamoDB storage with 90-day TTL

**Cost:** $0-5/month (free tier + optional $5 WAF)

See service README: [contact-form-handler](services/contact-form-handler/README.md)

## Development

### Workspace Cleanup

Build artifacts and caches can grow to several gigabytes. Clean them regularly:

```bash
# Quick clean (build artifacts only)
make clean

# Deep clean (removes all caches, build artifacts, and temporary files)
make deep-clean

# Manual cleanup script
./scripts/cleanup.sh
```

**What gets cleaned:**
- Rust `target/` directories (~11GB)
- Terraform `.terraform/` caches (~4GB)
- Frontend `dist/` and `node_modules/.vite` caches
- Large log files and temporary files

### Building Lambda Functions

```bash
# Build for x86_64 (LocalStack/AWS compatible)
./scripts/build-lambda.sh

# Output: services/target/lambda.zip
```

### Running Tests

```bash
# Unit tests
cd services
cargo test

# Smoke tests (quick validation after deployment)
./scripts/smoke-test.sh local   # LocalStack
./scripts/smoke-test.sh dev     # AWS dev environment

# E2E tests (full integration testing)
ENVIRONMENT=local ./scripts/run-e2e-tests.sh  # LocalStack
ENVIRONMENT=dev ./scripts/run-e2e-tests.sh    # AWS dev environment
```

### Git Hooks

Enable pre-commit hooks to catch formatting issues before pushing:

```bash
# Configure git to use project hooks (run once after cloning)
git config core.hooksPath .githooks
```

The pre-commit hook automatically runs `cargo fmt --check` on staged Rust files and blocks commits with formatting errors. To fix issues:

```bash
cd services && cargo fmt
```

### Deploying Infrastructure

```bash
# Deploy all layers
./infrastructure/scripts/init-environment.sh local

# Deploy single layer
./infrastructure/scripts/deploy-layer.sh 03-api local

# Clean up
./infrastructure/scripts/cleanup-local.sh
```

## API Usage

Once deployed, you can interact with the API:

```bash
# Get API Gateway ID
API_ID=$(cd infrastructure/layers/03-api && terraform output -raw api_gateway_id)
BASE_URL="http://localhost:4566/restapis/${API_ID}/local/_user_request_"

# Update bin status (IoT devices - no auth required)
curl -X POST "${BASE_URL}/bins/00000000-0000-0000-0000-000000000001/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 75}'
# Response: {"message":"Status update queued for processing"}

# Admin login
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@ecoscan.local", "password": "admin123"}'
# Response: {"token": "eyJ...", "user": {...}}

# List bins (requires JWT)
TOKEN="<token from login>"
curl "${BASE_URL}/admin/bins" -H "Authorization: Bearer ${TOKEN}"
```

The status update is queued in SQS and processed asynchronously by Lambda.

## Testing

The project includes comprehensive automated tests:

- **Unit Tests**: Rust service tests (`cargo test`)
- **Integration Tests**: DynamoDB repository tests
- **Smoke Tests**: Quick validation after deployment (API, Lambda, DynamoDB)
- **E2E Tests**: Full API → SQS → Lambda → DynamoDB flow
- **CI/CD Tests**: Automated testing in GitHub Actions on every push

### Automated Testing in CI/CD

Every push to `dev` branch automatically:
1. ✅ Runs unit tests and linting
2. ✅ Validates Terraform configuration
3. ✅ Deploys to AWS dev environment
4. ✅ Runs smoke tests to verify deployment
5. ✅ Runs E2E tests for full flow validation

See [Testing Automation Guide](docs/TESTING_AUTOMATION.md) for details.

All tests pass with both LocalStack and AWS! ✅

## Contributing

1. Test locally with LocalStack first
2. Update documentation for any changes
3. Run all tests before submitting PR
4. Follow Rust and Terraform best practices

## License

See [LICENSE](LICENSE) file for details.
