# AWS Dev environment configuration
environment    = "dev"
aws_region     = "eu-central-1"
project_name   = "ecoscan"

# AWS-specific settings
use_localstack      = false
localstack_endpoint = ""

# DynamoDB settings (PAY_PER_REQUEST for production-like environments)
dynamodb_billing_mode  = "PAY_PER_REQUEST"
dynamodb_read_capacity  = null
dynamodb_write_capacity = null

# Lambda settings
lambda_memory_size  = 256
lambda_timeout      = 60
lambda_architecture = "arm64"
lambda_zip_path     = "../../../services/target/lambda.zip"

# S3 bucket settings (AWS requires unique global names)
health_bucket_name             = "ecoscan-dev-health-bucket"
lambda_deployments_bucket_name = "ecoscan-dev-lambda-deployments"

# Lambda SQS configuration
lambda_sqs_batch_size  = 10  # Process up to 10 messages per invocation
lambda_max_concurrency = 100 # Allow higher concurrency in AWS

# Tags
tags = {
  Environment = "dev"
  ManagedBy   = "terraform"
  Project     = "ecoscan"
  CostCenter  = "engineering"
}
