# AWS Dev environment configuration
environment  = "dev"
aws_region   = "eu-central-1"
project_name = "ecoscan"

# AWS-specific settings
use_localstack      = false
localstack_endpoint = ""

# DynamoDB settings (PAY_PER_REQUEST for production-like environments)
dynamodb_billing_mode   = "PAY_PER_REQUEST"
dynamodb_read_capacity  = null
dynamodb_write_capacity = null

# Lambda settings
lambda_memory_size  = 256
lambda_timeout      = 60
lambda_architecture = "x86_64"
lambda_zip_path     = "../../../services/target/lambda.zip"

# S3 bucket settings (AWS requires unique global names)
health_bucket_name             = "ecoscan-dev-health-bucket"
lambda_deployments_bucket_name = "ecoscan-dev-lambda-deployments"

# Lambda SQS configuration
lambda_sqs_batch_size  = 10  # Process up to 10 messages per invocation
lambda_max_concurrency = 100 # Allow higher concurrency in AWS

# CORS configuration
# Set this to your CloudFront domain after deployment, e.g., "https://d1234abcd.cloudfront.net"
# Use "*" for development/testing (less secure)
# cors_allowed_origins = "https://your-cloudfront-domain.cloudfront.net"

# reCAPTCHA settings
# Set skip_recaptcha=true for e2e tests, false for production-like environments
# recaptcha_secret_key should be set via TF_VAR_recaptcha_secret_key or -var flag
skip_recaptcha       = false
recaptcha_secret_key = "" # Set via TF_VAR_recaptcha_secret_key

# WAF settings
waf_rate_limit = 100 # 100 requests per 5 minutes per IP

# API Gateway throttling (MVP: strict limits)
api_rate_limit  = 2 # 2 requests per second
api_burst_limit = 5 # Max 5 concurrent requests

# Tags
tags = {
  Environment = "dev"
  ManagedBy   = "terraform"
  Project     = "ecoscan"
  CostCenter  = "engineering"
}
