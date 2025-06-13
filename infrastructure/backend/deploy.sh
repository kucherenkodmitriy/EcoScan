#!/bin/bash

# Exit on error
set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SERVICES_DIR="${PROJECT_ROOT}/services"
INFRA_DIR="${SCRIPT_DIR}"

# Source .env file for AWS credentials only in local development (not CI/CD)
if [ -f "${PROJECT_ROOT}/.env" ] && [ -z "$GITHUB_ACTIONS" ]; then
    echo "Loading AWS credentials from .env file..."
    source "${PROJECT_ROOT}/.env"
    export AWS_ACCESS_KEY_ID
    export AWS_SECRET_ACCESS_KEY
    export AWS_DEFAULT_REGION
else
    echo "Using AWS credentials from environment (CI/CD mode)"
fi

# Default values
ENVIRONMENT="dev"
RATE_LIMIT=10
BURST_LIMIT=5
REGION="eu-central-1"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --rate-limit)
      RATE_LIMIT="$2"
      shift 2
      ;;
    --burst-limit)
      BURST_LIMIT="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Invalid environment. Must be one of: dev, staging, prod"
  exit 1
fi

echo "Building Lambda function..."
cd "${SERVICES_DIR}"

# Print debug info
echo "Current directory: $(pwd)"
echo "Project root: ${PROJECT_ROOT}"
echo "Build target directory: ${PROJECT_ROOT}/target"

# Clean previous build to ensure we're building fresh
echo "Cleaning previous build..."
cargo clean

# Build the bootstrap binary in release mode with verbose output
echo "Building binary..."
RUST_BACKTRACE=1 cargo build --release --bin bootstrap --verbose

# Debug: List target directory
echo "Build complete. Listing target directory:"
find "${PROJECT_ROOT}/target" -type f -name "bootstrap" -o -name "bootstrap.*"

# Create output directory for the Lambda package
mkdir -p "${PROJECT_ROOT}/target/lambda"

# Find the built binary - look in both possible locations
BINARY_PATH=$(find "${SERVICES_DIR}/target" -name "bootstrap" -type f -exec ls -1t {} + | head -1)

if [ -z "$BINARY_PATH" ]; then
    echo "Error: Could not find the built binary in ${SERVICES_DIR}/target"
    echo "Trying alternative location..."
    BINARY_PATH=$(find "${PROJECT_ROOT}/target" -name "bootstrap" -type f -exec ls -1t {} + | head -1)
    if [ -z "$BINARY_PATH" ]; then
        echo "Error: Could not find the built binary in ${PROJECT_ROOT}/target either"
        exit 1
    fi
fi

echo "Found binary at: ${BINARY_PATH}"

# Copy the binary to the Lambda bootstrap location
mkdir -p "${PROJECT_ROOT}/target/lambda"
cp "${BINARY_PATH}" "${PROJECT_ROOT}/target/lambda/"

# Package for Lambda deployment
echo "Packaging Lambda function..."
cd "${PROJECT_ROOT}/target/lambda"
chmod +x bootstrap
zip -r "${PROJECT_ROOT}/target/lambda.zip" .

echo "Deploying infrastructure..."
cd "${INFRA_DIR}"

# Build and deploy with SAM
echo "Building SAM application..."
sam build --template-file template.yaml

# Package and deploy
echo "Packaging and deploying SAM application..."
sam package \
  --template-file .aws-sam/build/template.yaml \
  --output-template-file packaged.yaml \
  --s3-bucket "${S3_BUCKET}" \
  --region "${REGION}"

sam deploy \
  --template-file packaged.yaml \
  --stack-name "ecostack-${ENVIRONMENT}" \
  --capabilities CAPABILITY_IAM \
  --region "${REGION}" \
  --parameter-overrides \
      "Environment=${ENVIRONMENT}" \
      "RateLimit=${RATE_LIMIT}" \
      "BurstLimit=${BURST_LIMIT}" \
  --no-fail-on-empty-changeset

echo "Deployment completed successfully!"