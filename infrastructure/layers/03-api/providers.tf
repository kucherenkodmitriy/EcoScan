provider "aws" {
  region = var.aws_region

  # Conditional LocalStack configuration
  dynamic "endpoints" {
    for_each = var.use_localstack ? [1] : []
    content {
      apigateway = var.localstack_endpoint
      dynamodb   = var.localstack_endpoint
      iam        = var.localstack_endpoint
      lambda     = var.localstack_endpoint
      s3         = var.localstack_endpoint
      sns        = var.localstack_endpoint
      sqs        = var.localstack_endpoint
      sts        = var.localstack_endpoint
      cloudwatch = var.localstack_endpoint
      logs       = var.localstack_endpoint
    }
  }

  # LocalStack requires fake credentials
  access_key = var.use_localstack ? "test" : null
  secret_key = var.use_localstack ? "test" : null

  # LocalStack-specific flags
  s3_use_path_style           = var.use_localstack
  skip_credentials_validation = var.use_localstack
  skip_metadata_api_check     = var.use_localstack
  skip_requesting_account_id  = var.use_localstack
}
