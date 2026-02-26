use tracing::{info, instrument, warn};
use uuid::Uuid;

use crate::domain::{
    AppError, BatchResetReportsResponse, BatchResetResult, BinInfo, BinRepository,
    CreateBinRequest, ReportRepository, ResetReportsResponse, Result, UpdateBinRequest,
};

/// List all bins
#[instrument(skip(repo))]
pub async fn list_bins(repo: &dyn BinRepository) -> Result<Vec<BinInfo>> {
    let bins = repo.list_bins().await?;
    info!(count = bins.len(), "Listed all bins");
    Ok(bins)
}

/// Get a single bin by ID
#[instrument(skip(repo))]
pub async fn get_bin(repo: &dyn BinRepository, bin_id: &Uuid) -> Result<BinInfo> {
    repo.get_bin(bin_id)
        .await?
        .ok_or_else(|| AppError::BinNotFound(bin_id.to_string()))
}

/// Create a new bin
#[instrument(skip(repo, request))]
pub async fn create_bin(repo: &dyn BinRepository, request: CreateBinRequest) -> Result<BinInfo> {
    use crate::domain::BinType;

    // Validate input
    if request.name.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Bin name is required".to_string(),
        ));
    }

    // Generate new bin ID
    let bin_id = Uuid::new_v4();

    // Create in database
    repo.create_bin(&bin_id, &request).await?;

    info!(bin_id = %bin_id, name = %request.name, "Bin created");

    // Return the created bin info
    Ok(BinInfo {
        bin_id,
        name: request.name,
        bin_type: request.bin_type.unwrap_or(BinType::Mixed),
        address: request.address,
        coordinates: request.coordinates,
        status: 0,
        reports_count: 0,
        last_updated: Some(chrono::Utc::now()),
        is_active: true,
    })
}

/// Update an existing bin
#[instrument(skip(repo, request))]
pub async fn update_bin(
    repo: &dyn BinRepository,
    bin_id: &Uuid,
    request: UpdateBinRequest,
) -> Result<BinInfo> {
    // Check bin exists
    let _existing = repo
        .get_bin(bin_id)
        .await?
        .ok_or_else(|| AppError::BinNotFound(bin_id.to_string()))?;

    // Update in database
    repo.update_bin(bin_id, &request).await?;

    // Return updated bin
    repo.get_bin(bin_id)
        .await?
        .ok_or_else(|| AppError::InternalError("Failed to fetch updated bin".to_string()))
}

/// Delete (deactivate) a bin
#[instrument(skip(repo))]
pub async fn delete_bin(repo: &dyn BinRepository, bin_id: &Uuid) -> Result<()> {
    // Check bin exists
    let _existing = repo
        .get_bin(bin_id)
        .await?
        .ok_or_else(|| AppError::BinNotFound(bin_id.to_string()))?;

    // Soft delete
    repo.delete_bin(bin_id).await?;

    info!(bin_id = %bin_id, "Bin deactivated");
    Ok(())
}

/// Reset all reports for a bin: archive to archive table, delete from source, reset status to 0
#[instrument(skip(bin_repo, report_repo))]
pub async fn reset_reports(
    bin_repo: &dyn BinRepository,
    report_repo: &dyn ReportRepository,
    bin_id: &Uuid,
    archived_by: &str,
) -> Result<ResetReportsResponse> {
    // Verify bin exists
    bin_repo
        .get_bin(bin_id)
        .await?
        .ok_or_else(|| AppError::BinNotFound(bin_id.to_string()))?;

    // Query all reports
    let reports = report_repo.query_reports(bin_id).await?;
    let count = reports.len();
    let batch_id = Uuid::new_v4().to_string();

    if !reports.is_empty() {
        // Archive to archive table
        report_repo
            .archive_reports(bin_id, &reports, &batch_id, archived_by)
            .await?;

        // Delete from source table
        report_repo.delete_reports(bin_id, &reports).await?;
    }

    // Reset bin status to 0
    report_repo.reset_bin_status(bin_id).await?;

    info!(bin_id = %bin_id, archived = count, batch_id = %batch_id, "Reports reset");

    Ok(ResetReportsResponse {
        archived_count: count,
        archive_batch_id: batch_id,
        message: format!(
            "Successfully archived {} reports and reset bin status",
            count
        ),
    })
}

/// Batch reset reports for multiple bins
#[instrument(skip(bin_repo, report_repo))]
pub async fn batch_reset_reports(
    bin_repo: &dyn BinRepository,
    report_repo: &dyn ReportRepository,
    bin_ids: &[Uuid],
    archived_by: &str,
) -> Result<BatchResetReportsResponse> {
    if bin_ids.is_empty() {
        return Err(AppError::ValidationError(
            "At least one bin ID is required".to_string(),
        ));
    }
    if bin_ids.len() > 50 {
        return Err(AppError::ValidationError(
            "Cannot reset more than 50 bins at once".to_string(),
        ));
    }

    let mut results = Vec::new();
    let mut total_archived = 0;

    for bin_id in bin_ids {
        match reset_reports(bin_repo, report_repo, bin_id, archived_by).await {
            Ok(response) => {
                total_archived += response.archived_count;
                results.push(BatchResetResult {
                    bin_id: *bin_id,
                    archived_count: response.archived_count,
                    archive_batch_id: response.archive_batch_id,
                });
            }
            Err(AppError::BinNotFound(id)) => {
                warn!(bin_id = %id, "Skipping non-existent bin in batch reset");
            }
            Err(e) => return Err(e),
        }
    }

    let bin_count = results.len();
    info!(
        bins = bin_count,
        total_archived = total_archived,
        "Batch reset reports completed"
    );

    Ok(BatchResetReportsResponse {
        results,
        total_archived,
        message: format!(
            "Successfully reset {} bins ({} reports archived)",
            bin_count, total_archived
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::BinType;
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    struct MockBinRepository {
        bins: Arc<Mutex<Vec<BinInfo>>>,
    }

    impl MockBinRepository {
        fn new() -> Self {
            Self {
                bins: Arc::new(Mutex::new(Vec::new())),
            }
        }

        fn with_bins(bins: Vec<BinInfo>) -> Self {
            Self {
                bins: Arc::new(Mutex::new(bins)),
            }
        }
    }

    use crate::domain::StatusReport;

    struct MockReportRepository {
        reports: Arc<Mutex<Vec<StatusReport>>>,
        archived: Arc<Mutex<Vec<StatusReport>>>,
        status_reset: Arc<Mutex<bool>>,
    }

    impl MockReportRepository {
        fn new() -> Self {
            Self {
                reports: Arc::new(Mutex::new(Vec::new())),
                archived: Arc::new(Mutex::new(Vec::new())),
                status_reset: Arc::new(Mutex::new(false)),
            }
        }

        fn with_reports(reports: Vec<StatusReport>) -> Self {
            Self {
                reports: Arc::new(Mutex::new(reports)),
                archived: Arc::new(Mutex::new(Vec::new())),
                status_reset: Arc::new(Mutex::new(false)),
            }
        }
    }

    #[async_trait]
    impl ReportRepository for MockReportRepository {
        async fn query_reports(&self, bin_id: &Uuid) -> Result<Vec<StatusReport>> {
            let reports = self.reports.lock().unwrap();
            Ok(reports
                .iter()
                .filter(|r| r.bin_id == *bin_id)
                .cloned()
                .collect())
        }

        async fn archive_reports(
            &self,
            _bin_id: &Uuid,
            reports: &[StatusReport],
            _batch_id: &str,
            _archived_by: &str,
        ) -> Result<usize> {
            let mut archived = self.archived.lock().unwrap();
            archived.extend_from_slice(reports);
            Ok(reports.len())
        }

        async fn delete_reports(&self, bin_id: &Uuid, _reports: &[StatusReport]) -> Result<()> {
            let mut reports = self.reports.lock().unwrap();
            reports.retain(|r| r.bin_id != *bin_id);
            Ok(())
        }

        async fn reset_bin_status(&self, _bin_id: &Uuid) -> Result<()> {
            *self.status_reset.lock().unwrap() = true;
            Ok(())
        }
    }

    #[async_trait]
    impl BinRepository for MockBinRepository {
        async fn list_bins(&self) -> Result<Vec<BinInfo>> {
            Ok(self.bins.lock().unwrap().clone())
        }

        async fn get_bin(&self, bin_id: &Uuid) -> Result<Option<BinInfo>> {
            let bins = self.bins.lock().unwrap();
            Ok(bins.iter().find(|b| b.bin_id == *bin_id).cloned())
        }

        async fn create_bin(&self, bin_id: &Uuid, request: &CreateBinRequest) -> Result<()> {
            let mut bins = self.bins.lock().unwrap();
            bins.push(BinInfo {
                bin_id: *bin_id,
                name: request.name.clone(),
                bin_type: request.bin_type.unwrap_or_default(),
                address: request.address.clone(),
                coordinates: request.coordinates,
                status: 0,
                reports_count: 0,
                last_updated: Some(chrono::Utc::now()),
                is_active: true,
            });
            Ok(())
        }

        async fn update_bin(&self, bin_id: &Uuid, request: &UpdateBinRequest) -> Result<()> {
            let mut bins = self.bins.lock().unwrap();
            if let Some(bin) = bins.iter_mut().find(|b| b.bin_id == *bin_id) {
                if let Some(name) = &request.name {
                    bin.name = name.clone();
                }
                if let Some(bin_type) = &request.bin_type {
                    bin.bin_type = *bin_type;
                }
                if let Some(address) = &request.address {
                    bin.address = Some(address.clone());
                }
                if let Some(coords) = &request.coordinates {
                    bin.coordinates = Some(*coords);
                }
                if let Some(is_active) = request.is_active {
                    bin.is_active = is_active;
                }
            }
            Ok(())
        }

        async fn delete_bin(&self, bin_id: &Uuid) -> Result<()> {
            let mut bins = self.bins.lock().unwrap();
            if let Some(bin) = bins.iter_mut().find(|b| b.bin_id == *bin_id) {
                bin.is_active = false;
            }
            Ok(())
        }

        async fn list_bins_paginated(
            &self,
            limit: i32,
            _cursor: Option<String>,
        ) -> Result<(Vec<BinInfo>, Option<String>)> {
            let bins = self.bins.lock().unwrap();
            let take = (limit as usize).min(bins.len());
            Ok((bins[..take].to_vec(), None))
        }
    }

    #[tokio::test]
    async fn test_list_bins() {
        let bins = vec![
            BinInfo {
                bin_id: Uuid::new_v4(),
                name: "Bin 1".to_string(),
                bin_type: BinType::Plastic,
                address: Some("123 Main St".to_string()),
                coordinates: None,
                status: 50,
                reports_count: 10,
                last_updated: None,
                is_active: true,
            },
            BinInfo {
                bin_id: Uuid::new_v4(),
                name: "Bin 2".to_string(),
                bin_type: BinType::Glass,
                address: None,
                coordinates: None,
                status: 75,
                reports_count: 20,
                last_updated: None,
                is_active: true,
            },
        ];

        let repo = MockBinRepository::with_bins(bins.clone());
        let result = list_bins(&repo).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn test_create_bin() {
        let repo = MockBinRepository::new();

        let request = CreateBinRequest {
            name: "New Bin".to_string(),
            bin_type: Some(BinType::Paper),
            address: Some("456 Oak Ave".to_string()),
            coordinates: None,
        };

        let result = create_bin(&repo, request).await.unwrap();

        assert_eq!(result.name, "New Bin");
        assert_eq!(result.bin_type, BinType::Paper);
        assert_eq!(result.address, Some("456 Oak Ave".to_string()));
        assert_eq!(result.status, 0);
        assert!(result.is_active);
    }

    #[tokio::test]
    async fn test_create_bin_empty_name() {
        let repo = MockBinRepository::new();

        let request = CreateBinRequest {
            name: "   ".to_string(),
            bin_type: None,
            address: None,
            coordinates: None,
        };

        let result = create_bin(&repo, request).await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_get_bin_not_found() {
        let repo = MockBinRepository::new();
        let bin_id = Uuid::new_v4();

        let result = get_bin(&repo, &bin_id).await;
        assert!(matches!(result, Err(AppError::BinNotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_bin() {
        let bin_id = Uuid::new_v4();
        let bins = vec![BinInfo {
            bin_id,
            name: "Test Bin".to_string(),
            bin_type: BinType::Mixed,
            address: None,
            coordinates: None,
            status: 0,
            reports_count: 0,
            last_updated: None,
            is_active: true,
        }];

        let repo = MockBinRepository::with_bins(bins);
        let result = delete_bin(&repo, &bin_id).await;

        assert!(result.is_ok());

        // Check bin is now inactive
        let bin = repo.get_bin(&bin_id).await.unwrap().unwrap();
        assert!(!bin.is_active);
    }

    #[tokio::test]
    async fn test_reset_reports_with_reports() {
        let bin_id = Uuid::new_v4();
        let bins = vec![BinInfo {
            bin_id,
            name: "Test Bin".to_string(),
            bin_type: BinType::Mixed,
            address: None,
            coordinates: None,
            status: 75,
            reports_count: 3,
            last_updated: None,
            is_active: true,
        }];
        let reports = vec![
            StatusReport {
                bin_id,
                created_at: "2026-02-01T10:00:00Z".to_string(),
                status: 50,
                source: "qr".to_string(),
            },
            StatusReport {
                bin_id,
                created_at: "2026-02-02T10:00:00Z".to_string(),
                status: 75,
                source: "iot".to_string(),
            },
            StatusReport {
                bin_id,
                created_at: "2026-02-03T10:00:00Z".to_string(),
                status: 80,
                source: "manual".to_string(),
            },
        ];

        let bin_repo = MockBinRepository::with_bins(bins);
        let report_repo = MockReportRepository::with_reports(reports);

        let result = reset_reports(&bin_repo, &report_repo, &bin_id, "admin@test.com")
            .await
            .unwrap();

        assert_eq!(result.archived_count, 3);
        assert!(!result.archive_batch_id.is_empty());

        // Check reports were archived
        assert_eq!(report_repo.archived.lock().unwrap().len(), 3);
        // Check source reports were deleted
        assert!(report_repo.reports.lock().unwrap().is_empty());
        // Check bin status was reset
        assert!(*report_repo.status_reset.lock().unwrap());
    }

    #[tokio::test]
    async fn test_reset_reports_with_zero_reports() {
        let bin_id = Uuid::new_v4();
        let bins = vec![BinInfo {
            bin_id,
            name: "Empty Bin".to_string(),
            bin_type: BinType::Mixed,
            address: None,
            coordinates: None,
            status: 0,
            reports_count: 0,
            last_updated: None,
            is_active: true,
        }];

        let bin_repo = MockBinRepository::with_bins(bins);
        let report_repo = MockReportRepository::new();

        let result = reset_reports(&bin_repo, &report_repo, &bin_id, "admin@test.com")
            .await
            .unwrap();

        assert_eq!(result.archived_count, 0);
        // Status should still be reset
        assert!(*report_repo.status_reset.lock().unwrap());
    }

    #[tokio::test]
    async fn test_reset_reports_bin_not_found() {
        let bin_id = Uuid::new_v4();
        let bin_repo = MockBinRepository::new();
        let report_repo = MockReportRepository::new();

        let result = reset_reports(&bin_repo, &report_repo, &bin_id, "admin@test.com").await;
        assert!(matches!(result, Err(AppError::BinNotFound(_))));
    }

    // =========================================================================
    // Batch Reset Reports Tests
    // =========================================================================

    fn make_bin(bin_id: Uuid) -> BinInfo {
        BinInfo {
            bin_id,
            name: format!("Bin {}", bin_id),
            bin_type: BinType::Mixed,
            address: None,
            coordinates: None,
            status: 50,
            reports_count: 2,
            last_updated: None,
            is_active: true,
        }
    }

    #[tokio::test]
    async fn test_batch_reset_reports_success() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let bins = vec![make_bin(id1), make_bin(id2)];
        let reports = vec![
            StatusReport {
                bin_id: id1,
                created_at: "2026-02-01T10:00:00Z".to_string(),
                status: 50,
                source: "qr".to_string(),
            },
            StatusReport {
                bin_id: id2,
                created_at: "2026-02-02T10:00:00Z".to_string(),
                status: 60,
                source: "iot".to_string(),
            },
        ];

        let bin_repo = MockBinRepository::with_bins(bins);
        let report_repo = MockReportRepository::with_reports(reports);

        let result = batch_reset_reports(&bin_repo, &report_repo, &[id1, id2], "admin@test.com")
            .await
            .unwrap();

        assert_eq!(result.results.len(), 2);
        assert_eq!(result.total_archived, 2);
    }

    #[tokio::test]
    async fn test_batch_reset_reports_empty_ids() {
        let bin_repo = MockBinRepository::new();
        let report_repo = MockReportRepository::new();

        let result = batch_reset_reports(&bin_repo, &report_repo, &[], "admin@test.com").await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_batch_reset_reports_too_many_ids() {
        let bin_repo = MockBinRepository::new();
        let report_repo = MockReportRepository::new();
        let ids: Vec<Uuid> = (0..51).map(|_| Uuid::new_v4()).collect();

        let result = batch_reset_reports(&bin_repo, &report_repo, &ids, "admin@test.com").await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_batch_reset_reports_skips_not_found() {
        let id1 = Uuid::new_v4();
        let id_missing = Uuid::new_v4();
        let bins = vec![make_bin(id1)];

        let bin_repo = MockBinRepository::with_bins(bins);
        let report_repo = MockReportRepository::new();

        let result = batch_reset_reports(
            &bin_repo,
            &report_repo,
            &[id1, id_missing],
            "admin@test.com",
        )
        .await
        .unwrap();

        // Only the existing bin should be in results
        assert_eq!(result.results.len(), 1);
        assert_eq!(result.results[0].bin_id, id1);
    }
}
