use std::net::IpAddr;
use tracing::{info, instrument};
use url::Url;
use uuid::Uuid;

use crate::domain::{
    AppError, CreateWebhookRequest, Result, UpdateWebhookRequest, WebhookAuthType, WebhookConfig,
    WebhookInfo, WebhookRepository,
};

/// Check if an IP address is a private/reserved address
fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()          // 127.0.0.0/8
                || v4.is_private()    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                || v4.is_link_local() // 169.254.0.0/16 (blocks AWS metadata endpoint)
                || v4.is_unspecified() // 0.0.0.0
                || v4.is_broadcast() // 255.255.255.255
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()          // ::1
                || v6.is_unspecified() // ::
        }
    }
}

/// Validate a webhook URL to prevent SSRF attacks.
/// Blocks private IPs, localhost, link-local, and internal hostnames.
fn validate_webhook_url(url_str: &str) -> Result<()> {
    let parsed = Url::parse(url_str)
        .map_err(|_| AppError::ValidationError("Invalid webhook URL format".to_string()))?;

    // Must be http or https
    match parsed.scheme() {
        "http" | "https" => {}
        _ => {
            return Err(AppError::ValidationError(
                "Webhook URL must use http or https scheme".to_string(),
            ));
        }
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| AppError::ValidationError("Webhook URL must have a host".to_string()))?;

    // Block localhost and internal hostnames
    let host_lower = host.to_lowercase();
    if host_lower == "localhost"
        || host_lower.ends_with(".local")
        || host_lower.ends_with(".internal")
        || host_lower.ends_with(".localhost")
    {
        return Err(AppError::ValidationError(
            "Webhook URL must not point to localhost or internal hosts".to_string(),
        ));
    }

    // If the host is an IP address, check if it's private
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err(AppError::ValidationError(
                "Webhook URL must not point to a private or reserved IP address".to_string(),
            ));
        }
    }

    // Also check bracket-stripped IPv6 (url crate strips brackets)
    let stripped = host.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = stripped.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err(AppError::ValidationError(
                "Webhook URL must not point to a private or reserved IP address".to_string(),
            ));
        }
    }

    Ok(())
}

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

    validate_webhook_url(&request.url)?;

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
        validate_webhook_url(url)?;
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
    async fn test_create_webhook_localhost_blocked() {
        let repo = MockWebhookRepository::new();

        let request = CreateWebhookRequest {
            name: "Test".to_string(),
            url: "http://localhost:8080/hook".to_string(),
            auth_type: None,
            auth_header: None,
            auth_value: None,
            events: None,
        };

        let result = create_webhook(&repo, request).await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_create_webhook_private_ip_blocked() {
        let repo = MockWebhookRepository::new();

        for url in &[
            "http://127.0.0.1/hook",
            "http://10.0.0.1/hook",
            "http://172.16.0.1/hook",
            "http://192.168.1.1/hook",
            "http://169.254.169.254/latest/meta-data/",
        ] {
            let request = CreateWebhookRequest {
                name: "Test".to_string(),
                url: url.to_string(),
                auth_type: None,
                auth_header: None,
                auth_value: None,
                events: None,
            };

            let result = create_webhook(&repo, request).await;
            assert!(
                matches!(result, Err(AppError::ValidationError(_))),
                "Expected error for URL: {}",
                url
            );
        }
    }

    #[tokio::test]
    async fn test_create_webhook_valid_public_url() {
        let repo = MockWebhookRepository::new();

        let request = CreateWebhookRequest {
            name: "Public Webhook".to_string(),
            url: "https://hooks.example.com/callback".to_string(),
            auth_type: None,
            auth_header: None,
            auth_value: None,
            events: None,
        };

        let result = create_webhook(&repo, request).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_create_webhook_missing_scheme() {
        let repo = MockWebhookRepository::new();

        let request = CreateWebhookRequest {
            name: "Test".to_string(),
            url: "example.com/hook".to_string(),
            auth_type: None,
            auth_header: None,
            auth_value: None,
            events: None,
        };

        let result = create_webhook(&repo, request).await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_create_webhook_internal_hostname_blocked() {
        let repo = MockWebhookRepository::new();

        let request = CreateWebhookRequest {
            name: "Test".to_string(),
            url: "http://service.internal/hook".to_string(),
            auth_type: None,
            auth_header: None,
            auth_value: None,
            events: None,
        };

        let result = create_webhook(&repo, request).await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
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
