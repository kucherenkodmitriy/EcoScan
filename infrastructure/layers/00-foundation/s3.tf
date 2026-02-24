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

# Block public access for health bucket
resource "aws_s3_bucket_public_access_block" "health" {
  bucket                  = aws_s3_bucket.health.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Block public access for lambda deployments bucket
resource "aws_s3_bucket_public_access_block" "lambda_deployments" {
  bucket                  = aws_s3_bucket.lambda_deployments.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for non-local environments
resource "aws_s3_bucket_versioning" "lambda_deployments" {
  count  = var.use_localstack ? 0 : 1
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
