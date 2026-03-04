use chrono::{Duration, Utc};
use rand::Rng;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tracing::{info, instrument, warn};

use crate::domain::{
    AdminUser, AppError, ForgotPasswordRequest, LoginRequest, LoginResponse, MessageResponse,
    ResetPasswordRequest, Result, UserInfo, UserRepository, UserRole,
};
use crate::infrastructure::{
    generate_token, hash_password, verify_password, EmailService, JwtConfig,
};

/// Validate password meets strength requirements:
/// - At least 8 characters
/// - At least one uppercase letter
/// - At least one lowercase letter
/// - At least one digit
fn validate_password(password: &str) -> Result<()> {
    if password.len() < 8 {
        return Err(AppError::ValidationError(
            "Password must be at least 8 characters".to_string(),
        ));
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err(AppError::ValidationError(
            "Password must contain at least one uppercase letter".to_string(),
        ));
    }
    if !password.chars().any(|c| c.is_lowercase()) {
        return Err(AppError::ValidationError(
            "Password must contain at least one lowercase letter".to_string(),
        ));
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err(AppError::ValidationError(
            "Password must contain at least one digit".to_string(),
        ));
    }
    Ok(())
}

/// Handle user login
#[instrument(skip(repo, request, jwt_config), fields(email = %request.email))]
pub async fn handle_login(
    repo: &dyn UserRepository,
    request: LoginRequest,
    jwt_config: &JwtConfig,
) -> Result<LoginResponse> {
    // Validate input
    if request.email.is_empty() || request.password.is_empty() {
        return Err(AppError::ValidationError(
            "Email and password are required".to_string(),
        ));
    }

    // Normalize email to match storage format
    let email = request.email.trim().to_lowercase();

    // Get user from database
    let user = repo
        .get_user(&email)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    // Check if user is active
    if !user.is_active {
        warn!(email = %request.email, "Login attempt for inactive user");
        return Err(AppError::InvalidCredentials);
    }

    // Verify password
    if !verify_password(&request.password, &user.password_hash)? {
        warn!(email = %request.email, "Invalid password");
        return Err(AppError::InvalidCredentials);
    }

    // Generate JWT token
    let (token, expires_at) = generate_token(&user.email, &user.role, jwt_config)?;

    // Update last login timestamp
    if let Err(e) = repo.update_last_login(&user.email, Utc::now()).await {
        // Log but don't fail the login
        warn!(error = %e, "Failed to update last login timestamp");
    }

    info!(email = %user.email, role = %user.role, "Login successful");

    Ok(LoginResponse {
        token,
        expires_at,
        user: UserInfo::from(&user),
    })
}

/// Create a new admin user (for seeding/setup)
#[instrument(skip(repo, password), fields(email = %email))]
pub async fn create_user(
    repo: &dyn UserRepository,
    email: String,
    password: String,
    name: String,
    role: UserRole,
) -> Result<()> {
    // Validate input
    if email.is_empty() || password.is_empty() || name.is_empty() {
        return Err(AppError::ValidationError(
            "All fields are required".to_string(),
        ));
    }

    validate_password(&password)?;

    // Check if user already exists
    if repo.get_user(&email).await?.is_some() {
        return Err(AppError::ValidationError("User already exists".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&password)?;

    // Create user
    let user = AdminUser::new(email.clone(), password_hash, name, role);
    repo.create_user(&user).await?;

    info!(email = %email, "User created successfully");
    Ok(())
}

/// Handle forgot password request
///
/// Always returns success to prevent email enumeration.
#[instrument(skip(repo, email_service, request), fields(email = %request.email))]
pub async fn handle_forgot_password(
    repo: &dyn UserRepository,
    email_service: &EmailService,
    request: ForgotPasswordRequest,
    frontend_url: &str,
) -> Result<MessageResponse> {
    let email = request.email.trim().to_lowercase();

    // Always return success message regardless of whether user exists
    let success = MessageResponse {
        message: "If an account with that email exists, a password reset link has been sent."
            .to_string(),
    };

    if email.is_empty() {
        return Ok(success);
    }

    // Check if user exists
    let user = match repo.get_user(&email).await? {
        Some(u) => u,
        None => {
            info!(email = %email, "Forgot password for non-existent user (returning success)");
            return Ok(success);
        }
    };

    if !user.is_active {
        info!(email = %email, "Forgot password for inactive user (returning success)");
        return Ok(success);
    }

    // Generate random token (32 bytes -> 64 hex chars)
    let token_bytes: [u8; 32] = rand::thread_rng().gen();
    let token = hex::encode(token_bytes);

    // Hash token before storing (SHA-256)
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let token_hash = hex::encode(hasher.finalize());

    // Store hashed token with 1-hour expiry
    let expiry = Utc::now() + Duration::hours(1);
    repo.store_reset_token(&email, &token_hash, expiry).await?;

    // Build reset link with raw token (not hash)
    let reset_link = format!(
        "{}/reset-password?token={}&email={}",
        frontend_url.trim_end_matches('/'),
        token,
        urlencoding::encode(&email)
    );

    // Send email - log errors but don't fail the request
    if email_service.is_configured() {
        if let Err(e) = email_service
            .send_password_reset_email(&email, &reset_link)
            .await
        {
            warn!(error = %e, email = %email, "Failed to send password reset email");
        }
    } else {
        info!(email = %email, reset_link = %reset_link, "Email service not configured, logging reset link");
    }

    Ok(success)
}

/// Handle reset password request
#[instrument(skip(repo, request), fields(email = %request.email))]
pub async fn handle_reset_password(
    repo: &dyn UserRepository,
    request: ResetPasswordRequest,
) -> Result<MessageResponse> {
    let email = request.email.trim().to_lowercase();

    // Validate new password
    validate_password(&request.new_password)?;

    // Hash the incoming token
    let mut hasher = Sha256::new();
    hasher.update(request.token.as_bytes());
    let incoming_hash = hex::encode(hasher.finalize());

    // Get stored token
    let (stored_hash, expiry) = repo
        .get_reset_token(&email)
        .await?
        .ok_or(AppError::ResetTokenInvalid)?;

    // Compare hashes using constant-time comparison to prevent timing attacks
    let hashes_match = incoming_hash.as_bytes().ct_eq(stored_hash.as_bytes());
    if hashes_match.unwrap_u8() != 1 {
        // Clear token on invalid attempt to prevent brute-force
        let _ = repo.clear_reset_token(&email).await;
        warn!(email = %email, "Invalid reset token");
        return Err(AppError::ResetTokenInvalid);
    }

    // Check expiry
    if Utc::now() > expiry {
        // Clean up expired token
        let _ = repo.clear_reset_token(&email).await;
        warn!(email = %email, "Expired reset token");
        return Err(AppError::ResetTokenInvalid);
    }

    // Hash new password and update
    let new_password_hash = hash_password(&request.new_password)?;
    repo.update_password(&email, &new_password_hash).await?;

    info!(email = %email, "Password reset successful");

    Ok(MessageResponse {
        message: "Password has been reset successfully.".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use chrono::{DateTime, Utc};
    use std::sync::{Arc, Mutex};

    struct MockUserRepository {
        users: Arc<Mutex<Vec<AdminUser>>>,
    }

    impl MockUserRepository {
        fn new() -> Self {
            Self {
                users: Arc::new(Mutex::new(Vec::new())),
            }
        }

        fn with_user(user: AdminUser) -> Self {
            Self {
                users: Arc::new(Mutex::new(vec![user])),
            }
        }
    }

    #[async_trait]
    impl UserRepository for MockUserRepository {
        async fn get_user(&self, email: &str) -> Result<Option<AdminUser>> {
            let users = self.users.lock().unwrap();
            Ok(users.iter().find(|u| u.email == email).cloned())
        }

        async fn create_user(&self, user: &AdminUser) -> Result<()> {
            self.users.lock().unwrap().push(user.clone());
            Ok(())
        }

        async fn update_last_login(&self, _email: &str, _timestamp: DateTime<Utc>) -> Result<()> {
            Ok(())
        }

        async fn store_reset_token(
            &self,
            _email: &str,
            _token_hash: &str,
            _expiry: DateTime<Utc>,
        ) -> Result<()> {
            Ok(())
        }

        async fn get_reset_token(&self, _email: &str) -> Result<Option<(String, DateTime<Utc>)>> {
            Ok(None)
        }

        async fn clear_reset_token(&self, _email: &str) -> Result<()> {
            Ok(())
        }

        async fn update_password(&self, email: &str, password_hash: &str) -> Result<()> {
            let mut users = self.users.lock().unwrap();
            if let Some(user) = users.iter_mut().find(|u| u.email == email) {
                user.password_hash = password_hash.to_string();
            }
            Ok(())
        }

        async fn list_users(&self) -> Result<Vec<AdminUser>> {
            Ok(self.users.lock().unwrap().clone())
        }

        async fn update_user(
            &self,
            email: &str,
            name: Option<&str>,
            role: Option<UserRole>,
            is_active: Option<bool>,
        ) -> Result<()> {
            let mut users = self.users.lock().unwrap();
            if let Some(user) = users.iter_mut().find(|u| u.email == email) {
                if let Some(n) = name {
                    user.name = n.to_string();
                }
                if let Some(r) = role {
                    user.role = r;
                }
                if let Some(a) = is_active {
                    user.is_active = a;
                }
            }
            Ok(())
        }

        async fn count_active_admins(&self) -> Result<usize> {
            let count = self
                .users
                .lock()
                .unwrap()
                .iter()
                .filter(|u| u.role == UserRole::Admin && u.is_active)
                .count();
            Ok(count)
        }
    }

    #[tokio::test]
    async fn test_login_success() {
        let password = "test-password";
        let password_hash = hash_password(password).unwrap();

        let user = AdminUser {
            email: "test@example.com".to_string(),
            password_hash,
            name: "Test User".to_string(),
            role: UserRole::Admin,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
        };

        let repo = MockUserRepository::with_user(user);
        let jwt_config = JwtConfig {
            secret: "test-secret".to_string(),
            expiry_hours: 24,
        };

        let request = LoginRequest {
            email: "test@example.com".to_string(),
            password: password.to_string(),
        };

        let result = handle_login(&repo, request, &jwt_config).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(!response.token.is_empty());
        assert_eq!(response.user.email, "test@example.com");
    }

    #[tokio::test]
    async fn test_login_invalid_password() {
        let password_hash = hash_password("correct-password").unwrap();

        let user = AdminUser {
            email: "test@example.com".to_string(),
            password_hash,
            name: "Test User".to_string(),
            role: UserRole::Admin,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
        };

        let repo = MockUserRepository::with_user(user);
        let jwt_config = JwtConfig {
            secret: "test-secret".to_string(),
            expiry_hours: 24,
        };

        let request = LoginRequest {
            email: "test@example.com".to_string(),
            password: "wrong-password".to_string(),
        };

        let result = handle_login(&repo, request, &jwt_config).await;
        assert!(matches!(result, Err(AppError::InvalidCredentials)));
    }

    #[tokio::test]
    async fn test_login_user_not_found() {
        let repo = MockUserRepository::new();
        let jwt_config = JwtConfig {
            secret: "test-secret".to_string(),
            expiry_hours: 24,
        };

        let request = LoginRequest {
            email: "nonexistent@example.com".to_string(),
            password: "password".to_string(),
        };

        let result = handle_login(&repo, request, &jwt_config).await;
        assert!(matches!(result, Err(AppError::InvalidCredentials)));
    }

    #[tokio::test]
    async fn test_create_user_success() {
        let repo = MockUserRepository::new();

        let result = create_user(
            &repo,
            "new@example.com".to_string(),
            "Password123".to_string(),
            "New User".to_string(),
            UserRole::Admin,
        )
        .await;

        assert!(result.is_ok());
        assert!(repo.get_user("new@example.com").await.unwrap().is_some());
    }

    #[tokio::test]
    async fn test_create_user_password_too_short() {
        let repo = MockUserRepository::new();

        let result = create_user(
            &repo,
            "new@example.com".to_string(),
            "short".to_string(),
            "New User".to_string(),
            UserRole::Admin,
        )
        .await;

        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_create_user_password_no_uppercase() {
        let repo = MockUserRepository::new();

        let result = create_user(
            &repo,
            "new@example.com".to_string(),
            "password123".to_string(),
            "New User".to_string(),
            UserRole::Admin,
        )
        .await;

        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_create_user_password_no_lowercase() {
        let repo = MockUserRepository::new();

        let result = create_user(
            &repo,
            "new@example.com".to_string(),
            "PASSWORD123".to_string(),
            "New User".to_string(),
            UserRole::Admin,
        )
        .await;

        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_create_user_password_no_digit() {
        let repo = MockUserRepository::new();

        let result = create_user(
            &repo,
            "new@example.com".to_string(),
            "PasswordABC".to_string(),
            "New User".to_string(),
            UserRole::Admin,
        )
        .await;

        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }
}
