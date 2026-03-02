# Lambda Build Guide

This guide explains how to build the Rust Lambda function for different environments and platforms.

## Build Strategy Overview

| Environment | Build Location | Architecture | Use Case |
|-------------|----------------|--------------|----------|
| **AWS (dev/prod)** | GitHub Actions CI | x86_64 | Production deployments |
| **LocalStack** | Local (Docker) | arm64 (Apple Silicon) or x86_64 (Intel/Linux) | Local development |

### Key Principles

1. **CI/CD builds for AWS**: Lambda artifacts for AWS are always built in GitHub Actions
2. **Local builds for LocalStack only**: Use Docker-based builds locally for LocalStack testing
3. **Change detection**: CI only builds/deploys what has changed
4. **Artifact storage**: Lambda packages are stored in S3 for Terraform to use

## Build Architecture Strategy

The project uses **Docker-based builds** to ensure consistent compilation across different development platforms (Linux, Mac, Windows). This approach provides:

1. **Platform Independence**: Build from Linux or Mac without installing Rust toolchains
2. **Consistent Binaries**: Same binary output regardless of host OS
3. **Architecture Flexibility**: Build for x86_64 or arm64 as needed

## Architecture Requirements

### AWS Lambda (dev/prod environments)
- **Architecture**: `x86_64`
- **Target**: `x86_64-unknown-linux-musl`
- **Docker Image**: `clux/muslrust`

### LocalStack (local development)
- **Architecture**: `arm64` (for Apple Silicon Macs) or `x86_64` (for Intel)
- **Target**: `aarch64-unknown-linux-musl` or `x86_64-unknown-linux-musl`
- **Docker Image**: `messense/rust-musl-cross:aarch64-musl` or `clux/muslrust`

## Build Script Usage

### Basic Usage

```bash
# Build for AWS Lambda (x86_64, default)
./scripts/build-lambda.sh

# Build for AWS Lambda (x86_64, explicit)
./scripts/build-lambda.sh x86_64

# Build for LocalStack on Apple Silicon (arm64)
./scripts/build-lambda.sh arm64
```

### Using the Init Script (Recommended)

The `init-environment.sh` script automatically builds for the correct architecture:

```bash
# Builds for arm64 (LocalStack)
./infrastructure/scripts/init-environment.sh local

# Builds for x86_64 (AWS)
./infrastructure/scripts/init-environment.sh dev

# Builds for x86_64 (AWS)
./infrastructure/scripts/init-environment.sh prod
```

## Architecture Detection

The build script automatically selects the correct configuration:

| Architecture | Rust Target | Docker Image | Lambda Runtime |
|--------------|-------------|--------------|----------------|
| x86_64 | `x86_64-unknown-linux-musl` | `clux/muslrust` | `provided.al2023` |
| arm64 | `aarch64-unknown-linux-musl` | `messense/rust-musl-cross:aarch64-musl` | `provided.al2023` |

## Environment Configuration

### LocalStack (local.tfvars)
```hcl
lambda_architecture = "arm64"   # For Apple Silicon Macs
# OR
lambda_architecture = "x86_64"  # For Intel Macs or Linux
```

### AWS Dev (dev.tfvars)
```hcl
lambda_architecture = "x86_64"  # Standard AWS Lambda
```

### AWS Prod (prod.tfvars)
```hcl
lambda_architecture = "x86_64"  # Standard AWS Lambda
```

## GitHub Actions CI/CD

GitHub Actions handles all builds and deployments for AWS environments with **smart change detection**.

### Change Detection

The CI/CD pipeline only builds and deploys what has changed:

| Changed Files | Actions Triggered |
|---------------|-------------------|
| `services/**` | Lint, Test, Build Lambda, Deploy Compute |
| `infrastructure/layers/00-foundation/**` | Deploy Foundation |
| `infrastructure/layers/01-data/**` | Deploy Data |
| `infrastructure/layers/02-compute/**` | Deploy Compute |
| `infrastructure/layers/03-api/**` | Deploy API |
| `infrastructure/environments/**` | Deploy all layers |

### Lambda Build in CI

```yaml
- name: Build Lambda function
  run: |
    chmod +x ./scripts/build-lambda.sh
    ./scripts/build-lambda.sh x86_64
```

### Artifact Storage

Lambda packages are stored in S3 for Terraform:
- `s3://ecoscan-terraform-state-dev/lambda-artifacts/lambda-latest.zip`
- `s3://ecoscan-terraform-state-dev/lambda-artifacts/lambda-{hash}.zip`

This allows compute layer deployments without rebuilding if only infrastructure changed.

## Quick Reference

### Manual Build Commands

```bash
# Clean previous builds
rm -rf services/target/lambda.zip

# Build for AWS (x86_64)
./scripts/build-lambda.sh x86_64

# Build for LocalStack on Apple Silicon (arm64)
./scripts/build-lambda.sh arm64

# Check the artifact
ls -lh services/target/lambda.zip
unzip -l services/target/lambda.zip
```

### Testing the Binary

```bash
# Extract and check the binary
cd services/target
unzip -o lambda.zip
file bootstrap

# Expected output for x86_64:
# bootstrap: ELF 64-bit LSB executable, x86-64, statically linked

# Expected output for arm64:
# bootstrap: ELF 64-bit LSB executable, ARM aarch64, statically linked
```

## Troubleshooting

### Docker Permission Issues

If you get permission errors on Linux:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Wrong Architecture Deployed

If you deploy the wrong architecture:

1. **Symptom**: Lambda function fails with "Exec format error"
2. **Cause**: Mismatch between binary architecture and Lambda configuration
3. **Solution**:
   ```bash
   # Rebuild for correct architecture
   rm services/target/lambda.zip
   ./scripts/build-lambda.sh x86_64  # or arm64

   # Redeploy
   cd infrastructure/layers/02-compute
   terraform apply -var-file="../../environments/dev.tfvars"
   ```

### LocalStack Architecture Mismatch

If LocalStack fails to execute the Lambda:

1. Check your Mac architecture:
   ```bash
   uname -m
   # arm64 = Apple Silicon
   # x86_64 = Intel
   ```

2. Update `local.tfvars`:
   ```hcl
   lambda_architecture = "arm64"  # For Apple Silicon
   # OR
   lambda_architecture = "x86_64"  # For Intel
   ```

3. Rebuild:
   ```bash
   rm services/target/lambda.zip
   ./scripts/build-lambda.sh arm64  # or x86_64
   ./infrastructure/scripts/init-environment.sh local
   ```

## Platform-Specific Notes

### Linux
- Docker typically runs natively
- Both x86_64 and arm64 builds work well
- Use x86_64 for AWS deployments

### Mac (Intel)
- Docker runs via virtualization
- Use x86_64 for both LocalStack and AWS
- Build times may be slower than native

### Mac (Apple Silicon)
- Docker runs via Rosetta 2 translation
- Use arm64 for LocalStack (faster)
- Always use x86_64 for AWS deployments
- Can build both architectures

### Windows
- Requires Docker Desktop with WSL2
- Use x86_64 for all environments
- Line endings: Ensure build scripts use LF, not CRLF

## Build Performance

Typical build times (depending on machine):

| Platform | Architecture | First Build | Incremental |
|----------|--------------|-------------|-------------|
| Mac M1/M2 | arm64 | 2-3 min | 30-60 sec |
| Mac M1/M2 | x86_64 | 3-5 min | 60-90 sec |
| Mac Intel | x86_64 | 3-5 min | 60-90 sec |
| Linux | x86_64 | 2-4 min | 30-60 sec |

## Best Practices

1. **Use the init script**: Let it handle architecture selection automatically
2. **Clean builds**: Delete `lambda.zip` when switching architectures
3. **Match environments**: LocalStack arm64 on Apple Silicon, x86_64 for AWS
4. **CI/CD**: Always build x86_64 in GitHub Actions
5. **Docker images**: Keep them updated for security patches

## Summary

The build system is designed to work seamlessly across different platforms:

- **Docker-based**: No local Rust installation needed
- **Architecture-aware**: Automatically selects the right target
- **Consistent**: Same binary output regardless of host OS
- **Flexible**: Easy to switch between x86_64 and arm64

### Local Development (LocalStack)

```bash
# Start LocalStack and deploy infrastructure
./infrastructure/scripts/init-environment.sh local
```

This will:
1. Start LocalStack via Docker Compose
2. Build Lambda for your local architecture (arm64 on Apple Silicon)
3. Deploy all infrastructure layers to LocalStack

### AWS Deployment (CI/CD)

Push to the `dev` branch to trigger GitHub Actions:

```bash
git push origin dev
```

The CI/CD pipeline will:
1. Detect what changed (Rust code, infrastructure, or both)
2. Build Lambda only if Rust code changed
3. Deploy only the affected infrastructure layers
4. Store Lambda artifacts in S3 for future deployments

### Manual AWS Deployment (not recommended)

If you need to deploy manually (e.g., for debugging):

```bash
# Build for AWS
./scripts/build-lambda.sh x86_64

# Deploy (requires AWS credentials)
./infrastructure/scripts/init-environment.sh dev -auto-approve
```

**Note**: Prefer CI/CD for AWS deployments to ensure consistent builds.
