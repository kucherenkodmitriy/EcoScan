pub mod application;
pub mod domain;
pub mod infrastructure;

pub use domain::error::AppError;

use std::sync::Arc;

use aws_lambda_events::event::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use aws_lambda_events::event::sqs::{BatchItemFailure, SqsBatchResponse, SqsEvent};
use aws_lambda_events::http::HeaderMap;
use lambda_runtime::{Error, LambdaEvent};
use serde::Deserialize;
use tracing::{error, info, info_span, Instrument};
use uuid::Uuid;

use crate::application::handle_status_update;
use crate::domain::{BinStatus, ReportSource, StatusUpdateRequest};
use crate::infrastructure::dynamodb::DynamoDbRepository;

#[derive(Debug, Deserialize)]
struct StatusUpdateBody {
    status: i32,
    #[serde(default)]
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SqsMessageBody {
    #[serde(rename = "binId")]
    bin_id: String,
    status: i32,
    #[serde(default)]
    source: Option<String>,
}

/// Create the Lambda handler with shared DynamoDB repository
#[allow(clippy::type_complexity)]
pub fn create_handler(
    repo: Arc<DynamoDbRepository>,
) -> impl Fn(
    LambdaEvent<SqsEvent>,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<SqsBatchResponse, Error>> + Send>,
> + Send
       + Sync {
    move |event| {
        let repo = repo.clone();
        Box::pin(async move { sqs_handler_inner(event, &repo).await })
    }
}

// SQS event handler - processes messages from the SQS queue
async fn sqs_handler_inner(
    event: LambdaEvent<SqsEvent>,
    repo: &DynamoDbRepository,
) -> Result<SqsBatchResponse, Error> {
    info!(
        "Received SQS event with {} records",
        event.payload.records.len()
    );

    let mut failures = Vec::new();

    for record in event.payload.records {
        let message_id = record.message_id.clone().unwrap_or_default();

        // Extract correlation IDs from SQS message attributes
        let request_id = record
            .message_attributes
            .get("RequestId")
            .and_then(|attr| attr.string_value.as_ref())
            .map(|s| s.as_str())
            .unwrap_or("unknown");

        let trace_id = record
            .message_attributes
            .get("TraceId")
            .and_then(|attr| attr.string_value.as_ref())
            .map(|s| s.as_str())
            .unwrap_or("unknown");

        let source_ip = record
            .message_attributes
            .get("SourceIp")
            .and_then(|attr| attr.string_value.as_ref())
            .map(|s| s.as_str())
            .unwrap_or("unknown");

        // Create a tracing span with correlation IDs for structured logging
        let span = info_span!(
            "process_message",
            message_id = %message_id,
            request_id = %request_id,
            trace_id = %trace_id,
            source_ip = %source_ip
        );

        // Process the record within the span context
        match process_sqs_record(repo, &record)
            .instrument(span.clone())
            .await
        {
            Ok(_) => {
                info!(
                    parent: &span,
                    "Successfully processed message"
                );
            }
            Err(e) => {
                error!(
                    parent: &span,
                    error = %e,
                    "Failed to process message"
                );
                failures.push(BatchItemFailure {
                    item_identifier: message_id,
                });
            }
        }
    }

    Ok(SqsBatchResponse {
        batch_item_failures: failures,
    })
}

async fn process_sqs_record(
    repo: &DynamoDbRepository,
    record: &aws_lambda_events::event::sqs::SqsMessage,
) -> Result<(), Error> {
    let body = record
        .body
        .as_ref()
        .ok_or_else(|| Error::from("Missing message body"))?;

    info!("Processing SQS message body: {}", body);

    // Parse the message body
    let message: SqsMessageBody = serde_json::from_str(body)
        .map_err(|e| Error::from(format!("Failed to parse message body: {}", e)))?;

    // Parse bin_id
    let bin_id = Uuid::parse_str(&message.bin_id)
        .map_err(|e| Error::from(format!("Invalid bin_id format: {}", e)))?;

    // Validate and create status
    let status = BinStatus::new(message.status).map_err(|e| Error::from(e.to_string()))?;

    // Parse source (default to QR if not specified)
    let source = message
        .source
        .as_deref()
        .map(ReportSource::parse)
        .unwrap_or_default();

    let request = StatusUpdateRequest {
        bin_id,
        status,
        source,
    };

    // Process the status update
    handle_status_update(repo, request)
        .await
        .map_err(|e| Error::from(e.to_string()))?;

    info!("Status update successful for bin {}", bin_id);
    Ok(())
}

pub async fn api_gateway_handler(
    event: LambdaEvent<ApiGatewayProxyRequest>,
    repo: &DynamoDbRepository,
) -> Result<ApiGatewayProxyResponse, Error> {
    info!("Received API Gateway event: {:?}", event);

    let request = match parse_request(event.payload) {
        Ok(req) => req,
        Err(resp) => return Ok(resp),
    };

    match handle_status_update(repo, request).await {
        Ok(response) => {
            info!("Status update successful: {}", response.message);
            let body = serde_json::to_string(&response).unwrap_or_default();
            Ok(ApiGatewayProxyResponse {
                status_code: 200,
                body: Some(body.into()),
                headers: {
                    let mut map = HeaderMap::new();
                    map.insert("Content-Type", "application/json".parse().unwrap());
                    map
                },
                ..Default::default()
            })
        }
        Err(e) => {
            error!("Error processing status update: {}", e);
            Ok(build_response(500, "Failed to process status update"))
        }
    }
}

#[allow(clippy::result_large_err)]
fn parse_request(
    event: ApiGatewayProxyRequest,
) -> Result<StatusUpdateRequest, ApiGatewayProxyResponse> {
    let bin_id_str = event
        .path_parameters
        .get("bin_id")
        .ok_or_else(|| build_response(400, "Missing 'bin_id' in path"))?;

    let bin_id =
        Uuid::parse_str(bin_id_str).map_err(|_| build_response(400, "Invalid 'bin_id' format"))?;

    let body_str = event.body.as_deref().unwrap_or("");
    let update_body: StatusUpdateBody =
        serde_json::from_str(body_str).map_err(|_| build_response(400, "Invalid request body"))?;

    let status = BinStatus::new(update_body.status as i32)
        .map_err(|e| build_response(400, &e.to_string()))?;

    // Parse source (default to QR if not specified)
    let source = update_body
        .source
        .as_deref()
        .map(ReportSource::parse)
        .unwrap_or_default();

    Ok(StatusUpdateRequest {
        bin_id,
        status,
        source,
    })
}

fn build_response(status_code: i64, body: &str) -> ApiGatewayProxyResponse {
    ApiGatewayProxyResponse {
        status_code,
        body: Some(serde_json::json!({ "error": body }).to_string().into()),
        headers: {
            let mut map = HeaderMap::new();
            map.insert("Content-Type", "application/json".parse().unwrap());
            map
        },
        ..Default::default()
    }
}
