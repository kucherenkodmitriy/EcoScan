#!/bin/bash
#
# Builds the Lambda function using the official rust:latest Docker image
# with the MUSL toolchain for static linking. This ensures compatibility
# with the AWS Lambda Amazon Linux 2 runtime.
#
set -e

# --- Configuration ---
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/services"
PACKAGE_NAME="bin-status-reporter"
RUST_TARGET="x86_64-unknown-linux-musl"

# --- Build the Lambda Binary using Docker ---
echo "--- Building Lambda binary using rust:latest image ---"

# The command to run inside the Docker container.
# It first installs the MUSL toolchain and then compiles the project.
DOCKER_SHELL_COMMAND="apt-get update > /dev/null && apt-get install -y musl-tools > /dev/null && rustup target add $RUST_TARGET && cargo build --release --target $RUST_TARGET --package $PACKAGE_NAME"

# Run the build in a container.
# We mount the services directory into the container.
docker run --rm -v "$SERVICE_DIR":/usr/src/app -w /usr/src/app rust:latest bash -c "$DOCKER_SHELL_COMMAND"

# --- Package ---
echo "--- Packaging artifact ---"
SOURCE_ARTIFACT="$SERVICE_DIR/target/$RUST_TARGET/release/bootstrap"
ZIP_PATH="$SERVICE_DIR/target/lambda.zip"

if [ ! -f "$SOURCE_ARTIFACT" ]; then
    echo "Error: Build artifact not found at $SOURCE_ARTIFACT" >&2
    exit 1
fi

# Create a temporary directory for packaging
PACKAGE_DIR=$(mktemp -d)

# Copy the bootstrap executable to the temp directory
cp "$SOURCE_ARTIFACT" "$PACKAGE_DIR/bootstrap"

# Create the zip file containing the bootstrap executable
mkdir -p "$(dirname "$ZIP_PATH")"
(cd "$PACKAGE_DIR" && zip -r "$ZIP_PATH" ./*)

# --- Verify ---
echo "--- Verifying zip contents... ---"
unzip -l "$ZIP_PATH"

# Clean up the temporary directory
rm -rf "$PACKAGE_DIR"

echo -e "\n\xE2\x9C\x85 Build successful!"
echo "Lambda package created at: $ZIP_PATH"