# Import outputs from foundation layer via remote state
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
