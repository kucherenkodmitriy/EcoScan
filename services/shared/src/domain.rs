use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashBin {
    pub bin_id: String,
    pub location_id: String,
    pub status: i32,  // 0-100 percentage full
    pub last_updated: DateTime<Utc>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub location_id: String,
    pub name: String,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdate {
    pub bin_id: String,
    pub status: i32,
    pub timestamp: DateTime<Utc>,
}
