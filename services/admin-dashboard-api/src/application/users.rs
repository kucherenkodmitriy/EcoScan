use bcrypt::{hash, DEFAULT_COST};
use rand::Rng;
use tracing::{info, instrument, warn};

use crate::domain::{
    AdminUser, AppError, CreateUserRequest, Result, UpdateUserRequest, UserCreatedResponse,
    UserDetailInfo, UserRepository, UserRole,
};
use crate::infrastructure::email::EmailService;

const PASSWORD_LENGTH: usize = 16;
const PASSWORD_CHARS: &[u8] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

/// Generate a random secure password
fn generate_password() -> String {
    let mut rng = rand::thread_rng();
    (0..PASSWORD_LENGTH)
        .map(|_| {
            let idx = rng.gen_range(0..PASSWORD_CHARS.len());
            PASSWORD_CHARS[idx] as char
        })
        .collect()
}

/// Validate email format (basic validation)
fn validate_email(email: &str) -> Result<()> {
    if email.is_empty() {
        return Err(AppError::ValidationError(
            "Invalid email format".to_string(),
        ));
    }

    // Check for @ symbol
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return Err(AppError::ValidationError(
            "Invalid email format".to_string(),
        ));
    }

    // Check that local part (before @) is not empty
    if parts[0].is_empty() {
        return Err(AppError::ValidationError(
            "Invalid email format".to_string(),
        ));
    }

    // Check that domain part (after @) is not empty and contains a dot
    if parts[1].is_empty() || !parts[1].contains('.') {
        return Err(AppError::ValidationError(
            "Invalid email format".to_string(),
        ));
    }

    Ok(())
}

/// Create a new user with generated password
#[instrument(skip(repo, email_service, request))]
pub async fn create_user(
    repo: &dyn UserRepository,
    email_service: Option<&EmailService>,
    request: CreateUserRequest,
) -> Result<UserCreatedResponse> {
    // Normalize email to lowercase
    let email = request.email.trim().to_lowercase();

    // Validate email format
    validate_email(&email)?;

    // Check if user already exists
    if repo.get_user(&email).await?.is_some() {
        return Err(AppError::ValidationError(format!(
            "User with email {} already exists",
            email
        )));
    }

    // Generate initial password
    let initial_password = generate_password();
    info!("Generated initial password for user");

    // Hash password
    let password_hash = hash(&initial_password, DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Create user
    let user = AdminUser::new(
        email.clone(),
        password_hash,
        request.name.clone(),
        request.role,
    );
    repo.create_user(&user).await?;

    info!(email = %email, role = ?request.role, "User created successfully");

    // Send welcome email (best effort)
    let password_delivered = if let Some(email_svc) = email_service {
        if email_svc.is_configured() {
            match email_svc
                .send_welcome_email(&email, &request.name, &initial_password)
                .await
            {
                Ok(_) => {
                    info!("Welcome email sent to {}", email);
                    true
                }
                Err(e) => {
                    warn!("Failed to send welcome email to {}: {}", email, e);
                    false
                }
            }
        } else {
            warn!("Email service not configured for user {}", email);
            false
        }
    } else {
        warn!("No email service provided for user {}", email);
        false
    };

    Ok(UserCreatedResponse {
        email,
        name: request.name,
        role: request.role,
        initial_password,
        password_delivered,
        created_at: user.created_at.to_rfc3339(),
    })
}

/// List all users (returns safe info without passwords)
#[instrument(skip(repo))]
pub async fn list_users(repo: &dyn UserRepository) -> Result<Vec<UserDetailInfo>> {
    let users = repo.list_users().await?;
    Ok(users.iter().map(UserDetailInfo::from).collect())
}

/// Get a single user by email
#[instrument(skip(repo))]
pub async fn get_user(repo: &dyn UserRepository, email: &str) -> Result<UserDetailInfo> {
    let email = email.trim().to_lowercase();
    let user = repo
        .get_user(&email)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", email)))?;

    Ok(UserDetailInfo::from(&user))
}

/// Update a user (with security checks)
#[instrument(skip(repo, request))]
pub async fn update_user(
    repo: &dyn UserRepository,
    email: &str,
    current_user_email: &str,
    request: UpdateUserRequest,
) -> Result<UserDetailInfo> {
    let email = email.trim().to_lowercase();
    let current_email = current_user_email.trim().to_lowercase();

    // Check if user exists
    let user = repo
        .get_user(&email)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", email)))?;

    // Security check: Cannot change own role
    if email == current_email && request.role.is_some() && request.role != Some(user.role) {
        return Err(AppError::PermissionDenied(
            "Cannot change your own role".to_string(),
        ));
    }

    // Security check: Cannot demote last admin
    if let Some(new_role) = request.role {
        if user.role == UserRole::Admin && new_role != UserRole::Admin {
            let admin_count = repo.count_active_admins().await?;
            if admin_count <= 1 {
                return Err(AppError::PermissionDenied(
                    "Cannot demote the last admin".to_string(),
                ));
            }
        }
    }

    // Security check: Cannot deactivate last admin
    if let Some(false) = request.is_active {
        if user.role == UserRole::Admin && user.is_active {
            let admin_count = repo.count_active_admins().await?;
            if admin_count <= 1 {
                return Err(AppError::PermissionDenied(
                    "Cannot deactivate the last admin".to_string(),
                ));
            }
        }
    }

    // Update user
    repo.update_user(
        &email,
        request.name.as_deref(),
        request.role,
        request.is_active,
    )
    .await?;

    info!(email = %email, "User updated successfully");

    // Fetch and return updated user
    get_user(repo, &email).await
}

/// Delete (deactivate) a user
#[instrument(skip(repo))]
pub async fn delete_user(
    repo: &dyn UserRepository,
    email: &str,
    current_user_email: &str,
) -> Result<()> {
    let email = email.trim().to_lowercase();
    let current_email = current_user_email.trim().to_lowercase();

    // Security check: Cannot delete self
    if email == current_email {
        return Err(AppError::PermissionDenied(
            "Cannot delete your own account".to_string(),
        ));
    }

    // Check if user exists
    let user = repo
        .get_user(&email)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", email)))?;

    // Security check: Cannot delete last admin
    if user.role == UserRole::Admin && user.is_active {
        let admin_count = repo.count_active_admins().await?;
        if admin_count <= 1 {
            return Err(AppError::PermissionDenied(
                "Cannot delete the last admin".to_string(),
            ));
        }
    }

    // Soft delete by deactivating
    repo.update_user(&email, None, None, Some(false)).await?;

    info!(email = %email, "User deleted (deactivated) successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use chrono::Utc;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    // Mock repository for testing
    struct MockUserRepository {
        users: Arc<Mutex<HashMap<String, AdminUser>>>,
    }

    impl MockUserRepository {
        fn new() -> Self {
            Self {
                users: Arc::new(Mutex::new(HashMap::new())),
            }
        }

        fn add_user(&self, user: AdminUser) {
            self.users.lock().unwrap().insert(user.email.clone(), user);
        }
    }

    #[async_trait]
    impl UserRepository for MockUserRepository {
        async fn get_user(&self, email: &str) -> Result<Option<AdminUser>> {
            Ok(self.users.lock().unwrap().get(email).cloned())
        }

        async fn create_user(&self, user: &AdminUser) -> Result<()> {
            self.users
                .lock()
                .unwrap()
                .insert(user.email.clone(), user.clone());
            Ok(())
        }

        async fn update_last_login(
            &self,
            _email: &str,
            _timestamp: chrono::DateTime<Utc>,
        ) -> Result<()> {
            Ok(())
        }

        async fn store_reset_token(
            &self,
            _email: &str,
            _token_hash: &str,
            _expiry: chrono::DateTime<Utc>,
        ) -> Result<()> {
            Ok(())
        }

        async fn get_reset_token(
            &self,
            _email: &str,
        ) -> Result<Option<(String, chrono::DateTime<Utc>)>> {
            Ok(None)
        }

        async fn clear_reset_token(&self, _email: &str) -> Result<()> {
            Ok(())
        }

        async fn update_password(&self, _email: &str, _password_hash: &str) -> Result<()> {
            Ok(())
        }

        async fn list_users(&self) -> Result<Vec<AdminUser>> {
            Ok(self.users.lock().unwrap().values().cloned().collect())
        }

        async fn update_user(
            &self,
            email: &str,
            name: Option<&str>,
            role: Option<UserRole>,
            is_active: Option<bool>,
        ) -> Result<()> {
            let mut users = self.users.lock().unwrap();
            if let Some(user) = users.get_mut(email) {
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
                .values()
                .filter(|u| u.role == UserRole::Admin && u.is_active)
                .count();
            Ok(count)
        }
    }

    #[tokio::test]
    async fn test_create_user_success() {
        let repo = MockUserRepository::new();
        let request = CreateUserRequest {
            email: "test@example.com".to_string(),
            name: "Test User".to_string(),
            role: UserRole::Operator,
        };

        let result = create_user(&repo, None, request).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response.email, "test@example.com");
        assert_eq!(response.name, "Test User");
        assert_eq!(response.role, UserRole::Operator);
        assert!(!response.password_delivered);
    }

    #[tokio::test]
    async fn test_create_user_duplicate_email() {
        let repo = MockUserRepository::new();
        let existing_user = AdminUser::new(
            "test@example.com".to_string(),
            "hash".to_string(),
            "Existing".to_string(),
            UserRole::Admin,
        );
        repo.add_user(existing_user);

        let request = CreateUserRequest {
            email: "test@example.com".to_string(),
            name: "New User".to_string(),
            role: UserRole::Viewer,
        };

        let result = create_user(&repo, None, request).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::ValidationError(_)));
    }

    #[tokio::test]
    async fn test_create_user_invalid_email() {
        let repo = MockUserRepository::new();
        let request = CreateUserRequest {
            email: "invalid-email".to_string(),
            name: "Test User".to_string(),
            role: UserRole::Viewer,
        };

        let result = create_user(&repo, None, request).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::ValidationError(_)));
    }

    #[tokio::test]
    async fn test_list_users() {
        let repo = MockUserRepository::new();
        repo.add_user(AdminUser::new(
            "admin@test.com".to_string(),
            "hash".to_string(),
            "Admin".to_string(),
            UserRole::Admin,
        ));
        repo.add_user(AdminUser::new(
            "user@test.com".to_string(),
            "hash".to_string(),
            "User".to_string(),
            UserRole::Viewer,
        ));

        let result = list_users(&repo).await;
        assert!(result.is_ok());

        let users = result.unwrap();
        assert_eq!(users.len(), 2);
    }

    #[tokio::test]
    async fn test_update_user_cannot_change_own_role() {
        let repo = MockUserRepository::new();
        let user = AdminUser::new(
            "admin@test.com".to_string(),
            "hash".to_string(),
            "Admin".to_string(),
            UserRole::Admin,
        );
        repo.add_user(user);

        let request = UpdateUserRequest {
            name: None,
            role: Some(UserRole::Viewer),
            is_active: None,
        };

        let result = update_user(&repo, "admin@test.com", "admin@test.com", request).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn test_update_user_cannot_demote_last_admin() {
        let repo = MockUserRepository::new();
        let admin = AdminUser::new(
            "admin@test.com".to_string(),
            "hash".to_string(),
            "Admin".to_string(),
            UserRole::Admin,
        );
        repo.add_user(admin);

        let request = UpdateUserRequest {
            name: None,
            role: Some(UserRole::Viewer),
            is_active: None,
        };

        let result = update_user(&repo, "admin@test.com", "other@test.com", request).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn test_delete_user_cannot_delete_self() {
        let repo = MockUserRepository::new();
        let user = AdminUser::new(
            "admin@test.com".to_string(),
            "hash".to_string(),
            "Admin".to_string(),
            UserRole::Admin,
        );
        repo.add_user(user);

        let result = delete_user(&repo, "admin@test.com", "admin@test.com").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn test_delete_user_cannot_delete_last_admin() {
        let repo = MockUserRepository::new();
        let admin = AdminUser::new(
            "admin@test.com".to_string(),
            "hash".to_string(),
            "Admin".to_string(),
            UserRole::Admin,
        );
        repo.add_user(admin);

        let result = delete_user(&repo, "admin@test.com", "other@test.com").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn test_delete_user_success() {
        let repo = MockUserRepository::new();
        let admin1 = AdminUser::new(
            "admin1@test.com".to_string(),
            "hash".to_string(),
            "Admin 1".to_string(),
            UserRole::Admin,
        );
        let admin2 = AdminUser::new(
            "admin2@test.com".to_string(),
            "hash".to_string(),
            "Admin 2".to_string(),
            UserRole::Admin,
        );
        repo.add_user(admin1);
        repo.add_user(admin2);

        let result = delete_user(&repo, "admin2@test.com", "admin1@test.com").await;
        assert!(result.is_ok());

        // Verify user is deactivated
        let user = repo.get_user("admin2@test.com").await.unwrap().unwrap();
        assert!(!user.is_active);
    }

    #[test]
    fn test_generate_password() {
        let password = generate_password();
        assert_eq!(password.len(), PASSWORD_LENGTH);
        assert!(password
            .chars()
            .all(|c| PASSWORD_CHARS.contains(&(c as u8))));
    }

    #[test]
    fn test_validate_email() {
        assert!(validate_email("test@example.com").is_ok());
        assert!(validate_email("user.name+tag@domain.co.uk").is_ok());
        assert!(validate_email("").is_err());
        assert!(validate_email("invalid").is_err());
        assert!(validate_email("@example.com").is_err());
        assert!(validate_email("test@").is_err());
    }
}
