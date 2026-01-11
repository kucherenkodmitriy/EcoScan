use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header, Algorithm};
use serde::{Deserialize, Serialize};

use crate::domain::{AppError, Result, UserRole};

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,           // Subject (email)
    pub exp: usize,            // Expiration time
    pub iat: usize,            // Issued at
    pub role: String,          // User role
}

/// JWT configuration
pub struct JwtConfig {
    pub secret: String,
    pub expiry_hours: i64,
}

impl JwtConfig {
    pub fn from_env() -> Self {
        let secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "ecoscan-jwt-secret-change-in-production".to_string());
        let expiry_hours = std::env::var("JWT_EXPIRY_HOURS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(24);

        Self {
            secret,
            expiry_hours,
        }
    }
}

/// Generate a JWT token for a user
pub fn generate_token(email: &str, role: &UserRole, config: &JwtConfig) -> Result<(String, String)> {
    let now = Utc::now();
    let expiry = now + Duration::hours(config.expiry_hours);

    let claims = Claims {
        sub: email.to_string(),
        exp: expiry.timestamp() as usize,
        iat: now.timestamp() as usize,
        role: role.to_string(),
    };

    let header = Header::new(Algorithm::HS256);
    let encoding_key = EncodingKey::from_secret(config.secret.as_bytes());

    let token = encode(&header, &claims, &encoding_key)
        .map_err(|e| AppError::JwtError(e.to_string()))?;

    Ok((token, expiry.to_rfc3339()))
}

/// Verify password against hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    bcrypt::verify(password, hash)
        .map_err(|e| AppError::InternalError(format!("Password verification error: {}", e)))
}

/// Hash a password for storage
pub fn hash_password(password: &str) -> Result<String> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Password hashing error: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_token() {
        let config = JwtConfig {
            secret: "test-secret".to_string(),
            expiry_hours: 24,
        };

        let result = generate_token("test@example.com", &UserRole::Admin, &config);
        assert!(result.is_ok());

        let (token, expiry) = result.unwrap();
        assert!(!token.is_empty());
        assert!(!expiry.is_empty());
    }

    #[test]
    fn test_hash_and_verify_password() {
        let password = "my-secure-password";
        let hash = hash_password(password).unwrap();

        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong-password", &hash).unwrap());
    }
}
