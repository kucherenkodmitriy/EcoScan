terraform {
  backend "s3" {
    # Backend configuration is provided via -backend-config flags in CI/CD
    # or via override.tf for local development
  }
}
