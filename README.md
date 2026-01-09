# EcoScan

A serverless application for monitoring trash bin status using AWS Lambda, DynamoDB, API Gateway, and SQS with Terraform infrastructure as code.

## Architecture

EcoScan uses an event-driven, asynchronous architecture:

```
Client → API Gateway → SQS Queue → Lambda → DynamoDB
                         ↓
                    Dead Letter Queue
```

**Key Features:**
- 🚀 Async processing with SQS for resilience and scalability
- 📦 Rust Lambda functions for high performance
- 🏗️ Multi-layer Terraform infrastructure
- 🧪 LocalStack for local development
- ✅ Comprehensive E2E testing

## Getting Started

This project is managed using a `Makefile` to simplify common development tasks.

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose
- [Terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli) (>= 1.6)
- [Rust Toolchain](https://www.rust-lang.org/tools/install) (>= 1.92)
- [AWS CLI](https://aws.amazon.com/cli/) (>= 2.0)
- `libssl-dev` and `pkg-config` for building Rust dependencies

### Quick Start

```bash
# Start LocalStack and deploy infrastructure
make local-up

# Run all tests (unit and E2E)
make test

# Run E2E tests only
make test-e2e

# Tear down the local environment
make reset-local
```

### Manual Setup

If you prefer manual setup:

```bash
# 1. Start LocalStack
docker-compose up -d

# 2. Build Lambda function
./scripts/build-lambda.sh

# 3. Deploy infrastructure
./infrastructure/scripts/init-environment.sh local

# 4. Seed test data
./scripts/seed-data.sh

# 5. Run E2E tests
./scripts/run-e2e-tests.sh
```

## Project Structure

```
EcoScan/
├── services/                      # Rust microservices
│   ├── bin-status-reporter/      # Main Lambda function (SQS handler)
│   │   ├── src/                  # Source code
│   │   ├── tests/                # Unit & integration tests
│   │   └── test-events/          # Sample Lambda event payloads
│   ├── e2e-tests/                # End-to-end integration tests
│   └── shared/                   # Shared domain models
├── infrastructure/               # Terraform IaC
│   ├── layers/                   # Multi-layer architecture
│   │   ├── 00-foundation/       # S3 buckets
│   │   ├── 01-data/             # DynamoDB tables
│   │   ├── 02-compute/          # Lambda functions
│   │   └── 03-api/              # API Gateway + SQS
│   ├── environments/            # Environment configs
│   └── scripts/                 # Deployment scripts
├── scripts/                      # Build and utility scripts
├── docs/                         # Documentation
└── docker-compose.yml           # LocalStack configuration
```

## Documentation

For more detailed information:

- **[Architecture](docs/ARCHITECTURE.md)**: System design, components, and data model
- **[Infrastructure README](infrastructure/README.md)**: Terraform setup and deployment guide
- **[Testing Automation Guide](docs/TESTING_AUTOMATION.md)**: Automated testing, smoke tests, and CI/CD
- **[API Gateway → SQS → Lambda Flow](docs/api-sqs-lambda-flow.md)**: Async message flow details
- **[LocalStack Debugging Insights](docs/localstack-debugging-insights.md)**: LocalStack tips and solutions

## Development

### Building Lambda Functions

```bash
# Build for x86_64 (LocalStack/AWS compatible)
./scripts/build-lambda.sh

# Output: services/target/lambda.zip
```

### Running Tests

```bash
# Unit tests
cd services
cargo test

# Smoke tests (quick validation after deployment)
./scripts/smoke-test.sh local   # LocalStack
./scripts/smoke-test.sh dev     # AWS dev environment

# E2E tests (full integration testing)
ENVIRONMENT=local ./scripts/run-e2e-tests.sh  # LocalStack
ENVIRONMENT=dev ./scripts/run-e2e-tests.sh    # AWS dev environment
```

### Deploying Infrastructure

```bash
# Deploy all layers
./infrastructure/scripts/init-environment.sh local

# Deploy single layer
./infrastructure/scripts/deploy-layer.sh 03-api local

# Clean up
./infrastructure/scripts/cleanup-local.sh
```

## API Usage

Once deployed, you can interact with the API:

```bash
# Update bin status
curl -X POST "http://localhost:4566/restapis/<API_ID>/local/_user_request_/bins/<BIN_ID>/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 75}'

# Response
{"message":"Status update queued for processing"}
```

The message is queued in SQS and processed asynchronously by Lambda.

## Testing

The project includes comprehensive automated tests:

- **Unit Tests**: Rust service tests (`cargo test`)
- **Integration Tests**: DynamoDB repository tests
- **Smoke Tests**: Quick validation after deployment (API, Lambda, DynamoDB)
- **E2E Tests**: Full API → SQS → Lambda → DynamoDB flow
- **CI/CD Tests**: Automated testing in GitHub Actions on every push

### Automated Testing in CI/CD

Every push to `dev` branch automatically:
1. ✅ Runs unit tests and linting
2. ✅ Validates Terraform configuration
3. ✅ Deploys to AWS dev environment
4. ✅ Runs smoke tests to verify deployment
5. ✅ Runs E2E tests for full flow validation

See [Testing Automation Guide](docs/TESTING_AUTOMATION.md) for details.

All tests pass with both LocalStack and AWS! ✅

## Contributing

1. Test locally with LocalStack first
2. Update documentation for any changes
3. Run all tests before submitting PR
4. Follow Rust and Terraform best practices

## License

See [LICENSE](LICENSE) file for details.
