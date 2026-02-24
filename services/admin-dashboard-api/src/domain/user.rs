use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Admin user stored in DynamoDB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminUser {
    pub email: String,
    pub password_hash: String,
    pub name: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    pub is_active: bool,
}

impl AdminUser {
    pub fn new(email: String, password_hash: String, name: String, role: UserRole) -> Self {
        Self {
            email,
            password_hash,
            name,
            role,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
        }
    }
}

/// User roles for authorization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    Operator,
    #[default]
    Viewer,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Admin => write!(f, "admin"),
            UserRole::Operator => write!(f, "operator"),
            UserRole::Viewer => write!(f, "viewer"),
        }
    }
}

/// Login request from client
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Login response to client
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: String,
    pub user: UserInfo,
}

/// User info included in login response (no sensitive data)
#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub email: String,
    pub name: String,
    pub role: UserRole,
}

impl From<&AdminUser> for UserInfo {
    fn from(user: &AdminUser) -> Self {
        Self {
            email: user.email.clone(),
            name: user.name.clone(),
            role: user.role,
        }
    }
}

/// Forgot password request
#[derive(Debug, Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

/// Reset password request
#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub email: String,
    pub token: String,
    pub new_password: String,
}

/// Generic message response
#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

/// Create user request
#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub name: String,
    pub role: UserRole,
}

/// Update user request
#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub name: Option<String>,
    pub role: Option<UserRole>,
    pub is_active: Option<bool>,
}

/// User created response
#[derive(Debug, Serialize)]
pub struct UserCreatedResponse {
    pub email: String,
    pub name: String,
    pub role: UserRole,
    pub password_delivered: bool,
    pub created_at: String,
}

/// Detailed user info for list/detail views (no password hash)
#[derive(Debug, Serialize)]
pub struct UserDetailInfo {
    pub email: String,
    pub name: String,
    pub role: UserRole,
    pub is_active: bool,
    pub created_at: String,
    pub last_login: Option<String>,
}

impl From<&AdminUser> for UserDetailInfo {
    fn from(user: &AdminUser) -> Self {
        Self {
            email: user.email.clone(),
            name: user.name.clone(),
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at.to_rfc3339(),
            last_login: user.last_login.map(|dt| dt.to_rfc3339()),
        }
    }
}
