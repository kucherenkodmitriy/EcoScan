use std::sync::Arc;

use bin_status_reporter::create_handler;
use bin_status_reporter::infrastructure::dynamodb::DynamoDbRepository;
use lambda_runtime::{run, service_fn, Error};
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize structured logging with JSON format for CloudWatch
    // Includes span information for correlation IDs
    fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time() // CloudWatch adds timestamp
        .with_span_events(FmtSpan::CLOSE) // Log when spans close
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .json() // Use JSON format for structured logging
        .init();

    // Create DynamoDB repository once at cold start
    let repo =
        Arc::new(DynamoDbRepository::new().await.map_err(|e| {
            Error::from(format!("Failed to initialize DynamoDB repository: {}", e))
        })?);

    run(service_fn(create_handler(repo))).await
}
