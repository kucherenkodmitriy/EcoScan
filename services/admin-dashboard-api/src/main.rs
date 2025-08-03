use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use tracing_subscriber::fmt;

async fn function_handler(_event: LambdaEvent<serde_json::Value>) -> Result<serde_json::Value, Error> {
    // TODO: Implement admin dashboard API logic
    Ok(serde_json::json!({
        "statusCode": 200,
        "body": "Admin Dashboard API - Coming Soon"
    }))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    run(service_fn(function_handler)).await
}
