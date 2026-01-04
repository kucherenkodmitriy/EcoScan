output "health_bucket_name" {
  description = "Name of the health check S3 bucket"
  value       = aws_s3_bucket.health.id
}

output "health_bucket_arn" {
  description = "ARN of the health check S3 bucket"
  value       = aws_s3_bucket.health.arn
}

output "lambda_deployments_bucket_name" {
  description = "Name of the Lambda deployments S3 bucket"
  value       = aws_s3_bucket.lambda_deployments.id
}

output "lambda_deployments_bucket_arn" {
  description = "ARN of the Lambda deployments S3 bucket"
  value       = aws_s3_bucket.lambda_deployments.arn
}

output "environment" {
  description = "Current environment"
  value       = var.environment
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}
