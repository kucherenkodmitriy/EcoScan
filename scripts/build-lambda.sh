#!/bin/bash
# build-lambda.sh: Builds the Rust Lambda function for deployment.
#
# Usage:
#   ./build-lambda.sh [ARCHITECTURE]
#
# Arguments:
#   ARCHITECTURE - Optional. Either 'x86_64' (default) or 'arm64'
#                  If not specified, defaults to 'x86_64' for AWS Lambda
#
# Examples:
#   ./build-lambda.sh           # Build for x86_64 (AWS default)
#   ./build-lambda.sh x86_64    # Build for x86_64 (AWS)
#   ./build-lambda.sh arm64     # Build for arm64 (LocalStack on Apple Silicon)

set -e # Exit immediately if a command exits with a non-zero status.

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/services"
TARGET_DIR="$SERVICE_DIR/target"

# Determine target architecture
ARCH="${1:-x86_64}"  # Default to x86_64 if not specified

# Set Rust target and Docker image based on architecture
case "$ARCH" in
  x86_64)
    RUST_TARGET="x86_64-unknown-linux-musl"
    DOCKER_IMAGE="clux/muslrust"
    DOCKER_PLATFORM=""  # Native
    ;;
  arm64|aarch64)
    RUST_TARGET="aarch64-unknown-linux-musl"
    DOCKER_IMAGE="messense/rust-musl-cross:aarch64-musl"
    DOCKER_PLATFORM="--platform linux/arm64"
    ;;
  *)
    echo "Error: Unsupported architecture '$ARCH'. Use 'x86_64' or 'arm64'" >&2
    exit 1
    ;;
esac

SOURCE_ARTIFACT="$TARGET_DIR/$RUST_TARGET/release/bootstrap"
ZIP_PATH="$TARGET_DIR/lambda.zip"

# --- Build the Lambda function using Docker ---
echo "--- Building Lambda function for $ARCH ($RUST_TARGET) using $DOCKER_IMAGE ---"

# Get current user/group ID for fixing permissions
USER_ID=$(id -u)
GROUP_ID=$(id -g)

# Use Docker to build for the target architecture
# This ensures consistent builds across Linux, Mac, and Windows
docker run --rm $DOCKER_PLATFORM \
  -v "$SERVICE_DIR":/home/rust/src \
  -w /home/rust/src \
  -e RUSTFLAGS='-C target-feature=+crt-static -C link-arg=-static' \
  "$DOCKER_IMAGE" \
  sh -c "cargo build --release --target $RUST_TARGET -p bin-status-reporter && \
         chown -R $USER_ID:$GROUP_ID target/$RUST_TARGET/release/bootstrap target || true"

# --- Packaging artifact ---
echo "--- Packaging artifact ---"

if [ ! -f "$SOURCE_ARTIFACT" ]; then
    echo "Error: Build artifact not found at $SOURCE_ARTIFACT" >&2
    exit 1
fi

# Remove old zip if exists
rm -f "$ZIP_PATH"

# Create the zip package (on host where zip is available)
zip -j "$ZIP_PATH" "$SOURCE_ARTIFACT"

# --- Verify artifact ---
echo "--- Verifying artifact ---"

if [ ! -f "$ZIP_PATH" ]; then
    echo "Error: Lambda package not found at $ZIP_PATH" >&2
    exit 1
fi

echo -e "\n\xE2\x9C\x85 Build successful!"
echo "Lambda package created at: $ZIP_PATH"