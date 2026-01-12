# =============================================================================
# AWS Secrets Manager - JWT Secret
# =============================================================================

# Generate a random secret value for JWT signing
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Create the Secrets Manager secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.environment}-${var.project_name}-jwt-secret"
  description = "JWT signing secret for EcoScan admin authentication"

  # For local development, we don't need recovery window
  recovery_window_in_days = var.use_localstack ? 0 : 30

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-jwt-secret"
      Purpose = "JWT token signing for admin authentication"
    }
  )
}

# Store the secret value
resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret_override != "" ? var.jwt_secret_override : random_password.jwt_secret.result
}
