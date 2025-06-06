pub mod error;
pub mod domain;
pub mod application;
pub mod infrastructure;

use lambda_runtime::{Error, LambdaEvent};
use tracing::info;

use crate::application::handle_status_update;
use crate::domain::{StatusUpdateRequest, StatusUpdateResponse};
use crate::infrastructure::dynamodb::DynamoDbRepository;

pub use error::AppError;

pub async fn update_bin_status(
    event: LambdaEvent<StatusUpdateRequest>,
) -> Result<StatusUpdateResponse, Error> {
    info!("Received request: {:?}", event);

    let repo = DynamoDbRepository::new().await?;
    let response = handle_status_update(&repo, event.payload).await?;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use lambda_runtime::LambdaEvent;
    use uuid::Uuid;
    use crate::domain::{BinStatus, StatusUpdateRequest};

    #[tokio::test]
    #[ignore]
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

