use chrono::Utc;
use tracing::{info, instrument, warn};

use crate::domain::{
    AdminUser, AppError, LoginRequest, LoginResponse, Result, UserInfo, UserRepository, UserRole,
};
use crate::infrastructure::{generate_token, hash_password, verify_password, JwtConfig};

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

    // Get user from database
    let user = repo
        .get_user(&request.email)
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

    if password.len() < 8 {
        return Err(AppError::ValidationError(
            "Password must be at least 8 characters".to_string(),
        ));
    }

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
            "password123".to_string(),
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
}
