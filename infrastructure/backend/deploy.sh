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
cargo build --release --package bin-status-reporter

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