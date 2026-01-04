#!/bin/bash
# init-environment.sh: Initialize and deploy all infrastructure layers
# Usage: ./init-environment.sh <environment> [options]
# Example: ./init-environment.sh local
#          ./init-environment.sh dev -auto-approve

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
ENVIRONMENT=${1}
AUTO_APPROVE=${2}

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    echo -e "${RED}Usage: ./init-environment.sh <environment> [options]${NC}"
    echo "Example: ./init-environment.sh local"
    echo "         ./init-environment.sh dev -auto-approve"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(local|dev|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'. Must be one of: local, dev, prod${NC}"
    exit 1
fi

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFRA_ROOT="$PROJECT_ROOT/infrastructure"
LAYERS_DIR="$INFRA_ROOT/layers"

# Set approval flag
APPROVE_FLAG=""
if [[ "$AUTO_APPROVE" == "-auto-approve" ]] || [[ "$ENVIRONMENT" == "local" ]]; then
    APPROVE_FLAG="-auto-approve"
fi

echo -e "${GREEN}=== Initializing EcoScan Infrastructure ===${NC}"
echo "Environment: $ENVIRONMENT"
echo "Infrastructure root: $INFRA_ROOT"
echo ""

# For LocalStack, start Docker Compose (without -v to preserve volumes)
if [[ "$ENVIRONMENT" == "local" ]]; then
    echo -e "${YELLOW}--- Starting LocalStack ---${NC}"
    cd "$PROJECT_ROOT"

    # Only restart if not running
    if ! docker ps | grep -q ecoscan-localstack; then
        docker-compose down
        docker-compose up -d

        # Wait for LocalStack to be ready
        echo "Waiting for LocalStack to be ready..."
        sleep 5

        # Health check
        max_attempts=30
        attempt=0
        until curl -sf http://localhost:4566/health > /dev/null 2>&1; do
            attempt=$((attempt + 1))
            if [ $attempt -ge $max_attempts ]; then
                echo -e "${RED}LocalStack failed to start${NC}"
                exit 1
            fi
            echo "Waiting for LocalStack... ($attempt/$max_attempts)"
            sleep 2
        done
        echo -e "${GREEN}LocalStack is ready${NC}"
    else
        echo -e "${GREEN}LocalStack is already running${NC}"
    fi
fi

# Build Lambda function
echo -e "${YELLOW}--- Building Lambda function ---${NC}"
chmod +x "$PROJECT_ROOT/scripts/build-lambda.sh"
"$PROJECT_ROOT/scripts/build-lambda.sh"

# Deploy layers in order
# Note: 03-api creates SQS queue that 02-compute consumes from
LAYERS=("00-foundation" "01-data" "03-api" "02-compute")

for layer in "${LAYERS[@]}"; do
    echo ""
    echo -e "${YELLOW}=== Deploying Layer: $layer ===${NC}"

    LAYER_DIR="$LAYERS_DIR/$layer"
    cd "$LAYER_DIR"

    # Initialize Terraform with backend config
    echo "Initializing Terraform..."
    if [[ "$ENVIRONMENT" == "local" ]]; then
        # Local backend for LocalStack
        terraform init \
            -backend-config="path=terraform-${ENVIRONMENT}.tfstate" \
            -reconfigure
    else
        # S3 backend for AWS
        terraform init \
            -backend-config="$INFRA_ROOT/backend/${ENVIRONMENT}.tfbackend" \
            -backend-config="key=layers/${layer}/terraform.tfstate" \
            -reconfigure
    fi

    # Plan
    echo "Planning..."
    terraform plan \
        -var-file="$INFRA_ROOT/environments/${ENVIRONMENT}.tfvars" \
        -out=tfplan

    # Apply
    echo "Applying..."
    terraform apply $APPROVE_FLAG tfplan

    # Clean up plan file
    rm -f tfplan

    echo -e "${GREEN}✓ Layer $layer deployed successfully${NC}"
done

# Export outputs for testing
echo ""
echo -e "${YELLOW}=== Exporting Outputs ===${NC}"
cd "$LAYERS_DIR/01-data"
export BINS_TABLE_NAME=$(terraform output -raw trash_bins_table_name)

cd "$LAYERS_DIR/03-api"
export API_GATEWAY_URL=$(terraform output -raw api_gateway_invoke_url)
export API_GATEWAY_ID=$(terraform output -raw api_gateway_id)

echo "Bins table name: $BINS_TABLE_NAME"
echo "API Gateway URL: $API_GATEWAY_URL"
echo "API Gateway ID: $API_GATEWAY_ID"

# Seed data for local environment
if [[ "$ENVIRONMENT" == "local" ]]; then
    echo ""
    echo -e "${YELLOW}--- Seeding data ---${NC}"
    cd "$PROJECT_ROOT"
    ./scripts/seed-data.sh
fi

echo ""
echo -e "${GREEN}=== Infrastructure deployment complete! ===${NC}"
echo "Environment: $ENVIRONMENT"
echo "API Gateway URL: $API_GATEWAY_URL"

# For LocalStack, provide the special test URL
if [[ "$ENVIRONMENT" == "local" ]]; then
    echo "LocalStack API URL: http://localhost:4566/restapis/${API_GATEWAY_ID}/local/_user_request_"
fi
