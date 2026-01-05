use bin_status_reporter::sqs_handler;
use lambda_runtime::{run, service_fn, Error};
use tracing_subscriber::fmt;

#[tokio::main]
async fn main() -> Result<(), Error> {
    fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Use the SQS handler as the main entry point
    run(service_fn(sqs_handler)).await
}
