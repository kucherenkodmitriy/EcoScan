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
  description = "Path to Lambda deployment package"
  type        = string
  default     = "../../../services/target/lambda.zip"
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
