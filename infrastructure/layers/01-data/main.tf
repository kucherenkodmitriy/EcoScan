terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Temporary resource to force state update for missing outputs
resource "null_resource" "force_state_update" {
  triggers = {
    always_run = timestamp()
  }
}
