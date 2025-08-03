# EcoScan Development Tasks

.PHONY: help build test deploy clean local-up local-down

help: ## Show this help message
	@echo "EcoScan Development Tasks:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
build: build-lambda-aws ## Build Lambda function for AWS/LocalStack (default)

build-lambda-aws: ## Build Lambda for AWS/LocalStack (Linux binary)
	@echo "🔨 Building Lambda function for AWS (x86_64-unknown-linux-musl)..."
	./scripts/build-lambda.sh aws

build-lambda-local: ## Build Lambda for local macOS execution
	@echo "🔨 Building Lambda function for local macOS..."
	./scripts/build-lambda.sh local

test: ## Run all tests
	@echo "🧪 Running tests..."
	cd services/bin-status-reporter && cargo test --lib

test-watch: ## Run tests in watch mode
	@echo "👀 Watching tests..."
	cd services/bin-status-reporter && cargo watch -x "test --lib"

lint: ## Run linting and formatting
	@echo "🔍 Linting code..."
	cd services/bin-status-reporter && cargo clippy -- -D warnings
	cd services/bin-status-reporter && cargo fmt --check

fix: ## Auto-fix linting and formatting issues
	@echo "🔧 Auto-fixing code..."
	cd services/bin-status-reporter && cargo clippy --fix --allow-dirty --allow-staged
	cd services/bin-status-reporter && cargo fmt

# Local Development
reset-local: ## Stop and remove all local containers, volumes, and networks
	@echo "🔥 Resetting LocalStack environment..."
	AWS_ENDPOINT_URL=http://localhost:4566 aws --profile localstack cloudformation delete-stack --stack-name dev-ecoscan-backend || true
	@echo "⏳ Waiting for stack to delete..."
	AWS_ENDPOINT_URL=http://localhost:4566 aws --profile localstack cloudformation wait stack-delete-complete --stack-name dev-ecoscan-backend || true
	docker-compose down --volumes
	rm -rf ./volume

local-up: ## Start LocalStack development environment
	@echo "🚀 Starting LocalStack..."
	docker-compose up -d
	@echo "⏳ Waiting for LocalStack to be ready..."
	sleep 10 # Wait for services to initialize
	./scripts/init-localstack.sh

local-down: ## Stop LocalStack development environment
	@echo "🛑 Stopping LocalStack..."
	docker-compose down

local-logs: ## Show LocalStack logs
	docker-compose logs -f localstack

# Deployment
deploy-local: build ## Build, upload, and deploy the full stack to LocalStack. Run 'make seed-db' after.
	@echo "📦 Uploading Lambda artifact to S3..."
	AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_ENDPOINT_URL=http://localhost:4566 aws --profile localstack s3 cp \
	  services/target/lambda.zip s3://local-lambda-deployments/lambda.zip

	@echo "🏗️  Deploying infrastructure to LocalStack..."
	AWS_ENDPOINT_URL=http://localhost:4566 aws --profile localstack cloudformation deploy \
	  --template-file infrastructure/backend/template.yaml \
	  --stack-name dev-ecoscan-backend \
	  --capabilities CAPABILITY_IAM \
	  --parameter-overrides \
	    Environment=dev \
	    LambdaS3Bucket=local-lambda-deployments \
	    LambdaS3Key=lambda.zip

seed-db: ## Seed the local database with default data
	@echo "🌱 Seeding database..."
	./scripts/seed-data.sh

test-lambda: deploy-local ## Test Lambda function end-to-end
	@echo "🧪 Testing Lambda function..."
	aws --profile localstack --endpoint-url=http://localhost:4566 lambda invoke \
		--function-name update-bin-status \
		--payload file://services/bin-status-reporter/test-events/update-status-50-percent.json \
		--cli-binary-format raw-in-base64-out output.json
	@echo "📋 Test result:"
	@cat output.json

# AWS Deployment
package: build ## Package the Lambda function for AWS deployment
	@echo "📦 Packaging Lambda function for AWS..."
	@cd services/bin-status-reporter && \
	  mkdir -p target/package && \
	  cp target/lambda.zip target/package/

	@if [ ! -f .env ]; then \
		echo "Error: .env file not found in project root"; \
		exit 1; \
	fi
	@set -o allexport; source .env; set +o allexport; \
	cd services/bin-status-reporter && \
	  AWS_ACCESS_KEY_ID=$$AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$$AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN=$$AWS_SESSION_TOKEN \
	  aws cloudformation package \
	    --template-file template.yaml \
	    --output-template-file packaged.yaml \
	    --s3-bucket dev-ecoscan-lambda-deployments
	@echo "✅ Lambda packaging complete."

deploy-aws: package ## Deploy to AWS using credentials from .env
	@echo "🚀 Deploying backend infrastructure stack to AWS..."
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found in project root"; \
		exit 1; \
	fi
	@set -o allexport; source .env; set +o allexport; \
	AWS_ACCESS_KEY_ID=$$AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$$AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN=$$AWS_SESSION_TOKEN \
	aws cloudformation deploy \
	  --template-file infrastructure/backend/template.yaml \
	  --stack-name dev-ecoscan-backend \
	  --capabilities CAPABILITY_IAM \
	  --parameter-overrides Environment=dev \
	  --region $$AWS_REGION
	@echo "✅ Backend infrastructure deployment complete!"
deploy-bin-status-reporter: ## Deploy bin-status-reporter stack to AWS using canonical naming and .env credentials
	@echo "🚀 Deploying dev-ecoscan-bin-status-reporter stack..."
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found in project root"; \
		exit 1; \
	fi
	@set -o allexport; source .env; set +o allexport; \
	cd services/bin-status-reporter && \
	  AWS_ACCESS_KEY_ID=$$AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$$AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN=$$AWS_SESSION_TOKEN \
	  aws cloudformation deploy \
	    --template-file packaged.yaml \
	    --stack-name dev-ecoscan-bin-status-reporter \
	    --capabilities CAPABILITY_IAM \
	    --region $$AWS_REGION
	@echo "✅ Deployment complete!"

# Cleanup
clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	cd services/bin-status-reporter && cargo clean
	rm -rf services/bin-status-reporter/target/lambda.zip
	rm -f output*.json

# Documentation
docs: ## Generate and serve documentation
	@echo "📚 Generating documentation..."
	cd services/bin-status-reporter && cargo doc --open

# CI/CD helpers
ci-test: lint test ## Run CI tests locally
	@echo "✅ All CI checks passed!"

install-tools: ## Install development tools
	@echo "🛠️ Installing development tools..."
	cargo install cargo-watch
	cargo install cargo-audit
