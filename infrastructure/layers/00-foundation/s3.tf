resource "aws_s3_bucket" "health" {
  bucket = var.health_bucket_name

  # Allow bucket destruction for local environment
  force_destroy = var.environment == "local"

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-health"
      Purpose = "Health checks and monitoring"
    }
  )
}

resource "aws_s3_bucket" "lambda_deployments" {
  bucket = var.lambda_deployments_bucket_name

  # Allow bucket destruction for local environment
  force_destroy = var.environment == "local"

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-lambda-deployments"
      Purpose = "Lambda deployment packages"
    }
  )
}

# Enable versioning for production environments
resource "aws_s3_bucket_versioning" "lambda_deployments" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.lambda_deployments.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption for non-local environments
resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_deployments" {
  count  = var.use_localstack ? 0 : 1
  bucket = aws_s3_bucket.lambda_deployments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
