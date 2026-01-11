pub mod error;
pub mod user;

pub use error::{AppError, Result};
pub use user::{AdminUser, LoginRequest, LoginResponse, UserInfo, UserRole};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Bin status for admin dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinInfo {
    pub bin_id: Uuid,
    pub name: String,
    pub status: i32,
    pub reports_count: i32,
    pub last_updated: Option<DateTime<Utc>>,
    pub is_active: bool,
}

/// Request to create a new bin
#[derive(Debug, Deserialize)]
pub struct CreateBinRequest {
    pub name: String,
}

/// Request to update a bin
#[derive(Debug, Deserialize)]
pub struct UpdateBinRequest {
    pub name: Option<String>,
    pub is_active: Option<bool>,
}

/// Repository trait for user operations
#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn get_user(&self, email: &str) -> Result<Option<AdminUser>>;
    async fn create_user(&self, user: &AdminUser) -> Result<()>;
    async fn update_last_login(&self, email: &str, timestamp: DateTime<Utc>) -> Result<()>;
}

/// Repository trait for bin operations
#[async_trait]
pub trait BinRepository: Send + Sync {
    async fn list_bins(&self) -> Result<Vec<BinInfo>>;
    async fn get_bin(&self, bin_id: &Uuid) -> Result<Option<BinInfo>>;
    async fn create_bin(&self, bin_id: &Uuid, name: &str) -> Result<()>;
    async fn update_bin(&self, bin_id: &Uuid, request: &UpdateBinRequest) -> Result<()>;
    async fn delete_bin(&self, bin_id: &Uuid) -> Result<()>;
}
