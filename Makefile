# EcoScan Development Tasks

.PHONY: help build test deploy clean local-up local-down

help: ## Show this help message
	@echo "EcoScan Development Tasks:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
build: ## Build Lambda function for deployment
	@echo "🔨 Building Lambda function..."
	./scripts/build-lambda.sh

test: ## Run all tests
	@echo "🧪 Running tests..."
	cd lambda && cargo test --lib

test-watch: ## Run tests in watch mode
	@echo "👀 Watching tests..."
	cd lambda && cargo watch -x "test --lib"

lint: ## Run linting and formatting
	@echo "🔍 Linting code..."
	cd lambda && cargo clippy -- -D warnings
	cd lambda && cargo fmt --check

fix: ## Auto-fix linting and formatting issues
	@echo "🔧 Auto-fixing code..."
	cd lambda && cargo clippy --fix --allow-dirty --allow-staged
	cd lambda && cargo fmt

# Local Development
local-up: ## Start LocalStack development environment
	@echo "🚀 Starting LocalStack..."
	docker-compose up -d
	@echo "⏳ Waiting for LocalStack to be ready..."
	sleep 10
	./scripts/init-localstack.sh

local-down: ## Stop LocalStack development environment
	@echo "🛑 Stopping LocalStack..."
	docker-compose down

local-logs: ## Show LocalStack logs
	docker-compose logs -f localstack

# Deployment
deploy-local: build ## Deploy to LocalStack
	@echo "📦 Deploying to LocalStack..."
	aws --profile localstack --endpoint-url=http://localhost:4566 lambda update-function-code \
		--function-name update-bin-status \
		--zip-file fileb://lambda/target/lambda.zip

test-lambda: deploy-local ## Test Lambda function end-to-end
	@echo "🧪 Testing Lambda function..."
	aws --profile localstack --endpoint-url=http://localhost:4566 lambda invoke \
		--function-name update-bin-status \
		--payload file://lambda/test-events/update-status-50-percent.json \
		--cli-binary-format raw-in-base64-out output.json
	@echo "📋 Test result:"
	@cat output.json

# Cleanup
clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	cd lambda && cargo clean
	rm -rf lambda/target/lambda.zip
	rm -f output*.json

# Documentation
docs: ## Generate and serve documentation
	@echo "📚 Generating documentation..."
	cd lambda && cargo doc --open

# CI/CD helpers
ci-test: lint test ## Run CI tests locally
	@echo "✅ All CI checks passed!"

install-tools: ## Install development tools
	@echo "🛠️ Installing development tools..."
	cargo install cargo-watch
	cargo install cargo-audit
