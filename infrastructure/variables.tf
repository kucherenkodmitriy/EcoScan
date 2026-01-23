variable "aws_region" {
  description = "The AWS region to create resources in."
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "The deployment environment (e.g., dev, staging, prod, local)."
  type        = string
  default     = "local"
}

variable "project_name" {
  description = "The name of the project."
  type        = string
  default     = "ecoscan"
}

variable "recaptcha_secret_key" {
  description = "Google reCAPTCHA v3 secret key for server-side validation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "skip_recaptcha" {
  description = "Skip reCAPTCHA validation (for e2e tests only)"
  type        = bool
  default     = false
}

variable "waf_rate_limit" {
  description = "WAF rate limit: max requests per 5 minutes per IP"
  type        = number
  default     = 100 # Production default, set lower for strict environments
}

