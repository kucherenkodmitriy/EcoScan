use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub enum BinStatus {
    Full,
    Ok,
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

#[derive(Debug, Serialize, Deserialize)]
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