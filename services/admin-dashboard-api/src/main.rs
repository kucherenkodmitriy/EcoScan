use std::sync::Arc;

use lambda_runtime::{run, service_fn, Error};
use tracing::{error, info};
use tracing_subscriber::fmt;

use admin_dashboard_api::config::Config;
use admin_dashboard_api::infrastructure::{DynamoDbRepository, EmailService};
use admin_dashboard_api::{create_handler, AppState};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize structured JSON logging for CloudWatch
    fmt()
        .json()
        .with_max_level(tracing::Level::INFO)
        .with_current_span(false)
        .with_span_events(tracing_subscriber::fmt::format::FmtSpan::CLOSE)
        .without_time() // CloudWatch adds timestamps
        .init();

    info!("Admin Dashboard API Lambda starting");

    // Load configuration with secrets at cold start
    // This fetches JWT secret from Secrets Manager (or env var for local dev)
    let config = match Config::from_env_with_secrets().await {
        Ok(c) => c,
        Err(e) => {
            error!(error = %e, "Failed to load configuration");
            return Err(Error::from(e));
        }
    };

    info!("Configuration loaded successfully");

    // Initialize email service for password reset emails
    let email_service = match EmailService::new(
        config.from_email.clone().unwrap_or_default(),
        config.dynamodb_endpoint.as_deref(),
    )
    .await
    {
        Ok(svc) => svc,
        Err(e) => {
            error!(error = %e, "Failed to initialize email service");
            return Err(Error::from(e.to_string()));
        }
    };

    // Initialize DynamoDB repository at cold start
    let repo = match DynamoDbRepository::new(&config).await {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "Failed to initialize DynamoDB repository");
            return Err(Error::from(e.to_string()));
        }
    };

    // Create shared application state
    let state = AppState {
        config: Arc::new(config),
        email_service: Arc::new(email_service),
        repo: Arc::new(repo),
    };

    // Run Lambda with the handler that has access to shared state
    run(service_fn(create_handler(state))).await
}
