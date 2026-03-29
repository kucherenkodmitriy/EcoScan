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

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

# API Gateway throttling settings
variable "api_rate_limit" {
  description = "API Gateway rate limit (requests per second)"
  type        = number
  default     = 2
}

variable "api_burst_limit" {
  description = "API Gateway burst limit (max concurrent requests)"
  type        = number
  default     = 5
}

variable "cors_allowed_origins" {
  description = "Allowed CORS origins for MOCK integration responses. Use * only for local development."
  type        = string
}

variable "waf_rate_limit" {
  description = "WAF rate limit (requests per 5-minute window per IP)"
  type        = number
  default     = 100
}