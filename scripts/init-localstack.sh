#!/bin/bash

# Set AWS credentials for local testing
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-central-1}

# Set environment
ENVIRONMENT=${ENVIRONMENT:-dev}

# Create S3 bucket for health checks if it doesn't exist
echo "Checking S3 bucket for health checks..."
if ! aws --endpoint-url=http://localhost:4566 s3 ls s3://health >/dev/null 2>&1; then
    echo "Creating S3 bucket for health checks..."
    aws --endpoint-url=http://localhost:4566 s3 mb s3://health >/dev/null
else
    echo "Health check bucket already exists."
fi

# Create S3 bucket for Lambda deployments
echo "Checking S3 bucket for Lambda deployments..."
if ! aws --endpoint-url=http://localhost:4566 s3 ls s3://local-lambda-deployments >/dev/null 2>&1; then
    echo "Creating S3 bucket for Lambda deployments..."
    aws --endpoint-url=http://localhost:4566 s3 mb s3://local-lambda-deployments >/dev/null
else
    echo "Lambda deployment bucket already exists."
fi

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
while ! curl -s http://localhost:4566/_localstack/health | grep -E -q '"dynamodb": ("available"|"running")'; do
    sleep 1
done

# Create DynamoDB tables
echo "Creating DynamoDB tables..."

# Table: dev-ecoscan-trash-bins
if ! aws dynamodb --endpoint-url=http://localhost:4566 describe-table --table-name dev-ecoscan-trash-bins >/dev/null 2>&1; then
    echo "Creating table dev-ecoscan-trash-bins..."
    aws dynamodb --endpoint-url=http://localhost:4566 create-table \
        --table-name dev-ecoscan-trash-bins \
        --attribute-definitions AttributeName=binId,AttributeType=S \
        --key-schema AttributeName=binId,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 > /dev/null
else
    echo "Table dev-ecoscan-trash-bins already exists."
fi

# Table: dev-ecoscan-status-reports
if ! aws dynamodb --endpoint-url=http://localhost:4566 describe-table --table-name dev-ecoscan-status-reports >/dev/null 2>&1; then
    echo "Creating table dev-ecoscan-status-reports..."
    aws dynamodb --endpoint-url=http://localhost:4566 create-table \
        --table-name dev-ecoscan-status-reports \
        --attribute-definitions AttributeName=binId,AttributeType=S AttributeName=createdAt,AttributeType=S \
        --key-schema AttributeName=binId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 > /dev/null
else
    echo "Table dev-ecoscan-status-reports already exists."
fi

echo "DynamoDB tables creation process finished."

# --- Build and Deploy Lambda ---
echo "--- Building and Deploying Lambda Function ---"

# Build the lambda
./scripts/build-lambda.sh

LAMBDA_FUNCTION_NAME="dev-ecoscan-update-bin-status"
LAMBDA_ROLE_ARN="arn:aws:iam::000000000000:role/lambda-ex" # LocalStack default role
LAMBDA_ZIP_PATH="fileb://services/target/lambda.zip"

# Check if the function exists
if ! aws lambda --endpoint-url=http://localhost:4566 get-function --function-name "$LAMBDA_FUNCTION_NAME" >/dev/null 2>&1; then
    echo "Creating Lambda function: $LAMBDA_FUNCTION_NAME"
    aws lambda --endpoint-url=http://localhost:4566 create-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --runtime provided.al2 \
        --handler bootstrap \
        --role "$LAMBDA_ROLE_ARN" \
        --zip-file "$LAMBDA_ZIP_PATH"
else
    echo "Updating Lambda function code: $LAMBDA_FUNCTION_NAME"
    aws lambda --endpoint-url=http://localhost:4566 update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --zip-file "$LAMBDA_ZIP_PATH"
fi

# Wait for the function to be active
echo "Waiting for Lambda function to become active..."
aws lambda wait function-active-v2 --endpoint-url=http://localhost:4566 --function-name "$LAMBDA_FUNCTION_NAME"
echo "Lambda function is active."

LAMBDA_ARN=$(aws lambda --endpoint-url=http://localhost:4566 get-function --function-name "$LAMBDA_FUNCTION_NAME" | jq -r .Configuration.FunctionArn)
echo "Lambda ARN: $LAMBDA_ARN"

# --- Create or Update API Gateway (v1) ---
echo "--- Creating or Updating API Gateway (v1) ---"
API_NAME="dev-ecoscan-api"
STAGE_NAME="dev"

# Check if API exists, or create it
API_ID=$(aws apigateway --endpoint-url=http://localhost:4566 get-rest-apis | jq -r --arg API_NAME "$API_NAME" '.items[] | select(.name == $API_NAME) | .id')
if [ -z "$API_ID" ]; then
    echo "Creating API Gateway: $API_NAME"
    API_ID=$(aws apigateway --endpoint-url=http://localhost:4566 create-rest-api --name "$API_NAME" | jq -r .id)
    echo "API Gateway created with ID: $API_ID"
else
    echo "API Gateway '$API_NAME' already exists with ID: $API_ID"
fi

# Get the root resource ID
ROOT_RESOURCE_ID=$(aws apigateway --endpoint-url=http://localhost:4566 get-resources --rest-api-id "$API_ID" | jq -r '.items[] | select(.path == "/") | .id')

# Create /bins resource if it doesn't exist
BINS_RESOURCE_ID=$(aws apigateway --endpoint-url=http://localhost:4566 get-resources --rest-api-id "$API_ID" | jq -r --arg PARENT "$ROOT_RESOURCE_ID" '.items[] | select(.parentId == $PARENT and .pathPart == "bins") | .id')
if [ -z "$BINS_RESOURCE_ID" ]; then
    BINS_RESOURCE_ID=$(aws apigateway --endpoint-url=http://localhost:4566 create-resource --rest-api-id "$API_ID" --parent-id "$ROOT_RESOURCE_ID" --path-part "bins" | jq -r .id)
fi

# Create /bins/{bin_id} resource if it doesn't exist
BIN_ID_RESOURCE_ID=$(aws apigateway --endpoint-url=http://localhost:4566 get-resources --rest-api-id "$API_ID" | jq -r --arg PARENT "$BINS_RESOURCE_ID" '.items[] | select(.parentId == $PARENT and .pathPart == "{bin_id}") | .id')
if [ -z "$BIN_ID_RESOURCE_ID" ]; then
    BIN_ID_RESOURCE_ID=$(aws apigateway --endpoint-url=http://localhost:4566 create-resource --rest-api-id "$API_ID" --parent-id "$BINS_RESOURCE_ID" --path-part "{bin_id}" | jq -r .id)
fi

# Create /bins/{bin_id}/status resource if it doesn't exist
STATUS_RESOURCE_ID=$(aws apigateway --endpoint-url=http://localhost:4566 get-resources --rest-api-id "$API_ID" | jq -r --arg PARENT "$BIN_ID_RESOURCE_ID" '.items[] | select(.parentId == $PARENT and .pathPart == "status") | .id')
if [ -z "$STATUS_RESOURCE_ID" ]; then
    STATUS_RESOURCE_ID=$(aws apigateway --endpoint-url=http://localhost:4566 create-resource --rest-api-id "$API_ID" --parent-id "$BIN_ID_RESOURCE_ID" --path-part "status" | jq -r .id)
fi

# Create or update POST method and Lambda integration
aws apigateway --endpoint-url=http://localhost:4566 put-method --rest-api-id "$API_ID" --resource-id "$STATUS_RESOURCE_ID" --http-method POST --authorization-type NONE
aws apigateway --endpoint-url=http://localhost:4566 put-integration \
    --rest-api-id "$API_ID" \
    --resource-id "$STATUS_RESOURCE_ID" \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:${AWS_DEFAULT_REGION}:lambda:path/2015-03-31/functions/${LAMBDA_FUNCTION_NAME}/invocations

# Grant API Gateway permission to invoke Lambda
aws lambda --endpoint-url=http://localhost:4566 add-permission \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --statement-id "apigateway-invoke-permission-v1" \
    --action "lambda:InvokeFunction" \
    --principal "apigateway.amazonaws.com" \
    --source-arn "arn:aws:execute-api:eu-central-1:000000000000:$API_ID/*/*/*" 2>/dev/null || echo "Permission already exists."

# Deploy API
aws apigateway --endpoint-url=http://localhost:4566 create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE_NAME"

# Add a delay to allow the deployment to propagate
echo "Waiting for API Gateway deployment to propagate..."
sleep 5

API_ENDPOINT="http://localhost:4566/restapis/$API_ID/$STAGE_NAME/_user_request_"
echo "API Gateway Endpoint: $API_ENDPOINT"


# Seed data
"$(dirname "$0")/seed-data.sh"

echo "LocalStack initialization complete!"
echo "API Gateway URL: $API_ENDPOINT"