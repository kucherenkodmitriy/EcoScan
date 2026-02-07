pub mod error;

pub use error::{AppError, Result};

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Authentication type for webhook delivery
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthType {
    #[default]
    None,
    ApiKey,
    Bearer,
}

/// Webhook configuration stored in DynamoDB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub webhook_id: String,
    pub name: String,
    pub url: String,
    pub auth_type: AuthType,
    pub auth_header: Option<String>,
    pub auth_value: Option<String>,
    pub events: Vec<String>,
    pub is_active: bool,
}

/// The message body from SQS (same format as bin-status-reporter receives)
#[derive(Debug, Deserialize)]
pub struct SqsMessageBody {
    #[serde(rename = "binId")]
    pub bin_id: String,
    pub status: i32,
    #[serde(default)]
    pub source: Option<String>,
}

/// The webhook event payload sent to external systems
#[derive(Debug, Serialize)]
pub struct WebhookEvent {
    pub event: String,
    pub version: String,
    pub timestamp: String,
    pub data: WebhookEventData,
}

#[derive(Debug, Serialize)]
pub struct WebhookEventData {
    pub bin_id: String,
    pub status: i32,
    pub source: String,
    pub reported_at: String,
}

/// Repository trait for webhook config operations
#[async_trait]
pub trait WebhookConfigRepository: Send + Sync {
    async fn list_active_configs(&self) -> Result<Vec<WebhookConfig>>;
    async fn increment_success(&self, webhook_id: &str) -> Result<()>;
    async fn increment_failure(&self, webhook_id: &str) -> Result<()>;
}
