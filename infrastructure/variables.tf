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
