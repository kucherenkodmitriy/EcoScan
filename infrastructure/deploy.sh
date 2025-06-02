#!/bin/bash
set -e

# Load AWS credentials from .env file
if [ -f "../.env" ]; then
    export $(grep -v '^#' ../.env | xargs)
fi

# Check if required AWS credentials are set
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "Error: AWS credentials not found in .env file"
    echo "Please add the following variables to your .env file:"
    echo "AWS_ACCESS_KEY_ID=your_access_key"
    echo "AWS_SECRET_ACCESS_KEY=your_secret_key"
    echo "AWS_REGION=your_region (optional, defaults to eu-central-1)"
    exit 1
fi

# Usage information
usage() {
    echo "Usage: $0 [environment] [region]"
    echo ""
    echo "Available environments: dev, staging, prod"
    echo "Default environment: dev"
    echo "Default region: us-east-1"
    exit 1
}

# Validate arguments
if [ $# -gt 2 ]; then
    usage
fi

# Default values
ENVIRONMENT=${1:-dev}
REGION=${2:-${AWS_REGION:-eu-central-1}}
STACK_NAME="ecoscan-${ENVIRONMENT}"

# Validate environment
VALID_ENVS=("dev" "staging" "prod")
if [[ ! "${VALID_ENVS[@]}" =~ "${ENVIRONMENT}" ]]; then
    echo "Error: Invalid environment '${ENVIRONMENT}'"
    usage
fi

# Environment-specific configurations
ENV_CONFIG=""

# Add environment-specific parameters if needed
# For example:
# if [ "${ENVIRONMENT}" = "prod" ]; then
#     ENV_CONFIG="--parameter-overrides Environment=${ENVIRONMENT} Stage=production"
# else
#     ENV_CONFIG="--parameter-overrides Environment=${ENVIRONMENT} Stage=development"
# fi

# Build Lambda function
echo "Building Lambda function..."
cd ../lambda
if ! ./build.sh; then
    echo "Error: Failed to build Lambda function"
    exit 1
fi
cd ../infrastructure

# Deploy CloudFormation stack
echo "Deploying CloudFormation stack for ${ENVIRONMENT}..."
aws cloudformation deploy \
    --template-file template.yaml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides Environment=${ENVIRONMENT} ${ENV_CONFIG} \
    --capabilities CAPABILITY_IAM \
    --region ${REGION}

# Get stack outputs
echo "Retrieving stack outputs..."
aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs' \
    --output table \
    --region ${REGION} \
    || echo "Error: Failed to retrieve stack outputs"

# Validate deployment
echo "Validating deployment..."
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].StackStatus' \
    --output text \
    --region ${REGION})

if [ "$STACK_STATUS" != "CREATE_COMPLETE" ] && [ "$STACK_STATUS" != "UPDATE_COMPLETE" ]; then
    echo "Error: Stack deployment failed with status: $STACK_STATUS"
    exit 1
fi

echo "Deployment successful for environment: ${ENVIRONMENT} in region: ${REGION}" 