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
lambda_memory_size  = 128
lambda_timeout      = 30
lambda_architecture = "arm64"
lambda_zip_path     = "../../../services/target/lambda.zip"

# S3 bucket settings (LocalStack uses simple names)
health_bucket_name             = "health"
lambda_deployments_bucket_name = "lambda-deployments"

# Lambda SQS configuration
lambda_sqs_batch_size  = 10 # Process up to 10 messages per invocation
lambda_max_concurrency = 5  # Max 5 concurrent executions for local testing

# Tags
tags = {
  Environment = "local"
  ManagedBy   = "terraform"
  Project     = "ecoscan"
}
