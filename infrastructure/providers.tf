# Configure the AWS Provider
provider "aws" {
  region = var.aws_region

  # The following settings are required for LocalStack
  # They will be used only when var.environment is "local"
  access_key                  = "test"
  secret_key                  = "test"
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    apigateway     = var.environment == "local" ? "http://localhost:4566" : null
    dynamodb       = var.environment == "local" ? "http://localhost:4566" : null
    iam            = var.environment == "local" ? "http://localhost:4566" : null
    lambda         = var.environment == "local" ? "http://localhost:4566" : null
    s3             = var.environment == "local" ? "http://localhost:4566" : null
    sts            = var.environment == "local" ? "http://localhost:4566" : null
  }
}
