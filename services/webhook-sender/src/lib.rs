pub mod application;
pub mod config;
pub mod domain;
pub mod infrastructure;

use aws_lambda_events::event::sqs::{BatchItemFailure, SqsBatchResponse, SqsEvent};
use lambda_runtime::{Error, LambdaEvent};
use tracing::{error, info};

use crate::application::deliver_webhooks;
use crate::config::Config;
use crate::domain::SqsMessageBody;
use crate::infrastructure::DynamoDbWebhookRepository;

/// SQS event handler - processes messages and delivers webhooks
pub async fn sqs_handler(event: LambdaEvent<SqsEvent>) -> Result<SqsBatchResponse, Error> {
    info!(
        "Received SQS event with {} records",
        event.payload.records.len()
    );

    let config = Config::from_env();

    let repo = match DynamoDbWebhookRepository::new(&config).await {
        Ok(repo) => repo,
        Err(e) => {
            error!("Failed to initialize DynamoDB repository: {}", e);
            let failures: Vec<BatchItemFailure> = event
                .payload
                .records
                .iter()
                .map(|record| BatchItemFailure {
                    item_identifier: record.message_id.clone().unwrap_or_default(),
                })
                .collect();
            return Ok(SqsBatchResponse {
                batch_item_failures: failures,
            });
        }
    };

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
        deliver_webhooks(&repo, &message, &config).await;
    }

    Ok(SqsBatchResponse {
        batch_item_failures: failures,
    })
}
