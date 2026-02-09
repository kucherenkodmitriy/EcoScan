use crate::infrastructure::get_jwt_secret;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    pub admin_users_table: String,
    pub trash_bins_table: String,
    pub status_reports_table: String,
    pub webhook_configs_table: String,
    pub api_keys_table: String,
    pub dynamodb_endpoint: Option<String>,
    pub aws_region: String,
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,
    pub log_level: String,
    /// Allowed CORS origins (comma-separated for multiple). Use "*" for any origin.
    pub cors_allowed_origins: String,
    /// Email address to send password reset emails from (must be verified in SES)
    pub from_email: Option<String>,
    /// Frontend URL for building password reset links
    pub frontend_url: String,
}

impl Config {
    /// Load configuration from environment variables (sync version for tests)
    ///
    /// This version uses JWT_SECRET env var directly. For production,
    /// use `from_env_with_secrets()` which fetches from Secrets Manager.
    #[cfg(test)]
    pub fn from_env() -> Self {
        Self {
            admin_users_table: std::env::var("ADMIN_USERS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-admin-users".to_string()),
            trash_bins_table: std::env::var("TRASH_BINS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-trash-bins".to_string()),
            status_reports_table: std::env::var("STATUS_REPORTS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-status-reports".to_string()),
            webhook_configs_table: std::env::var("WEBHOOK_CONFIGS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-webhook-configs".to_string()),
            api_keys_table: std::env::var("API_KEYS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-api-keys".to_string()),
            dynamodb_endpoint: std::env::var("DYNAMODB_ENDPOINT_URL").ok(),
            aws_region: std::env::var("AWS_REGION").unwrap_or_else(|_| "eu-central-1".to_string()),
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret".to_string()),
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(24),
            log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "INFO".to_string()),
            cors_allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "*".to_string()),
            from_email: std::env::var("FROM_EMAIL").ok().filter(|s| !s.is_empty()),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }

    /// Load configuration with secrets from AWS Secrets Manager
    ///
    /// This is the production-ready async version that fetches JWT secret
    /// from Secrets Manager (or falls back to env var for local dev).
    pub async fn from_env_with_secrets() -> Result<Self, String> {
        let dynamodb_endpoint = std::env::var("DYNAMODB_ENDPOINT_URL").ok();

        // Fetch JWT secret (from Secrets Manager or env var)
        let jwt_secret_value = get_jwt_secret(dynamodb_endpoint.as_deref()).await?;

        Ok(Self {
            admin_users_table: std::env::var("ADMIN_USERS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-admin-users".to_string()),
            trash_bins_table: std::env::var("TRASH_BINS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-trash-bins".to_string()),
            status_reports_table: std::env::var("STATUS_REPORTS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-status-reports".to_string()),
            webhook_configs_table: std::env::var("WEBHOOK_CONFIGS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-webhook-configs".to_string()),
            api_keys_table: std::env::var("API_KEYS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-api-keys".to_string()),
            dynamodb_endpoint,
            aws_region: std::env::var("AWS_REGION").unwrap_or_else(|_| "eu-central-1".to_string()),
            jwt_secret: jwt_secret_value.secret,
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(24),
            log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "INFO".to_string()),
            cors_allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "*".to_string()),
            from_email: std::env::var("FROM_EMAIL").ok().filter(|s| !s.is_empty()),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        })
    }

    /// Check if running in local development mode (LocalStack)
    pub fn is_local_development(&self) -> bool {
        self.dynamodb_endpoint.is_some()
    }
}
