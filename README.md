# EcoScan

A serverless application for monitoring trash bin status using AWS Lambda, DynamoDB, and Terraform.

## Getting Started

This project is managed using a `Makefile` to simplify common development tasks.

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli)
- [Rust Toolchain](https://www.rust-lang.org/tools/install)
- [AWS CLI](https://aws.amazon.com/cli/)

### Key Commands

- **Start the local environment:**
  ```bash
  make local-up
  ```

- **Run all tests (unit and end-to-end):**
  ```bash
  make test
  ```

- **Tear down the local environment:**
  ```bash
  make reset-local
  ```

## Documentation

For more detailed information about the project, please refer to the following documents:

- **[Architecture](docs/ARCHITECTURE.md)**: An in-depth overview of the project's architecture, components, and data model.
- **[LocalStack Debugging Insights](docs/localstack-debugging-insights.md)**: A summary of key findings and solutions from debugging the application in a LocalStack environment.