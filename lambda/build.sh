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

# Create build directory
mkdir -p build

# Build the Lambda function locally
echo "Building Lambda function locally..."
cargo lambda build --release

# Copy the binary to the build directory
echo "Copying binary to build directory..."
cp target/lambda/bootstrap/bootstrap build/

# Package the binary
echo "Packaging Lambda function..."
cd build
zip -r ../ecoscan-lambda.zip bootstrap

echo "Build completed successfully!"
cd ..

echo "Uploading Lambda package to S3..."
BUCKET_NAME="${ENVIRONMENT:-dev}-ecoscan-lambda-deployments"
aws s3 mb s3://$BUCKET_NAME --region ${AWS_REGION:-eu-central-1} || true
aws s3 cp ecoscan-lambda.zip s3://$BUCKET_NAME/lambda.zip

echo "Build complete: ecoscan-lambda.zip"
echo "Lambda package uploaded to s3://$BUCKET_NAME/lambda.zip" 