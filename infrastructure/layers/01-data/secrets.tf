# =============================================================================
# AWS Secrets Manager - JWT Secret
# =============================================================================
#
# ROTATION PROCEDURE (manual):
# JWT secret rotation requires a dual-secret window so existing tokens remain
# valid until they expire (default: 24 hours). Steps:
#   1. Generate a new secret value
#   2. Update the Lambda authorizer to accept BOTH old and new secrets
#   3. Deploy the authorizer with dual-secret validation
#   4. Rotate the Secrets Manager value to the new secret
#   5. Wait 24 hours (JWT_EXPIRY_HOURS) for all old tokens to expire
#   6. Remove the old secret from the authorizer config
#   7. Deploy the authorizer with single-secret validation
# Automated rotation is deferred — requires a custom rotation Lambda.
# =============================================================================

# Generate a random secret value for JWT signing
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Create the Secrets Manager secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.environment}-${var.project_name}-jwt-secret"
  description = "JWT signing secret for EcoScan admin authentication. Rotate manually — see comments above."

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

# =============================================================================
# AWS Secrets Manager - Google Maps API Key
# =============================================================================

# Create the Secrets Manager secret for Google Maps API key
resource "aws_secretsmanager_secret" "google_maps_api_key" {
  name        = "${var.environment}-${var.project_name}-google-maps-api-key"
  description = "Google Maps API key for EcoScan frontend"

  # For local development, we don't need recovery window
  recovery_window_in_days = var.use_localstack ? 0 : 30

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-google-maps-api-key"
      Purpose = "Google Maps JavaScript API for bin location mapping"
    }
  )
}

# Store the Google Maps API key value
resource "aws_secretsmanager_secret_version" "google_maps_api_key" {
  secret_id     = aws_secretsmanager_secret.google_maps_api_key.id
  secret_string = var.google_maps_api_key != "" ? var.google_maps_api_key : "placeholder-for-local-dev"
}
