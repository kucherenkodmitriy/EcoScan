use std::net::{IpAddr, ToSocketAddrs};
use std::time::Duration;

use reqwest::Client;
use tracing::{error, info, warn};

use crate::domain::{
    AuthType, SqsMessageBody, WebhookConfig, WebhookConfigRepository, WebhookEvent,
    WebhookEventData,
};

const MAX_RETRIES: u32 = 2;

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

/// Check if an IP address is private or reserved (SSRF protection)
fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
        }
        IpAddr::V6(v6) => v6.is_loopback() || v6.is_unspecified(),
    }
}

/// Validate a webhook URL at delivery time to prevent SSRF attacks.
/// Resolves DNS and checks that all resolved IPs are public.
fn validate_url_at_delivery(url_str: &str) -> std::result::Result<(), String> {
    let parsed = url::Url::parse(url_str).map_err(|e| format!("Invalid URL: {}", e))?;

    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err("URL must use http or https scheme".to_string()),
    }

    let host = parsed.host_str().ok_or("URL has no host")?;

    // Block obviously internal hostnames
    let host_lower = host.to_lowercase();
    if host_lower == "localhost"
        || host_lower.ends_with(".local")
        || host_lower.ends_with(".internal")
        || host_lower.ends_with(".localhost")
    {
        return Err(format!("URL points to internal host: {}", host));
    }

    // If host parses as an IP, check directly
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err(format!("URL resolves to private/reserved IP: {}", ip));
        }
    }

    // Resolve DNS and check all IPs
    let port = parsed.port_or_known_default().unwrap_or(443);
    let addrs = format!("{}:{}", host, port)
        .to_socket_addrs()
        .map_err(|e| format!("DNS resolution failed: {}", e))?;

    for addr in addrs {
        let ip = addr.ip();
        if is_private_ip(&ip) {
            return Err(format!("URL resolves to private/reserved IP: {}", ip));
        }
    }

    Ok(())
}

/// Deliver a webhook event to all active webhook configurations
pub async fn deliver_webhooks(
    http_client: &Client,
    repo: &dyn WebhookConfigRepository,
    message: &SqsMessageBody,
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

        match deliver_with_retry(http_client, webhook, &event, MAX_RETRIES).await {
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

/// Deliver with retry and exponential backoff
async fn deliver_with_retry(
    client: &Client,
    webhook: &WebhookConfig,
    event: &WebhookEvent,
    max_retries: u32,
) -> std::result::Result<(), String> {
    for attempt in 0..=max_retries {
        match deliver_single(client, webhook, event).await {
            Ok(()) => return Ok(()),
            Err(e) if is_retryable(&e) && attempt < max_retries => {
                let delay = Duration::from_millis(500 * 2u64.pow(attempt));
                warn!(
                    attempt = attempt + 1,
                    delay_ms = delay.as_millis() as u64,
                    error = %e,
                    "Retrying webhook delivery"
                );
                tokio::time::sleep(delay).await;
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}

/// Determine if an error is retryable (server errors, rate limits, connection errors)
fn is_retryable(error: &str) -> bool {
    error.contains("HTTP 5") || error.contains("HTTP 429") || error.contains("request failed")
}

/// Deliver the event to a single webhook endpoint
async fn deliver_single(
    client: &Client,
    webhook: &WebhookConfig,
    event: &WebhookEvent,
) -> std::result::Result<(), String> {
    // SSRF protection: validate URL resolves to public IPs
    validate_url_at_delivery(&webhook.url)?;

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

    #[test]
    fn test_validate_url_blocks_localhost() {
        assert!(validate_url_at_delivery("http://localhost:8080/hook").is_err());
        assert!(validate_url_at_delivery("http://127.0.0.1/hook").is_err());
    }

    #[test]
    fn test_validate_url_blocks_private_ips() {
        assert!(validate_url_at_delivery("http://10.0.0.1/hook").is_err());
        assert!(validate_url_at_delivery("http://192.168.1.1/hook").is_err());
        assert!(validate_url_at_delivery("http://172.16.0.1/hook").is_err());
    }

    #[test]
    fn test_validate_url_blocks_internal_hostnames() {
        assert!(validate_url_at_delivery("http://service.local/hook").is_err());
        assert!(validate_url_at_delivery("http://db.internal/hook").is_err());
    }

    #[test]
    fn test_validate_url_blocks_invalid_schemes() {
        assert!(validate_url_at_delivery("ftp://example.com/hook").is_err());
        assert!(validate_url_at_delivery("file:///etc/passwd").is_err());
    }

    #[test]
    fn test_is_retryable() {
        assert!(is_retryable("HTTP 500 - Internal Server Error"));
        assert!(is_retryable("HTTP 503 - Service Unavailable"));
        assert!(is_retryable("HTTP 429 - Too Many Requests"));
        assert!(is_retryable("HTTP request failed: connection refused"));
        assert!(!is_retryable("HTTP 400 - Bad Request"));
        assert!(!is_retryable("HTTP 404 - Not Found"));
    }

    #[test]
    fn test_is_private_ip() {
        use std::net::Ipv4Addr;
        assert!(is_private_ip(&IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))));
        assert!(is_private_ip(&IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))));
        assert!(is_private_ip(&IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1))));
        assert!(is_private_ip(&IpAddr::V4(Ipv4Addr::new(172, 16, 0, 1))));
        assert!(is_private_ip(&IpAddr::V4(Ipv4Addr::new(169, 254, 1, 1))));
        assert!(!is_private_ip(&IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
    }
}
