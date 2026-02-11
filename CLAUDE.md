# Model Usage Guidelines
- Context Handling: For reading entire directories, large files (>100KB), or complex architectural analysis, use the gemini MCP tool.
- Token Efficiency: Prefer Gemini for "map-making" (understanding where things are) and Claude for "precision surgery" (writing the specific fix).
- Tool Preference:
    - Use gemini-mcp for: grep, find, and read_file on large modules.
    - Use internal read_file for: Small files (<50 lines) you are currently editing.

# Example Workflow
1. Use Gemini to scan the repo: "Ask Gemini to find all instances of the Auth pattern in ..."
2. Use Claude to implement: "Now that we found the files, Claude, please refactor the login function in ..."

# EcoScan Project Context

This file provides context for Claude Code sessions to quickly understand the project without expensive codebase scanning.

**Last Updated:** 2026-02-11

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
├──────────────┬──────────────┬─────────────────┬──────────┬──────────────┤
│ POST /bins/  │ GET /report/ │ POST /auth/*    │ External │ /admin/*     │
│ {id}/status  │ {bin_id}     │ login, forgot,  │ /api/    │ (JWT req'd)  │
│ (IoT/QR)     │ (Public)     │ reset (No auth) │ external │ bins, keys,  │
│              │              │                 │ /bins    │ webhooks     │
└──────┬───────┴──────┬───────┴────────┬────────┴────┬─────┴──────┬───────┘
       │              │                │             │            │
       ▼              │                │   (API Key) │ ┌──────────▼────────┐
  ┌─────────┐         │                │             │ │ Lambda Authorizer │
  │   SQS   │         │                │             │ │ (JWT validation)  │
  └────┬────┘         │                │             │ └──────────┬────────┘
       │              │                │             │            │
       │              ▼                ▼             ▼            ▼
       │   ┌──────────────────────────────────────────────────────────────┐
       │   │              admin-dashboard-api Lambda                      │
       │   │  (handles auth, bins, api-keys, webhooks, public endpoints) │
       │   └────────────────────────────┬─────────────────────────────────┘
       │                                │
       ▼                                ▼
┌──────────────┐    ┌─────────────────────────────────────────────────────┐
│ bin-status-  │    │                  DynamoDB (6 tables)                │
│ reporter     ├───▶├─────────────┬────────────────┬───────────────────────┤
│ Lambda       │    │ trash-bins  │ status-reports │ admin-users          │
└──────────────┘    │             │                │                      │
                    ├─────────────┼────────────────┼───────────────────────┤
┌──────────────┐    │ api-keys    │ webhook-      │ demo-requests        │
│ webhook-     │    │             │ configs        │                      │
│ sender       ├───▶│             │                │                      │
│ Lambda (SQS) │    └─────────────┴────────────────┴───────────────────────┘
└──────────────┘                   │
                                   │ webhook events
                                   ▼
                              ┌─────────┐
                              │   SNS   │
                              └────┬────┘
                                   │
                                   ▼
                              ┌─────────┐
                              │   SQS   │ → webhook-sender Lambda
                              └─────────┘
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
- **Purpose:** Main API for admin operations, authentication, and public endpoints
- **Endpoints:**
  - **Auth**: `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`
  - **Public**: `GET /report/{bin_id}` - Bin info for QR reporting
  - **Bins**: `GET/POST/PUT/DELETE /admin/bins/*` - Protected bin CRUD
  - **API Keys**: `GET/POST/PUT/DELETE /admin/api-keys/*` - API key management
  - **Webhooks**: `GET/POST/PUT/DELETE /admin/webhooks/*` - Webhook management
  - **External API**: `GET /api/external/bins` - API key authenticated access
- **Key files:**
  - `src/lib.rs` - Request routing
  - `src/application/auth.rs` - Login, password reset logic
  - `src/application/bins.rs` - Bin management
  - `src/application/api_keys.rs` - API key CRUD
  - `src/application/webhooks.rs` - Webhook CRUD
  - `src/domain/api_key.rs` - ApiKey, ApiKeyScope
  - `src/domain/webhook.rs` - Webhook, WebhookAuthType

### webhook-sender
- **Purpose:** Deliver webhook notifications asynchronously
- **Trigger:** SQS messages from SNS topic
- **Features:**
  - HTTP POST delivery with configurable auth (None, API Key, Bearer)
  - Retry logic with exponential backoff
  - Delivery statistics tracking
  - Error handling with DLQ for failed deliveries
- **Key files:**
  - `src/main.rs` - SQS handler
  - `src/application/mod.rs` - Webhook delivery logic
  - `src/infrastructure/dynamodb.rs` - Stats updates

### contact-form-handler
- **Purpose:** Process contact and demo request forms from landing page
- **Trigger:** API Gateway POST `/api/contact`
- **Features:**
  - reCAPTCHA v3 validation for spam protection
  - DynamoDB storage with 90-day TTL
  - Email delivery via AWS SES
  - Score-based filtering (≥0.5 required)
- **Key files:**
  - `src/main.rs` - Lambda handler with reCAPTCHA validation

## Frontend (React SPA)

The admin dashboard is a React SPA hosted on CloudFront + S3.

### Pages & Routes

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | Landing | No | Marketing landing page with contact form |
| `/login` | Login | No | Admin login form |
| `/forgot-password` | ForgotPassword | No | Request password reset email |
| `/reset-password` | ResetPassword | No | Reset password with token |
| `/dashboard` | Dashboard | Yes | Bin list with map/table toggle, route planning |
| `/bins/new` | BinForm | Yes | Create new bin with address autocomplete |
| `/bins/:id` | BinDetail | Yes | View bin details, QR link, delete |
| `/bins/:id/edit` | BinForm | Yes | Edit existing bin |
| `/report?bin={id}` | Report | No | Public QR code reporting page |
| `/qr-print` | QRPrint | Yes | Batch QR code printing with filters |
| `/settings` | Settings | Yes | Settings hub (redirects to /settings/api-keys) |
| `/settings/api-keys` | ApiKeyList | Yes | List and manage API keys |
| `/api-keys/new` | ApiKeyCreate | Yes | Create new API key with scopes |
| `/api-keys/:id` | ApiKeyDetail | Yes | View API key details |
| `/settings/webhooks` | WebhookList | Yes | List webhooks with delivery stats |
| `/webhooks/new` | WebhookForm | Yes | Create new webhook |
| `/webhooks/:id` | WebhookDetail | Yes | View webhook details |
| `/webhooks/:id/edit` | WebhookForm | Yes | Edit existing webhook |
| `/settings/export` | Export | Yes | One-time CSV data export |
| `/privacy` | PrivacyPolicy | No | Privacy policy |
| `/terms` | Terms | No | Terms of service |

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

### ApiKeyScope (admin-dashboard-api)
```rust
pub enum ApiKeyScope {
    BinsRead,   // Read-only access to bins
    BinsWrite,  // Full read/write access to bins
}
```

### WebhookAuthType (admin-dashboard-api)
```rust
pub enum WebhookAuthType {
    None,       // No authentication
    ApiKey,     // API key in header
    Bearer,     // Bearer token in Authorization header
}
```

## API Endpoints

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | None | Get JWT token |
| POST | /auth/forgot-password | None | Request password reset email |
| POST | /auth/reset-password | None | Reset password with token |

### Public Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /bins/{bin_id}/status | None | Submit bin status (queued to SQS) |
| GET | /report/{bin_id} | None | Get public bin info for QR reporting |
| POST | /api/contact | None | Submit contact/demo request form |

### External API (API Key Required)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/external/bins | API Key | List all active bins |

### Admin Endpoints (JWT Required)
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/bins | List all bins |
| GET | /admin/bins/{id} | Get bin details |
| POST | /admin/bins | Create bin |
| PUT | /admin/bins/{id} | Update bin |
| DELETE | /admin/bins/{id} | Soft delete bin |
| GET | /admin/api-keys | List all API keys |
| GET | /admin/api-keys/{key_id} | Get API key details |
| POST | /admin/api-keys | Create API key |
| PUT | /admin/api-keys/{key_id} | Update API key |
| DELETE | /admin/api-keys/{key_id} | Delete API key |
| GET | /admin/webhooks | List all webhooks |
| GET | /admin/webhooks/{webhook_id} | Get webhook details |
| POST | /admin/webhooks | Create webhook |
| PUT | /admin/webhooks/{webhook_id} | Update webhook |
| DELETE | /admin/webhooks/{webhook_id} | Delete webhook |

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
| 01-data | Storage | DynamoDB (6 tables), Secrets Manager (JWT), SQS queues, SNS topics |
| 02-compute | Processing | Lambda functions (5), IAM roles, SQS triggers, event sources |
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
- **Attributes:** passwordHash (bcrypt), name, role (admin/operator/viewer), createdAt, lastLogin, isActive, resetToken (SHA-256 hash), resetTokenExpiry

### api-keys
- **PK:** `keyId` (String/UUID)
- **GSI:** `keyHash` (SHA-256 hash for lookup)
- **Attributes:** name, keyPrefix (first 10 chars), scopes (list), createdAt, lastUsedAt, isActive

### webhook-configs
- **PK:** `webhookId` (String/UUID)
- **Attributes:** url, eventTypes (list), authType, authValue, isActive, successCount, failureCount, lastTriggeredAt, createdAt

### demo-requests
- **PK:** `requestId` (String/UUID)
- **Attributes:** name, email, organization, message, requestType (contact/demo), recaptchaScore, createdAt
- **TTL:** 90 days (automatic deletion)

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

## Recent Changes

### February 2026 (2026-02-11)

1. **API Keys Management System**
   - Full CRUD operations for API keys
   - Scope-based access control (bins:read, bins:write)
   - SHA-256 hashed key storage with prefix display
   - Last used tracking and active/inactive status
   - External API endpoint: `GET /api/external/bins`
   - Frontend pages: ApiKeyList, ApiKeyCreate, ApiKeyDetail
   - New DynamoDB table: `api-keys`

2. **Webhooks Integration**
   - Real-time event notification system
   - Configurable auth types (None, API Key, Bearer)
   - Delivery statistics (success/failure counts, last triggered)
   - Async webhook delivery via SQS with retry logic
   - Frontend pages: WebhookList, WebhookForm, WebhookDetail
   - New Lambda service: `webhook-sender`
   - New DynamoDB table: `webhook-configs`
   - SNS topic for webhook event publishing

3. **Password Reset Flow**
   - Forgot password endpoint with email delivery
   - Secure token generation with SHA-256 hashing
   - 1-hour token expiry for security
   - Frontend pages: ForgotPassword, ResetPassword
   - AWS SES integration for email delivery
   - Security best practices (always show success message)

4. **CSV Data Export**
   - One-time export of all bin data
   - Includes: ID, name, type, address, coordinates, status, reports
   - Frontend page: Export
   - Client-side CSV generation with automatic download
   - ISO timestamp in filename

5. **Internationalization (i18n)**
   - Multi-language support: English (EN), Czech (CS), German (DE)
   - 470+ translation keys covering entire UI
   - Language selector component with URL parameter support
   - HTML lang attribute updates for accessibility
   - Translation files: `i18n/locales/{en,cs,de}.json`

6. **Interactive Maps & Route Planning**
   - Google Maps integration with marker clustering
   - Color-coded bin markers by fullness (green/orange/red)
   - Route optimization through multiple bins
   - Address autocomplete for bin creation
   - Directions rendering with turn-by-turn navigation
   - Components: BinMap, RouteModal, AddBinModal, AddressAutocomplete

7. **QR Code Batch Printing**
   - Print multiple QR codes at once
   - Filter by bin type, status, active/inactive
   - Print-optimized responsive grid layout
   - Preview mode before printing
   - Frontend page: QRPrint

8. **Landing Page & Contact Forms**
   - Full marketing landing page with multiple sections
   - Contact form with reCAPTCHA v3 protection
   - Demo request modal
   - Google Analytics integration with cookie consent
   - Scroll-triggered analytics tracking
   - New Lambda service: `contact-form-handler`
   - New DynamoDB table: `demo-requests` (90-day TTL)

9. **UI/UX Enhancements**
   - Settings hub with navigation tabs
   - Footer component with legal links
   - Cookie consent banner (GDPR-compliant)
   - Privacy Policy and Terms of Service pages
   - Improved dashboard with map/table toggle
   - Enhanced error handling and user feedback

### January 2026 (2026-01-14)

1. **React Frontend Dashboard**
   - Created React SPA with Vite + TypeScript
   - Pages: Login, Dashboard, BinDetail, BinForm, Report
   - API client with JWT auth and automatic token refresh
   - Full CRUD operations for bins

2. **CloudFront + S3 Hosting**
   - Added `04-frontend` infrastructure layer
   - CloudFront CDN with S3 origin for static files
   - API Gateway origin for `/api/*` requests
   - Automatic cache invalidation on deploy

3. **QR Code Reporting Flow**
   - Added `ReportSource` enum (iot/qr/manual) to track report origin
   - Added `GET /report/{bin_id}` public endpoint for QR landing page
   - Added `PublicBinInfo` struct with limited bin data

4. **CI/CD Updates**
   - Added frontend build and deploy jobs
   - Change detection for frontend code
   - S3 sync with proper cache headers

5. **Code Quality**
   - Fixed clippy warnings
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

1. **Notifier Service** - Real-time alerts when bins reach thresholds (push notifications, SMS)
2. **User Management** - Admin CRUD for user accounts and role management
3. **Advanced Analytics** - Time-series analysis, predictive modeling, reporting dashboards
4. **Multi-tenant** - Organization support with isolated data and custom branding
5. **Custom Domain** - Route53 + ACM certificate setup for production domains
6. **Mobile App** - Native iOS/Android apps for bin reporting and route management
7. **IoT Integration** - Direct integration with smart bin sensors
8. **AI Optimization** - Machine learning for route optimization and fill prediction
