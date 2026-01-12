#!/bin/bash
set -e

# Navigate to the root directory of the project
cd "$(dirname "$0")/.."

echo "--- Resetting LocalStack container ---"
docker-compose down -v --rmi all
docker-compose up -d

# Add a small delay to ensure LocalStack is ready to accept connections
sleep 5

echo "--- Building Lambda function for release ---"
chmod +x ./scripts/build-lambda.sh
./scripts/build-lambda.sh

# Navigate to the infrastructure directory
cd infrastructure

echo "--- Initializing Terraform ---"
terraform init

echo "--- Applying Terraform configuration for local environment ---"
# Auto-approve for non-interactive use in scripts
terraform apply -auto-approve -var="environment=local"

echo "--- Exporting outputs from Terraform ---"
# Get the table name from Terraform output and export it
export BINS_TABLE_NAME=$(terraform output -raw trash_bins_table_name)
export API_GATEWAY_URL=$(terraform output -raw api_gateway_invoke_url)

echo "Bins table name: $BINS_TABLE_NAME"
echo "API Gateway URL: $API_GATEWAY_URL"

# Navigate back to the root directory
cd ..

echo "--- Seeding data ---"
# Run the seed script, which will now use the exported environment variable
./scripts/seed-data.sh

echo "--- Local environment setup complete! ---"
echo "API Gateway is available at: $API_GATEWAY_URL"
