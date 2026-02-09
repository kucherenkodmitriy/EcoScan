variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "environment" {
  description = "Environment name (local, dev, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "use_localstack" {
  description = "Whether to use LocalStack endpoints"
  type        = bool
  default     = false
}

variable "localstack_endpoint" {
  description = "LocalStack endpoint URL"
  type        = string
  default     = ""
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda function in MB"
  type        = number
  default     = 128
}

variable "lambda_timeout" {
  description = "Timeout for Lambda function in seconds"
  type        = number
  default     = 30
}

variable "lambda_architecture" {
  description = "Lambda architecture (x86_64 or arm64)"
  type        = string
  default     = "x86_64"
}

variable "lambda_zip_path" {
  description = "Path to Lambda deployment package (bin-status-reporter)"
  type        = string
  default     = "../../../services/target/lambda.zip"
}

variable "authorizer_zip_path" {
  description = "Path to Lambda authorizer deployment package"
  type        = string
  default     = "../../../services/target/authorizer.zip"
}

variable "admin_dashboard_zip_path" {
  description = "Path to Admin Dashboard API deployment package"
  type        = string
  default     = "../../../services/target/admin-dashboard.zip"
}

variable "contact_form_zip_path" {
  description = "Path to Contact Form Handler deployment package"
  type        = string
  default     = "../../../services/target/contact-form-handler.zip"
}

variable "webhook_sender_zip_path" {
  description = "Path to Webhook Sender deployment package"
  type        = string
  default     = "../../../services/target/webhook-sender.zip"
}

variable "apikey_authorizer_zip_path" {
  description = "Path to API Key Authorizer deployment package"
  type        = string
  default     = "../../../services/target/apikey-authorizer.zip"
}

variable "recaptcha_secret_key" {
  description = "Google reCAPTCHA v3 secret key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "skip_recaptcha" {
  description = "Skip reCAPTCHA validation (for e2e tests only)"
  type        = bool
  default     = false
}

variable "notify_email" {
  description = "Email address to receive contact form notifications"
  type        = string
  default     = ""
}

variable "from_email" {
  description = "Email address to send notifications from (must be verified in SES)"
  type        = string
  default     = ""
}

variable "jwt_secret" {
  description = "Secret key for JWT token signing"
  type        = string
  default     = "ecoscan-jwt-secret-change-in-production"
  sensitive   = true
}

variable "jwt_expiry_hours" {
  description = "JWT token expiry time in hours"
  type        = number
  default     = 24
}

variable "cors_allowed_origins" {
  description = "Allowed CORS origins (e.g., https://your-cloudfront-domain.cloudfront.net). Use * for development."
  type        = string
  default     = "*"
}

variable "frontend_url" {
  description = "Frontend URL for building password reset links"
  type        = string
  default     = "http://localhost:3000"
}

variable "lambda_sqs_batch_size" {
  description = "Maximum number of SQS messages to process in a single Lambda invocation"
  type        = number
  default     = 10
}

variable "lambda_max_concurrency" {
  description = "Maximum number of concurrent Lambda executions for SQS"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
