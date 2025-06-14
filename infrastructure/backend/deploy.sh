#!/bin/bash

# Exit on error, undefined variables, and pipeline failures
set -euo pipefail

# Enable debug output if DEBUG is set to 1
[[ "${DEBUG:-0}" == "1" ]] && set -x

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] $*"
}

error() {
    log "ERROR: $*" >&2
    exit 1
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log "Cleaning up..."
    # Add any cleanup tasks here
    exit $exit_code
}

trap cleanup EXIT

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICES_DIR="$ROOT_DIR/../services"
INFRA_DIR="${SCRIPT_DIR}"

# Source .env file for AWS credentials only in local development (not CI/CD)
if [ -f "${ROOT_DIR}/.env" ] && [ -z "$GITHUB_ACTIONS" ]; then
    log "Loading AWS credentials from ${ROOT_DIR}/.env"
    # Use grep to safely extract values without sourcing the file
    AWS_ACCESS_KEY_ID=$(grep -E '^AWS_ACCESS_KEY_ID=' "${ROOT_DIR}/.env" | cut -d= -f2-)
    AWS_SECRET_ACCESS_KEY=$(grep -E '^AWS_SECRET_ACCESS_KEY=' "${ROOT_DIR}/.env" | cut -d= -f2-)
    AWS_DEFAULT_REGION=$(grep -E '^AWS_DEFAULT_REGION=' "${ROOT_DIR}/.env" | cut -d= -f2-)
    
    # Export variables if they exist
    [ -n "$AWS_ACCESS_KEY_ID" ] && export AWS_ACCESS_KEY_ID
    [ -n "$AWS_SECRET_ACCESS_KEY" ] && export AWS_SECRET_ACCESS_KEY
    [ -n "$AWS_DEFAULT_REGION" ] && export AWS_DEFAULT_REGION
fi

# Default values
ENVIRONMENT="dev"
RATE_LIMIT=10
BURST_LIMIT=5
REGION="eu-central-1"
STACK_NAME="ecoscan-${ENVIRONMENT}"
ARTIFACT_BUCKET="ecoscan-${ENVIRONMENT}-artifacts-$(date +%s%N | md5sum | head -c 8)"

# Show help message
show_help() {
    cat <<EOF
Usage: $0 [OPTIONS]

Deploy EcoScan infrastructure using AWS SAM

Options:
  -e, --environment ENV   Deployment environment (default: dev)
  --rate-limit NUM       API Gateway rate limit (default: 10)
  --burst-limit NUM      API Gateway burst limit (default: 5)
  --region REGION        AWS region (default: eu-central-1)
  --help                 Show this help message
  --debug                Enable debug output

Examples:
  $0 --environment dev
  $0 --environment prod --rate-limit 100 --burst-limit 50

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            ENVIRONMENT="$2"
            STACK_NAME="ecoscan-${ENVIRONMENT}"
            ARTIFACT_BUCKET="ecoscan-${ENVIRONMENT}-artifacts-$(date +%s%N | md5sum | head -c 8)"
            shift 2
            ;;
        --rate-limit)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            [[ $2 =~ ^[0-9]+$ ]] || error "Rate limit must be a number"
            RATE_LIMIT="$2"
            shift 2
            ;;
        --burst-limit)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            [[ $2 =~ ^[0-9]+$ ]] || error "Burst limit must be a number"
            BURST_LIMIT="$2"
            shift 2
            ;;
        --region)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            REGION="$2"
            shift 2
            ;;
        --debug)
            set -x
            shift
            ;;
        --help)
            show_help
            ;;
        -*)
            error "Unknown option: $1"
            ;;
        *)
            error "Unexpected argument: $1"
            ;;
    esac
done

log "Deployment configuration:"
log "  Environment:     $ENVIRONMENT"
log "  Stack Name:     $STACK_NAME"
log "  Region:         $REGION"
log "  Rate Limit:     $RATE_LIMIT"
log "  Burst Limit:    $BURST_LIMIT"

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] $*"
}

error() {
    log "ERROR: $*" >&2
    exit 1
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log "Cleaning up..."
    # Add any cleanup tasks here
    exit $exit_code
}

trap cleanup EXIT

# Validate AWS credentials and environment
validate_aws_credentials() {
    log "Validating AWS credentials..."
    
    # Check if running in local development with act
    if [ -n "${ACT:-}" ]; then
        log "Running in local development with act - skipping AWS validation"
        return 0
    fi
    
    # Check if running in CI/CD environment
    if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
        log "Running in CI/CD environment"
        # In CI/CD, we expect environment variables to be set
        if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
            error "AWS credentials not found in environment variables"
        fi
    else
        # In local development, check for AWS credentials in the environment or AWS credentials file
        if ! aws sts get-caller-identity >/dev/null 2>&1; then
            error "Failed to validate AWS credentials. Please ensure you have valid credentials configured."
            [ -n "$AWS_ACCESS_KEY_ID" ] && export AWS_ACCESS_KEY_ID
            [ -n "$AWS_SECRET_ACCESS_KEY" ] && export AWS_SECRET_ACCESS_KEY
            [ -n "$AWS_DEFAULT_REGION" ] && export AWS_DEFAULT_REGION
        fi
    fi
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "Failed to validate AWS credentials. Please ensure you have valid credentials configured."
    fi
    
    log "AWS credentials validated successfully"
    log "  AWS Account: $(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null || echo 'unknown')"
    log "  AWS User: $(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null || echo 'unknown')"
}

# Call the validation function
validate_aws_credentials

# Set AWS region if not already set
if [ -z "${AWS_DEFAULT_REGION:-}" ]; then
    export AWS_DEFAULT_REGION="$REGION"
    log "Using default region: $AWS_DEFAULT_REGION"
fi

# Show help message
show_help() {
    cat <<EOF
Usage: $0 [OPTIONS]

Deploy EcoScan infrastructure using AWS SAM

Options:
  -e, --environment ENV   Deployment environment (default: dev)
  --rate-limit NUM       API Gateway rate limit (default: 10)
  --burst-limit NUM      API Gateway burst limit (default: 5)
  --region REGION        AWS region (default: eu-central-1)
  --help                 Show this help message
  --debug                Enable debug output

Examples:
  $0 --environment dev
  $0 --environment prod --rate-limit 100 --burst-limit 50

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            ENVIRONMENT="$2"
            STACK_NAME="ecoscan-${ENVIRONMENT}"
            ARTIFACT_BUCKET="ecoscan-${ENVIRONMENT}-artifacts-$(date +%s%N | md5sum | head -c 8)"
            shift 2
            ;;
        --rate-limit)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            [[ $2 =~ ^[0-9]+$ ]] || error "Rate limit must be a number"
            RATE_LIMIT="$2"
            shift 2
            ;;
        --burst-limit)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            [[ $2 =~ ^[0-9]+$ ]] || error "Burst limit must be a number"
            BURST_LIMIT="$2"
            shift 2
            ;;
        --region)
            [[ -z $2 || $2 == -* ]] && error "Missing argument for $1"
            REGION="$2"
            shift 2
            ;;
        --debug)
            set -x
            shift
            ;;
        --help)
            show_help
            ;;
        -*)
            error "Unknown option: $1"
            ;;
        *)
            error "Unexpected argument: $1"
            ;;
    esac
done

log "Deployment configuration:"
log "  Environment:     $ENVIRONMENT"
log "  Stack Name:     $STACK_NAME"
log "  Region:         $REGION"
log "  Rate Limit:     $RATE_LIMIT"
log "  Burst Limit:    $BURST_LIMIT"

# Build the Lambda function
build_lambda() {
    log "Building Lambda function..."
    local build_dir="${SERVICES_DIR}/bin-status-reporter"
    local target_dir="${build_dir}/target/lambda/bin-status-reporter"
    local lambda_binary="${target_dir}/bootstrap"
    
    # Ensure build directory exists
    if [ ! -d "$build_dir" ]; then
        error "Lambda source directory not found: $build_dir"
    fi
    
    log "Building Lambda function in directory: $build_dir"
    
    # Check for required tools
    if ! command -v cargo &> /dev/null; then
        error "Rust toolchain (cargo) not found. Please install Rust first: https://rustup.rs/"
    fi
    
    if ! command -v cargo-lambda &> /dev/null; then
        log "Installing cargo-lambda..."
        cargo install cargo-lambda || error "Failed to install cargo-lambda"
    fi
    
    # Build the Lambda function
    (
        cd "$build_dir" || error "Failed to change to directory: $build_dir"
        
        log "Installing target for cross-compilation..."
        rustup target add aarch64-unknown-linux-gnu || error "Failed to add cross-compilation target"
        
        # Clean previous builds
        log "Cleaning previous build artifacts..."
        cargo clean || true
        
        # Create target directories if they don't exist
        mkdir -p "${build_dir}/target/lambda/bin-status-reporter"
        
        log "Building with cargo lambda..."
        # Build with unstable options for artifact directory
        cargo lambda build \
            --release \
            --arm64 \
            --output-format zip \
            -Z unstable-options \
            --out-dir "${build_dir}/target/lambda" \
            || error "Failed to build Lambda function"
        
        # Show the directory structure for debugging
        log "Build directory structure:"
        find "${build_dir}/target" -type f -name "bootstrap" -o -name "*.zip" -o -name "*.so" | xargs ls -la 2>/dev/null || true
        
        # Show the contents of the lambda directory
        log "Lambda output directory contents:"
        ls -la "${build_dir}/target/lambda/" 2>/dev/null || true
        
        # If we have a zip file, extract it to check contents
        if [ -f "${build_dir}/target/lambda/bin-status-reporter.zip" ]; then
            log "Found zip file, checking contents..."
            unzip -l "${build_dir}/target/lambda/bin-status-reporter.zip" || true
        fi
        
        # Check for the binary in multiple possible locations
        local possible_locations=(
            "${build_dir}/target/lambda/bin-status-reporter/bootstrap"
            "${build_dir}/target/aarch64-unknown-linux-gnu/release/bootstrap"
            "${build_dir}/target/release/bootstrap"
            "${build_dir}/target/lambda/bootstrap"
            "${build_dir}/target/lambda/bin-status-reporter/bootstrap"
            "${build_dir}/target/lambda/bin-status-reporter/bootstrap.zip"
        )
        
        local found_binary=""
        for loc in "${possible_locations[@]}"; do
            if [ -f "$loc" ]; then
                found_binary="$loc"
                log "Found Lambda binary at: $found_binary"
                break
            fi
        done
        
        if [ -z "$found_binary" ]; then
            ls -la "${build_dir}/target"/* || true
            ls -la "${build_dir}/target/lambda"/* || true
            error "Could not find built Lambda binary in any expected location"
        else
            # Ensure target directory exists
            mkdir -p "$(dirname "$lambda_binary")" || error "Failed to create target directory"
            
            # Copy to the expected location if different
            if [ "$found_binary" != "$lambda_binary" ]; then
                log "Copying binary from $found_binary to $lambda_binary"
                cp "$found_binary" "$lambda_binary" || error "Failed to copy Lambda binary"
            fi
            
            log "Lambda build completed successfully"
            log "Binary size: $(du -h "$lambda_binary" | cut -f1)"
        fi
    ) || exit 1
    
    # Verify the final binary exists
    if [ ! -f "$lambda_binary" ]; then
        error "Failed to locate built Lambda binary after build"
    fi
}

# Deploy the CloudFormation stack
deploy_stack() {
    log "Starting CloudFormation stack deployment..."
    log "Stack name: $STACK_NAME"
    log "Region: $REGION"
    log "Environment: $ENVIRONMENT"
    log "Artifact bucket: $ARTIFACT_BUCKET"
    
    # Ensure the S3 bucket exists
    ensure_s3_bucket() {
        log "Checking S3 bucket: $ARTIFACT_BUCKET"
        if ! aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" 2>/dev/null; then
            log "Creating S3 bucket: $ARTIFACT_BUCKET"
            local create_bucket_args=(
                --bucket "$ARTIFACT_BUCKET"
                --region "$REGION"
            )
            
            if [ "$REGION" != "us-east-1" ]; then
                create_bucket_args+=(--create-bucket-configuration "LocationConstraint=$REGION")
            fi
            
            aws s3api create-bucket "${create_bucket_args[@]}" || 
                error "Failed to create S3 bucket: $ARTIFACT_BUCKET"
            
            # Enable versioning
            aws s3api put-bucket-versioning \
                --bucket "$ARTIFACT_BUCKET" \
                --versioning-configuration Status=Enabled \
                --region "$REGION" || 
                log "Warning: Failed to enable versioning on bucket: $ARTIFACT_BUCKET"
        fi
    }
    
    # Clean up any existing stack in a failed state
    cleanup_failed_stack() {
        log "Checking for existing stack: $STACK_NAME"
        local stack_status
        
        if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
            log "No existing stack found with name: $STACK_NAME"
            return 0
        fi
        
        stack_status=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$REGION" \
            --query 'Stacks[0].StackStatus' \
            --output text 2>/dev/null || echo "")
        
        log "Current stack status: $stack_status"
        
        # If stack is in a failed state, delete it
        if [[ "$stack_status" == *"ROLLBACK_COMPLETE"* || 
              "$stack_status" == *"ROLLBACK_FAILED"* || 
              "$stack_status" == *"DELETE_FAILED"* ||
              "$stack_status" == *"CREATE_FAILED"* ||
              "$stack_status" == *"UPDATE_FAILED"* ||
              "$stack_status" == *"UPDATE_ROLLBACK_FAILED"* ]]; then
            
            log "Deleting stack in failed state: $STACK_NAME (Status: $stack_status)"
            
            # First, try to delete any retention policies that might prevent deletion
            aws cloudformation update-termination-protection \
                --stack-name "$STACK_NAME" \
                --no-enable-termination-protection \
                --region "$REGION" || true
                
            # Delete the stack
            if ! aws cloudformation delete-stack \
                --stack-name "$STACK_NAME" \
                --region "$REGION"; then
                error "Failed to delete stack: $STACK_NAME"
            fi
            
            # Wait for deletion to complete with a timeout
            local wait_timeout=$((30 * 60))  # 30 minutes
            local wait_interval=10
            local time_elapsed=0
            
            log "Waiting for stack deletion to complete (timeout: $wait_timeout seconds)..."
            
            while [ $time_elapsed -lt $wait_timeout ]; do
                if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
                    log "Stack $STACK_NAME has been successfully deleted"
                    return 0
                fi
                
                sleep $wait_interval
                time_elapsed=$((time_elapsed + wait_interval))
                log "Waiting for stack deletion... (${time_elapsed}s elapsed)"
            done
            
            log "Warning: Stack deletion did not complete within the timeout period"
            return 1
        fi
        
        # If stack is in progress, wait for it to complete
        if [[ "$stack_status" == *"IN_PROGRESS"* ]]; then
            log "Waiting for stack operation to complete: $stack_status"
            aws cloudformation wait stack-$(
                if [[ "$stack_status" == *"CREATE"* ]]; then
                    echo "create-complete"
                elif [[ "$stack_status" == *"UPDATE"* ]]; then
                    echo "update-complete"
                elif [[ "$stack_status" == *"DELETE"* ]]; then
                    echo "delete-complete"
                fi
            ) --stack-name "$STACK_NAME" --region "$REGION" || {
                log "Warning: Stack operation did not complete successfully"
                return 1
            }
        fi
        
        return 0
    }
    
    # Build and deploy with SAM
    build_and_deploy() {
        log "Building SAM application..."
        
        # Clean any previous builds
        rm -rf .aws-sam
        
        if ! sam build; then
            error "SAM build failed"
            return 1
        fi
        
        log "Deploying with SAM..."
        local deploy_args=(
            --stack-name "$STACK_NAME"
            --region "$REGION"
            --s3-bucket "$ARTIFACT_BUCKET"
            --capabilities CAPABILITY_IAM
            --parameter-overrides
                "Environment=${ENVIRONMENT}"
                "RateLimit=${RATE_LIMIT}"
                "BurstLimit=${BURST_LIMIT}"
            --no-fail-on-empty-changeset
            --no-confirm-changeset
            --debug
        )
        
        # Add --force-upload if updating
        if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
            deploy_args+=(--no-fail-on-empty-changeset)
        fi
        
        # Execute deployment with retry logic
        local max_retries=3
        local retry_count=0
        local deploy_success=false
        
        while [ $retry_count -lt $max_retries ]; do
            if sam deploy "${deploy_args[@]}"; then
                deploy_success=true
                break
            fi
            
            retry_count=$((retry_count + 1))
            log "Deployment attempt $retry_count failed. Retrying..."
            
            # Clean up any partial resources
            if [ $retry_count -lt $max_retries ]; then
                log "Cleaning up before retry..."
                aws cloudformation delete-stack \
                    --stack-name "$STACK_NAME" \
                    --region "$REGION" || true
                
                # Wait for cleanup to complete
                sleep 30
            fi
        done
        
        if [ "$deploy_success" = false ]; then
            error "SAM deployment failed after $max_retries attempts"
            return 1
        fi
        
        return 0
    }
    
    # Display stack outputs
    show_outputs() {
        log "Retrieving stack outputs..."
        local outputs
        
        if ! outputs=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$REGION" \
            --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
            --output table 2>&1); then
            log "Warning: Failed to get stack outputs: $outputs"
            return 1
        fi
        
        log "Stack outputs:"
        echo "$outputs"
        return 0
    }
    
    # Main deployment flow
    log "Starting deployment to $ENVIRONMENT environment..."
    local start_time
    start_time=$(date +%s)
    
    # Ensure S3 bucket exists
    if ! ensure_s3_bucket; then
        error "Failed to ensure S3 bucket exists"
        return 1
    fi
    
    # Clean up any failed stacks
    if ! cleanup_failed_stack; then
        error "Failed to clean up existing stack"
        return 1
    fi
    
    # Build and deploy
    if ! build_and_deploy; then
        error "Deployment failed"
        
        # Try to get more detailed error information
        local events
        if events=$(aws cloudformation describe-stack-events \
            --stack-name "$STACK_NAME" \
            --region "$REGION" \
            --query 'sort_by(StackEvents, &Timestamp)[].{ResourceStatus:ResourceStatus, ResourceType:ResourceType, StatusReason:ResourceStatusReason}' \
            --output json 2>/dev/null); then
            
            log "Stack events that might indicate the cause of failure:"
            echo "$events" | jq -r '.[] | "\(.ResourceType) - \(.ResourceStatus): \(.StatusReason)"'
        fi
        
        return 1
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "Deployment completed successfully in ${duration} seconds"
    
    # Show outputs
    if ! show_outputs; then
        log "Warning: Failed to retrieve stack outputs"
    fi
    
    # Additional verification
    log "Verifying stack resources..."
    if ! aws cloudformation describe-stack-resources \
        --stack-name "$STACK_NAME" \
        --region "$REGION" &>/dev/null; then
        log "Warning: Failed to verify stack resources"
    fi
    
    return 0
}

# Main function
main() {
    log "Starting deployment to $ENVIRONMENT environment"
    
    # Build the Lambda function
    build_lambda
    
    # Deploy the stack
    deploy_stack
    
    log "Deployment completed successfully!"
}

# Execute main function
main "$@"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Invalid environment. Must be one of: dev, staging, prod"
  exit 1
fi

echo "Building Lambda function..."
cd "${SERVICES_DIR}"

# Print debug info
echo "Current directory: $(pwd)"
echo "Project root: ${PROJECT_ROOT}"
echo "Build target directory: ${PROJECT_ROOT}/target"

# Clean previous build to ensure we're building fresh
echo "Cleaning previous build..."
cargo clean

# Build the bootstrap binary in release mode with verbose output
echo "Building binary..."
RUST_BACKTRACE=1 cargo build --release --bin bootstrap --verbose

# Debug: List target directory
echo "Build complete. Listing target directory:"
find "${PROJECT_ROOT}/target" -type f -name "bootstrap" -o -name "bootstrap.*"

# Create output directory for the Lambda package
mkdir -p "${PROJECT_ROOT}/target/lambda"

# Find the built binary - try multiple possible locations
BINARY_PATHS=(
    "${SERVICES_DIR}/target/release/bootstrap"
    "${SERVICES_DIR}/target/x86_64-unknown-linux-musl/release/bootstrap"
    "${SERVICES_DIR}/target/aarch64-unknown-linux-gnu/release/bootstrap"
    "${PROJECT_ROOT}/target/release/bootstrap"
    "${PROJECT_ROOT}/target/x86_64-unknown-linux-musl/release/bootstrap"
    "${PROJECT_ROOT}/target/aarch64-unknown-linux-gnu/release/bootstrap"
)

BINARY_PATH=""
for path in "${BINARY_PATHS[@]}"; do
    if [ -f "$path" ]; then
        BINARY_PATH="$path"
        echo "Found binary at: $BINARY_PATH"
        break
    fi
done

if [ -z "$BINARY_PATH" ]; then
    echo "Error: Could not find the built binary in any expected location"
    echo "Searched in:"
    for path in "${BINARY_PATHS[@]}"; do
        echo "  - $path"
    done
    exit 1
fi

echo "Found binary at: ${BINARY_PATH}"

# Copy the binary to the Lambda bootstrap location
mkdir -p "${PROJECT_ROOT}/target/lambda"
cp "${BINARY_PATH}" "${PROJECT_ROOT}/target/lambda/"

# Package for Lambda deployment
echo "Packaging Lambda function..."
cd "${PROJECT_ROOT}/target/lambda"
chmod +x bootstrap
zip -r "${PROJECT_ROOT}/target/lambda.zip" .

echo "Deploying infrastructure..."
cd "${INFRA_DIR}"

# Build and deploy with SAM
echo "Building SAM application..."
sam build --template-file template.yaml

# Check if S3 bucket exists, create if it doesn't
echo "Checking S3 bucket ${S3_BUCKET}..."
if ! aws s3api head-bucket --bucket "${S3_BUCKET}" --region "${REGION}" 2>/dev/null; then
    echo "Creating S3 bucket ${S3_BUCKET}..."
    if [ "${REGION}" = "us-east-1" ]; then
        aws s3api create-bucket --bucket "${S3_BUCKET}" --region "${REGION}"
    else
        aws s3api create-bucket \
            --bucket "${S3_BUCKET}" \
            --region "${REGION}" \
            --create-bucket-configuration LocationConstraint="${REGION}"
    fi
    
    # Wait for bucket to be created
    aws s3api wait bucket-exists --bucket "${S3_BUCKET}" --region "${REGION}"
fi

# Package and deploy
echo "Packaging and deploying SAM application..."
sam package \
    --template-file .aws-sam/build/template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket "${S3_BUCKET}" \
    --region "${REGION}" || {
        echo "Failed to package SAM application"
        exit 1
    }

echo "Deploying CloudFormation stack..."
sam deploy \
    --template-file packaged.yaml \
    --stack-name "ecoscan-${ENVIRONMENT}" \
    --capabilities CAPABILITY_IAM \
    --region "${REGION}" \
    --parameter-overrides \
        "Environment=${ENVIRONMENT}" \
        "RateLimit=${RATE_LIMIT}" \
        "BurstLimit=${BURST_LIMIT}" \
    --no-fail-on-empty-changeset || {
        echo "Failed to deploy CloudFormation stack"
        exit 1
    }

echo "Deployment completed successfully!"