use rand::Rng;
use sha2::{Digest, Sha256};
use tracing::{info, instrument};
use uuid::Uuid;

use crate::domain::{
    ApiKeyCreatedResponse, ApiKeyInfo, ApiKeyRecord, ApiKeyRepository, AppError,
    CreateApiKeyRequest, Result, UpdateApiKeyRequest,
};

/// Generate a random API key with the `ek_live_` prefix
fn generate_api_key() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
    format!("ek_live_{}", hex::encode(random_bytes))
}

/// Hash an API key using SHA-256
fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

/// Create a new API key
#[instrument(skip(repo, request))]
pub async fn create_api_key(
    repo: &dyn ApiKeyRepository,
    request: CreateApiKeyRequest,
    created_by: &str,
) -> Result<ApiKeyCreatedResponse> {
    if request.name.trim().is_empty() {
        return Err(AppError::ValidationError(
            "API key name is required".to_string(),
        ));
    }

    let raw_key = generate_api_key();
    let key_hash = hash_api_key(&raw_key);
    let key_id = Uuid::new_v4().to_string();
    let key_prefix = raw_key[..16].to_string(); // "ek_live_" + 8 hex chars
    let now = chrono::Utc::now();

    let scopes = request
        .scopes
        .unwrap_or_else(|| vec!["bins:read".to_string()]);

    let record = ApiKeyRecord {
        key_id: key_id.clone(),
        key_hash,
        key_prefix: key_prefix.clone(),
        name: request.name.clone(),
        scopes: scopes.clone(),
        created_by: created_by.to_string(),
        created_at: now,
        last_used_at: None,
        is_active: true,
        expires_at: request.expires_at,
    };

    repo.create_api_key(&record).await?;

    info!(key_id = %key_id, name = %request.name, "API key created");

    Ok(ApiKeyCreatedResponse {
        key: raw_key,
        key_id,
        key_prefix,
        name: request.name,
        scopes,
        created_at: now,
        expires_at: request.expires_at,
    })
}

/// List all API keys
#[instrument(skip(repo))]
pub async fn list_api_keys(repo: &dyn ApiKeyRepository) -> Result<Vec<ApiKeyInfo>> {
    let records = repo.list_api_keys().await?;
    let infos: Vec<ApiKeyInfo> = records.iter().map(ApiKeyInfo::from).collect();
    info!(count = infos.len(), "Listed all API keys");
    Ok(infos)
}

/// Get a single API key by ID
#[instrument(skip(repo))]
pub async fn get_api_key(repo: &dyn ApiKeyRepository, key_id: &str) -> Result<ApiKeyInfo> {
    let record = repo
        .get_api_key(key_id)
        .await?
        .ok_or_else(|| AppError::ApiKeyNotFound(key_id.to_string()))?;
    Ok(ApiKeyInfo::from(&record))
}

/// Update an API key
#[instrument(skip(repo, request))]
pub async fn update_api_key(
    repo: &dyn ApiKeyRepository,
    key_id: &str,
    request: UpdateApiKeyRequest,
) -> Result<ApiKeyInfo> {
    let _existing = repo
        .get_api_key(key_id)
        .await?
        .ok_or_else(|| AppError::ApiKeyNotFound(key_id.to_string()))?;

    repo.update_api_key(key_id, &request).await?;

    let updated = repo
        .get_api_key(key_id)
        .await?
        .ok_or_else(|| AppError::InternalError("Failed to fetch updated API key".to_string()))?;

    Ok(ApiKeyInfo::from(&updated))
}

/// Delete an API key (soft delete)
#[instrument(skip(repo))]
pub async fn delete_api_key(repo: &dyn ApiKeyRepository, key_id: &str) -> Result<()> {
    let _existing = repo
        .get_api_key(key_id)
        .await?
        .ok_or_else(|| AppError::ApiKeyNotFound(key_id.to_string()))?;

    repo.delete_api_key(key_id).await?;

    info!(key_id = %key_id, "API key deactivated");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    struct MockApiKeyRepository {
        keys: Arc<Mutex<Vec<ApiKeyRecord>>>,
    }

    impl MockApiKeyRepository {
        fn new() -> Self {
            Self {
                keys: Arc::new(Mutex::new(Vec::new())),
            }
        }

        fn with_keys(keys: Vec<ApiKeyRecord>) -> Self {
            Self {
                keys: Arc::new(Mutex::new(keys)),
            }
        }
    }

    #[async_trait]
    impl ApiKeyRepository for MockApiKeyRepository {
        async fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>> {
            Ok(self.keys.lock().unwrap().clone())
        }

        async fn get_api_key(&self, key_id: &str) -> Result<Option<ApiKeyRecord>> {
            let keys = self.keys.lock().unwrap();
            Ok(keys.iter().find(|k| k.key_id == key_id).cloned())
        }

        async fn create_api_key(&self, record: &ApiKeyRecord) -> Result<()> {
            self.keys.lock().unwrap().push(record.clone());
            Ok(())
        }

        async fn update_api_key(&self, key_id: &str, request: &UpdateApiKeyRequest) -> Result<()> {
            let mut keys = self.keys.lock().unwrap();
            if let Some(k) = keys.iter_mut().find(|k| k.key_id == key_id) {
                if let Some(name) = &request.name {
                    k.name = name.clone();
                }
                if let Some(scopes) = &request.scopes {
                    k.scopes = scopes.clone();
                }
                if let Some(is_active) = request.is_active {
                    k.is_active = is_active;
                }
            }
            Ok(())
        }

        async fn delete_api_key(&self, key_id: &str) -> Result<()> {
            let mut keys = self.keys.lock().unwrap();
            if let Some(k) = keys.iter_mut().find(|k| k.key_id == key_id) {
                k.is_active = false;
            }
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_create_api_key() {
        let repo = MockApiKeyRepository::new();

        let request = CreateApiKeyRequest {
            name: "Test Key".to_string(),
            scopes: Some(vec!["bins:read".to_string()]),
            expires_at: None,
        };

        let result = create_api_key(&repo, request, "admin@test.com")
            .await
            .unwrap();

        assert!(result.key.starts_with("ek_live_"));
        assert_eq!(result.name, "Test Key");
        assert_eq!(result.scopes, vec!["bins:read"]);
        assert!(!result.key_id.is_empty());
        assert!(!result.key_prefix.is_empty());
    }

    #[tokio::test]
    async fn test_create_api_key_empty_name() {
        let repo = MockApiKeyRepository::new();

        let request = CreateApiKeyRequest {
            name: "   ".to_string(),
            scopes: None,
            expires_at: None,
        };

        let result = create_api_key(&repo, request, "admin@test.com").await;
        assert!(matches!(result, Err(AppError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_create_api_key_default_scopes() {
        let repo = MockApiKeyRepository::new();

        let request = CreateApiKeyRequest {
            name: "Default Scopes".to_string(),
            scopes: None,
            expires_at: None,
        };

        let result = create_api_key(&repo, request, "admin@test.com")
            .await
            .unwrap();
        assert_eq!(result.scopes, vec!["bins:read"]);
    }

    #[tokio::test]
    async fn test_create_api_key_hashes_correctly() {
        let repo = MockApiKeyRepository::new();

        let request = CreateApiKeyRequest {
            name: "Hash Test".to_string(),
            scopes: None,
            expires_at: None,
        };

        let result = create_api_key(&repo, request, "admin@test.com")
            .await
            .unwrap();

        // Verify the stored hash matches what we'd compute
        let stored = repo.keys.lock().unwrap();
        let record = &stored[0];
        assert_eq!(record.key_hash, hash_api_key(&result.key));
        assert_eq!(record.key_hash.len(), 64); // SHA-256 hex
    }

    #[tokio::test]
    async fn test_get_api_key_not_found() {
        let repo = MockApiKeyRepository::new();
        let result = get_api_key(&repo, "nonexistent").await;
        assert!(matches!(result, Err(AppError::ApiKeyNotFound(_))));
    }

    #[tokio::test]
    async fn test_list_api_keys() {
        let keys = vec![ApiKeyRecord {
            key_id: "key-1".to_string(),
            key_hash: "hash".to_string(),
            key_prefix: "ek_live_abc".to_string(),
            name: "Test Key".to_string(),
            scopes: vec!["bins:read".to_string()],
            created_by: "admin@test.com".to_string(),
            created_at: chrono::Utc::now(),
            last_used_at: None,
            is_active: true,
            expires_at: None,
        }];

        let repo = MockApiKeyRepository::with_keys(keys);
        let result = list_api_keys(&repo).await.unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Test Key");
    }

    #[tokio::test]
    async fn test_delete_api_key() {
        let keys = vec![ApiKeyRecord {
            key_id: "key-1".to_string(),
            key_hash: "hash".to_string(),
            key_prefix: "ek_live_abc".to_string(),
            name: "Test Key".to_string(),
            scopes: vec![],
            created_by: "admin@test.com".to_string(),
            created_at: chrono::Utc::now(),
            last_used_at: None,
            is_active: true,
            expires_at: None,
        }];

        let repo = MockApiKeyRepository::with_keys(keys);
        let result = delete_api_key(&repo, "key-1").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_api_key_not_found() {
        let repo = MockApiKeyRepository::new();
        let result = delete_api_key(&repo, "nonexistent").await;
        assert!(matches!(result, Err(AppError::ApiKeyNotFound(_))));
    }
}
