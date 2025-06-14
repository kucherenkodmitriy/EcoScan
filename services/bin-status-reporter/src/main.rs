use lambda_runtime::{run, service_fn, Error};
use tracing_subscriber::fmt;
use bin_status_reporter::api_gateway_handler;

#[tokio::main]
async fn main() -> Result<(), Error> {
    fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Use the API Gateway handler as the main entry point
    run(service_fn(api_gateway_handler)).await
}
