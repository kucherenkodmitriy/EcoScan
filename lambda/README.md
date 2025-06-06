# EcoScan Lambda Function

This Lambda function is part of the EcoScan project and is responsible for updating the status of bins.

## Purpose

The Lambda function receives requests to update the status of bins and returns a response indicating whether the update was successful.

## Prerequisites

- Rust and Cargo installed
- Docker installed
- AWS CLI configured

## Building the Lambda Function

To build the Lambda function, run the following command in the `lambda` directory:

```bash
./build.sh
```

This script uses Docker to build the Lambda function and creates a deployment package.

## Deploying the Lambda Function

To deploy the Lambda function, run the following command in the `infrastructure` directory:

```bash
./deploy.sh [environment] [region]
```

- `environment`: The deployment environment (e.g., `dev`, `staging`, `prod`). Default is `dev`.
- `region`: The AWS region to deploy to. Default is `eu-central-1`.

## Testing

You can run tests for the Lambda function using Cargo:

```bash
cargo test
```

## Project Structure

This crate follows a domain-driven design (DDD) layout:

- `src/domain/`: Domain models and repository traits.
- `src/application/`: Use cases and business logic.
- `src/infrastructure/`: DynamoDB implementation of repositories.
- `src/lib.rs`: Wiring of the Lambda handler.
- `src/main.rs`: Entry point for the Lambda function.
- `build.sh`: Script to build the Lambda function.
- `deploy.sh`: Script to deploy the Lambda function.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
