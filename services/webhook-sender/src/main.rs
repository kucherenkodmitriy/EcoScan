use std::sync::Arc;

use lambda_runtime::{run, service_fn, Error};
use tracing::error;
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::{fmt, EnvFilter};
use webhook_sender::config::Config;
use webhook_sender::infrastructure::DynamoDbWebhookRepository;
use webhook_sender::{create_handler, WebhookState};

#[tokio::main]
async fn main() -> Result<(), Error> {
    fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .with_span_events(FmtSpan::CLOSE)
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .json()
        .init();

    let config = Config::from_env();

    let repo = match DynamoDbWebhookRepository::new(&config).await {
        Ok(repo) => repo,
        Err(e) => {
            error!("Failed to initialize DynamoDB repository: {}", e);
            return Err(Error::from(format!(
                "Failed to initialize DynamoDB repository: {}",
                e
            )));
        }
    };

    let state = Arc::new(WebhookState { config, repo });

    run(service_fn(create_handler(state))).await
}
