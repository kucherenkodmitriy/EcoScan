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

test: ## Run unit and e2e tests
	@echo "🧪 Running unit tests..."
	cd services/bin-status-reporter && cargo test --lib
	@make test-e2e

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
reset-local: ## Destroy local infrastructure and stop all containers
	@echo "🔥 Destroying LocalStack infrastructure..."
	cd infrastructure && terraform destroy -auto-approve -var-file=local.tfvars
	@echo "🛑 Stopping Docker containers..."
	docker-compose down --volumes
	rm -rf ./volume

local-up: ## Start LocalStack development environment
	@echo "🚀 Starting LocalStack..."
	docker-compose up -d
	@echo "⏳ Waiting for LocalStack to be ready..."
	sleep 10 # Wait for services to initialize
	./scripts/init-terraform.sh

local-down: ## Stop LocalStack development environment
	@echo "🛑 Stopping LocalStack..."
	docker-compose down

local-logs: ## Show LocalStack logs
	docker-compose logs -f localstack

test-e2e: ## Run end-to-end tests against a running local environment
	@echo "🔬 Running end-to-end tests..."
	./scripts/run-e2e-tests.sh

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
