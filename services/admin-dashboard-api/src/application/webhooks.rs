use tracing::{info, instrument};
use uuid::Uuid;

use crate::domain::{
    AppError, CreateWebhookRequest, Result, UpdateWebhookRequest, WebhookAuthType, WebhookConfig,
    WebhookInfo, WebhookRepository,
};

/// List all webhooks
#[instrument(skip(repo))]
pub async fn list_webhooks(repo: &dyn WebhookRepository) -> Result<Vec<WebhookInfo>> {
    let webhooks = repo.list_webhooks().await?;
    let infos: Vec<WebhookInfo> = webhooks.iter().map(WebhookInfo::from).collect();
    info!(count = infos.len(), "Listed all webhooks");
    Ok(infos)
}

/// Get a single webhook by ID
#[instrument(skip(repo))]
pub async fn get_webhook(repo: &dyn WebhookRepository, webhook_id: &str) -> Result<WebhookInfo> {
    let config = repo
        .get_webhook(webhook_id)
        .await?
        .ok_or_else(|| AppError::WebhookNotFound(webhook_id.to_string()))?;
    Ok(WebhookInfo::from(&config))
}

/// Create a new webhook
#[instrument(skip(repo, request))]
pub async fn create_webhook(
    repo: &dyn WebhookRepository,
    request: CreateWebhookRequest,
) -> Result<WebhookInfo> {
    // Validate input
    if request.name.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Webhook name is required".to_string(),
        ));
    }

    if request.url.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Webhook URL is required".to_string(),
        ));
    }

    if !request.url.starts_with("http://") && !request.url.starts_with("https://") {
        return Err(AppError::ValidationError(
            "Webhook URL must start with http:// or https://".to_string(),
        ));
    }

    let webhook_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    let config = WebhookConfig {
        webhook_id: webhook_id.clone(),
        name: request.name,
        url: request.url,
        auth_type: request.auth_type.unwrap_or(WebhookAuthType::None),
        auth_header: request.auth_header,
        auth_value: request.auth_value,
        events: request
            .events
            .unwrap_or_else(|| vec!["bin.status.updated".to_string()]),
        is_active: true,
        created_at: Some(now),
        updated_at: Some(now),
        last_triggered_at: None,
        success_count: 0,
        failure_count: 0,
    };

    repo.create_webhook(&config).await?;

    info!(webhook_id = %webhook_id, name = %config.name, "Webhook created");

    Ok(WebhookInfo::from(&config))
}

/// Update an existing webhook
#[instrument(skip(repo, request))]
pub async fn update_webhook(
    repo: &dyn WebhookRepository,
    webhook_id: &str,
    request: UpdateWebhookRequest,
) -> Result<WebhookInfo> {
    // Check webhook exists
    let _existing = repo
        .get_webhook(webhook_id)
        .await?
        .ok_or_else(|| AppError::WebhookNotFound(webhook_id.to_string()))?;

    // Validate URL if provided
    if let Some(url) = &request.url {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(AppError::ValidationError(
                "Webhook URL must start with http:// or https://".to_string(),
            ));
        }
    }

    repo.update_webhook(webhook_id, &request).await?;

    // Return updated webhook
    let updated = repo
        .get_webhook(webhook_id)
        .await?
        .ok_or_else(|| AppError::InternalError("Failed to fetch updated webhook".to_string()))?;

    Ok(WebhookInfo::from(&updated))
}

/// Delete a webhook (soft delete)
#[instrument(skip(repo))]
pub async fn delete_webhook(repo: &dyn WebhookRepository, webhook_id: &str) -> Result<()> {
    // Check webhook exists
    let _existing = repo
        .get_webhook(webhook_id)
        .await?
        .ok_or_else(|| AppError::WebhookNotFound(webhook_id.to_string()))?;

    repo.delete_webhook(webhook_id).await?;

    info!(webhook_id = %webhook_id, "Webhook deactivated");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    struct MockWebhookRepository {
        webhooks: Arc<Mutex<Vec<WebhookConfig>>>,
    }

    impl MockWebhookRepository {
        fn new() -> Self {
            Self {
                webhooks: Arc::new(Mutex::new(Vec::new())),
            }
        }

        fn with_webhooks(webhooks: Vec<WebhookConfig>) -> Self {
            Self {
                webhooks: Arc::new(Mutex::new(webhooks)),
            }
        }
    }

    #[async_trait]
    impl WebhookRepository for MockWebhookRepository {
        async fn list_webhooks(&self) -> Result<Vec<WebhookConfig>> {
            Ok(self.webhooks.lock().unwrap().clone())
        }

        async fn get_webhook(&self, webhook_id: &str) -> Result<Option<WebhookConfig>> {
            let webhooks = self.webhooks.lock().unwrap();
            Ok(webhooks
                .iter()
                .find(|w| w.webhook_id == webhook_id)
                .cloned())
        }

        async fn create_webhook(&self, webhook: &WebhookConfig) -> Result<()> {
            self.webhooks.lock().unwrap().push(webhook.clone());
            Ok(())
        }

        async fn update_webhook(
            &self,
            webhook_id: &str,
            request: &UpdateWebhookRequest,
        ) -> Result<()> {
            let mut webhooks = self.webhooks.lock().unwrap();
            if let Some(w) = webhooks.iter_mut().find(|w| w.webhook_id == webhook_id) {
                if let Some(name) = &request.name {
                    w.name = name.clone();
                }
                if let Some(url) = &request.url {
                    w.url = url.clone();
                }
                if let Some(auth_type) = &request.auth_type {
                    w.auth_type = auth_type.clone();
                }
                if let Some(is_active) = request.is_active {
                    w.is_active = is_active;
                }
            }
            Ok(())
        }

        async fn delete_webhook(&self, webhook_id: &str) -> Result<()> {
            let mut webhooks = self.webhooks.lock().unwrap();
            if let Some(w) = webhooks.iter_mut().find(|w| w.webhook_id == webhook_id) {
                w.is_active = false;
            }
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_create_webhook() {
        let repo = MockWebhookRepository::new();

        let request = CreateWebhookRequest {
            name: "Test Webhook".to_string(),
            url: "https://example.com/webhook".to_string(),
            auth_type: Some(WebhookAuthType::ApiKey),
            auth_header: Some("X-Api-Key".to_string()),
            auth_value: Some("secret123".to_string()),
            events: None,
        };

        let result = create_webhook(&repo, request).await.unwrap();

        assert_eq!(result.name, "Test Webhook");
        assert_eq!(result.url, "https://example.com/webhook");
        assert_eq!(result.auth_type, WebhookAuthType::ApiKey);
        assert!(result.is_active);
        assert_eq!(result.events, vec!["bin.status.updated"]);
    }

    #[tokio::test]
    async fn test_create_webhook_empty_name() {
        let repo = MockWebhookRepository::new();

        let request = CreateWebhookRequest {
            name: "   ".to_string(),
            url: "https://example.com".to_string(),
            auth_type: None,
            auth_header: None,
            auth_value: None,
            events: None,
        };

        let result = create_webhook(&repo, request).await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_create_webhook_invalid_url() {
        let repo = MockWebhookRepository::new();

        let request = CreateWebhookRequest {
            name: "Test".to_string(),
            url: "not-a-url".to_string(),
            auth_type: None,
            auth_header: None,
            auth_value: None,
            events: None,
        };

        let result = create_webhook(&repo, request).await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_get_webhook_not_found() {
        let repo = MockWebhookRepository::new();
        let result = get_webhook(&repo, "nonexistent").await;
        assert!(matches!(result, Err(AppError::WebhookNotFound(_))));
    }

    #[tokio::test]
    async fn test_list_webhooks() {
        let webhooks = vec![WebhookConfig {
            webhook_id: "test-1".to_string(),
            name: "Webhook 1".to_string(),
            url: "https://example.com/hook".to_string(),
            auth_type: WebhookAuthType::None,
            auth_header: None,
            auth_value: Some("secret".to_string()),
            events: vec!["bin.status.updated".to_string()],
            is_active: true,
            created_at: None,
            updated_at: None,
            last_triggered_at: None,
            success_count: 5,
            failure_count: 1,
        }];

        let repo = MockWebhookRepository::with_webhooks(webhooks);
        let result = list_webhooks(&repo).await.unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Webhook 1");
        // Verify auth_value is not exposed in WebhookInfo
        // (WebhookInfo doesn't have auth_value field)
    }

    #[tokio::test]
    async fn test_delete_webhook() {
        let webhooks = vec![WebhookConfig {
            webhook_id: "test-1".to_string(),
            name: "Webhook 1".to_string(),
            url: "https://example.com/hook".to_string(),
            auth_type: WebhookAuthType::None,
            auth_header: None,
            auth_value: None,
            events: vec![],
            is_active: true,
            created_at: None,
            updated_at: None,
            last_triggered_at: None,
            success_count: 0,
            failure_count: 0,
        }];

        let repo = MockWebhookRepository::with_webhooks(webhooks);
        let result = delete_webhook(&repo, "test-1").await;
        assert!(result.is_ok());
    }
}
