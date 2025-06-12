use chrono::Utc;
use tracing::{info, error};

use crate::domain::{BinRepository, StatusUpdateRequest, StatusUpdateResponse};
use crate::error::AppError;

pub async fn handle_status_update<R: BinRepository>(
    repo: &R,
    request: StatusUpdateRequest,
) -> Result<StatusUpdateResponse, AppError> {
    info!("Processing status update for bin: {}", request.bin_id);
    
    let timestamp = Utc::now();
    let status = request.status.clone();
    
    info!("Updating bin status to: {} (value: {})", status, status.value());
    
    match repo.update_status(&request.bin_id, status.clone(), timestamp).await {
        Ok(_) => {
            info!("Successfully updated bin status in database");
        }
        Err(e) => {
            error!("Failed to update bin status: {}", e);
            return Err(e);
        }
    }
    
    match repo.add_report(&request.bin_id, status.clone(), timestamp).await {
        Ok(_) => {
            info!("Successfully added status report to database");
        }
        Err(e) => {
            error!("Failed to add status report: {}", e);
            return Err(e);
        }
    }

    let response = StatusUpdateResponse {
        success: true,
        message: format!("Bin status updated to {}", request.status),
        updated_at: timestamp,
    };
    
    info!("Status update completed successfully: {}", response.message);
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::BinStatus;
    use chrono::{DateTime, Utc};
    use uuid::Uuid;
    use async_trait::async_trait;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    // Mock repository for isolated unit testing
    #[derive(Debug, Clone)]
    struct MockBinRepository {
        update_status_calls: Arc<Mutex<Vec<(Uuid, BinStatus, DateTime<Utc>)>>>,
        add_report_calls: Arc<Mutex<Vec<(Uuid, BinStatus, DateTime<Utc>)>>>,
        should_fail_update: Arc<Mutex<bool>>,
        should_fail_report: Arc<Mutex<bool>>,
    }

    impl MockBinRepository {
        fn new() -> Self {
            Self {
                update_status_calls: Arc::new(Mutex::new(Vec::new())),
                add_report_calls: Arc::new(Mutex::new(Vec::new())),
                should_fail_update: Arc::new(Mutex::new(false)),
                should_fail_report: Arc::new(Mutex::new(false)),
            }
        }

        async fn get_update_status_calls(&self) -> Vec<(Uuid, BinStatus, DateTime<Utc>)> {
            self.update_status_calls.lock().await.clone()
        }

        async fn get_add_report_calls(&self) -> Vec<(Uuid, BinStatus, DateTime<Utc>)> {
            self.add_report_calls.lock().await.clone()
        }

        async fn set_should_fail_update(&self, should_fail: bool) {
            *self.should_fail_update.lock().await = should_fail;
        }

        async fn set_should_fail_report(&self, should_fail: bool) {
            *self.should_fail_report.lock().await = should_fail;
        }
    }

    #[async_trait]
    impl BinRepository for MockBinRepository {
        async fn update_status(
            &self,
            bin_id: &Uuid,
            status: BinStatus,
            timestamp: DateTime<Utc>,
        ) -> Result<(), AppError> {
            if *self.should_fail_update.lock().await {
                return Err(AppError::DatabaseError("Mock update failure".to_string()));
            }
            
            self.update_status_calls
                .lock()
                .await
                .push((*bin_id, status, timestamp));
            Ok(())
        }

        async fn add_report(
            &self,
            bin_id: &Uuid,
            status: BinStatus,
            timestamp: DateTime<Utc>,
        ) -> Result<(), AppError> {
            if *self.should_fail_report.lock().await {
                return Err(AppError::DatabaseError("Mock report failure".to_string()));
            }
            
            self.add_report_calls
                .lock()
                .await
                .push((*bin_id, status, timestamp));
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_handle_status_update_success() {
        let mock_repo = MockBinRepository::new();
        let bin_id = Uuid::new_v4();
        let status = BinStatus::new(7).unwrap();
        
        let request = StatusUpdateRequest {
            bin_id,
            status: status.clone(),
        };

        let result = handle_status_update(&mock_repo, request).await;
        
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.success);
        assert_eq!(response.message, "Bin status updated to 70%");
        
        // Verify both repository methods were called
        let update_calls = mock_repo.get_update_status_calls().await;
        let report_calls = mock_repo.get_add_report_calls().await;
        
        assert_eq!(update_calls.len(), 1);
        assert_eq!(report_calls.len(), 1);
        assert_eq!(update_calls[0].0, bin_id);
        assert_eq!(update_calls[0].1, status);
        assert_eq!(report_calls[0].0, bin_id);
        assert_eq!(report_calls[0].1, status);
    }

    #[tokio::test]
    async fn test_handle_status_update_empty_bin() {
        let mock_repo = MockBinRepository::new();
        let bin_id = Uuid::new_v4();
        let status = BinStatus::empty();
        
        let request = StatusUpdateRequest {
            bin_id,
            status: status.clone(),
        };

        let result = handle_status_update(&mock_repo, request).await;
        
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.success);
        assert_eq!(response.message, "Bin status updated to Empty");
    }

    #[tokio::test]
    async fn test_handle_status_update_full_bin() {
        let mock_repo = MockBinRepository::new();
        let bin_id = Uuid::new_v4();
        let status = BinStatus::full();
        
        let request = StatusUpdateRequest {
            bin_id,
            status: status.clone(),
        };

        let result = handle_status_update(&mock_repo, request).await;
        
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.success);
        assert_eq!(response.message, "Bin status updated to Full");
    }

    #[tokio::test]
    async fn test_handle_status_update_fails_on_update_error() {
        let mock_repo = MockBinRepository::new();
        mock_repo.set_should_fail_update(true).await;
        
        let bin_id = Uuid::new_v4();
        let request = StatusUpdateRequest {
            bin_id,
            status: BinStatus::ok(),
        };

        let result = handle_status_update(&mock_repo, request).await;
        
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::DatabaseError(msg) => {
                assert_eq!(msg, "Mock update failure");
            }
            _ => panic!("Expected DatabaseError"),
        }
        
        // Verify update was called but report was not (due to early return)
        let update_calls = mock_repo.get_update_status_calls().await;
        let report_calls = mock_repo.get_add_report_calls().await;
        
        assert_eq!(update_calls.len(), 0); // Mock fails before recording
        assert_eq!(report_calls.len(), 0); // Never reached due to error
    }

    #[tokio::test]
    async fn test_handle_status_update_fails_on_report_error() {
        let mock_repo = MockBinRepository::new();
        mock_repo.set_should_fail_report(true).await;
        
        let bin_id = Uuid::new_v4();
        let request = StatusUpdateRequest {
            bin_id,
            status: BinStatus::ok(),
        };

        let result = handle_status_update(&mock_repo, request).await;
        
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::DatabaseError(msg) => {
                assert_eq!(msg, "Mock report failure");
            }
            _ => panic!("Expected DatabaseError"),
        }
        
        // Verify update was successful but report failed
        let update_calls = mock_repo.get_update_status_calls().await;
        let report_calls = mock_repo.get_add_report_calls().await;
        
        assert_eq!(update_calls.len(), 1); // Update succeeded
        assert_eq!(report_calls.len(), 0); // Report failed before recording
    }

    #[tokio::test]
    async fn test_handle_status_update_response_timestamp() {
        let mock_repo = MockBinRepository::new();
        let bin_id = Uuid::new_v4();
        
        let request = StatusUpdateRequest {
            bin_id,
            status: BinStatus::ok(),
        };

        let before_call = Utc::now();
        let result = handle_status_update(&mock_repo, request).await;
        let after_call = Utc::now();
        
        assert!(result.is_ok());
        let response = result.unwrap();
        
        // Verify timestamp is within reasonable bounds
        assert!(response.updated_at >= before_call);
        assert!(response.updated_at <= after_call);
    }
}
