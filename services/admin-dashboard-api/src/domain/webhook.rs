use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;

/// Authentication type for webhook delivery
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum WebhookAuthType {
    #[default]
    None,
    ApiKey,
    Bearer,
}

impl fmt::Display for WebhookAuthType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WebhookAuthType::None => write!(f, "none"),
            WebhookAuthType::ApiKey => write!(f, "api_key"),
            WebhookAuthType::Bearer => write!(f, "bearer"),
        }
    }
}

impl WebhookAuthType {
    pub fn parse(s: &str) -> Self {
        match s {
            "api_key" => WebhookAuthType::ApiKey,
            "bearer" => WebhookAuthType::Bearer,
            _ => WebhookAuthType::None,
        }
    }
}

/// Full webhook configuration (internal model, includes secrets)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub webhook_id: String,
    pub name: String,
    pub url: String,
    pub auth_type: WebhookAuthType,
    pub auth_header: Option<String>,
    pub auth_value: Option<String>,
    pub events: Vec<String>,
    pub is_active: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub success_count: i64,
    pub failure_count: i64,
}

/// API response model (excludes auth_value for security)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookInfo {
    pub webhook_id: String,
    pub name: String,
    pub url: String,
    pub auth_type: WebhookAuthType,
    pub auth_header: Option<String>,
    pub events: Vec<String>,
    pub is_active: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub success_count: i64,
    pub failure_count: i64,
}

impl From<&WebhookConfig> for WebhookInfo {
    fn from(config: &WebhookConfig) -> Self {
        Self {
            webhook_id: config.webhook_id.clone(),
            name: config.name.clone(),
            url: config.url.clone(),
            auth_type: config.auth_type.clone(),
            auth_header: config.auth_header.clone(),
            events: config.events.clone(),
            is_active: config.is_active,
            created_at: config.created_at,
            updated_at: config.updated_at,
            last_triggered_at: config.last_triggered_at,
            success_count: config.success_count,
            failure_count: config.failure_count,
        }
    }
}

/// Request to create a new webhook
#[derive(Debug, Deserialize)]
pub struct CreateWebhookRequest {
    pub name: String,
    pub url: String,
    pub auth_type: Option<WebhookAuthType>,
    pub auth_header: Option<String>,
    pub auth_value: Option<String>,
    pub events: Option<Vec<String>>,
}

/// Request to update a webhook
#[derive(Debug, Deserialize)]
pub struct UpdateWebhookRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub auth_type: Option<WebhookAuthType>,
    pub auth_header: Option<String>,
    pub auth_value: Option<String>,
    pub events: Option<Vec<String>>,
    pub is_active: Option<bool>,
}
