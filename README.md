# EcoScan

A serverless application for monitoring trash bin status using AWS Lambda and DynamoDB.

## Architecture

- **AWS Lambda**: Handles status updates and reports
- **DynamoDB**: Stores bin status and reports
  - `trash-bins` table: Current status and average calculations
  - `status-reports` table: Historical status reports

## Data Model

### Trash Bins Table
- `binId` (String, Hash Key): Unique identifier for the bin
- `name` (String): Bin name
- `status` (Number): Current average status (0-10)
- `lastUpdated` (String): Last update timestamp
- `reportsCount` (Number): Number of status reports

### Status Reports Table
- `binId` (String, Hash Key): Bin identifier
- `createdAt` (String, Range Key): Report timestamp
- `status` (Number): Status value (0-10)

## Status Calculation

The system maintains a running average of bin status:
1. Each status update is stored in the reports table
2. The average is calculated using: `((current_status * reports_count) + new_status) / (reports_count + 1)`
3. The result is stored as the current status in the trash-bins table

## Local Development

### Prerequisites
- Docker
- AWS CLI
- Rust toolchain

### Setup

1. Start LocalStack:
```bash
docker-compose up -d
```

2. Initialize LocalStack with tables and default bin:
```bash
./scripts/init-localstack.sh
```

3. Build and test the Lambda function:
```bash
./scripts/build-lambda.sh
./scripts/test-lambda.sh
```

### Environment Variables

Create a `.env.local` file for local development:
```env
DYNAMODB_ENDPOINT_URL=http://localhost:4566
TRASH_BINS_TABLE=trash-bins
STATUS_REPORTS_TABLE=status-reports
```

## Testing

The project includes:
- Unit tests for domain logic
- Integration tests with LocalStack
- Test events in `lambda/test-events/`

## Project Structure

```
.
├── lambda/                 # Lambda function code
│   ├── src/
│   │   ├── application/   # Business logic
│   │   ├── domain/        # Domain models
│   │   ├── infrastructure/# DynamoDB implementation
│   │   └── lib.rs         # Main entry point
│   └── test-events/       # Test events
├── scripts/
│   ├── build-lambda.sh    # Build script
│   ├── init-localstack.sh # LocalStack setup
│   └── test-lambda.sh     # Test script
└── docker-compose.yml     # LocalStack configuration
``` 