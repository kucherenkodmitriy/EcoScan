# Cross-Platform Build Configuration Summary

## Overview

The EcoScan Lambda build system now supports **cross-platform development** with automatic architecture selection for:
- **Linux** (any architecture)
- **Mac** (both Intel and Apple Silicon)
- **AWS Lambda** (x86_64)
- **LocalStack** (arm64 or x86_64)

## Key Changes

### 1. Enhanced Build Script (`scripts/build-lambda.sh`)

**New Features:**
- Accepts optional architecture parameter: `x86_64` (default) or `arm64`
- Uses Docker for consistent builds across all platforms
- Automatically selects correct Docker image for each architecture
- No local Rust installation required

**Usage:**
```bash
# AWS Lambda (default)
./scripts/build-lambda.sh
./scripts/build-lambda.sh x86_64

# LocalStack on Apple Silicon
./scripts/build-lambda.sh arm64
```

### 2. Updated Init Script (`infrastructure/scripts/init-environment.sh`)

**Smart Architecture Detection:**
- `local` environment → builds for `arm64` (LocalStack on Apple Silicon)
- `dev`/`prod` environments → builds for `x86_64` (AWS Lambda)

**Usage:**
```bash
# Automatically builds arm64
./infrastructure/scripts/init-environment.sh local

# Automatically builds x86_64
./infrastructure/scripts/init-environment.sh dev
```

### 3. GitHub Actions Configuration (`.github/workflows/deploy-dev.yml`)

**Changes:**
- Removed unused Rust toolchain installation
- Removed cargo-lambda installation (using Docker instead)
- Explicitly builds for x86_64: `./scripts/build-lambda.sh x86_64`

**Benefits:**
- Faster CI/CD pipeline
- Consistent with local builds
- No dependency on specific Rust versions in CI

## Architecture Matrix

| Environment | Platform | Architecture | Build Command |
|-------------|----------|--------------|---------------|
| Local | Mac (Apple Silicon) | arm64 | `./scripts/build-lambda.sh arm64` |
| Local | Mac (Intel) | x86_64 | `./scripts/build-lambda.sh x86_64` |
| Local | Linux (x86) | x86_64 | `./scripts/build-lambda.sh x86_64` |
| Dev/Prod | Any | x86_64 | `./scripts/build-lambda.sh x86_64` |
| GitHub Actions | Linux | x86_64 | `./scripts/build-lambda.sh x86_64` |

## Docker Images Used

### x86_64 Builds
- **Image**: `clux/muslrust`
- **Target**: `x86_64-unknown-linux-musl`
- **Purpose**: AWS Lambda, Intel Macs, Linux x86

### arm64 Builds
- **Image**: `messense/rust-musl-cross:aarch64-musl`
- **Target**: `aarch64-unknown-linux-musl`
- **Purpose**: LocalStack on Apple Silicon, ARM servers

## Configuration Files

### LocalStack (`infrastructure/environments/local.tfvars`)
```hcl
lambda_architecture = "arm64"  # For Apple Silicon
```

### AWS Dev (`infrastructure/environments/dev.tfvars`)
```hcl
lambda_architecture = "x86_64"  # Standard AWS Lambda
```

### Compute Layer (`infrastructure/layers/02-compute/lambda.tf`)
```hcl
architectures = [var.lambda_architecture]  # Dynamic based on environment
```

## Benefits

### 1. Platform Independence
- Build on Linux, Mac, or Windows
- Consistent binary output regardless of host OS
- No need to install Rust toolchains locally

### 2. Architecture Flexibility
- Easy switch between x86_64 and arm64
- Optimized for each target environment
- LocalStack works on Apple Silicon without emulation

### 3. Developer Experience
- Single command deployment
- Automatic architecture selection
- No manual configuration needed

### 4. CI/CD Reliability
- Deterministic builds in GitHub Actions
- Same build process as local development
- Reduced pipeline complexity

## Common Workflows

### Local Development (Apple Silicon Mac)

```bash
# First time setup
./infrastructure/scripts/init-environment.sh local

# Make code changes...

# Rebuild and redeploy
rm services/target/lambda.zip
./scripts/build-lambda.sh arm64
cd infrastructure/layers/02-compute
terraform apply -var-file="../../environments/local.tfvars"
```

### Local Development (Intel Mac or Linux)

```bash
# First time setup
./infrastructure/scripts/init-environment.sh local

# Make code changes...

# Rebuild and redeploy
rm services/target/lambda.zip
./scripts/build-lambda.sh x86_64
cd infrastructure/layers/02-compute
terraform apply -var-file="../../environments/local.tfvars"
```

### Deploy to AWS Dev

```bash
# Build and deploy everything
./infrastructure/scripts/init-environment.sh dev

# Or just rebuild Lambda
rm services/target/lambda.zip
./scripts/build-lambda.sh x86_64
cd infrastructure/layers/02-compute
terraform apply -var-file="../../environments/dev.tfvars"
```

### GitHub Actions Deploy

```bash
# Just push to main branch
git push origin main

# GitHub Actions automatically:
# 1. Builds for x86_64 using Docker
# 2. Deploys to AWS Dev
# 3. Verifies deployment
```

## Troubleshooting

### Wrong Architecture Error

**Symptom**: Lambda fails with "Exec format error"

**Solution**:
```bash
# Check what you built
unzip -p services/target/lambda.zip bootstrap | file -

# Should show x86-64 for AWS, ARM aarch64 for LocalStack arm64

# Rebuild for correct architecture
rm services/target/lambda.zip
./scripts/build-lambda.sh x86_64  # or arm64
```

### Docker Permission Issues

**Symptom**: Permission errors when building

**Linux Solution**:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Mac/Windows**: Ensure Docker Desktop is running

### Build Takes Too Long

**First Build**: 2-5 minutes (normal, downloading dependencies)

**Incremental Builds**: 30-90 seconds

**Speed Up**:
- Keep Docker running
- Don't delete `services/target` between builds
- Use SSD for Docker volumes

## Migration Notes

### From Old Build System

If you were previously building without Docker:

1. **No Rust Installation Needed**: Docker handles everything
2. **Different Toolchains**: Now using `musl` targets for static linking
3. **Architecture Parameter**: Build script now accepts `x86_64` or `arm64`

### From cargo-lambda

The project no longer uses `cargo-lambda` in favor of Docker builds:

**Benefits**:
- Works on all platforms without cargo-lambda installation
- Consistent with CI/CD pipeline
- Better control over build environment

## Documentation

- **BUILD_GUIDE.md**: Comprehensive build documentation
- **GITHUB_ACTIONS_SETUP.md**: CI/CD configuration
- **This file**: Quick reference and summary

## Quick Command Reference

```bash
# Build for AWS Lambda
./scripts/build-lambda.sh x86_64

# Build for LocalStack (Apple Silicon)
./scripts/build-lambda.sh arm64

# Deploy local environment (auto-detects architecture)
./infrastructure/scripts/init-environment.sh local

# Deploy dev environment (always x86_64)
./infrastructure/scripts/init-environment.sh dev

# Check binary architecture
unzip -p services/target/lambda.zip bootstrap | file -

# Clean rebuild
rm services/target/lambda.zip
./scripts/build-lambda.sh x86_64
```

## Summary

The build system is now:
- ✅ **Platform-independent**: Works on Linux, Mac (Intel/ARM), Windows
- ✅ **Architecture-flexible**: Supports x86_64 and arm64
- ✅ **Consistent**: Same builds locally and in CI/CD
- ✅ **Simple**: One command to build and deploy
- ✅ **Automatic**: Detects correct architecture per environment

**You can now seamlessly develop on any platform and deploy to AWS Lambda without worrying about architecture mismatches!**
