pub mod application;
pub mod config;
pub mod domain;
pub mod infrastructure;

use std::sync::Arc;

use aws_lambda_events::event::sqs::{BatchItemFailure, SqsBatchResponse, SqsEvent};
use lambda_runtime::{Error, LambdaEvent};
use reqwest::Client;
use tracing::{error, info};

use crate::application::deliver_webhooks;
use crate::config::Config;
use crate::domain::SqsMessageBody;
use crate::infrastructure::DynamoDbWebhookRepository;

/// Shared state initialized at cold start
pub struct WebhookState {
    pub config: Config,
    pub repo: DynamoDbWebhookRepository,
    pub http_client: Client,
}

/// Create the Lambda handler with shared state
#[allow(clippy::type_complexity)]
pub fn create_handler(
    state: Arc<WebhookState>,
) -> impl Fn(
    LambdaEvent<SqsEvent>,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<SqsBatchResponse, Error>> + Send>,
> + Send
       + Sync {
    move |event| {
        let state = state.clone();
        Box::pin(async move { sqs_handler_inner(event, &state).await })
    }
}

/// SQS event handler - processes messages and delivers webhooks
async fn sqs_handler_inner(
    event: LambdaEvent<SqsEvent>,
    state: &WebhookState,
) -> Result<SqsBatchResponse, Error> {
    info!(
        "Received SQS event with {} records",
        event.payload.records.len()
    );

    let mut failures = Vec::new();

    for record in event.payload.records {
        let message_id = record.message_id.clone().unwrap_or_default();

        let body = match &record.body {
            Some(b) => b,
            None => {
                error!(message_id = %message_id, "Missing message body");
                failures.push(BatchItemFailure {
                    item_identifier: message_id,
                });
                continue;
            }
        };

        let message: SqsMessageBody = match serde_json::from_str(body) {
            Ok(m) => m,
            Err(e) => {
                error!(
                    message_id = %message_id,
                    error = %e,
                    body = %body,
                    "Failed to parse SQS message body"
                );
                // Parse errors won't resolve on retry, so don't report as failure
                continue;
            }
        };

        info!(
            message_id = %message_id,
            bin_id = %message.bin_id,
            status = %message.status,
            "Processing webhook delivery"
        );

        // Deliver webhooks - individual delivery failures are logged but don't fail the message
        deliver_webhooks(&state.http_client, &state.repo, &message).await;
    }

    Ok(SqsBatchResponse {
        batch_item_failures: failures,
    })
}
