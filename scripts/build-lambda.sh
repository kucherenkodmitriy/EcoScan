#!/bin/bash
# build-lambda.sh: Builds Rust Lambda functions for deployment.
#
# Usage:
#   ./build-lambda.sh [ARCHITECTURE] [SERVICE]
#
# Arguments:
#   ARCHITECTURE - Optional. Either 'x86_64' (default) or 'arm64'
#   SERVICE      - Optional. Which service to build:
#                  'all' (default), 'bin-status-reporter', 'lambda-authorizer', 'admin-dashboard-api'
#
# Examples:
#   ./build-lambda.sh                          # Build all services for x86_64
#   ./build-lambda.sh x86_64                   # Build all services for x86_64
#   ./build-lambda.sh arm64                    # Build all services for arm64
#   ./build-lambda.sh x86_64 bin-status-reporter  # Build only bin-status-reporter

set -e # Exit immediately if a command exits with a non-zero status.

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/services"
TARGET_DIR="$SERVICE_DIR/target"

# Determine target architecture
ARCH="${1:-x86_64}"  # Default to x86_64 if not specified
SERVICE="${2:-all}"  # Default to all services

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

# Get current user/group ID for fixing permissions
USER_ID=$(id -u)
GROUP_ID=$(id -g)

# Function to build a single service
build_service() {
    local package_name="$1"
    local binary_name="$2"
    local zip_name="$3"

    echo ""
    echo "=== Building $package_name for $ARCH ($RUST_TARGET) ==="

    # Build the service
    docker run --rm $DOCKER_PLATFORM \
      -v "$SERVICE_DIR":/home/rust/src \
      -w /home/rust/src \
      -e RUSTFLAGS='-C target-feature=+crt-static -C link-arg=-static' \
      "$DOCKER_IMAGE" \
      sh -c "cargo build --release --target $RUST_TARGET -p $package_name && \
             chown -R $USER_ID:$GROUP_ID target/$RUST_TARGET/release/$binary_name target || true"

    # Check if build succeeded
    local source_artifact="$TARGET_DIR/$RUST_TARGET/release/$binary_name"
    if [ ! -f "$source_artifact" ]; then
        echo "Error: Build artifact not found at $source_artifact" >&2
        return 1
    fi

    # Package the artifact
    local zip_path="$TARGET_DIR/$zip_name"
    rm -f "$zip_path"

    # Lambda expects the binary to be named 'bootstrap'
    local temp_dir=$(mktemp -d)
    cp "$source_artifact" "$temp_dir/bootstrap"
    zip -j "$zip_path" "$temp_dir/bootstrap"
    rm -rf "$temp_dir"

    echo "Created: $zip_path"
}

# Build services based on selection
case "$SERVICE" in
  all)
    echo "--- Building all Lambda services for $ARCH ---"
    build_service "bin-status-reporter" "bootstrap" "lambda.zip"
    build_service "lambda-authorizer" "authorizer-bootstrap" "authorizer.zip"
    build_service "admin-dashboard-api" "admin-bootstrap" "admin-dashboard.zip"
    ;;
  bin-status-reporter)
    build_service "bin-status-reporter" "bootstrap" "lambda.zip"
    ;;
  lambda-authorizer)
    build_service "lambda-authorizer" "authorizer-bootstrap" "authorizer.zip"
    ;;
  admin-dashboard-api)
    build_service "admin-dashboard-api" "admin-bootstrap" "admin-dashboard.zip"
    ;;
  *)
    echo "Error: Unknown service '$SERVICE'. Use 'all', 'bin-status-reporter', 'lambda-authorizer', or 'admin-dashboard-api'" >&2
    exit 1
    ;;
esac

# --- Verify artifacts ---
echo ""
echo "--- Build Summary ---"
echo "Architecture: $ARCH ($RUST_TARGET)"
echo "Artifacts:"

[ -f "$TARGET_DIR/lambda.zip" ] && echo "  - lambda.zip (bin-status-reporter): $(ls -lh "$TARGET_DIR/lambda.zip" | awk '{print $5}')"
[ -f "$TARGET_DIR/authorizer.zip" ] && echo "  - authorizer.zip (lambda-authorizer): $(ls -lh "$TARGET_DIR/authorizer.zip" | awk '{print $5}')"
[ -f "$TARGET_DIR/admin-dashboard.zip" ] && echo "  - admin-dashboard.zip (admin-dashboard-api): $(ls -lh "$TARGET_DIR/admin-dashboard.zip" | awk '{print $5}')"

echo -e "\n\xE2\x9C\x85 Build successful!"
