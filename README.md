# EcoScan

A serverless trash bin monitoring system with React admin dashboard, built on AWS Lambda, DynamoDB, API Gateway, CloudFront, and SQS with Terraform infrastructure as code.

**Enterprise-ready waste management platform** with API keys, webhooks, route optimization, multi-language support, and comprehensive analytics.

## Architecture

EcoScan uses an event-driven architecture with a React SPA frontend:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CloudFront (CDN + HTTPS)                          │
├──────────────────────────────┬───────────────────────────────────────┤
│  /* → S3 (React SPA)         │  /api/* → API Gateway                 │
└──────────────────────────────┴───────────────────┬───────────────────┘
                                                   │
┌──────────────────────────────────────────────────▼───────────────────┐
│                          API Gateway                                  │
├────────┬──────────┬──────────┬───────────┬──────────────────────────┤
│ Public │ Auth     │ IoT/QR   │ External  │ Admin (JWT required)     │
│ /report│ /login   │ /bins/   │ /api/     │ /admin/*                 │
│        │ /forgot  │ {id}/    │ external/ │  - bins, api-keys,       │
│        │ /reset   │ status   │ bins      │    webhooks, export      │
└────┬───┴────┬─────┴────┬─────┴─────┬─────┴──────────┬───────────────┘
     │        │          │           │                │
     │        │          ▼           │    ┌───────────▼───────────┐
     │        │     ┌────────┐       │    │  Lambda Authorizer    │
     │        │     │  SQS   │       │    │  (JWT validation)     │
     │        │     └───┬────┘       │    └───────────┬───────────┘
     │        │         │            │                │
     ▼        ▼         ▼            ▼                ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Lambda Functions                             │
├────────────────┬───────────────────┬──────────────┬────────────────┤
│ admin-         │ bin-status-       │ webhook-     │ contact-form-  │
│ dashboard-api  │ reporter          │ sender       │ handler        │
│ (main API)     │ (SQS processor)   │ (SQS)        │ (forms)        │
└────────┬───────┴────────┬──────────┴──────┬───────┴────────┬───────┘
         │                │                 │                │
         └────────────────┼─────────────────┼────────────────┘
                          ▼                 │
                   ┌─────────────┐          │
                   │  DynamoDB   │          │
                   │  (6 tables) │◄─────────┘
                   └─────────────┘
         trash-bins, status-reports, admin-users,
         api-keys, webhook-configs, demo-requests
```

**Key Features:**
- 🖥️ **Modern React Admin Dashboard** - Full-featured SPA with bin management, map view, and route planning
- 🔑 **API Keys Management** - Scope-based access control for external integrations
- 🔗 **Webhooks** - Real-time event notifications with delivery tracking and retry logic
- 📊 **Data Export** - One-time CSV exports of all bin data
- 🌍 **Multi-Language Support** - English, Czech, and German translations
- 🗺️ **Interactive Maps** - Google Maps integration with route optimization and address autocomplete
- 📱 **QR Code System** - Generate, print, and scan QR codes for public bin reporting
- 🔐 **Secure Authentication** - JWT tokens with forgot/reset password flow via email
- 🚀 **Event-Driven Architecture** - Async processing with SQS for resilience and scalability
- 📦 **High-Performance Backend** - Rust Lambda functions with structured logging
- 🌐 **Global CDN** - CloudFront for fast static file delivery worldwide
- 🏗️ **Infrastructure as Code** - Multi-layer Terraform (5 layers) for reproducible deployments
- 🧪 **Local Development** - Full LocalStack integration for testing
- ✅ **Comprehensive Testing** - Unit, integration, and E2E tests with CI/CD automation

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
│   │   ├── components/           # Reusable components
│   │   │   ├── map/             # Map components (BinMap, RouteModal, AddBinModal)
│   │   │   ├── CookieConsent.tsx
│   │   │   ├── LanguageSelector.tsx
│   │   │   └── QRLabel.tsx
│   │   ├── context/              # Auth context
│   │   ├── i18n/                 # Internationalization (EN, CS, DE)
│   │   └── pages/                # All pages
│   │       ├── Login.tsx         # Authentication
│   │       ├── ForgotPassword.tsx
│   │       ├── ResetPassword.tsx
│   │       ├── Dashboard.tsx     # Main bin list with map
│   │       ├── BinDetail.tsx     # Bin details
│   │       ├── BinForm.tsx       # Create/edit bin
│   │       ├── Report.tsx        # Public QR reporting
│   │       ├── QRPrint.tsx       # Batch QR printing
│   │       ├── Settings.tsx      # Settings hub
│   │       ├── ApiKeyList.tsx    # API keys management
│   │       ├── ApiKeyCreate.tsx
│   │       ├── ApiKeyDetail.tsx
│   │       ├── WebhookList.tsx   # Webhooks management
│   │       ├── WebhookForm.tsx
│   │       ├── WebhookDetail.tsx
│   │       ├── Export.tsx        # CSV data export
│   │       ├── PrivacyPolicy.tsx
│   │       ├── Terms.tsx
│   │       └── landing/          # Landing page
│   ├── package.json
│   └── vite.config.ts            # Dev proxy to LocalStack
├── services/                      # Rust microservices
│   ├── bin-status-reporter/      # SQS-triggered status processor
│   ├── lambda-authorizer/        # JWT token validator
│   ├── admin-dashboard-api/      # Main API (CRUD, auth, API keys, webhooks)
│   ├── webhook-sender/           # Webhook delivery service
│   ├── contact-form-handler/     # Contact/demo form handler
│   ├── e2e-tests/                # End-to-end integration tests
│   └── shared/                   # Shared domain models (stub)
├── infrastructure/               # Terraform IaC
│   ├── layers/                   # Multi-layer architecture
│   │   ├── 00-foundation/       # S3 buckets, GitHub Actions IAM
│   │   ├── 01-data/             # DynamoDB (6 tables), Secrets Manager, SQS, SNS
│   │   ├── 02-compute/          # Lambda functions (5), IAM roles, SQS event mapping
│   │   ├── 03-api/              # API Gateway, routes, Lambda authorizer config
│   │   └── 04-frontend/         # CloudFront CDN, S3 static hosting
│   ├── environments/            # Environment configs (local/dev/prod)
│   └── scripts/                 # Deployment scripts
├── scripts/                      # Build and utility scripts
├── docs/                         # Documentation
└── docker-compose.yml           # LocalStack configuration
```

## Core Features

### 🔑 API Keys Management
Create and manage API keys for external integrations with scope-based access control:
- **Scopes**: `bins:read`, `bins:write` for granular permissions
- **Security**: SHA-256 hashed keys, prefix display for identification
- **Tracking**: Last used timestamp, creation date
- **Admin UI**: Full CRUD interface in Settings > API Keys

**External API Endpoint**: `GET /api/external/bins` (requires API key in `X-API-Key` header)

### 🔗 Webhooks
Real-time event notifications with delivery tracking:
- **Events**: Bin status changes, threshold alerts
- **Auth Types**: None, API Key, Bearer token
- **Delivery Stats**: Success/failure counts, last triggered timestamp
- **Retry Logic**: Automatic retry with exponential backoff
- **Admin UI**: Webhooks management in Settings > Webhooks

### 📊 Data Export
One-time CSV export of all bin data:
- Bin ID, name, type, address
- GPS coordinates (latitude/longitude)
- Current fullness percentage
- Report count and last updated timestamp
- Status (active/inactive)
- **Access**: Settings > Data Export

### 🔐 Authentication & Security
- **JWT Tokens**: Secure authentication with automatic refresh
- **Password Reset**: Email-based forgot/reset password flow
- **Token Security**: 1-hour expiry for reset tokens, SHA-256 hashing
- **Email Delivery**: AWS SES integration for production, SMTP for local

### 🌍 Internationalization
Multi-language support with complete translations:
- **English (EN)** - Default
- **Czech (CS)** - Full translation
- **German (DE)** - Full translation
- 470+ translation keys across all UI elements
- Language persistence in URL parameters for SEO

### 🗺️ Maps & Route Planning
Interactive Google Maps integration:
- **Bin Visualization**: Color-coded markers by fullness (green/orange/red)
- **Marker Clustering**: Efficient display of many bins
- **Route Optimization**: Create optimized collection routes through multiple bins
- **Address Autocomplete**: Google Places API for easy bin creation
- **Directions**: Real-time routing with turn-by-turn navigation

### 📱 QR Code System
Generate and print QR codes for public bin reporting:
- **Batch Printing**: Select multiple bins and print all QR codes
- **Filtering**: Filter by bin type, status, and active/inactive
- **Public Reporting**: Users scan QR code to report bin fullness
- **Responsive Design**: Print-optimized layout

### 📨 Contact & Demo Requests
Landing page with contact form and demo request modal:
- **reCAPTCHA v3**: Server-side spam protection
- **Email Delivery**: AWS SES for contact notifications
- **DynamoDB Storage**: 90-day TTL for form submissions
- **Analytics**: Google Analytics integration with cookie consent

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

# Forgot password
curl -X POST "${BASE_URL}/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@ecoscan.local"}'
# Response: {"message": "If an account with that email exists..."}

# Create API key (requires JWT)
curl -X POST "${BASE_URL}/admin/api-keys" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "External Integration", "scopes": ["bins:read"]}'
# Response: {"apiKey": "es_live_abc123...", "keyId": "...", ...}

# List bins using API key (external API)
API_KEY="es_live_abc123..."
curl "${BASE_URL}/api/external/bins" -H "X-API-Key: ${API_KEY}"

# Create webhook (requires JWT)
curl -X POST "${BASE_URL}/admin/webhooks" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "eventTypes": ["bin.status.changed"],
    "authType": "bearer",
    "authValue": "secret_token",
    "isActive": true
  }'
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
