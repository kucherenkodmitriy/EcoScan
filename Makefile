# EcoScan Development Tasks

.PHONY: help build test deploy clean local-up local-down frontend-dev frontend-build frontend-install frontend-lint

help: ## Show this help message
	@echo "EcoScan Development Tasks:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
build: ## Build Lambda function for deployment
	@echo "🔨 Building Lambda function..."
	./scripts/build-lambda.sh

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

# Frontend Development
frontend-dev: ## Start frontend development server
	@echo "🌐 Starting frontend development server..."
	cd infrastructure/frontend && pnpm run dev

frontend-build: ## Build frontend for production
	@echo "🏗️ Building frontend for production..."
	cd infrastructure/frontend && pnpm run build

frontend-install: ## Install frontend dependencies
	@echo "📦 Installing frontend dependencies..."
	cd infrastructure/frontend && pnpm install

frontend-lint: ## Lint frontend code
	@echo "🔍 Linting frontend code..."
	cd infrastructure/frontend && pnpm run lint

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

# Full Stack Development
dev-full: local-up frontend-dev ## Start full development environment (backend + frontend)

# Deployment
deploy-local: build ## Deploy to LocalStack
	@echo "📦 Deploying to LocalStack..."
	aws --profile localstack --endpoint-url=http://localhost:4566 lambda update-function-code \
		--function-name update-bin-status \
		--zip-file fileb://services/bin-status-reporter/target/lambda.zip

test-lambda: deploy-local ## Test Lambda function end-to-end
	@echo "🧪 Testing Lambda function..."
	aws --profile localstack --endpoint-url=http://localhost:4566 lambda invoke \
		--function-name update-bin-status \
		--payload file://services/bin-status-reporter/test-events/update-status-50-percent.json \
		--cli-binary-format raw-in-base64-out output.json
	@echo "📋 Test result:"
	@cat output.json

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
