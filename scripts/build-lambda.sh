#!/bin/bash
# build-lambda.sh: Builds the Rust Lambda function for deployment.

set -e # Exit immediately if a command exits with a non-zero status.

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/services"
TARGET_DIR="$SERVICE_DIR/target"
RUST_TARGET="aarch64-unknown-linux-musl"
SOURCE_ARTIFACT="$TARGET_DIR/$RUST_TARGET/release/bootstrap"
ZIP_PATH="$TARGET_DIR/lambda.zip"

# --- Build the Lambda function using Docker ---
# We're building for aarch64 since it works on Apple Silicon and is supported by Lambda
echo "--- Building Lambda function for $RUST_TARGET (clux/muslrust) ---"

# Use the clux/muslrust image which is a modern, well-maintained builder for static Rust binaries.
docker run --rm -v "$SERVICE_DIR":/home/rust/src -w /home/rust/src \
  -e RUSTFLAGS='-C target-feature=+crt-static -C link-arg=-static -C link-arg=-no-pie' \
  clux/muslrust cargo build --release --target $RUST_TARGET -p bin-status-reporter

# --- Packaging artifact ---
echo "--- Packaging artifact ---"

if [ ! -f "$SOURCE_ARTIFACT" ]; then
    echo "Error: Build artifact not found at $SOURCE_ARTIFACT" >&2
    exit 1
fi

chmod +x "$SOURCE_ARTIFACT"

zip -j "$ZIP_PATH" "$SOURCE_ARTIFACT"

echo -e "\n\xE2\x9C\x85 Build successful!"
echo "Lambda package created at: $ZIP_PATH"