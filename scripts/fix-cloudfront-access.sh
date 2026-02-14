#!/bin/bash
# Fix CloudFront Access Denied issue
# This script diagnoses and fixes CloudFront S3 access permission issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "CloudFront Access Denied Fix Tool"
echo "=========================================="
echo ""

# Get environment from first argument or default to dev
ENVIRONMENT=${1:-dev}
echo "Using environment: $ENVIRONMENT"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Get bucket name (format: dev-ecoscan-frontend-ACCOUNT_ID)
BUCKET_NAME="${ENVIRONMENT}-ecoscan-frontend-${ACCOUNT_ID}"
echo "S3 Bucket: $BUCKET_NAME"

# Check if bucket exists
echo ""
echo "Checking S3 bucket..."
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo -e "${RED}ERROR: Bucket $BUCKET_NAME does not exist or you don't have access${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Bucket exists${NC}"

# Get CloudFront distribution
echo ""
echo "Finding CloudFront distribution..."
DIST_INFO=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Comment, \`${ENVIRONMENT} EcoScan Frontend\`)].{Id: Id, ARN: ARN, DomainName: DomainName, Status: Status}" \
    --output json 2>/dev/null || echo "[]")

DIST_COUNT=$(echo "$DIST_INFO" | jq length)

if [ "$DIST_COUNT" -eq 0 ]; then
    echo -e "${RED}ERROR: No CloudFront distribution found with comment '${ENVIRONMENT} EcoScan Frontend'${NC}"
    exit 1
fi

DIST_ID=$(echo "$DIST_INFO" | jq -r '.[0].Id')
DIST_ARN=$(echo "$DIST_INFO" | jq -r '.[0].ARN')
DIST_DOMAIN=$(echo "$DIST_INFO" | jq -r '.[0].DomainName')
DIST_STATUS=$(echo "$DIST_INFO" | jq -r '.[0].Status')

echo -e "${GREEN}✓ Found CloudFront distribution:${NC}"
echo "  ID: $DIST_ID"
echo "  ARN: $DIST_ARN"
echo "  Domain: $DIST_DOMAIN"
echo "  Status: $DIST_STATUS"

# Check current bucket policy
echo ""
echo "Checking current bucket policy..."
CURRENT_POLICY=$(aws s3api get-bucket-policy --bucket "$BUCKET_NAME" --query Policy --output text 2>/dev/null || echo "NONE")

if [ "$CURRENT_POLICY" = "NONE" ]; then
    echo -e "${YELLOW}⚠ No bucket policy found${NC}"
else
    echo "Current policy:"
    echo "$CURRENT_POLICY" | python3 -m json.tool 2>/dev/null || echo "$CURRENT_POLICY"

    # Check if policy contains the correct CloudFront ARN
    if echo "$CURRENT_POLICY" | grep -q "$DIST_ARN"; then
        echo -e "${GREEN}✓ Bucket policy contains correct CloudFront ARN${NC}"
    else
        echo -e "${YELLOW}⚠ Bucket policy does not contain the correct CloudFront ARN${NC}"
    fi
fi

# Check if files exist in S3
echo ""
echo "Checking S3 bucket contents..."
FILE_COUNT=$(aws s3 ls "s3://$BUCKET_NAME/" | wc -l)
if [ "$FILE_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠ No files found in S3 bucket!${NC}"
    echo "  You need to deploy the frontend files first."
else
    echo -e "${GREEN}✓ Found $FILE_COUNT objects in S3 bucket${NC}"
    aws s3 ls "s3://$BUCKET_NAME/" | head -5
    if [ "$FILE_COUNT" -gt 5 ]; then
        echo "  ... and $((FILE_COUNT - 5)) more"
    fi
fi

# Check CloudFront OAC configuration
echo ""
echo "Checking CloudFront OAC configuration..."
DIST_CONFIG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --output json)
OAC_ID=$(echo "$DIST_CONFIG" | jq -r '.DistributionConfig.Origins.Items[] | select(.Id | contains("S3")) | .OriginAccessControlId // "NONE"')

if [ "$OAC_ID" != "NONE" ] && [ "$OAC_ID" != "null" ]; then
    echo -e "${GREEN}✓ CloudFront distribution uses OAC: $OAC_ID${NC}"
else
    echo -e "${YELLOW}⚠ CloudFront distribution does not have OAC configured${NC}"
fi

# Fix the bucket policy
echo ""
echo "=========================================="
echo "Applying correct bucket policy..."
echo "=========================================="

# Get the actual bucket ARN from Terraform output or construct it
BUCKET_ARN="arn:aws:s3:::${BUCKET_NAME}"

cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "${BUCKET_ARN}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "${DIST_ARN}"
        }
      }
    }
  ]
}
EOF

echo ""
echo "New bucket policy:"
cat /tmp/bucket-policy.json | python3 -m json.tool

echo ""
read -p "Apply this policy to s3://$BUCKET_NAME? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file:///tmp/bucket-policy.json
    echo -e "${GREEN}✓ Bucket policy applied successfully${NC}"

    # Create CloudFront invalidation
    echo ""
    echo "Creating CloudFront cache invalidation..."
    INVALIDATION=$(aws cloudfront create-invalidation \
        --distribution-id "$DIST_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' --output text)

    echo -e "${GREEN}✓ Invalidation created: $INVALIDATION${NC}"
    echo ""
    echo "CloudFront will update within 1-5 minutes."
    echo "You can monitor progress with:"
    echo "  aws cloudfront get-invalidation --distribution-id $DIST_ID --id $INVALIDATION"
else
    echo "Cancelled. Policy saved to /tmp/bucket-policy.json"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "CloudFront URL: https://$DIST_DOMAIN"
echo "S3 Bucket: s3://$BUCKET_NAME"
echo ""
echo "After 1-5 minutes, test with:"
echo "  curl -I https://$DIST_DOMAIN"
