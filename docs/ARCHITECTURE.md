# EcoScan Architecture

## Overview
EcoScan is a serverless trash bin monitoring system built with Rust Lambda functions and DynamoDB.

## Multi-Stack AWS Deployment
EcoScan uses a multi-stack AWS deployment model. Each microservice or major component is deployed as a separate CloudFormation stack, following the naming convention:

```
<env>-ecoscan-<service>
```

**Examples:**
- `dev-ecoscan-bin-status-reporter`
- `dev-ecoscan-notifier`
- `dev-ecoscan-admin-dashboard-api`
- `dev-ecoscan-shared` (for shared resources, if needed)

This approach enables modularity, independent updates, and easier scaling or hand-off of individual services.

## Architecture Diagram
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │───▶│   API Gateway    │───▶│  Lambda Functions│
│   QR Scanner    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────▼─────────┐
                       │   CloudWatch    │    │    DynamoDB       │
                       │     Logs        │    │  - dev-ecoscan-trash-bins     │
                       └─────────────────┘    │  - dev-ecoscan-status-reports │
                                              └───────────────────┘
```

## Components

### Lambda Microservices (Rust)
- **bin-status-reporter**: Main service. Handles trash bin status updates and maintains running averages. Fully functional.
- **admin-dashboard-api**: Skeleton. Intended for authenticated admin management of bins and locations. (Future extension)
- **notifier**: Skeleton. Intended for push/email notifications when bins are full. (Future extension)
- **shared**: Rust library crate with domain models, DTOs, and utilities, shared by all services.

### Data Model
The data model is centered around two DynamoDB tables:

#### `dev-ecoscan-trash-bins`
Stores the current state of each trash bin.

| Attribute      | Type   | Key           | Description                                      |
|----------------|--------|---------------|--------------------------------------------------|
| `binId`        | String | Partition Key | Unique identifier for the bin                    |
| `name`         | String |               | Bin name                                         |
| `status`       | Number |               | Current average status (0-10)                    |
| `lastUpdated`  | String |               | Last update timestamp (ISO 8601)                 |
| `reportsCount` | Number |               | Number of status reports received                |

#### `dev-ecoscan-status-reports`
Stores historical status reports for auditing and analysis.

| Attribute   | Type   | Key        | Description                      |
|-------------|--------|------------|----------------------------------|
| `binId`     | String | Partition Key | Bin identifier                   |
| `createdAt` | String | Sort Key   | Report timestamp (ISO 8601)      |
| `status`    | Number |            | Reported status value (0-10)     |

### External Services
- **DynamoDB**: Primary data store
- **CloudWatch**: Logging and monitoring
- **S3**: Future file storage

## Clean Architecture Layers
```
┌─────────────────────────────────────┐
│            Presentation             │  ← Lambda handlers
├─────────────────────────────────────┤
│            Application              │  ← Use cases/business workflows
├─────────────────────────────────────┤
│              Domain                 │  ← Business logic/entities
├─────────────────────────────────────┤
│           Infrastructure            │  ← DynamoDB, external services
└─────────────────────────────────────┘
```

## Development Practices
- Clean Architecture with dependency inversion
- Comprehensive test coverage (unit + integration)
- Docker-based cross-compilation for Apple Silicon
- LocalStack for local development
- Structured logging for observability
