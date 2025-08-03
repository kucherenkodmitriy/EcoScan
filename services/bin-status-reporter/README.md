# Bin Status Reporter Service

This service is a core component of the EcoScan project. It is a Rust-based AWS Lambda function responsible for processing trash bin status updates.

## Purpose

The primary responsibility of this service is to receive status update requests (e.g., from a QR code scan or sensor), calculate the new average bin status, and persist the changes to DynamoDB.

## Architecture

This crate is designed following Clean Architecture and Domain-Driven Design (DDD) principles to ensure a clear separation of concerns, making it maintainable and testable.

The project structure is organized as follows:

-   `src/main.rs`: The entry point for the AWS Lambda runtime. It initializes dependencies and invokes the handler.
-   `src/lib.rs`: Wires up the application dependencies for the Lambda handler.
-   `src/application/`: Contains the core business logic and use cases (e.g., `UpdateBinStatusUseCase`).
-   `src/domain/`: Defines the core business entities (e.g., `TrashBin`, `StatusReport`), value objects, and repository traits (interfaces).
-   `src/infrastructure/`: Provides concrete implementations of the repository traits defined in the domain layer, specifically for interacting with AWS DynamoDB.

## Building and Deployment

This service is a crate within the `services` Rust workspace. It is not intended to be built or deployed standalone.

-   **Building**: The service is automatically built as part of the backend deployment process. The build is triggered by the `infrastructure/backend/deploy.sh` script, which uses Docker for cross-compilation.
-   **Deployment**: The deployment is managed by the AWS SAM template located in `infrastructure/backend/template.yaml`. Please refer to the `infrastructure/backend/README.md` for detailed deployment instructions.

## Testing

-   **Unit Tests**: You can run unit tests for this specific service by navigating to the `services` directory and running `cargo test --package bin-status-reporter`.
-   **Integration/E2E Tests**: Integration tests and sample Lambda invocation events are located in the root `tests/` directory of the project.

## License

This project is licensed under the MIT License.
