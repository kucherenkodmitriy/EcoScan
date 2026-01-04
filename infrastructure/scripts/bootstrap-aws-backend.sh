#!/bin/bash
# bootstrap-aws-backend.sh: Create S3 bucket and DynamoDB table for Terraform state backend
# Usage: ./bootstrap-aws-backend.sh <environment>
# Example: ./bootstrap-aws-backend.sh dev

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
ENVIRONMENT=${1}
AWS_REGION="eu-central-1"

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    echo -e "${RED}Usage: ./bootstrap-aws-backend.sh <environment>${NC}"
    echo "Example: ./bootstrap-aws-backend.sh dev"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'. Must be 'dev' or 'prod'${NC}"
    exit 1
fi

# Set resource names
S3_BUCKET="ecoscan-terraform-state-${ENVIRONMENT}"
DYNAMODB_TABLE="ecoscan-terraform-locks-${ENVIRONMENT}"

echo -e "${GREEN}=== Bootstrapping Terraform Backend for Environment: $ENVIRONMENT ===${NC}"
echo "S3 Bucket: $S3_BUCKET"
echo "DynamoDB Table: $DYNAMODB_TABLE"
echo "Region: $AWS_REGION"
echo ""

# Check if S3 bucket already exists
if aws s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null; then
    echo -e "${YELLOW}S3 bucket '$S3_BUCKET' already exists${NC}"
else
    echo "Creating S3 bucket..."
    aws s3api create-bucket \
        --bucket "$S3_BUCKET" \
        --region "$AWS_REGION" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION"

    echo "Enabling bucket versioning..."
    aws s3api put-bucket-versioning \
        --bucket "$S3_BUCKET" \
        --versioning-configuration Status=Enabled

    echo "Enabling server-side encryption..."
    aws s3api put-bucket-encryption \
        --bucket "$S3_BUCKET" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'

    echo "Blocking public access..."
    aws s3api put-public-access-block \
        --bucket "$S3_BUCKET" \
        --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

    echo -e "${GREEN}✓ S3 bucket '$S3_BUCKET' created successfully${NC}"
fi

# Check if DynamoDB table already exists
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION" 2>/dev/null >/dev/null; then
    echo -e "${YELLOW}DynamoDB table '$DYNAMODB_TABLE' already exists${NC}"
else
    echo "Creating DynamoDB table..."
    aws dynamodb create-table \
        --table-name "$DYNAMODB_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION"

    echo "Waiting for table to be created..."
    aws dynamodb wait table-exists \
        --table-name "$DYNAMODB_TABLE" \
        --region "$AWS_REGION"

    echo -e "${GREEN}✓ DynamoDB table '$DYNAMODB_TABLE' created successfully${NC}"
fi

echo ""
echo -e "${GREEN}=== Bootstrap Complete! ===${NC}"
echo ""
echo "Backend configuration:"
echo "  bucket         = \"$S3_BUCKET\""
echo "  region         = \"$AWS_REGION\""
echo "  dynamodb_table = \"$DYNAMODB_TABLE\""
echo ""
echo "You can now run:"
echo "  ./infrastructure/scripts/init-environment.sh $ENVIRONMENT"
