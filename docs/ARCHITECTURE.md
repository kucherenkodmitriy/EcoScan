# EcoScan Architecture

## Overview
EcoScan is a serverless trash bin monitoring system built with Rust Lambda functions, API Gateway, SQS, and DynamoDB. The entire infrastructure is managed as code using **Terraform** with a multi-layer approach, ensuring a consistent and reproducible environment for both local development and cloud deployment.

## System Architecture

### Event-Driven Async Architecture
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
00-foundation (S3 buckets)
    ↓
01-data (DynamoDB tables)
    ↓
03-api (API Gateway + SQS queues)
    ↓
02-compute (Lambda + IAM roles)
```

**Key Features:**
- **Single Source of Truth**: All AWS resources defined in `.tf` files
- **Layer Isolation**: Each layer has its own state and can be deployed independently
- **Environment Parity**: Same configuration for LocalStack and AWS
- **Automated Deployment**: Scripts handle layer dependencies automatically

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

#### Future Services (Skeletons)
- **admin-dashboard-api**: Admin management of bins and locations
- **notifier**: Push/email notifications when bins are full
- **shared**: Domain models, DTOs, and utilities

### Data Model

The data model uses two DynamoDB tables with environment-prefixed names (e.g., `local-ecoscan-trash-bins`).

#### `trash-bins` Table
Current state of each trash bin.

| Attribute      | Type   | Key           | Description                          |
|----------------|--------|---------------|--------------------------------------|
| `binId`        | String | Partition Key | Unique UUID for the bin              |
| `Name`         | String |               | Bin name/label                       |
| `Status`       | Number |               | Current average status (0-100)       |
| `LastUpdated`  | String |               | ISO 8601 timestamp                   |
| `ReportsCount` | Number |               | Number of reports received           |

#### `status-reports` Table
Historical status reports for auditing and analytics.

| Attribute   | Type   | Key           | Description                     |
|-------------|--------|---------------|---------------------------------|
| `binId`     | String | Partition Key | Bin UUID                        |
| `createdAt` | String | Sort Key      | ISO 8601 timestamp              |
| `status`    | Number |               | Reported status value (0-100)   |

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
