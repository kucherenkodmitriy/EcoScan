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

# Import outputs from compute layer (for Lambda authorizer and admin dashboard API)
# Note: This creates a dependency - compute layer must be deployed before API layer
# can reference the Lambda ARNs. The deployment script handles this.
data "terraform_remote_state" "compute" {
  backend = var.use_localstack ? "local" : "s3"

  config = var.use_localstack ? {
    path = "../02-compute/terraform-local.tfstate"
    } : {
    bucket = "ecoscan-terraform-state-${var.environment}"
    key    = "layers/02-compute/terraform.tfstate"
    region = var.aws_region
  }
}
