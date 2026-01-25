#!/bin/bash

# EcoScan Workspace Cleanup Script
# This script removes build artifacts, caches, and temporary files
# to free up disk space. Safe to run anytime - all cleaned files can be regenerated.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🧹 EcoScan Workspace Cleanup"
echo "======================================"
echo ""

# Function to check size before cleanup
check_size() {
    if [ -d "$1" ] || [ -f "$1" ]; then
        du -sh "$1" 2>/dev/null | awk '{print $1}'
    else
        echo "0"
    fi
}

# Function to safely remove directory/file
safe_remove() {
    local target="$1"
    local description="$2"

    if [ -d "$target" ] || [ -f "$target" ]; then
        local size=$(check_size "$target")
        echo "  Removing $description ($size)..."
        rm -rf "$target"
    fi
}

echo "📦 Cleaning Rust build artifacts..."
safe_remove "$PROJECT_ROOT/services/target" "Rust target directory"
safe_remove "$PROJECT_ROOT/services/*/target" "Individual service targets"

echo ""
echo "🏗️  Cleaning Terraform caches..."
safe_remove "$PROJECT_ROOT/infrastructure/.terraform" "Main Terraform cache"
safe_remove "$PROJECT_ROOT/infrastructure/.terraform.lock.hcl" "Terraform lock file"

for layer in "$PROJECT_ROOT/infrastructure/layers"/*/; do
    if [ -d "$layer" ]; then
        layer_name=$(basename "$layer")
        safe_remove "$layer/.terraform" "Layer $layer_name Terraform cache"
        safe_remove "$layer/.terraform.lock.hcl" "Layer $layer_name lock file"
    fi
done

echo ""
echo "⚛️  Cleaning frontend build artifacts..."
safe_remove "$PROJECT_ROOT/frontend/dist" "Frontend build output"
safe_remove "$PROJECT_ROOT/frontend/.vite" "Vite cache"
safe_remove "$PROJECT_ROOT/frontend/node_modules" "Node modules (can reinstall with npm install)"

echo ""
echo "📄 Cleaning logs and temporary files..."
find "$PROJECT_ROOT" -name "*.log" -type f -size +1M -delete 2>/dev/null || true
safe_remove "$PROJECT_ROOT/volume/logs" "LocalStack logs"
safe_remove "$PROJECT_ROOT/volume/tmp" "LocalStack tmp files"

echo ""
echo "🗜️  Cleaning ZIP artifacts..."
find "$PROJECT_ROOT/services" -name "*.zip" -type f -delete 2>/dev/null || true

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "Space saved. To rebuild:"
echo "  • Rust: cd services && cargo build --release"
echo "  • Terraform: cd infrastructure && terraform init"
echo "  • Frontend: cd frontend && npm install && npm run build"
echo ""

# Show final size
if command -v du &> /dev/null; then
    echo "Current workspace size: $(du -sh "$PROJECT_ROOT" 2>/dev/null | awk '{print $1}')"
fi
