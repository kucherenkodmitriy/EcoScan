#!/bin/bash

set -e

echo "Building contact-form-handler Lambda..."

cd "$(dirname "$0")"

# Build for AWS Lambda (x86_64)
cargo build --release --target x86_64-unknown-linux-musl

# Create output directory
mkdir -p ../target

# Copy binary to bootstrap (Lambda custom runtime requirement)
cp ../target/x86_64-unknown-linux-musl/release/contact-form-handler bootstrap

# Create zip file
zip -j ../target/contact-form-handler.zip bootstrap

# Clean up
rm bootstrap

echo "✓ Lambda package created: target/contact-form-handler.zip"
