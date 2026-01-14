variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "ecoscan"
}

variable "environment" {
  description = "Environment (local, dev, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "use_localstack" {
  description = "Whether to use LocalStack for local development"
  type        = bool
  default     = false
}

variable "localstack_endpoint" {
  description = "LocalStack endpoint URL"
  type        = string
  default     = "http://localhost:4566"
}

# Custom domain configuration (optional - for future use)
variable "custom_domain" {
  description = "Custom domain for CloudFront (e.g., app.ecoscan.com). Leave empty to use CloudFront default domain."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for custom domain. Required if custom_domain is set."
  type        = string
  default     = ""
}

# Cache settings
variable "default_ttl" {
  description = "Default TTL for cached objects (seconds)"
  type        = number
  default     = 86400 # 1 day
}

variable "max_ttl" {
  description = "Maximum TTL for cached objects (seconds)"
  type        = number
  default     = 31536000 # 1 year
}
