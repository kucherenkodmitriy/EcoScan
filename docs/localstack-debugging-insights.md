# EcoScan LocalStack Debugging Insights

This document summarizes the key findings and solutions discovered while debugging the Rust Lambda function's startup failures in the LocalStack environment.

## Summary of Key Issues and Solutions

The primary symptom was the end-to-end test consistently failing with an **HTTP 502 Bad Gateway** error. This was caused by the Lambda function failing to start, which also resulted in a complete **absence of CloudWatch logs**, making direct debugging difficult.

### 1. Build and Compilation

- **Problem**: Cross-compiling a statically linked binary for the `x86_64-unknown-linux-musl` target on an Apple Silicon (ARM64) machine proved to be impossible due to compiler flag incompatibilities in the `aws-lc-sys` dependency.
- **Solution**: Switched the build process to target `aarch64-unknown-linux-musl` and configured the Lambda function in `infrastructure/layers/02-compute/lambda.tf` to use the `arm64` architecture. This resulted in a fully static, compatible binary.

### 2. LocalStack Networking and Configuration

- **Problem**: The Lambda function was unable to connect to DynamoDB due to unreliable networking and incorrect AWS SDK configuration.
- **Solution**:
    - Changed the `DYNAMODB_ENDPOINT_URL` to use the Docker service name (`http://localstack:4566`) for a more stable container-to-container connection.
    - Modified the DynamoDB repository to build a static, local-only AWS config, avoiding the hang caused by the SDK trying to contact the non-existent EC2 Metadata Service.

### 3. Runtime Environment

- **Problem**: The `bootstrap` binary was not executable within the Lambda environment, and there was a subtle incompatibility between the build environment and the `provided.al2023` runtime.
- **Solution**:
    - Added a `chmod +x` command to the `scripts/build-lambda.sh` script to ensure the binary has the correct permissions.
    - Switched the build script to use an `amazonlinux:2` Docker image, guaranteeing that the compiled binary is 100% compatible with the target runtime.
