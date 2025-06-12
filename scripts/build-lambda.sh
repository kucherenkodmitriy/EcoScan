#!/bin/bash
set -e

# Change to lambda directory
cd "$(dirname "$0")/../lambda" || exit

# Use Docker to build the Lambda binary for Linux x86_64 (Apple Silicon compatible)
echo "Building Lambda function with Docker for Linux x86_64..."
docker run --rm --platform linux/amd64 -v "$PWD":/usr/src/myapp -w /usr/src/myapp rust:latest bash -c "
    apt-get update && apt-get install -y musl-tools && 
    rustup target add x86_64-unknown-linux-musl && 
    cargo build --release --target x86_64-unknown-linux-musl
"

# Package the binary as bootstrap
echo "Packaging Lambda function..."
rm -rf target/lambda
mkdir -p target/lambda
cp target/x86_64-unknown-linux-musl/release/bootstrap target/lambda/bootstrap
chmod +x target/lambda/bootstrap

cd target/lambda
zip lambda.zip bootstrap
mv lambda.zip ../lambda.zip
cd ../..

echo "Lambda package created at target/lambda.zip"