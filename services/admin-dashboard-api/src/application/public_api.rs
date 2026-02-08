use tracing::{info, instrument};
use uuid::Uuid;

use crate::domain::{AppError, BinRepository, ExternalBinInfo, PaginatedResponse, Result};

/// List bins for external API consumers with pagination
#[instrument(skip(repo))]
pub async fn list_bins_external(
    repo: &dyn BinRepository,
    limit: Option<i32>,
    cursor: Option<String>,
) -> Result<PaginatedResponse<ExternalBinInfo>> {
    // Clamp limit to 1-100, default 20
    let limit = limit.unwrap_or(20).clamp(1, 100);

    let (bins, next_cursor) = repo.list_bins_paginated(limit, cursor).await?;

    let items: Vec<ExternalBinInfo> = bins.iter().map(ExternalBinInfo::from).collect();
    let has_more = next_cursor.is_some();

    info!(
        count = items.len(),
        has_more, "Listed bins for external API"
    );

    Ok(PaginatedResponse {
        items,
        next_cursor,
        has_more,
    })
}

/// Get a single bin for external API consumers
#[instrument(skip(repo))]
pub async fn get_bin_external(repo: &dyn BinRepository, bin_id: &Uuid) -> Result<ExternalBinInfo> {
    let bin = repo
        .get_bin(bin_id)
        .await?
        .ok_or_else(|| AppError::BinNotFound(bin_id.to_string()))?;

    if !bin.is_active {
        return Err(AppError::BinNotFound(bin_id.to_string()));
    }

    Ok(ExternalBinInfo::from(&bin))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{BinInfo, BinType, CreateBinRequest, UpdateBinRequest};
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    struct MockBinRepository {
        bins: Arc<Mutex<Vec<BinInfo>>>,
    }

    impl MockBinRepository {
        fn with_bins(bins: Vec<BinInfo>) -> Self {
            Self {
                bins: Arc::new(Mutex::new(bins)),
            }
        }
    }

    fn make_bin(id: &str, name: &str, is_active: bool) -> BinInfo {
        BinInfo {
            bin_id: Uuid::parse_str(id).unwrap(),
            name: name.to_string(),
            bin_type: BinType::Mixed,
            address: None,
            coordinates: None,
            status: 50,
            reports_count: 5,
            last_updated: None,
            is_active,
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

        async fn create_bin(&self, _bin_id: &Uuid, _request: &CreateBinRequest) -> Result<()> {
            Ok(())
        }

        async fn update_bin(&self, _bin_id: &Uuid, _request: &UpdateBinRequest) -> Result<()> {
            Ok(())
        }

        async fn delete_bin(&self, _bin_id: &Uuid) -> Result<()> {
            Ok(())
        }

        async fn list_bins_paginated(
            &self,
            limit: i32,
            _cursor: Option<String>,
        ) -> Result<(Vec<BinInfo>, Option<String>)> {
            let bins = self.bins.lock().unwrap();
            let active: Vec<BinInfo> = bins.iter().filter(|b| b.is_active).cloned().collect();
            let take = (limit as usize).min(active.len());
            let result = active[..take].to_vec();
            let next = if take < active.len() {
                Some("next_cursor".to_string())
            } else {
                None
            };
            Ok((result, next))
        }
    }

    #[tokio::test]
    async fn test_list_bins_external_default_limit() {
        let bins = vec![
            make_bin("00000000-0000-0000-0000-000000000001", "Bin 1", true),
            make_bin("00000000-0000-0000-0000-000000000002", "Bin 2", true),
        ];
        let repo = MockBinRepository::with_bins(bins);

        let result = list_bins_external(&repo, None, None).await.unwrap();
        assert_eq!(result.items.len(), 2);
        assert!(!result.has_more);
    }

    #[tokio::test]
    async fn test_list_bins_external_limit_clamped_to_min() {
        let bins = vec![make_bin(
            "00000000-0000-0000-0000-000000000001",
            "Bin 1",
            true,
        )];
        let repo = MockBinRepository::with_bins(bins);

        // Limit of 0 should be clamped to 1
        let result = list_bins_external(&repo, Some(0), None).await.unwrap();
        assert_eq!(result.items.len(), 1);
    }

    #[tokio::test]
    async fn test_list_bins_external_limit_clamped_to_max() {
        let bins = vec![make_bin(
            "00000000-0000-0000-0000-000000000001",
            "Bin 1",
            true,
        )];
        let repo = MockBinRepository::with_bins(bins);

        // Limit of 200 should be clamped to 100
        let result = list_bins_external(&repo, Some(200), None).await.unwrap();
        assert_eq!(result.items.len(), 1);
    }

    #[tokio::test]
    async fn test_get_bin_external_active() {
        let bins = vec![make_bin(
            "00000000-0000-0000-0000-000000000001",
            "Active Bin",
            true,
        )];
        let repo = MockBinRepository::with_bins(bins);
        let id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

        let result = get_bin_external(&repo, &id).await.unwrap();
        assert_eq!(result.name, "Active Bin");
    }

    #[tokio::test]
    async fn test_get_bin_external_inactive_returns_not_found() {
        let bins = vec![make_bin(
            "00000000-0000-0000-0000-000000000001",
            "Inactive Bin",
            false,
        )];
        let repo = MockBinRepository::with_bins(bins);
        let id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

        let result = get_bin_external(&repo, &id).await;
        assert!(matches!(result, Err(AppError::BinNotFound(_))));
    }

    #[tokio::test]
    async fn test_get_bin_external_not_found() {
        let repo = MockBinRepository::with_bins(vec![]);
        let id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

        let result = get_bin_external(&repo, &id).await;
        assert!(matches!(result, Err(AppError::BinNotFound(_))));
    }
}
