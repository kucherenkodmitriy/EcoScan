# EcoScan Architecture

## Overview
EcoScan is a serverless trash bin monitoring system built with Rust Lambda functions and DynamoDB.

## Architecture Diagram
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │───▶│   API Gateway    │───▶│  Lambda Functions│
│   QR Scanner    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────▼─────────┐
                       │   CloudWatch    │    │    DynamoDB       │
                       │     Logs        │    │  - trash-bins     │
                       └─────────────────┘    │  - status-reports │
                                              └───────────────────┘
```

## Components

### Lambda Functions
- **update-bin-status**: Updates trash bin status and maintains averages
- **Future**: bin-analytics, notifications, reporting

### Data Model
- **TrashBin**: Core entity with status tracking
- **StatusReport**: Individual status readings
- **BinStatus**: Value object (0-10 scale)

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
