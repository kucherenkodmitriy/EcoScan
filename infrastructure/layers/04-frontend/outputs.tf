# S3 bucket outputs
output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend files"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket for frontend files"
  value       = aws_s3_bucket.frontend.arn
}

# CloudFront outputs
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.use_localstack ? null : aws_cloudfront_distribution.frontend[0].id
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = var.use_localstack ? null : aws_cloudfront_distribution.frontend[0].arn
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.use_localstack ? null : aws_cloudfront_distribution.frontend[0].domain_name
}

output "frontend_url" {
  description = "URL to access the frontend"
  value = var.use_localstack ? "http://localhost:3000" : (
    var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${aws_cloudfront_distribution.frontend[0].domain_name}"
  )
}

# API URL (for reference)
output "api_url" {
  description = "URL for API calls (via CloudFront)"
  value = var.use_localstack ? "http://localhost:3000/api" : (
    var.custom_domain != "" ? "https://${var.custom_domain}/api" : "https://${aws_cloudfront_distribution.frontend[0].domain_name}/api"
  )
}
