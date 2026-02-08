use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

use super::{BinInfo, BinType, Coordinates};

/// Available scopes for API keys
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeyScope {
    BinsRead,
    BinsWrite,
}

impl fmt::Display for ApiKeyScope {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ApiKeyScope::BinsRead => write!(f, "bins:read"),
            ApiKeyScope::BinsWrite => write!(f, "bins:write"),
        }
    }
}

impl ApiKeyScope {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "bins:read" => Some(ApiKeyScope::BinsRead),
            "bins:write" => Some(ApiKeyScope::BinsWrite),
            _ => None,
        }
    }
}

/// Internal API key record stored in DynamoDB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyRecord {
    pub key_id: String,
    pub key_hash: String,
    pub key_prefix: String,
    pub name: String,
    pub scopes: Vec<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

/// API key info returned to admins (excludes hash)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyInfo {
    pub key_id: String,
    pub key_prefix: String,
    pub name: String,
    pub scopes: Vec<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

impl From<&ApiKeyRecord> for ApiKeyInfo {
    fn from(record: &ApiKeyRecord) -> Self {
        Self {
            key_id: record.key_id.clone(),
            key_prefix: record.key_prefix.clone(),
            name: record.name.clone(),
            scopes: record.scopes.clone(),
            created_by: record.created_by.clone(),
            created_at: record.created_at,
            last_used_at: record.last_used_at,
            is_active: record.is_active,
            expires_at: record.expires_at,
        }
    }
}

/// Response when creating an API key - includes the raw key (shown only once)
#[derive(Debug, Serialize)]
pub struct ApiKeyCreatedResponse {
    pub api_key: String,
    pub key_id: String,
    pub key_prefix: String,
    pub name: String,
    pub scopes: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Request to create a new API key
#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scopes: Option<Vec<String>>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Request to update an API key
#[derive(Debug, Deserialize)]
pub struct UpdateApiKeyRequest {
    pub name: Option<String>,
    pub scopes: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

/// Bin info exposed via the external API (limited fields)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalBinInfo {
    pub bin_id: Uuid,
    pub name: String,
    pub bin_type: BinType,
    pub address: Option<String>,
    pub coordinates: Option<Coordinates>,
    pub status: i32,
    pub last_updated: Option<DateTime<Utc>>,
}

impl From<&BinInfo> for ExternalBinInfo {
    fn from(bin: &BinInfo) -> Self {
        Self {
            bin_id: bin.bin_id,
            name: bin.name.clone(),
            bin_type: bin.bin_type,
            address: bin.address.clone(),
            coordinates: bin.coordinates,
            status: bin.status,
            last_updated: bin.last_updated,
        }
    }
}

/// Paginated response wrapper
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}
