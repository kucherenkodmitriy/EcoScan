# EcoScan Architecture

## Overview
EcoScan is a serverless trash bin monitoring system built with Rust Lambda functions and DynamoDB. The entire infrastructure is managed as code using **Terraform**, ensuring a consistent and reproducible environment for both local development and cloud deployment.

## Infrastructure as Code with Terraform
EcoScan's infrastructure is defined declaratively using Terraform. This approach replaces manual configuration and brittle scripts with a version-controlled, automated, and reliable process.

- **Single Source of Truth**: All AWS resources—including API Gateway, Lambda, DynamoDB, and S3—are defined in `.tf` files located in the `infrastructure/` directory.
- **Environment Parity**: The same Terraform configuration is used to provision the local **LocalStack** environment and can be adapted to deploy to production AWS accounts, minimizing drift between environments.
- **Automated Setup**: A single command (`make local-up`) orchestrates the entire local setup, from building the application to provisioning the infrastructure with Terraform.

## Architecture Diagram
```
                                 ┌─────────────┐
                                 │  Terraform  │
                                 └──────┬──────┘
                                        │ provisions
                                        ▼
┌───────────────┐   ┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Developer   │──▶│  LocalStack CLI  │───▶│   API Gateway    │───▶│  Lambda Function │
│ (via scripts) │   │ (Docker)         │    │                  │    │ (Rust)          │
└───────────────┘   └──────────────────┘    └──────────────────┘    └─────────┬───────┘
                                                                            │
                                           ┌─────────────────┐    ┌─────────▼─────────┐
                                           │   CloudWatch    │◀───│    DynamoDB       │
                                           │     Logs        │    │  - trash-bins     │
                                           └─────────────────┘    │  - status-reports │
                                                                  └───────────────────┘
```

## Components

### Lambda Microservices (Rust)
- **bin-status-reporter**: Main service. Handles trash bin status updates and maintains running averages. Fully functional.
- **admin-dashboard-api**: Skeleton. Intended for authenticated admin management of bins and locations. (Future extension)
- **notifier**: Skeleton. Intended for push/email notifications when bins are full. (Future extension)
- **shared**: Rust library crate with domain models, DTOs, and utilities, shared by all services.

### Data Model
The data model is centered around two DynamoDB tables, with names prefixed by the environment (e.g., `local-ecoscan-trash-bins`).

#### `trash-bins` Table
Stores the current state of each trash bin.

| Attribute      | Type   | Key           | Description                                      |
|----------------|--------|---------------|--------------------------------------------------|
| `binId`        | String | Partition Key | Unique identifier for the bin                    |
| `name`         | String |               | Bin name                                         |
| `status`       | Number |               | Current average status (0-100)                   |
| `lastUpdated`  | String |               | Last update timestamp (ISO 8601)                 |
| `reportsCount` | Number |               | Number of status reports received                |

#### `status-reports` Table
Stores historical status reports for auditing and analysis.

| Attribute   | Type   | Key        | Description                      |
|-------------|--------|------------|----------------------------------|
| `binId`     | String | Partition Key | Bin identifier                   |
| `createdAt` | String | Sort Key   | Report timestamp (ISO 8601)      |
| `status`    | Number |            | Reported status value (0-100)    |

### External Services
- **DynamoDB**: Primary data store
- **CloudWatch**: Logging and monitoring
- **S3**: For Lambda deployments and other assets.

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
- **Infrastructure as Code (IaC)** with Terraform
- Clean Architecture with dependency inversion
- Comprehensive test coverage (unit + integration)
- Docker-based cross-compilation for Apple Silicon
- LocalStack for local development
- Structured logging for observability
