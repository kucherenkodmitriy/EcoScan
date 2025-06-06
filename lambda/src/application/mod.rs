use chrono::Utc;

use crate::domain::{BinRepository, StatusUpdateRequest, StatusUpdateResponse};
use crate::error::AppError;

pub async fn handle_status_update<R: BinRepository>(
    repo: &R,
    request: StatusUpdateRequest,
) -> Result<StatusUpdateResponse, AppError> {
    let timestamp = Utc::now();
    repo.update_status(&request.bin_id, request.status.clone(), timestamp)
        .await?;
    repo.add_report(&request.bin_id, request.status, timestamp).await?;

    Ok(StatusUpdateResponse {
        success: true,
        message: format!("Bin status updated to {}", request.status),
        updated_at: timestamp,
    })
}
