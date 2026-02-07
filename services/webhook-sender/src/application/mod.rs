use std::time::Duration;

use reqwest::Client;
use tracing::{error, info, warn};

use crate::config::Config;
use crate::domain::{
    AuthType, SqsMessageBody, WebhookConfig, WebhookConfigRepository, WebhookEvent,
    WebhookEventData,
};

/// Build the webhook event payload from an SQS message
fn build_event(message: &SqsMessageBody) -> WebhookEvent {
    let now = chrono::Utc::now().to_rfc3339();
    WebhookEvent {
        event: "bin.status.updated".to_string(),
        version: "1.0".to_string(),
        timestamp: now.clone(),
        data: WebhookEventData {
            bin_id: message.bin_id.clone(),
            status: message.status,
            source: message.source.clone().unwrap_or_else(|| "qr".to_string()),
            reported_at: now,
        },
    }
}

/// Deliver a webhook event to all active webhook configurations
pub async fn deliver_webhooks(
    repo: &dyn WebhookConfigRepository,
    message: &SqsMessageBody,
    config: &Config,
) {
    let configs = match repo.list_active_configs().await {
        Ok(c) => c,
        Err(e) => {
            error!(error = %e, "Failed to load webhook configs");
            return;
        }
    };

    if configs.is_empty() {
        info!("No active webhook configs found, skipping delivery");
        return;
    }

    let event = build_event(message);
    let event_type = &event.event;

    let http_client = match Client::builder()
        .timeout(Duration::from_secs(config.webhook_timeout_secs))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            error!(error = %e, "Failed to create HTTP client");
            return;
        }
    };

    for webhook in &configs {
        // Check if this webhook is subscribed to this event type
        if !webhook.events.is_empty() && !webhook.events.contains(event_type) {
            info!(
                webhook_id = %webhook.webhook_id,
                webhook_name = %webhook.name,
                "Webhook not subscribed to event type, skipping"
            );
            continue;
        }

        match deliver_single(&http_client, webhook, &event).await {
            Ok(()) => {
                info!(
                    webhook_id = %webhook.webhook_id,
                    webhook_name = %webhook.name,
                    url = %webhook.url,
                    "Webhook delivered successfully"
                );
                if let Err(e) = repo.increment_success(&webhook.webhook_id).await {
                    warn!(error = %e, "Failed to increment success counter");
                }
            }
            Err(e) => {
                error!(
                    webhook_id = %webhook.webhook_id,
                    webhook_name = %webhook.name,
                    url = %webhook.url,
                    error = %e,
                    "Webhook delivery failed"
                );
                if let Err(e) = repo.increment_failure(&webhook.webhook_id).await {
                    warn!(error = %e, "Failed to increment failure counter");
                }
            }
        }
    }
}

/// Deliver the event to a single webhook endpoint
async fn deliver_single(
    client: &Client,
    webhook: &WebhookConfig,
    event: &WebhookEvent,
) -> std::result::Result<(), String> {
    let mut request = client
        .post(&webhook.url)
        .header("Content-Type", "application/json");

    // Add authentication header based on auth type
    match &webhook.auth_type {
        AuthType::ApiKey => {
            if let (Some(header), Some(value)) = (&webhook.auth_header, &webhook.auth_value) {
                request = request.header(header.as_str(), value.as_str());
            }
        }
        AuthType::Bearer => {
            if let Some(value) = &webhook.auth_value {
                request = request.header("Authorization", format!("Bearer {}", value));
            }
        }
        AuthType::None => {}
    }

    let response = request
        .json(event)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = response.status();
    if status.is_success() {
        Ok(())
    } else {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "failed to read body".to_string());
        Err(format!("HTTP {} - {}", status, body))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_event() {
        let message = SqsMessageBody {
            bin_id: "test-bin-id".to_string(),
            status: 75,
            source: Some("iot".to_string()),
        };

        let event = build_event(&message);

        assert_eq!(event.event, "bin.status.updated");
        assert_eq!(event.version, "1.0");
        assert_eq!(event.data.bin_id, "test-bin-id");
        assert_eq!(event.data.status, 75);
        assert_eq!(event.data.source, "iot");
    }

    #[test]
    fn test_build_event_default_source() {
        let message = SqsMessageBody {
            bin_id: "test-bin-id".to_string(),
            status: 50,
            source: None,
        };

        let event = build_event(&message);
        assert_eq!(event.data.source, "qr");
    }
}
