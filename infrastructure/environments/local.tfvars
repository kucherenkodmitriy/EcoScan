# LocalStack environment configuration
environment  = "local"
aws_region   = "eu-central-1"
project_name = "ecoscan"

# LocalStack-specific settings
use_localstack      = true
localstack_endpoint = "http://localhost:4566"

# DynamoDB settings
dynamodb_billing_mode   = "PROVISIONED"
dynamodb_read_capacity  = 5
dynamodb_write_capacity = 5

# Lambda settings
lambda_memory_size      = 128
lambda_timeout          = 30
lambda_architecture     = "x86_64"
lambda_zip_path         = "../../../services/target/lambda.zip"
webhook_sender_zip_path = "../../../services/target/webhook-sender.zip"

# S3 bucket settings (LocalStack uses simple names)
health_bucket_name             = "health"
lambda_deployments_bucket_name = "lambda-deployments"

# Lambda SQS configuration
lambda_sqs_batch_size  = 10 # Process up to 10 messages per invocation
lambda_max_concurrency = 5  # Max 5 concurrent executions for local testing

# Frontend URL for password reset links
frontend_url = "http://localhost:3000"

# reCAPTCHA settings (skip for local testing)
skip_recaptcha       = true
recaptcha_secret_key = ""

# WAF settings (higher limit for local testing)
waf_rate_limit = 1000

# API Gateway throttling (relaxed for local testing)
api_rate_limit  = 100
api_burst_limit = 50

# Tags
tags = {
  Environment = "local"
  ManagedBy   = "terraform"
  Project     = "ecoscan"
}
