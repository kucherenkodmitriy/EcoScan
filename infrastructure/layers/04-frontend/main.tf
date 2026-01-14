terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Layer       = "04-frontend"
  }

  # S3 bucket name must be globally unique
  frontend_bucket_name = "${var.environment}-${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"

  # API Gateway URL from layer 03
  api_gateway_url = data.terraform_remote_state.api.outputs.api_gateway_invoke_url
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
