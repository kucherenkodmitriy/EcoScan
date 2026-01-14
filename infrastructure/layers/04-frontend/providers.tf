provider "aws" {
  region = var.aws_region

  # LocalStack configuration
  dynamic "endpoints" {
    for_each = var.use_localstack ? [1] : []
    content {
      s3         = var.localstack_endpoint
      cloudfront = var.localstack_endpoint
      sts        = var.localstack_endpoint
    }
  }

  # Skip validation for LocalStack
  skip_credentials_validation = var.use_localstack
  skip_metadata_api_check     = var.use_localstack
  skip_requesting_account_id  = var.use_localstack

  # Use path-style for LocalStack S3
  s3_use_path_style = var.use_localstack

  # Default tags for all resources
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront requires ACM certificates in us-east-1
# Only needed when using custom domain
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  dynamic "endpoints" {
    for_each = var.use_localstack ? [1] : []
    content {
      acm = var.localstack_endpoint
    }
  }

  skip_credentials_validation = var.use_localstack
  skip_metadata_api_check     = var.use_localstack
  skip_requesting_account_id  = var.use_localstack
}
