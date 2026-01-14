# EcoScan Project Context

This file provides context for Claude Code sessions to quickly understand the project without expensive codebase scanning.

**Last Updated:** 2026-01-14

## Project Overview

**EcoScan** is a serverless trash bin monitoring system built with:
- **Language:** Rust (Lambda functions), TypeScript/React (Frontend)
- **Cloud:** AWS (Lambda, DynamoDB, API Gateway, SQS, CloudFront, S3) with LocalStack for local development
- **Infrastructure:** Terraform with 5-layer architecture
- **CI/CD:** GitHub Actions with OIDC authentication

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CloudFront (CDN + Custom Domain)                     │
├─────────────────────────────────┬───────────────────────────────────────┤
│  /* (Static files)              │  /api/* (API requests)                │
│  → S3 Bucket (React SPA)        │  → API Gateway                        │
└─────────────────────────────────┴──────────────────┬────────────────────┘
                                                     │
┌────────────────────────────────────────────────────▼────────────────────┐
│                            API Gateway                                   │
├──────────────┬──────────────┬─────────────────┬─────────────────────────┤
│ POST /bins/  │ GET /report/ │ POST /auth/     │ GET/POST/PUT/DELETE     │
│ {id}/status  │ {bin_id}     │ login           │ /admin/*                │
│ (IoT/QR)     │ (Public)     │ (No auth)       │ (JWT required)          │
└──────┬───────┴──────┬───────┴────────┬────────┴──────────┬──────────────┘
       │              │                │                   │
       ▼              │                │        ┌──────────▼──────────┐
  ┌─────────┐         │                │        │ Lambda Authorizer   │
  │   SQS   │         │                │        │ (JWT validation)    │
  └────┬────┘         │                │        └──────────┬──────────┘
       │              │                │                   │
       ▼              ▼                ▼                   │
┌─────────────────┐  ┌──────────────────────────────────────────────────┐
│ bin-status-     │  │            admin-dashboard-api Lambda            │
│ reporter Lambda │  │  (handles /report, /auth/login, /admin/*)       │
└────────┬────────┘  └───────────────────────┬──────────────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              DynamoDB                                    │
├─────────────────┬───────────────────────┬───────────────────────────────┤
│   trash-bins    │    status-reports     │         admin-users           │
│ (current state) │ (history, time-series)│       (credentials)           │
└─────────────────┴───────────────────────┴───────────────────────────────┘
```

## Directory Structure

```
EcoScan/
├── services/                     # Rust Lambda services
│   ├── Cargo.toml               # Workspace definition
│   ├── bin-status-reporter/     # SQS-triggered status processor
│   ├── lambda-authorizer/       # JWT token validator
│   ├── admin-dashboard-api/     # Admin CRUD API + public endpoints
│   ├── e2e-tests/              # End-to-end tests
│   ├── notifier/               # STUB - Future notification service
│   └── shared/                 # STUB - Shared domain models
│
├── frontend/                     # React SPA (Admin Dashboard)
│   ├── src/
│   │   ├── api/client.ts       # API client with auth
│   │   ├── context/AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx       # Admin login
│   │   │   ├── Dashboard.tsx   # Bin list with stats
│   │   │   ├── BinDetail.tsx   # Single bin view
│   │   │   ├── BinForm.tsx     # Create/edit bin
│   │   │   └── Report.tsx      # Public QR reporting page
│   │   └── App.tsx             # Routes
│   ├── package.json
│   └── vite.config.ts          # Dev proxy to LocalStack
│
├── infrastructure/
│   ├── layers/
│   │   ├── 00-foundation/      # S3 buckets, GitHub Actions IAM
│   │   ├── 01-data/            # DynamoDB tables, Secrets Manager, SQS
│   │   ├── 02-compute/         # Lambda functions, IAM roles
│   │   ├── 03-api/             # API Gateway, routes, integrations
│   │   └── 04-frontend/        # CloudFront CDN, S3 static hosting
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
├── docs/
│   ├── openapi.yaml            # OpenAPI 3.0 specification
│   ├── ARCHITECTURE.md         # System design
│   ├── BUILD_GUIDE.md          # Build instructions
│   ├── TESTING_GUIDE.md        # Manual testing procedures
│   └── ...
│
├── .github/workflows/
│   ├── ci.yml                  # Main CI/CD pipeline
│   └── deploy-dev.yml          # Dev deployment (legacy)
│
├── README.md
└── CLAUDE.md                   # This file
```

## Service Details

### bin-status-reporter
- **Purpose:** Process bin status updates from IoT devices and QR code reports
- **Trigger:** SQS messages from API Gateway
- **Features:**
  - Weighted average fullness calculation
  - Stores current status + historical reports
  - Batch processing with partial failure support
  - **ReportSource tracking** (iot, qr, manual)
- **Key files:**
  - `src/domain/mod.rs` - StatusUpdate, ReportSource enum
  - `src/domain/fullness.rs` - Weighted average algorithm
  - `src/infrastructure/dynamodb.rs` - DynamoDB operations

### lambda-authorizer
- **Purpose:** Validate JWT tokens for admin endpoints
- **Returns:** IAM Allow/Deny policy with user context
- **Key config:** `JWT_SECRET_ARN` (production) or `JWT_SECRET` (local)
- **Key files:**
  - `src/main.rs` - Token validation, Secrets Manager integration

### admin-dashboard-api
- **Purpose:** Admin CRUD + public bin info for QR reports
- **Endpoints:**
  - `POST /auth/login` - Returns JWT token
  - `GET /report/{bin_id}` - **Public** bin info (name, type, address)
  - `GET/POST/PUT/DELETE /admin/bins/*` - Protected bin CRUD
- **Key files:**
  - `src/lib.rs` - Request routing
  - `src/application/auth.rs` - Login logic
  - `src/application/bins.rs` - Bin management
  - `src/domain/bin.rs` - BinInfo, PublicBinInfo, BinType

## Frontend (React SPA)

The admin dashboard is a React SPA hosted on CloudFront + S3.

### Pages & Routes

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/login` | Login | No | Admin login form |
| `/dashboard` | Dashboard | Yes | Bin list with stats, create/refresh |
| `/bins/new` | BinForm | Yes | Create new bin |
| `/bins/:id` | BinDetail | Yes | View bin details, QR link, delete |
| `/bins/:id/edit` | BinForm | Yes | Edit existing bin |
| `/report?bin={id}` | Report | No | Public QR code reporting page |

### Key Files
- `src/api/client.ts` - API functions with JWT auth
- `src/context/AuthContext.tsx` - Auth state management
- `src/App.tsx` - Route definitions with PrivateRoute wrapper

### Local Development
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:3000
```

The Vite dev server proxies `/api/*` to LocalStack API Gateway.

## Domain Models

### ReportSource (bin-status-reporter)
```rust
pub enum ReportSource {
    Iot,    // IoT device sensor readings
    Qr,     // QR code scan from mobile (default)
    Manual, // Manual entry from admin dashboard
}
```

### BinType (admin-dashboard-api)
```rust
#[serde(rename_all = "lowercase")]
pub enum BinType {
    Mixed,    // Mixed waste (default)
    Plastic,  // Plastic recyclables
    Paper,    // Paper recyclables
    Glass,    // Glass recyclables
}
```

### PublicBinInfo (admin-dashboard-api)
Limited bin info returned by public `/report/{bin_id}` endpoint:
```rust
pub struct PublicBinInfo {
    pub bin_id: Uuid,
    pub name: String,
    pub bin_type: BinType,
    pub address: Option<String>,
}
```

## API Endpoints

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | /bins/{bin_id}/status | None | bin-status-reporter (SQS) | Submit bin status |
| GET | /report/{bin_id} | None | admin-dashboard-api | Public bin info for QR page |
| POST | /auth/login | None | admin-dashboard-api | Get JWT token |
| GET | /admin/bins | JWT | admin-dashboard-api | List all bins |
| GET | /admin/bins/{id} | JWT | admin-dashboard-api | Get bin details |
| POST | /admin/bins | JWT | admin-dashboard-api | Create bin |
| PUT | /admin/bins/{id} | JWT | admin-dashboard-api | Update bin |
| DELETE | /admin/bins/{id} | JWT | admin-dashboard-api | Soft delete bin |

## QR Code Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  QR Code    │────▶│ report.html │────▶│ GET /report │────▶│ Display bin │
│  on bin     │     │ (static)    │     │ /{bin_id}   │     │ info + form │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                    ┌─────────────┐     ┌─────────────┐            │
                    │  DynamoDB   │◀────│ Lambda via  │◀───────────┘
                    │  updated    │     │ SQS         │     User submits
                    └─────────────┘     └─────────────┘     status (0-100)
```

**QR URL Format:** `https://{domain}/static/report.html?bin={bin_id}`

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) includes:

1. **Detect Changes** - Determines which components changed (rust, frontend, infra layers)
2. **Lint** - `cargo fmt --check` + `cargo clippy -- -D warnings`
3. **Test** - `cargo test --lib`
4. **Terraform Validate** - All 5 layers
5. **Build Lambda** - Builds all 3 Lambda zips via Docker
6. **Build Frontend** - `npm ci && npm run build` (React SPA)
7. **Deploy Foundation** → **Deploy Data** → **Deploy API** → **Deploy Compute**
8. **Deploy Frontend** - Terraform (CloudFront/S3) + S3 sync + cache invalidation
9. **Upload Lambda to S3** - Stores artifacts for future deployments
10. **Smoke Tests** - Basic endpoint validation
11. **E2E Tests** - Full integration tests

### Lambda Artifacts
The build produces 3 separate zip files:
- `lambda.zip` - bin-status-reporter
- `authorizer.zip` - lambda-authorizer
- `admin-dashboard.zip` - admin-dashboard-api

### Frontend Deployment
- Builds React app with Vite
- Uploads to S3 with cache headers (immutable for assets, no-cache for index.html)
- Invalidates CloudFront cache after deployment

## Infrastructure Layers

Deploy order: 00 → 01 → 03 → 02 → 04

| Layer | Purpose | Key Resources |
|-------|---------|---------------|
| 00-foundation | Base | S3 buckets, GitHub Actions IAM (incl. Secrets Manager perms) |
| 01-data | Storage | DynamoDB (3 tables), Secrets Manager (JWT), SQS queues |
| 02-compute | Processing | Lambda functions (3), IAM roles, SQS triggers |
| 03-api | Gateway | API Gateway, routes, Lambda integrations, authorizer config |
| 04-frontend | CDN | CloudFront distribution, S3 bucket for React SPA |

## DynamoDB Tables

### trash-bins
- **PK:** `binId` (String/UUID)
- **Attributes:** Name, binType, status (0-100), reportsCount, lastUpdated, isActive, address, coordinates

### status-reports
- **PK:** `binId` (String), **SK:** `createdAt` (String/ISO8601)
- **Attributes:** status (0-100), source (iot/qr/manual)

### admin-users
- **PK:** `email` (String)
- **Attributes:** passwordHash (bcrypt), name, role (admin/operator/viewer), createdAt, lastLogin, isActive

## Environment Variables

**Common:**
- `DYNAMODB_ENDPOINT_URL` - LocalStack only
- `TRASH_BINS_TABLE_NAME`
- `STATUS_REPORTS_TABLE_NAME`
- `AWS_REGION` - Default: eu-central-1

**Admin/Authorizer:**
- `ADMIN_USERS_TABLE_NAME`
- `JWT_SECRET_ARN` - Secrets Manager ARN (AWS)
- `JWT_SECRET` - Direct secret (LocalStack fallback)
- `JWT_EXPIRY_HOURS` - Default: 24

## Quick Commands

```bash
# Build all Lambda services
./scripts/build-lambda.sh [x86_64|arm64] [all|service-name]

# Deploy to LocalStack
./infrastructure/scripts/init-environment.sh local

# Seed test data
./scripts/seed-data.sh

# Run unit tests
cd services && cargo test --lib

# Run E2E tests (requires LocalStack or AWS)
./scripts/run-e2e-tests.sh

# Format code
cd services && cargo fmt

# Lint check
cd services && cargo clippy -- -D warnings
```

## Test Credentials (Local)

- **Email:** admin@ecoscan.local
- **Password:** admin123

## Test Status

- **Unit tests:** 50 passing
  - 14 admin-dashboard-api
  - 36 bin-status-reporter (includes ReportSource tests)
  - lambda-authorizer tests
- **E2E tests:** Require running environment

## Key Dependencies

```toml
tokio = "1.0"
lambda_runtime = "0.8"
aws-sdk-dynamodb = "1.0"
aws-sdk-secretsmanager = "1.0"
aws-config = "1.0"
jsonwebtoken = "9.0"
bcrypt = "0.15"
uuid = "1.0"
chrono = "0.4"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
```

## Recent Changes (Jan 2026)

1. **React Frontend Dashboard** (2026-01-14)
   - Created React SPA with Vite + TypeScript
   - Pages: Login, Dashboard, BinDetail, BinForm, Report
   - API client with JWT auth and automatic token refresh
   - Full CRUD operations for bins

2. **CloudFront + S3 Hosting** (2026-01-14)
   - Added `04-frontend` infrastructure layer
   - CloudFront CDN with S3 origin for static files
   - API Gateway origin for `/api/*` requests
   - Automatic cache invalidation on deploy
   - Custom domain support (optional, for future use)

3. **QR Code Reporting Flow**
   - Added `ReportSource` enum (iot/qr/manual) to track report origin
   - Added `GET /report/{bin_id}` public endpoint for QR landing page
   - Added `PublicBinInfo` struct with limited bin data

4. **CI/CD Updates**
   - Added frontend build and deploy jobs
   - Change detection for frontend code
   - S3 sync with proper cache headers
   - CloudFront invalidation after deploy

5. **Code Quality**
   - Fixed clippy warnings (strip_prefix, type_complexity, derive Default)
   - Renamed `from_str` methods to `parse` to avoid trait conflicts

## Known Issues & Solutions

### Terraform Backend
- `override.tf` files in layer directories override S3 backend with local
- These are gitignored; don't commit them
- CI uses S3 backend via `-backend-config` flags

### Clippy Strict Mode
CI runs `clippy -- -D warnings`. Common fixes:
- Use `strip_prefix()` instead of manual slicing
- Add `#[allow(clippy::type_complexity)]` for complex handler types
- Use `#[derive(Default)]` with `#[default]` attribute on enum variants

### GitHub Actions IAM
The role needs permissions for:
- S3 (Terraform state)
- DynamoDB, Lambda, API Gateway, SQS, IAM
- **Secrets Manager** (create, read, update, delete secrets)

## Troubleshooting

### LocalStack
```bash
docker-compose logs localstack
awslocal dynamodb list-tables
awslocal logs tail /aws/lambda/{function-name}
```

### Build Issues
```bash
cd services && cargo clean
docker ps  # Ensure Docker running
```

### Auth Issues
- Check `JWT_SECRET_ARN` or `JWT_SECRET` env var
- Verify IAM policies include `secretsmanager:GetSecretValue`
- Check Lambda logs for "JWT secret loaded" message

---

## Future Work

1. **Notifier Service** - Alerts when bins reach thresholds
2. **User Management** - Admin CRUD for users
3. **Analytics** - Reporting and data export
4. **Multi-tenant** - Organization support
5. **Custom Domain** - Route53 + ACM certificate setup
