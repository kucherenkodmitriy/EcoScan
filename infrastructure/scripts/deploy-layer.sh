#!/bin/bash
# deploy-layer.sh: Deploy a single infrastructure layer
# Usage: ./deploy-layer.sh <layer> <environment> [options]
# Example: ./deploy-layer.sh 03-api dev -auto-approve

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
LAYER=$1
ENVIRONMENT=$2
AUTO_APPROVE=$3

# Validate inputs
if [[ -z "$LAYER" ]] || [[ -z "$ENVIRONMENT" ]]; then
    echo -e "${RED}Usage: ./deploy-layer.sh <layer> <environment> [options]${NC}"
    echo "Layers: 00-foundation, 01-data, 02-compute, 03-api"
    echo "Environments: local, dev, prod"
    echo ""
    echo "Examples:"
    echo "  ./deploy-layer.sh 03-api local"
    echo "  ./deploy-layer.sh 02-compute dev -auto-approve"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(local|dev|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
    exit 1
fi

# Get paths
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFRA_ROOT="$PROJECT_ROOT/infrastructure"
LAYER_DIR="$INFRA_ROOT/layers/$LAYER"

if [[ ! -d "$LAYER_DIR" ]]; then
    echo -e "${RED}Error: Layer directory not found: $LAYER_DIR${NC}"
    exit 1
fi

# Set approval flag
APPROVE_FLAG=""
if [[ "$AUTO_APPROVE" == "-auto-approve" ]] || [[ "$ENVIRONMENT" == "local" ]]; then
    APPROVE_FLAG="-auto-approve"
fi

echo -e "${YELLOW}=== Deploying Layer: $LAYER ===${NC}"
echo "Environment: $ENVIRONMENT"
echo "Layer directory: $LAYER_DIR"
echo ""

cd "$LAYER_DIR"

# Initialize
echo "Initializing Terraform..."
if [[ "$ENVIRONMENT" == "local" ]]; then
    terraform init \
        -backend-config="path=terraform-${ENVIRONMENT}.tfstate" \
        -reconfigure
else
    terraform init \
        -backend-config="$INFRA_ROOT/backend/${ENVIRONMENT}.tfbackend" \
        -backend-config="key=layers/${LAYER}/terraform.tfstate" \
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

# Clean up
rm -f tfplan

echo -e "${GREEN}✓ Layer $LAYER deployed successfully${NC}"

# Show outputs
echo ""
echo "Outputs:"
terraform output
