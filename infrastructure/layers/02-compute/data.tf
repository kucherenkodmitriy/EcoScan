# Import outputs from foundation layer
data "terraform_remote_state" "foundation" {
  backend = var.use_localstack ? "local" : "s3"

  config = var.use_localstack ? {
    path = "../00-foundation/terraform-local.tfstate"
    } : {
    bucket = "ecoscan-terraform-state-${var.environment}"
    key    = "layers/00-foundation/terraform.tfstate"
    region = var.aws_region
  }
}

# Import outputs from data layer (includes DynamoDB, Secrets Manager, and SQS)
data "terraform_remote_state" "data" {
  backend = var.use_localstack ? "local" : "s3"

  config = var.use_localstack ? {
    path = "../01-data/terraform-local.tfstate"
    } : {
    bucket = "ecoscan-terraform-state-${var.environment}"
    key    = "layers/01-data/terraform.tfstate"
    region = var.aws_region
  }
}

# Note: SQS is now in data layer, no need to import from api layer
