#!/bin/bash

# Exit on error
set -e

# Source .env file for AWS credentials only in local development (not CI/CD)
if [ -f "../../.env" ] && [ -z "$GITHUB_ACTIONS" ]; then
    echo "Loading AWS credentials from .env file..."
    source ../../.env
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
cd ../../services/bin-status-reporter

# Create a temporary Cargo.toml for standalone build in CI/CD
if [ -n "$GITHUB_ACTIONS" ]; then
    echo "Creating temporary Cargo.toml for CI/CD build..."
    cat > Cargo.toml.ci << 'EOL'
[package]
name = "bin-status-reporter"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
lambda_runtime = "0.8"
lambda-web = "0.2"
aws-sdk-dynamodb = "1.0"
aws-config = "1.0"
uuid = { version = "1.0", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1.0"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
serde_dynamo = { version = "4.0", features = ["chrono"] }
serde_with = "3.0"
EOL
    
    # Use the temporary Cargo.toml for build
    mv Cargo.toml Cargo.toml.orig
    mv Cargo.toml.ci Cargo.toml
fi

# Build the Lambda function
cargo build --release

# Restore original Cargo.toml if we created a temporary one
if [ -n "$GITHUB_ACTIONS" ] && [ -f "Cargo.toml.orig" ]; then
    mv Cargo.toml.orig Cargo.toml
fi

echo "Building SAM application..."
cd ../../infrastructure/backend
sam build

echo "Deploying to $ENVIRONMENT environment..."
sam deploy \
  --stack-name "ecoscan-api-$ENVIRONMENT" \
  --parameter-overrides \
    "Environment=$ENVIRONMENT" \
    "RateLimit=$RATE_LIMIT" \
    "BurstLimit=$BURST_LIMIT" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

echo "Deployment completed successfully!" 