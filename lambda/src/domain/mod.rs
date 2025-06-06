use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::fmt;
use async_trait::async_trait;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum BinStatus {
    Full,
    Ok,
}

impl fmt::Display for BinStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BinStatus::Full => write!(f, "Full"),
            BinStatus::Ok => write!(f, "Ok"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Location {
    pub id: Uuid,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrashBin {
    pub id: Uuid,
    pub name: String,
    pub location_id: Uuid,
    pub qr_code_id: Uuid,
    pub status: BinStatus,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QRCode {
    pub id: Uuid,
    pub url: String,
    pub trash_bin_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusUpdateRequest {
    pub bin_id: Uuid,
    pub status: BinStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusUpdateResponse {
    pub success: bool,
    pub message: String,
    pub updated_at: DateTime<Utc>,
}

#[async_trait]
pub trait BinRepository {
    async fn update_status(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<(), AppError>;

    async fn add_report(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<(), AppError>;
}

