#!/bin/bash
# cleanup-local.sh: Clean up LocalStack Terraform state WITHOUT destroying volumes
# This allows you to reset Terraform state while preserving LocalStack data

set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAYERS_DIR="$PROJECT_ROOT/infrastructure/layers"

echo -e "${YELLOW}=== Cleaning up LocalStack Terraform state ===${NC}"
echo "Note: This does NOT destroy LocalStack volumes"
echo ""

# Remove local state files
for layer in 00-foundation 01-data 02-compute 03-api; do
    echo "Cleaning layer: $layer"
    rm -rf "$LAYERS_DIR/$layer/.terraform"
    rm -f "$LAYERS_DIR/$layer/terraform-local.tfstate"
    rm -f "$LAYERS_DIR/$layer/terraform-local.tfstate.backup"
    rm -f "$LAYERS_DIR/$layer/.terraform.lock.hcl"
    rm -f "$LAYERS_DIR/$layer/tfplan"
done

echo ""
echo -e "${GREEN}✓ Terraform state cleaned${NC}"
echo ""
echo "To restart LocalStack (preserving data):"
echo "  docker-compose restart"
echo ""
echo "To completely reset LocalStack (destroys data):"
echo "  docker-compose down -v"
echo "  docker-compose up -d"
