pub mod error;
pub mod domain;
pub mod application;
pub mod infrastructure;

use lambda_runtime::{Error, LambdaEvent};
use tracing::{info, error};

use crate::application::handle_status_update;
use crate::domain::{StatusUpdateRequest, StatusUpdateResponse};
use crate::infrastructure::dynamodb::DynamoDbRepository;

pub use error::AppError;

pub async fn update_bin_status(
    event: LambdaEvent<StatusUpdateRequest>,
) -> Result<StatusUpdateResponse, Error> {
    info!(
        "Lambda invocation started - RequestId: {:?}, BinId: {}, Status: {}", 
        event.context.request_id, 
        event.payload.bin_id, 
        event.payload.status
    );

    let repo = match DynamoDbRepository::new().await {
        Ok(repo) => {
            info!("Successfully initialized DynamoDB repository");
            repo
        }
        Err(e) => {
            error!("Failed to initialize DynamoDB repository: {}", e);
            return Err(Box::new(e));
        }
    };

    match handle_status_update(&repo, event.payload).await {
        Ok(response) => {
            info!(
                "Status update completed successfully - Message: {}, Timestamp: {}", 
                response.message, 
                response.updated_at
            );
            Ok(response)
        }
        Err(e) => {
            error!("Status update failed: {}", e);
            Err(Box::new(e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lambda_runtime::LambdaEvent;
    use uuid::Uuid;
    use crate::domain::{BinStatus, StatusUpdateRequest};
    use crate::infrastructure::test_utils;

    #[tokio::test]
    async fn test_update_bin_status() {
        // Setup LocalStack environment
        test_utils::setup_localstack_env();

        // Use the bin ID we know exists in LocalStack from our previous testing
        let bin_id = "550e8400-e29b-41d4-a716-446655440000".parse().unwrap();
        let request = StatusUpdateRequest {
            bin_id,
            status: BinStatus::full(),
        };

        let event = LambdaEvent::new(request, Default::default());
        let response = update_bin_status(event).await.unwrap();

        assert!(response.success);
        assert!(response.message.contains("Bin status updated to Full"));
    }

    #[tokio::test]
    async fn test_update_bin_status_with_custom_value() {
        // Setup LocalStack environment
        test_utils::setup_localstack_env();

        // Use the bin ID we know exists in LocalStack from our previous testing
        let bin_id = "550e8400-e29b-41d4-a716-446655440000".parse().unwrap();
        let request = StatusUpdateRequest {
            bin_id,
            status: BinStatus::new(7).unwrap(),
        };

        let event = LambdaEvent::new(request, Default::default());
        let response = update_bin_status(event).await.unwrap();

        assert!(response.success);
        assert!(response.message.contains("70%"));
    }
}
