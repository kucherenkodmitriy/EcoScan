use lambda_runtime::{run, service_fn, Error};
use tracing_subscriber::fmt;
use bin_status_reporter::update_bin_status;

#[tokio::main]
async fn main() -> Result<(), Error> {
    fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    run(service_fn(update_bin_status)).await
}
