pub mod error;
pub mod user;

pub use error::{AppError, Result};
pub use user::{AdminUser, LoginRequest, LoginResponse, UserInfo, UserRole};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

/// Type of waste the bin collects
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum BinType {
    #[default]
    Mixed,
    Plastic,
    Paper,
    Glass,
}

impl fmt::Display for BinType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BinType::Mixed => write!(f, "mixed"),
            BinType::Plastic => write!(f, "plastic"),
            BinType::Paper => write!(f, "paper"),
            BinType::Glass => write!(f, "glass"),
        }
    }
}

impl BinType {
    pub fn parse(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "plastic" => BinType::Plastic,
            "paper" => BinType::Paper,
            "glass" => BinType::Glass,
            _ => BinType::Mixed,
        }
    }
}

/// Geographic coordinates for bin location
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Coordinates {
    pub latitude: f64,
    pub longitude: f64,
}

/// Bin status for admin dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinInfo {
    pub bin_id: Uuid,
    pub name: String,
    pub bin_type: BinType,
    pub address: Option<String>,
    pub coordinates: Option<Coordinates>,
    pub status: i32,
    pub reports_count: i32,
    pub last_updated: Option<DateTime<Utc>>,
    pub is_active: bool,
}

/// Public bin info for QR code report page (no sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicBinInfo {
    pub bin_id: Uuid,
    pub name: String,
    pub bin_type: BinType,
    pub address: Option<String>,
}

impl From<&BinInfo> for PublicBinInfo {
    fn from(bin: &BinInfo) -> Self {
        Self {
            bin_id: bin.bin_id,
            name: bin.name.clone(),
            bin_type: bin.bin_type,
            address: bin.address.clone(),
        }
    }
}

/// Request to create a new bin
#[derive(Debug, Deserialize)]
pub struct CreateBinRequest {
    pub name: String,
    pub bin_type: Option<BinType>,
    pub address: Option<String>,
    pub coordinates: Option<Coordinates>,
}

/// Request to update a bin
#[derive(Debug, Deserialize)]
pub struct UpdateBinRequest {
    pub name: Option<String>,
    pub bin_type: Option<BinType>,
    pub address: Option<String>,
    pub coordinates: Option<Coordinates>,
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
    async fn create_bin(&self, bin_id: &Uuid, request: &CreateBinRequest) -> Result<()>;
    async fn update_bin(&self, bin_id: &Uuid, request: &UpdateBinRequest) -> Result<()>;
    async fn delete_bin(&self, bin_id: &Uuid) -> Result<()>;
}
