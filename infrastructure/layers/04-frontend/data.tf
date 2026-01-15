# Remote state from API layer to get API Gateway URL
data "terraform_remote_state" "api" {
  backend = var.use_localstack ? "local" : "s3"

  config = var.use_localstack ? {
    path = "${path.module}/../03-api/terraform.tfstate"
    } : {
    bucket = "${var.project_name}-terraform-state-${var.environment}"
    key    = "layers/03-api/terraform.tfstate"
    region = var.aws_region
  }
}
