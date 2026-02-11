# EcoScan Architecture

## Overview
EcoScan is a serverless trash bin monitoring system with a React admin dashboard, built with Rust Lambda functions, API Gateway, SQS, DynamoDB, CloudFront, and S3. The entire infrastructure is managed as code using **Terraform** with a multi-layer approach, ensuring a consistent and reproducible environment for both local development and cloud deployment.

## System Architecture

### Full Architecture with Frontend
```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CloudFront (CDN + HTTPS)                             │
├─────────────────────────────────┬───────────────────────────────────────┤
│  /* (default)                   │  /api/* (API requests)                │
│  Origin: S3 Bucket              │  Origin: API Gateway                  │
│  (React SPA static files)       │  (Lambda backend)                     │
└─────────────────────────────────┴──────────────────┬────────────────────┘
                                                     │
┌────────────────────────────────────────────────────▼────────────────────┐
│                            API Gateway                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Event-Driven Async Architecture (Backend)
```
┌──────────┐    ┌─────────────┐    ┌───────────┐    ┌────────┐    ┌──────────┐
│  Client  │───▶│ API Gateway │───▶│ SQS Queue │───▶│ Lambda │───▶│ DynamoDB │
└──────────┘    └─────────────┘    └─────┬─────┘    └────────┘    └──────────┘
                                          │
                                          ▼
                                    ┌──────────┐
                                    │   DLQ    │
                                    └──────────┘
```

**Benefits of SQS Integration:**
- ✅ **Resilience**: Messages aren't lost if Lambda is unavailable
- ✅ **Scalability**: Queue absorbs traffic spikes automatically
- ✅ **Cost Optimization**: Failed processing retries without re-invoking API Gateway
- ✅ **Decoupling**: API and compute layers scale independently
- ✅ **Observability**: SQS metrics show queue depth and processing rate

### Infrastructure as Code with Terraform

EcoScan uses a **multi-layer Terraform architecture**:

```
00-foundation (S3 buckets, IAM)
    ↓
01-data (DynamoDB tables, SQS)
    ↓
03-api (API Gateway + routes)
    ↓
02-compute (Lambda + IAM roles)
    ↓
04-frontend (CloudFront + S3)
```

**Key Features:**
- **Single Source of Truth**: All AWS resources defined in `.tf` files
- **Layer Isolation**: Each layer has its own state and can be deployed independently
- **Environment Parity**: Same configuration for LocalStack and AWS
- **Automated Deployment**: Scripts handle layer dependencies automatically
- **CDN Hosting**: CloudFront serves React SPA with API Gateway integration

### Full Architecture Diagram
```
                     ┌─────────────┐
                     │  Terraform  │
                     └──────┬──────┘
                            │ provisions all layers
                            ▼
        ┌───────────────────────────────────────────────────┐
        │              LocalStack / AWS                     │
        ├───────────────────────────────────────────────────┤
        │                                                   │
        │  ┌─────────┐    ┌────────────┐    ┌──────────┐  │
        │  │   S3    │    │    IAM     │    │   Logs   │  │
        │  └─────────┘    └────────────┘    └──────────┘  │
        │                                                   │
        │  ┌──────────────────────────────────────────┐   │
        │  │         API Gateway (REST API)           │   │
        │  │  POST /bins/{bin_id}/status              │   │
        │  └────────────────┬─────────────────────────┘   │
        │                   │ sends message                │
        │                   ▼                              │
        │  ┌──────────────────────────────────────────┐   │
        │  │  SQS Queue: status-updates               │   │
        │  │  - Visibility: 90s                       │   │
        │  │  - Retention: 4 days                     │   │
        │  │  - DLQ after 3 retries                   │   │
        │  └────────────────┬─────────────────────────┘   │
        │                   │ triggers (event source)      │
        │                   ▼                              │
        │  ┌──────────────────────────────────────────┐   │
        │  │  Lambda: update-bin-status (Rust)        │   │
        │  │  - Handler: sqs_handler                  │   │
        │  │  - Runtime: provided.al2                 │   │
        │  │  - Architecture: x86_64                  │   │
        │  └────────────────┬─────────────────────────┘   │
        │                   │ reads/writes                 │
        │                   ▼                              │
        │  ┌──────────────────────────────────────────┐   │
        │  │  DynamoDB Tables                         │   │
        │  │  - trash-bins (binId: PK)                │   │
        │  │  - status-reports (binId: PK, time: SK)  │   │
        │  └──────────────────────────────────────────┘   │
        │                                                   │
        └───────────────────────────────────────────────────┘
```

## Components

### API Gateway
- **Endpoint**: `POST /bins/{bin_id}/status`
- **Request**: `{"status": 0-100}`
- **Response**: `{"message": "Status update queued for processing"}`
- **Integration**: Direct SQS integration (AWS service proxy)
- **Transformation**: VTL template combines `binId` from path + `status` from body

### SQS Queues

#### Main Queue: `status-updates`
- **Purpose**: Primary message queue for status updates
- **Visibility Timeout**: 90 seconds
- **Message Retention**: 4 days
- **Max Receive Count**: 3 (then moves to DLQ)

#### Dead Letter Queue: `status-updates-dlq`
- **Purpose**: Captures failed messages for investigation
- **Message Retention**: 14 days

### Lambda Microservices (Rust)

#### bin-status-reporter (Production Ready ✅)
Main service that processes status updates from SQS.

**Handler**: `sqs_handler` - Processes batches of SQS messages
- Parses message body: `{"binId": "...", "status": 75}`
- Validates bin ID (UUID) and status (0-100)
- Updates DynamoDB with new status
- Returns batch item failures for retry/DLQ handling

**Architecture**:
```
src/
├── main.rs           # SQS handler entry point
├── lib.rs            # SQS event processing
├── application/      # Business logic
├── domain/           # Business entities
└── infrastructure/   # DynamoDB repository
```

#### webhook-sender (Production Ready ✅)
Asynchronous webhook delivery service triggered by SNS/SQS.

**Handler**: `sqs_handler` - Processes webhook delivery requests
- Receives webhook events from SQS queue
- Makes HTTP POST requests to configured webhook URLs
- Supports three auth types: None, API Key, Bearer token
- Updates delivery statistics in DynamoDB
- Implements retry logic with exponential backoff
- Handles failures with DLQ for manual investigation

**Architecture**:
```
src/
├── main.rs           # SQS handler entry point
├── lib.rs            # Webhook delivery logic
├── application/      # Business logic for HTTP delivery
├── domain/           # Webhook entities and errors
└── infrastructure/   # DynamoDB repository for stats
```

#### contact-form-handler (Production Ready ✅)
Processes contact and demo request forms from the landing page.

**Handler**: `lambda_handler` - API Gateway integration
- Validates reCAPTCHA v3 tokens (score ≥0.5)
- Stores submissions in DynamoDB with 90-day TTL
- Sends email notifications via AWS SES
- Prevents spam with server-side validation
- Supports two request types: "contact" and "demo"

**Architecture**:
```
src/
└── main.rs           # Lambda handler with reCAPTCHA validation
```

#### Future Services (Planned)
- **notifier**: Real-time push/email notifications when bins reach thresholds
- **shared**: Shared domain models, DTOs, and utilities (currently stub)

### Frontend (React SPA)

The admin dashboard is a React single-page application hosted on CloudFront + S3.

**Technology Stack:**
- React 18 with TypeScript
- Vite for development and building
- React Router for client-side routing
- CSS Modules for styling

**Pages:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing | Marketing landing page with contact form |
| `/login` | Login | Admin authentication |
| `/forgot-password` | ForgotPassword | Request password reset |
| `/reset-password` | ResetPassword | Complete password reset |
| `/dashboard` | Dashboard | Bin list with map/table toggle, route planning |
| `/bins/new` | BinForm | Create new bin with address autocomplete |
| `/bins/:id` | BinDetail | View bin details, QR link |
| `/bins/:id/edit` | BinForm | Edit existing bin |
| `/report` | Report | Public QR code reporting |
| `/qr-print` | QRPrint | Batch QR code printing |
| `/settings` | Settings | Settings hub (redirects to API keys) |
| `/settings/api-keys` | ApiKeyList | Manage API keys |
| `/api-keys/new` | ApiKeyCreate | Create new API key |
| `/api-keys/:id` | ApiKeyDetail | View API key details |
| `/settings/webhooks` | WebhookList | Manage webhooks |
| `/webhooks/new` | WebhookForm | Create webhook |
| `/webhooks/:id` | WebhookDetail | View webhook details |
| `/webhooks/:id/edit` | WebhookForm | Edit webhook |
| `/settings/export` | Export | CSV data export |
| `/privacy` | PrivacyPolicy | Privacy policy |
| `/terms` | Terms | Terms of service |

**Architecture:**
```
src/
├── api/
│   └── client.ts        # API functions with JWT auth
├── context/
│   └── AuthContext.tsx  # Auth state management
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── BinDetail.tsx
│   ├── BinForm.tsx
│   └── Report.tsx
├── App.tsx              # Routes with PrivateRoute wrapper
└── main.tsx            # Entry point
```

### CloudFront Distribution

CloudFront serves as the unified entry point for both static files and API requests.

**Origins:**
1. **S3 Bucket** (default): Serves React SPA static files
2. **API Gateway** (`/api/*`): Proxies API requests to Lambda

**Cache Behaviors:**
- `/*` (default): S3 origin, cached for 24h (assets for 1 year)
- `/api/*`: API Gateway origin, no caching

**SPA Routing:**
Custom error responses redirect 403/404 to `/index.html` for client-side routing.

### Data Model

The data model uses six DynamoDB tables with environment-prefixed names (e.g., `local-ecoscan-trash-bins`).

#### `trash-bins` Table
Current state of each trash bin.

| Attribute      | Type   | Key           | Description                          |
|----------------|--------|---------------|--------------------------------------|
| `binId`        | String | Partition Key | Unique UUID for the bin              |
| `Name`         | String |               | Bin name/label                       |
| `binType`      | String |               | mixed, plastic, paper, glass         |
| `Status`       | Number |               | Current average status (0-100)       |
| `LastUpdated`  | String |               | ISO 8601 timestamp                   |
| `ReportsCount` | Number |               | Number of reports received           |
| `isActive`     | Boolean|               | Active/inactive status               |
| `address`      | String |               | Physical address                     |
| `coordinates`  | Map    |               | {lat: Number, lng: Number}          |

#### `status-reports` Table
Historical status reports for auditing and analytics.

| Attribute   | Type   | Key           | Description                     |
|-------------|--------|---------------|---------------------------------|
| `binId`     | String | Partition Key | Bin UUID                        |
| `createdAt` | String | Sort Key      | ISO 8601 timestamp              |
| `status`    | Number |               | Reported status value (0-100)   |
| `source`    | String |               | iot, qr, or manual              |

#### `admin-users` Table
Administrator user accounts.

| Attribute          | Type    | Key           | Description                     |
|--------------------|---------|---------------|---------------------------------|
| `email`            | String  | Partition Key | User email (unique)             |
| `passwordHash`     | String  |               | bcrypt hashed password          |
| `name`             | String  |               | User display name               |
| `role`             | String  |               | admin, operator, viewer         |
| `isActive`         | Boolean |               | Account status                  |
| `createdAt`        | String  |               | ISO 8601 timestamp              |
| `lastLogin`        | String  |               | ISO 8601 timestamp              |
| `resetToken`       | String  |               | SHA-256 hashed reset token      |
| `resetTokenExpiry` | String  |               | ISO 8601 timestamp              |

#### `api-keys` Table
API keys for external integrations.

| Attribute   | Type   | Key           | Description                          |
|-------------|--------|---------------|--------------------------------------|
| `keyId`     | String | Partition Key | Unique UUID                          |
| `keyHash`   | String | GSI PK        | SHA-256 hash for lookup              |
| `name`      | String |               | Key description                      |
| `keyPrefix` | String |               | First 10 chars for display           |
| `scopes`    | List   |               | ["bins:read", "bins:write"]          |
| `isActive`  | Boolean|               | Active/inactive status               |
| `createdAt` | String |               | ISO 8601 timestamp                   |
| `lastUsedAt`| String |               | ISO 8601 timestamp                   |

#### `webhook-configs` Table
Webhook configurations for event notifications.

| Attribute         | Type    | Key           | Description                     |
|-------------------|---------|---------------|---------------------------------|
| `webhookId`       | String  | Partition Key | Unique UUID                     |
| `url`             | String  |               | Webhook endpoint URL            |
| `eventTypes`      | List    |               | ["bin.status.changed"]          |
| `authType`        | String  |               | none, apiKey, bearer            |
| `authValue`       | String  |               | Auth token/key (encrypted)      |
| `isActive`        | Boolean |               | Active/inactive status          |
| `successCount`    | Number  |               | Successful deliveries           |
| `failureCount`    | Number  |               | Failed deliveries               |
| `lastTriggeredAt` | String  |               | ISO 8601 timestamp              |
| `createdAt`       | String  |               | ISO 8601 timestamp              |

#### `demo-requests` Table
Contact and demo request form submissions.

| Attribute        | Type   | Key           | Description                     |
|------------------|--------|---------------|---------------------------------|
| `requestId`      | String | Partition Key | Unique UUID                     |
| `name`           | String |               | Submitter name                  |
| `email`          | String |               | Contact email                   |
| `organization`   | String |               | Company/org name                |
| `message`        | String |               | Request message                 |
| `requestType`    | String |               | contact or demo                 |
| `recaptchaScore` | Number |               | reCAPTCHA score (0-1)           |
| `createdAt`      | String |               | ISO 8601 timestamp              |
| `ttl`            | Number |               | Expiry timestamp (90 days)      |

## Message Flow

### 1. Client Request
```http
POST /bins/{bin_id}/status
Content-Type: application/json

{"status": 75}
```

### 2. API Gateway Transformation
VTL template combines path parameter and body:
```json
{
  "binId": "00000000-0000-0000-0000-000000000001",
  "status": 75
}
```

### 3. SQS Message
Message queued with attributes for tracking and retry logic.

### 4. Lambda Processing
- Receives batch of messages from SQS
- Validates each message
- Updates DynamoDB
- Returns failures for retry

### 5. Error Handling
- Failed messages retry up to 3 times
- After max retries, message moves to DLQ
- DLQ messages can be investigated and replayed

## Clean Architecture Layers

```
┌─────────────────────────────────────┐
│         Presentation Layer          │  ← SQS handler (main.rs)
│         (Entry Points)              │
├─────────────────────────────────────┤
│        Application Layer            │  ← Business workflows
│        (Use Cases)                  │  ← handle_status_update
├─────────────────────────────────────┤
│          Domain Layer               │  ← Business logic & entities
│     (Business Logic)                │  ← BinStatus, StatusUpdateRequest
├─────────────────────────────────────┤
│      Infrastructure Layer           │  ← DynamoDbRepository
│    (External Services)              │  ← AWS SDK integrations
└─────────────────────────────────────┘
```

**Dependency Rule**: Inner layers never depend on outer layers. This enables:
- Easy testing with mocks
- Swapping implementations (e.g., different databases)
- Clear separation of concerns

## Development Practices

### Infrastructure
- ✅ **Multi-layer Terraform**: Organized by concern (foundation, data, api, compute)
- ✅ **Environment Parity**: Same code for LocalStack and AWS
- ✅ **State Management**: Isolated state per layer
- ✅ **Automated Deployment**: Scripts handle dependencies

### Application
- ✅ **Clean Architecture**: Dependency inversion, testability
- ✅ **Rust**: Type safety, performance, reliability
- ✅ **Event-Driven**: Async processing with SQS
- ✅ **Error Handling**: Structured failures with batch responses

### Testing
- ✅ **Unit Tests**: Domain logic testing
- ✅ **Integration Tests**: Repository testing with LocalStack
- ✅ **E2E Tests**: Full API → SQS → Lambda → DynamoDB flow
- ✅ **LocalStack**: Complete local testing environment

### Observability
- ✅ **Structured Logging**: Tracing with context
- ✅ **CloudWatch Integration**: Lambda logs
- ✅ **SQS Metrics**: Queue depth, age, processing time
- ✅ **DLQ Monitoring**: Failed message tracking

## Deployment

### Local (LocalStack)
```bash
make local-up    # Builds, deploys, seeds data
make test-e2e    # Runs E2E tests
```

### AWS (Dev/Prod)
```bash
./infrastructure/scripts/init-environment.sh dev
```

Layers deploy in order: Foundation → Data → API → Compute

## Scalability Considerations

- **API Gateway**: Handles thousands of requests per second
- **SQS**: Unlimited throughput, automatic scaling
- **Lambda**: Concurrent execution up to account limits
- **DynamoDB**: On-demand or provisioned capacity

The async architecture with SQS ensures the system can handle traffic spikes gracefully!
