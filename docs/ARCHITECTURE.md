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
                       │     Logs        │    │  - dev-ecoscan-bin-status     │
                       └─────────────────┘    │  - dev-ecoscan-bin-status-reports │
                                              └───────────────────┘
```

## Components

### Lambda Microservices (Rust)
- **bin-status-reporter**: Main service. Handles trash bin status updates and maintains running averages. Fully functional.
- **admin-dashboard-api**: Skeleton. Intended for authenticated admin management of bins and locations. (Future extension)
- **notifier**: Skeleton. Intended for push/email notifications when bins are full. (Future extension)
- **shared**: Rust library crate with domain models, DTOs, and utilities, shared by all services.

### Data Model
- **TrashBin**: Core entity with status tracking
- **StatusReport**: Individual status readings
- **BinStatus**: Value object (0-10 scale)

#### Table structure
- **Location**: LocationId (PK), Name, Address, Latitude, Longitude, CreatedAt
| Attribute    | Type   | Key           | Description                   |
| ------------ | ------ | ------------- | ----------------------------- |
| `LocationId` | String | Partition Key | Unique ID for the location    |
| `Name`       | String |               | Human-readable location name  |
| `Address`    | String |               | Street address or label       |
| `Latitude`   | Number |               | Latitude coordinate           |
| `Longitude`  | Number |               | Longitude coordinate          |
| `CreatedAt`  | String |               | ISO8601 timestamp of creation |
- **TrashBin**: BinId (PK), Name, LocationId (FK), QRCodeId (FK), CreatedAt
| Attribute    | Type   | Key           | Description                       |
| ------------ | ------ | ------------- | --------------------------------- |
| `BinId`      | String | Partition Key | Unique ID for the trash bin       |
| `Name`       | String |               | Friendly bin name (e.g., “Bin 7”) |
| `LocationId` | String |               | Foreign key to `Location`         |
| `QRCodeId`   | String |               | Foreign key to `QRCode`           |
| `CreatedAt`  | String |               | ISO8601 timestamp of creation     |
- **QRCode**: QRCodeId (PK, UUID), BinId (FK), CreatedAt
| Attribute   | Type   | Key           | Description                           |
| ----------- | ------ | ------------- | ------------------------------------- |
| `QRCodeId`  | String | Partition Key | Unique QR code ID                     |
| `BinId`     | String |               | Foreign key to `TrashBin`             |
| `CreatedAt` | String |               | ISO8601 timestamp of QR code creation |
- **StatusReport**: BinId (PK), CreatedAt (SK), Fullness, ReportedBy (default: "anonymous")
| Attribute    | Type   | Key                         | Description                        |
| ------------ | ------ | --------------------------- | ---------------------------------- |
| `BinId`      | String | Partition Key               | Trash bin being reported           |
| `CreatedAt`  | String | Sort Key (ISO8601 datetime) | Timestamp of status submission     |
| `Fullness`   | Number |                             | Fullness percentage (0–100)        |
| `ReportedBy` | String |                             | Optionally: user/email/“anonymous” |

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
