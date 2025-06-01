#!/bin/bash
set -e

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

echo "Build complete: ecoscan-lambda.zip" 