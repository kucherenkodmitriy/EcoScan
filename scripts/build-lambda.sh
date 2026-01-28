#!/bin/bash
# build-lambda.sh: Builds Rust Lambda functions for deployment.
#
# Usage:
#   ./build-lambda.sh [ARCHITECTURE] [SERVICE]
#
# Arguments:
#   ARCHITECTURE - Optional. Either 'x86_64' (default) or 'arm64'
#   SERVICE      - Optional. Which service to build:
#                  'all' (default), 'bin-status-reporter', 'lambda-authorizer',
#                  'admin-dashboard-api', 'contact-form-handler'
#
# Examples:
#   ./build-lambda.sh                          # Build all services for x86_64
#   ./build-lambda.sh x86_64                   # Build all services for x86_64
#   ./build-lambda.sh arm64                    # Build all services for arm64
#   ./build-lambda.sh x86_64 bin-status-reporter  # Build only bin-status-reporter

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/services"
TARGET_DIR="$SERVICE_DIR/target"

ARCH="${1:-x86_64}"
SERVICE="${2:-all}"

# Set Rust target based on architecture
case "$ARCH" in
  x86_64)
    RUST_TARGET="x86_64-unknown-linux-musl"
    DOCKER_IMAGE="clux/muslrust"
    DOCKER_PLATFORM=""
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

USER_ID=$(id -u)
GROUP_ID=$(id -g)

# Function to package a single service
package_service() {
    local binary_name="$1"
    local zip_name="$2"

    local source_artifact="$TARGET_DIR/$RUST_TARGET/release/$binary_name"
    if [ ! -f "$source_artifact" ]; then
        echo "Error: Build artifact not found at $source_artifact" >&2
        return 1
    fi

    local zip_path="$TARGET_DIR/$zip_name"
    rm -f "$zip_path"

    local temp_dir=$(mktemp -d)
    cp "$source_artifact" "$temp_dir/bootstrap"
    zip -j "$zip_path" "$temp_dir/bootstrap"
    rm -rf "$temp_dir"

    echo "Created: $zip_path"
}

# Determine which packages to build
case "$SERVICE" in
  all)
    PACKAGES="-p bin-status-reporter -p lambda-authorizer -p admin-dashboard-api -p contact-form-handler"
    ;;
  bin-status-reporter)
    PACKAGES="-p bin-status-reporter"
    ;;
  lambda-authorizer)
    PACKAGES="-p lambda-authorizer"
    ;;
  admin-dashboard-api)
    PACKAGES="-p admin-dashboard-api"
    ;;
  contact-form-handler)
    PACKAGES="-p contact-form-handler"
    ;;
  *)
    echo "Error: Unknown service '$SERVICE'" >&2
    exit 1
    ;;
esac

echo "=== Building Lambda services for $ARCH ($RUST_TARGET) ==="
echo "Services: $SERVICE"
echo ""

# Build ALL selected packages in a SINGLE Docker run (shares cargo cache)
docker run --rm $DOCKER_PLATFORM \
  -v "$SERVICE_DIR":/home/rust/src \
  -v "$SERVICE_DIR/.cargo-cache/registry":/root/.cargo/registry \
  -v "$SERVICE_DIR/.cargo-cache/git":/root/.cargo/git \
  -w /home/rust/src \
  -e CARGO_INCREMENTAL=1 \
  -e RUSTFLAGS='-C target-feature=+crt-static -C link-arg=-static' \
  "$DOCKER_IMAGE" \
  sh -c "cargo build --release --target $RUST_TARGET $PACKAGES && \
         chown -R $USER_ID:$GROUP_ID target .cargo-cache 2>/dev/null || true"

# Package the artifacts
echo ""
echo "=== Packaging artifacts ==="

case "$SERVICE" in
  all)
    package_service "bootstrap" "lambda.zip"
    package_service "authorizer-bootstrap" "authorizer.zip"
    package_service "admin-bootstrap" "admin-dashboard.zip"
    package_service "contact-form-handler" "contact-form-handler.zip"
    ;;
  bin-status-reporter)
    package_service "bootstrap" "lambda.zip"
    ;;
  lambda-authorizer)
    package_service "authorizer-bootstrap" "authorizer.zip"
    ;;
  admin-dashboard-api)
    package_service "admin-bootstrap" "admin-dashboard.zip"
    ;;
  contact-form-handler)
    package_service "contact-form-handler" "contact-form-handler.zip"
    ;;
esac

echo ""
echo "--- Build Summary ---"
echo "Architecture: $ARCH ($RUST_TARGET)"
echo "Artifacts:"
[ -f "$TARGET_DIR/lambda.zip" ] && echo "  - lambda.zip: $(ls -lh "$TARGET_DIR/lambda.zip" | awk '{print $5}')"
[ -f "$TARGET_DIR/authorizer.zip" ] && echo "  - authorizer.zip: $(ls -lh "$TARGET_DIR/authorizer.zip" | awk '{print $5}')"
[ -f "$TARGET_DIR/admin-dashboard.zip" ] && echo "  - admin-dashboard.zip: $(ls -lh "$TARGET_DIR/admin-dashboard.zip" | awk '{print $5}')"
[ -f "$TARGET_DIR/contact-form-handler.zip" ] && echo "  - contact-form-handler.zip: $(ls -lh "$TARGET_DIR/contact-form-handler.zip" | awk '{print $5}')"
echo -e "\n✅ Build successful!"
