mod error;
mod models;

use lambda_runtime::{Error, LambdaEvent};
use models::{StatusUpdateRequest, StatusUpdateResponse};
use tracing::info;

pub use error::AppError;

pub async fn update_bin_status(
    event: LambdaEvent<StatusUpdateRequest>,
) -> Result<StatusUpdateResponse, Error> {
    info!("Received request: {:?}", event);

    // TODO: Implement bin status update logic
    Ok(StatusUpdateResponse {
        success: true,
        message: format!("Bin status updated to {:?}", event.payload.status),
        updated_at: chrono::Utc::now(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use lambda_runtime::LambdaEvent;
    use models::{BinStatus, StatusUpdateRequest};
    use uuid::Uuid;

    #[tokio::test]
    async fn test_update_bin_status() {
        let request = StatusUpdateRequest {
            bin_id: Uuid::new_v4(),
            status: BinStatus::Full,
        };

        let event = LambdaEvent::new(request, Default::default());
        let response = update_bin_status(event).await.unwrap();

        assert!(response.success);
        assert!(response.message.contains("Bin status updated to Full"));
    }
}
