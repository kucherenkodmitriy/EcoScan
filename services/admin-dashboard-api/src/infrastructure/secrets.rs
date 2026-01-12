//! AWS Secrets Manager integration for secure secret retrieval
//!
//! This module handles fetching secrets from AWS Secrets Manager,
//! with fallback to environment variables for local development and testing.

use aws_config::BehaviorVersion;
use aws_sdk_secretsmanager::Client as SecretsManagerClient;
use tracing::{info, warn};

/// Secret value retrieved from Secrets Manager
#[derive(Debug, Clone)]
pub struct JwtSecretValue {
    pub secret: String,
}

/// Fetch JWT secret from AWS Secrets Manager or fallback to environment variable
///
/// Priority:
/// 1. JWT_SECRET_ARN env var → fetch from Secrets Manager
/// 2. JWT_SECRET env var → use directly (for local dev/tests)
/// 3. Fail with error (no hardcoded defaults in production)
pub async fn get_jwt_secret(localstack_endpoint: Option<&str>) -> Result<JwtSecretValue, String> {
    // Check for Secrets Manager ARN first (production path)
    if let Ok(secret_arn) = std::env::var("JWT_SECRET_ARN") {
        info!("Fetching JWT secret from Secrets Manager");
        return fetch_from_secrets_manager(&secret_arn, localstack_endpoint).await;
    }

    // Fallback to environment variable (local dev/tests)
    if let Ok(secret) = std::env::var("JWT_SECRET") {
        warn!("Using JWT_SECRET from environment variable (not recommended for production)");
        return Ok(JwtSecretValue { secret });
    }

    Err("Neither JWT_SECRET_ARN nor JWT_SECRET environment variable is set".to_string())
}

/// Fetch secret from AWS Secrets Manager
async fn fetch_from_secrets_manager(
    secret_arn: &str,
    localstack_endpoint: Option<&str>,
) -> Result<JwtSecretValue, String> {
    let config = if let Some(endpoint) = localstack_endpoint {
        // LocalStack configuration
        aws_config::defaults(BehaviorVersion::latest())
            .endpoint_url(endpoint)
            .load()
            .await
    } else {
        // Production AWS configuration
        aws_config::defaults(BehaviorVersion::latest()).load().await
    };

    let client = SecretsManagerClient::new(&config);

    let response = client
        .get_secret_value()
        .secret_id(secret_arn)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch secret from Secrets Manager: {}", e))?;

    let secret = response
        .secret_string()
        .ok_or_else(|| "Secret value is not a string".to_string())?
        .to_string();

    info!("Successfully retrieved JWT secret from Secrets Manager");
    Ok(JwtSecretValue { secret })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Mutex to ensure tests that modify env vars run sequentially
    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    #[tokio::test]
    async fn test_get_jwt_secret_from_env() {
        let _lock = ENV_MUTEX.lock().unwrap();

        // Save original values
        let original_secret = std::env::var("JWT_SECRET").ok();
        let original_arn = std::env::var("JWT_SECRET_ARN").ok();

        // Set test values
        std::env::set_var("JWT_SECRET", "test-secret-value");
        std::env::remove_var("JWT_SECRET_ARN");

        let result = get_jwt_secret(None).await;
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert_eq!(result.unwrap().secret, "test-secret-value");

        // Restore original values
        match original_secret {
            Some(v) => std::env::set_var("JWT_SECRET", v),
            None => std::env::remove_var("JWT_SECRET"),
        }
        match original_arn {
            Some(v) => std::env::set_var("JWT_SECRET_ARN", v),
            None => std::env::remove_var("JWT_SECRET_ARN"),
        }
    }

    #[tokio::test]
    async fn test_get_jwt_secret_missing() {
        let _lock = ENV_MUTEX.lock().unwrap();

        // Save original values
        let original_secret = std::env::var("JWT_SECRET").ok();
        let original_arn = std::env::var("JWT_SECRET_ARN").ok();

        // Clear for test
        std::env::remove_var("JWT_SECRET");
        std::env::remove_var("JWT_SECRET_ARN");

        let result = get_jwt_secret(None).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Neither JWT_SECRET_ARN nor JWT_SECRET"));

        // Restore original values
        match original_secret {
            Some(v) => std::env::set_var("JWT_SECRET", v),
            None => std::env::remove_var("JWT_SECRET"),
        }
        match original_arn {
            Some(v) => std::env::set_var("JWT_SECRET_ARN", v),
            None => std::env::remove_var("JWT_SECRET_ARN"),
        }
    }
}
