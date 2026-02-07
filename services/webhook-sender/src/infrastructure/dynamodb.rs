use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use tracing::{info, instrument};

use crate::config::Config;
use crate::domain::{AppError, AuthType, Result, WebhookConfig, WebhookConfigRepository};

pub struct DynamoDbWebhookRepository {
    client: Client,
    table_name: String,
}

impl DynamoDbWebhookRepository {
    pub async fn new(config: &Config) -> Result<Self> {
        let sdk_config = if let Some(endpoint) = &config.dynamodb_endpoint {
            info!(endpoint = %endpoint, "Using custom DynamoDB endpoint (LocalStack)");
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .endpoint_url(endpoint)
                .region(aws_config::Region::new(config.aws_region.clone()))
                .load()
                .await
        } else {
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .region(aws_config::Region::new(config.aws_region.clone()))
                .load()
                .await
        };

        let client = Client::new(&sdk_config);

        Ok(Self {
            client,
            table_name: config.webhook_configs_table.clone(),
        })
    }

    fn parse_auth_type(s: &str) -> AuthType {
        match s {
            "api_key" => AuthType::ApiKey,
            "bearer" => AuthType::Bearer,
            _ => AuthType::None,
        }
    }

    fn parse_webhook_item(
        item: &std::collections::HashMap<String, AttributeValue>,
    ) -> Option<WebhookConfig> {
        let webhook_id = item.get("webhookId").and_then(|v| v.as_s().ok()).cloned()?;

        let events = item
            .get("events")
            .and_then(|v| v.as_l().ok())
            .map(|list| list.iter().filter_map(|v| v.as_s().ok().cloned()).collect())
            .unwrap_or_default();

        Some(WebhookConfig {
            webhook_id,
            name: item
                .get("name")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            url: item
                .get("url")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            auth_type: item
                .get("authType")
                .and_then(|v| v.as_s().ok())
                .map(|s| Self::parse_auth_type(s))
                .unwrap_or_default(),
            auth_header: item.get("authHeader").and_then(|v| v.as_s().ok()).cloned(),
            auth_value: item.get("authValue").and_then(|v| v.as_s().ok()).cloned(),
            events,
            is_active: item
                .get("isActive")
                .and_then(|v| v.as_bool().ok())
                .copied()
                .unwrap_or(false),
        })
    }
}

#[async_trait]
impl WebhookConfigRepository for DynamoDbWebhookRepository {
    #[instrument(skip(self), fields(table = %self.table_name))]
    async fn list_active_configs(&self) -> Result<Vec<WebhookConfig>> {
        let result = self
            .client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(true))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let configs: Vec<WebhookConfig> = result
            .items
            .unwrap_or_default()
            .iter()
            .filter_map(Self::parse_webhook_item)
            .collect();

        info!(count = configs.len(), "Listed active webhook configs");
        Ok(configs)
    }

    #[instrument(skip(self), fields(table = %self.table_name))]
    async fn increment_success(&self, webhook_id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.client
            .update_item()
            .table_name(&self.table_name)
            .key("webhookId", AttributeValue::S(webhook_id.to_string()))
            .update_expression(
                "SET successCount = if_not_exists(successCount, :zero) + :one, lastTriggeredAt = :now",
            )
            .expression_attribute_values(":zero", AttributeValue::N("0".to_string()))
            .expression_attribute_values(":one", AttributeValue::N("1".to_string()))
            .expression_attribute_values(":now", AttributeValue::S(now))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.table_name))]
    async fn increment_failure(&self, webhook_id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.client
            .update_item()
            .table_name(&self.table_name)
            .key("webhookId", AttributeValue::S(webhook_id.to_string()))
            .update_expression(
                "SET failureCount = if_not_exists(failureCount, :zero) + :one, lastTriggeredAt = :now",
            )
            .expression_attribute_values(":zero", AttributeValue::N("0".to_string()))
            .expression_attribute_values(":one", AttributeValue::N("1".to_string()))
            .expression_attribute_values(":now", AttributeValue::S(now))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
