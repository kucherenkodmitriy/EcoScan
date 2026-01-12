# EcoScan Project Context

This file provides context for Claude Code sessions to quickly understand the project without expensive codebase scanning.

## Project Overview

**EcoScan** is a serverless trash bin monitoring system built with:
- **Language:** Rust (for all Lambda functions)
- **Cloud:** AWS (Lambda, DynamoDB, API Gateway, SQS) with LocalStack for local development
- **Infrastructure:** Terraform with 4-layer architecture
- **CI/CD:** GitHub Actions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
├─────────────────┬───────────────────────┬───────────────────────┤
│ POST /bins/{id}/status │ POST /auth/login │ GET/POST /admin/*   │
│ (No auth, IoT devices) │ (No auth)        │ (JWT required)       │
└────────┬────────────────┴────────┬────────┴──────────┬──────────┘
         │                         │                    │
         ▼                         │                    │
    ┌─────────┐                    │         ┌─────────▼─────────┐
    │   SQS   │                    │         │ Lambda Authorizer │
    └────┬────┘                    │         │ (JWT validation)  │
         │                         │         └─────────┬─────────┘
         ▼                         ▼                   │
┌─────────────────┐     ┌──────────────────┐          │
│ bin-status-     │     │ admin-dashboard- │◄─────────┘
│ reporter Lambda │     │ api Lambda       │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DynamoDB                                 │
├─────────────────┬─────────────────────┬─────────────────────────┤
│   trash-bins    │   status-reports    │     admin-users         │
│ (current state) │ (history, time-series)│ (credentials)         │
└─────────────────┴─────────────────────┴─────────────────────────┘
```

## Directory Structure

```
EcoScan/
├── services/                     # Rust Lambda services
│   ├── Cargo.toml               # Workspace definition
│   ├── bin-status-reporter/     # ✅ IMPLEMENTED - SQS-triggered status processor
│   ├── lambda-authorizer/       # ✅ IMPLEMENTED - JWT token validator
│   ├── admin-dashboard-api/     # ✅ IMPLEMENTED - Admin CRUD API
│   ├── e2e-tests/              # ✅ IMPLEMENTED - End-to-end tests
│   ├── notifier/               # ❌ STUB - Future notification service
│   └── shared/                 # ❌ STUB - Shared domain models (not integrated)
│
├── infrastructure/
│   ├── layers/
│   │   ├── 00-foundation/      # S3 buckets, GitHub Actions IAM
│   │   ├── 01-data/            # DynamoDB tables, Secrets Manager, SQS queues
│   │   ├── 02-compute/         # Lambda functions, IAM roles, SQS event mapping
│   │   └── 03-api/             # API Gateway, Lambda authorizer config
│   ├── environments/           # tfvars for local/dev/prod
│   ├── backend/                # Terraform backend configs
│   └── scripts/                # init-environment.sh
│
├── scripts/
│   ├── build-lambda.sh         # Build all Lambda services
│   ├── seed-data.sh            # Seed test data + admin user
│   ├── run-e2e-tests.sh        # Run E2E tests
│   ├── smoke-test.sh           # Quick deployment validation
│   └── test-authorizer.sh      # Test JWT authorizer
│
├── docs/                       # All documentation
│   ├── openapi.yaml            # OpenAPI 3.0 specification
│   ├── ARCHITECTURE.md         # System design
│   ├── BUILD_GUIDE.md          # Build instructions
│   ├── TESTING_GUIDE.md        # Manual testing procedures
│   ├── TESTING_AUTOMATION.md   # CI/CD testing
│   ├── DISTRIBUTED_TRACING_GUIDE.md # X-Ray & CloudWatch
│   ├── GITHUB_ACTIONS_SETUP.md # CI/CD IAM setup
│   ├── api-sqs-lambda-flow.md  # API flow documentation
│   └── localstack-debugging-insights.md # LocalStack tips
│
├── .github/workflows/          # CI/CD pipelines
│   ├── ci.yml                  # Main CI pipeline
│   └── deploy-dev.yml          # Dev deployment
│
├── README.md                   # Project overview
└── CLAUDE.md                   # This file (AI context)
```

## Service Details

### bin-status-reporter (✅ Complete)
- **Purpose:** Process bin status updates from IoT devices
- **Trigger:** SQS messages from API Gateway
- **Features:**
  - Weighted average fullness calculation
  - Stores current status + historical reports
  - Batch processing with partial failure support
- **Key files:**
  - `src/domain/fullness.rs` - Weighted average algorithm
  - `src/infrastructure/dynamodb.rs` - DynamoDB operations

### lambda-authorizer (✅ Complete)
- **Purpose:** Validate JWT tokens for admin endpoints
- **Returns:** IAM Allow/Deny policy with user context
- **Key config:** `JWT_SECRET_ARN` (production) or `JWT_SECRET` (local dev)
- **Key files:**
  - `src/main.rs` - Token validation, Secrets Manager integration

### admin-dashboard-api (✅ Complete)
- **Purpose:** Admin CRUD operations for bins and authentication
- **Endpoints:**
  - `POST /auth/login` - Returns JWT token
  - `GET /admin/bins` - List all bins
  - `GET/POST/PUT/DELETE /admin/bins/{id}` - Bin CRUD
- **Authentication:** JWT via Lambda authorizer
- **Key files:**
  - `src/application/auth.rs` - Login logic
  - `src/application/bins.rs` - Bin management
  - `src/infrastructure/jwt.rs` - Token generation
  - `src/infrastructure/secrets.rs` - Secrets Manager integration

## Patterns & Conventions

### Rust Service Structure
```
service/
├── src/
│   ├── main.rs           # Entry point, logging init
│   ├── lib.rs            # Handler exports, routing
│   ├── config.rs         # Environment config
│   ├── application/      # Business logic
│   ├── domain/           # Models, traits, errors
│   └── infrastructure/   # DynamoDB, external services
└── Cargo.toml
```

### Naming Conventions
- **Terraform resources:** `${environment}-${project_name}-{resource}`
- **DynamoDB tables:** `${environment}-ecoscan-{table-name}`
- **Lambda functions:** `${environment}-ecoscan-{function-name}`
- **IAM roles:** `${environment}-ecoscan-{service}-role`

### Environment Variables
Common across services:
- `DYNAMODB_ENDPOINT_URL` - LocalStack endpoint (only for local)
- `TRASH_BINS_TABLE_NAME` - Bins table name
- `STATUS_REPORTS_TABLE_NAME` - Reports table name
- `AWS_REGION` - Default: eu-central-1

Admin-specific:
- `ADMIN_USERS_TABLE_NAME` - Users table name
- `JWT_SECRET_ARN` - Secrets Manager ARN (production only)
- `JWT_SECRET` - Token signing secret (LocalStack only, fallback)
- `JWT_EXPIRY_HOURS` - Token lifetime (default: 24)

## JWT Secret Management

The JWT signing secret is managed differently based on environment:

### Production (AWS)
- Secret stored in **AWS Secrets Manager**
- Lambda receives `JWT_SECRET_ARN` environment variable
- Secret fetched at Lambda cold start and cached
- Terraform creates secret in `01-data` layer with auto-generated value
- IAM policies grant `secretsmanager:GetSecretValue` permission

### Local Development (LocalStack)
- Secret passed directly via `JWT_SECRET` environment variable
- Configured in `infrastructure/environments/local.tfvars` or `.env.local`
- No Secrets Manager integration (simpler for local dev)

### Configuration Files
- `.env.local.example` - Template for local development overrides
- `.env.local` - Your local overrides (gitignored)

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                    JWT Secret Resolution                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Lambda Cold Start                                               │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────┐                                        │
│  │ JWT_SECRET_ARN set? │                                        │
│  └──────────┬──────────┘                                        │
│        Yes  │  No                                                │
│       ┌─────┴─────┐                                             │
│       ▼           ▼                                              │
│  ┌─────────┐  ┌─────────────────┐                               │
│  │ Fetch   │  │ JWT_SECRET set? │                               │
│  │ from SM │  └────────┬────────┘                               │
│  └────┬────┘      Yes  │  No                                    │
│       │          ┌─────┴─────┐                                  │
│       │          ▼           ▼                                   │
│       │     ┌────────┐  ┌─────────┐                             │
│       │     │ Use it │  │ ERROR   │                             │
│       │     └────┬───┘  └─────────┘                             │
│       │          │                                               │
│       └────┬─────┘                                               │
│            ▼                                                     │
│       ┌────────────┐                                            │
│       │ Cache &    │                                            │
│       │ Use Secret │                                            │
│       └────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Commands

```bash
# Build all Lambda services
./scripts/build-lambda.sh [x86_64|arm64] [all|service-name]

# Deploy to LocalStack
./infrastructure/scripts/init-environment.sh local

# Seed test data (includes admin user)
./scripts/seed-data.sh

# Run E2E tests
./scripts/run-e2e-tests.sh

# Run unit tests
cd services && cargo test

# Test login
curl -X POST http://localhost:4566/.../auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@ecoscan.local", "password": "admin123"}'
```

## Current State (as of last update)

### ✅ Implemented
- Bin status reporting (IoT → API → SQS → Lambda → DynamoDB)
- Weighted average fullness calculation
- Admin authentication (JWT)
- Lambda authorizer for protected routes
- Admin CRUD for bins
- JWT secret management via AWS Secrets Manager (production)
- Distributed tracing (X-Ray + CloudWatch)
- CI/CD pipeline
- LocalStack development environment

### ❌ Not Yet Implemented
- `notifier` service - Email/SMS/push notifications
- `shared` library - Not integrated into workspace
- Frontend UI - Backend API only
- User management endpoints (create/delete users)
- Bin location management

## Infrastructure Layers

Deploy order: 00 → 01 → 02 → 03 (unidirectional dependency flow)

| Layer | Purpose | Key Resources |
|-------|---------|---------------|
| 00-foundation | Base resources | S3 buckets, GitHub Actions IAM |
| 01-data | Data storage | DynamoDB tables (3), Secrets Manager (JWT secret), SQS queues |
| 02-compute | Processing | Lambda functions (3), IAM roles, SQS event source mapping |
| 03-api | API layer | API Gateway, Lambda authorizer config |

## DynamoDB Tables

### trash-bins
- **PK:** `binId` (String/UUID)
- **Attributes:** Name, status (0-100), reportsCount, lastUpdated, isActive

### status-reports
- **PK:** `binId` (String), **SK:** `createdAt` (String/ISO8601)
- **Attributes:** status (0-100)

### admin-users
- **PK:** `email` (String)
- **Attributes:** passwordHash (bcrypt), name, role, createdAt, lastLogin, isActive

## API Endpoints

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /bins/{bin_id}/status | None | bin-status-reporter (via SQS) |
| POST | /auth/login | None | admin-dashboard-api |
| GET | /admin/bins | JWT | admin-dashboard-api |
| GET | /admin/bins/{id} | JWT | admin-dashboard-api |
| POST | /admin/bins | JWT | admin-dashboard-api |
| PUT | /admin/bins/{id} | JWT | admin-dashboard-api |
| DELETE | /admin/bins/{id} | JWT | admin-dashboard-api |

## Test Credentials

For local development:
- **Email:** admin@ecoscan.local
- **Password:** admin123

## Key Dependencies (workspace)

```toml
tokio = "1.0"                  # Async runtime
lambda_runtime = "0.8"         # AWS Lambda runtime
aws-sdk-dynamodb = "1.0"       # DynamoDB client
aws-sdk-secretsmanager = "1.0" # Secrets Manager client
aws-config = "1.0"             # AWS config loader
jsonwebtoken = "9.0"           # JWT handling (admin-dashboard-api, lambda-authorizer)
bcrypt = "0.15"                # Password hashing (admin-dashboard-api)
uuid = "1.0"                   # UUID generation
chrono = "0.4"                 # Date/time handling
tracing = "0.1"                # Logging
```

## Future Plans

1. **Notifier Service** - Send alerts when bins reach thresholds
2. **Frontend Dashboard** - React/Vue SPA for admin UI
3. **Location Management** - Assign bins to locations
4. **User Management** - Admin endpoints for user CRUD
5. **Reporting** - Analytics and export functionality

## Known Issues & Fixes

### Test Status
- **Unit tests:** 56 passing total
  - 12 admin-dashboard-api
  - 35 bin-status-reporter
  - 9 lambda-authorizer
- **E2E tests:** Require LocalStack running with `API_ENDPOINT` env var

### aws_config deprecation
Use `aws_config::defaults(BehaviorVersion::latest())` instead of `aws_config::from_env()`.

### tracing-subscriber json feature
The workspace Cargo.toml includes `json` feature for structured Lambda logging:
```toml
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
```

---

## Troubleshooting

### LocalStack Issues
- Check `docker-compose logs localstack`
- Ensure all tables created: `awslocal dynamodb list-tables`
- Check Lambda logs: `awslocal logs tail /aws/lambda/{function-name}`

### Build Issues
- Clean build: `cd services && cargo clean`
- Check Docker is running for Lambda builds
- Verify architecture matches (arm64 for Apple Silicon LocalStack)

### Auth Issues
- **Production:** Verify both Lambdas have `secretsmanager:GetSecretValue` permission
- **LocalStack:** Verify `JWT_SECRET` env var is set (check Terraform output)
- Check token expiry (default 24h)
- Test with: `curl -v` to see authorization header processing
- Check Lambda logs for "JWT secret loaded successfully" message at cold start
