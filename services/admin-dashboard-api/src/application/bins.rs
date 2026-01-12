use tracing::{info, instrument};
use uuid::Uuid;

use crate::domain::{AppError, BinInfo, BinRepository, CreateBinRequest, Result, UpdateBinRequest};

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
}
