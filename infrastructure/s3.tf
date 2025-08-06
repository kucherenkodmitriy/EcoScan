resource "aws_s3_bucket" "health" {
  bucket = "health"

  # For localstack, we might need to force destroy
  force_destroy = var.environment == "local"
}

resource "aws_s3_bucket" "lambda_deployments" {
  bucket = "local-lambda-deployments"

  # For localstack, we might need to force destroy
  force_destroy = var.environment == "local"
}
