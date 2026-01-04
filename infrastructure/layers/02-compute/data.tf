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

# Import outputs from data layer
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

# Import outputs from api layer (for SQS queue info)
data "terraform_remote_state" "api" {
  backend = var.use_localstack ? "local" : "s3"

  config = var.use_localstack ? {
    path = "../03-api/terraform-local.tfstate"
  } : {
    bucket = "ecoscan-terraform-state-${var.environment}"
    key    = "layers/03-api/terraform.tfstate"
    region = var.aws_region
  }
}
