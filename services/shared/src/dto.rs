use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdateRequest {
    pub bin_id: String,
    pub status: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdateResponse {
    pub success: bool,
    pub message: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinStatusDto {
    pub bin_id: String,
    pub location_id: String,
    pub status: i32,
    pub last_updated: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationDto {
    pub location_id: String,
    pub name: String,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub created_at: String,
}
