/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    pub webhook_configs_table: String,
    pub webhook_timeout_secs: u64,
    pub dynamodb_endpoint: Option<String>,
    pub aws_region: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            webhook_configs_table: std::env::var("WEBHOOK_CONFIGS_TABLE_NAME")
                .unwrap_or_else(|_| "dev-ecoscan-webhook-configs".to_string()),
            webhook_timeout_secs: std::env::var("WEBHOOK_TIMEOUT_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(10),
            dynamodb_endpoint: std::env::var("DYNAMODB_ENDPOINT_URL").ok(),
            aws_region: std::env::var("AWS_REGION").unwrap_or_else(|_| "eu-central-1".to_string()),
        }
    }
}
