use std::time::Duration;

use async_trait::async_trait;
use aws_config::timeout::TimeoutConfig;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use chrono::{DateTime, Utc};
use tracing::{info, instrument};
use uuid::Uuid;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

use crate::config::Config;
use crate::domain::{
    AdminUser, ApiKeyRecord, ApiKeyRepository, AppError, BinInfo, BinRepository, BinType,
    Coordinates, CreateBinRequest, ReportRepository, Result, StatusReport, UpdateApiKeyRequest,
    UpdateBinRequest, UpdateWebhookRequest, UserRepository, UserRole, WebhookAuthType,
    WebhookConfig, WebhookRepository,
};

pub struct DynamoDbRepository {
    client: Client,
    users_table: String,
    bins_table: String,
    status_reports_table: String,
    archived_reports_table: String,
    webhooks_table: String,
    api_keys_table: String,
}

impl DynamoDbRepository {
    pub async fn new(config: &Config) -> Result<Self> {
        let timeout_config = TimeoutConfig::builder()
            .connect_timeout(Duration::from_secs(5))
            .operation_timeout(Duration::from_secs(10))
            .build();

        let sdk_config = if let Some(endpoint) = &config.dynamodb_endpoint {
            info!(endpoint = %endpoint, "Using custom DynamoDB endpoint (LocalStack)");
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .timeout_config(timeout_config)
                .endpoint_url(endpoint)
                .region(aws_config::Region::new(config.aws_region.clone()))
                .load()
                .await
        } else {
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .timeout_config(timeout_config)
                .region(aws_config::Region::new(config.aws_region.clone()))
                .load()
                .await
        };

        let client = Client::new(&sdk_config);

        Ok(Self {
            client,
            users_table: config.admin_users_table.clone(),
            bins_table: config.trash_bins_table.clone(),
            status_reports_table: config.status_reports_table.clone(),
            archived_reports_table: config.archived_reports_table.clone(),
            webhooks_table: config.webhook_configs_table.clone(),
            api_keys_table: config.api_keys_table.clone(),
        })
    }

    fn parse_user_role(role_str: &str) -> UserRole {
        match role_str.to_lowercase().as_str() {
            "admin" => UserRole::Admin,
            "operator" => UserRole::Operator,
            _ => UserRole::Viewer,
        }
    }

    fn parse_bin_item(item: &std::collections::HashMap<String, AttributeValue>) -> Option<BinInfo> {
        let bin_id = item
            .get("binId")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| Uuid::parse_str(s).ok())?;

        // Parse coordinates from nested map
        let coordinates = item.get("coordinates").and_then(|v| {
            v.as_m().ok().and_then(|m| {
                let lat = m
                    .get("latitude")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse::<f64>().ok())?;
                let lng = m
                    .get("longitude")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse::<f64>().ok())?;
                Some(Coordinates {
                    latitude: lat,
                    longitude: lng,
                })
            })
        });

        Some(BinInfo {
            bin_id,
            name: item
                .get("Name")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string()),
            bin_type: item
                .get("binType")
                .and_then(|v| v.as_s().ok())
                .map(|s| BinType::parse(s))
                .unwrap_or_default(),
            address: item.get("address").and_then(|v| v.as_s().ok()).cloned(),
            coordinates,
            status: item
                .get("status")
                .and_then(|v| v.as_n().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            reports_count: item
                .get("reportsCount")
                .and_then(|v| v.as_n().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            last_updated: item
                .get("lastUpdated")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            is_active: item
                .get("isActive")
                .and_then(|v| v.as_bool().ok())
                .copied()
                .unwrap_or(true),
        })
    }
}

#[async_trait]
impl UserRepository for DynamoDbRepository {
    #[instrument(skip(self), fields(table = %self.users_table))]
    async fn get_user(&self, email: &str) -> Result<Option<AdminUser>> {
        let result = self
            .client
            .get_item()
            .table_name(&self.users_table)
            .key("email", AttributeValue::S(email.to_string()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        match result.item {
            Some(item) => {
                let user = AdminUser {
                    email: item
                        .get("email")
                        .and_then(|v| v.as_s().ok())
                        .cloned()
                        .unwrap_or_default(),
                    password_hash: item
                        .get("passwordHash")
                        .and_then(|v| v.as_s().ok())
                        .cloned()
                        .unwrap_or_default(),
                    name: item
                        .get("name")
                        .and_then(|v| v.as_s().ok())
                        .cloned()
                        .unwrap_or_default(),
                    role: item
                        .get("role")
                        .and_then(|v| v.as_s().ok())
                        .map(|s| Self::parse_user_role(s))
                        .unwrap_or_default(),
                    created_at: item
                        .get("createdAt")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(Utc::now),
                    last_login: item
                        .get("lastLogin")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    is_active: item
                        .get("isActive")
                        .and_then(|v| v.as_bool().ok())
                        .copied()
                        .unwrap_or(true),
                };
                Ok(Some(user))
            }
            None => Ok(None),
        }
    }

    #[instrument(skip(self, user), fields(table = %self.users_table, email = %user.email))]
    async fn create_user(&self, user: &AdminUser) -> Result<()> {
        self.client
            .put_item()
            .table_name(&self.users_table)
            .item("email", AttributeValue::S(user.email.clone()))
            .item(
                "passwordHash",
                AttributeValue::S(user.password_hash.clone()),
            )
            .item("name", AttributeValue::S(user.name.clone()))
            .item("role", AttributeValue::S(user.role.to_string()))
            .item("createdAt", AttributeValue::S(user.created_at.to_rfc3339()))
            .item("isActive", AttributeValue::Bool(user.is_active))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(email = %user.email, "User created successfully");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.users_table))]
    async fn update_last_login(&self, email: &str, timestamp: DateTime<Utc>) -> Result<()> {
        self.client
            .update_item()
            .table_name(&self.users_table)
            .key("email", AttributeValue::S(email.to_string()))
            .update_expression("SET lastLogin = :ts")
            .expression_attribute_values(":ts", AttributeValue::S(timestamp.to_rfc3339()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    #[instrument(skip(self, token_hash), fields(table = %self.users_table))]
    async fn store_reset_token(
        &self,
        email: &str,
        token_hash: &str,
        expiry: DateTime<Utc>,
    ) -> Result<()> {
        self.client
            .update_item()
            .table_name(&self.users_table)
            .key("email", AttributeValue::S(email.to_string()))
            .update_expression("SET resetTokenHash = :hash, resetTokenExpiry = :expiry")
            .expression_attribute_values(":hash", AttributeValue::S(token_hash.to_string()))
            .expression_attribute_values(":expiry", AttributeValue::S(expiry.to_rfc3339()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(email = %email, "Reset token stored");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.users_table))]
    async fn get_reset_token(&self, email: &str) -> Result<Option<(String, DateTime<Utc>)>> {
        let result = self
            .client
            .get_item()
            .table_name(&self.users_table)
            .key("email", AttributeValue::S(email.to_string()))
            .projection_expression("resetTokenHash, resetTokenExpiry")
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        match result.item {
            Some(item) => {
                let hash = item
                    .get("resetTokenHash")
                    .and_then(|v| v.as_s().ok())
                    .cloned();
                let expiry = item
                    .get("resetTokenExpiry")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc));

                match (hash, expiry) {
                    (Some(h), Some(e)) => Ok(Some((h, e))),
                    _ => Ok(None),
                }
            }
            None => Ok(None),
        }
    }

    #[instrument(skip(self), fields(table = %self.users_table))]
    async fn clear_reset_token(&self, email: &str) -> Result<()> {
        self.client
            .update_item()
            .table_name(&self.users_table)
            .key("email", AttributeValue::S(email.to_string()))
            .update_expression("REMOVE resetTokenHash, resetTokenExpiry")
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(email = %email, "Reset token cleared");
        Ok(())
    }

    #[instrument(skip(self, password_hash), fields(table = %self.users_table))]
    async fn update_password(&self, email: &str, password_hash: &str) -> Result<()> {
        self.client
            .update_item()
            .table_name(&self.users_table)
            .key("email", AttributeValue::S(email.to_string()))
            .update_expression("SET passwordHash = :pw REMOVE resetTokenHash, resetTokenExpiry")
            .expression_attribute_values(":pw", AttributeValue::S(password_hash.to_string()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(email = %email, "Password updated and reset token cleared");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.users_table))]
    async fn list_users(&self) -> Result<Vec<AdminUser>> {
        let result = self
            .client
            .scan()
            .table_name(&self.users_table)
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let users: Vec<AdminUser> = result
            .items
            .unwrap_or_default()
            .iter()
            .filter_map(|item| {
                Some(AdminUser {
                    email: item.get("email").and_then(|v| v.as_s().ok()).cloned()?,
                    password_hash: item
                        .get("passwordHash")
                        .and_then(|v| v.as_s().ok())
                        .cloned()
                        .unwrap_or_default(),
                    name: item
                        .get("name")
                        .and_then(|v| v.as_s().ok())
                        .cloned()
                        .unwrap_or_default(),
                    role: item
                        .get("role")
                        .and_then(|v| v.as_s().ok())
                        .map(|s| Self::parse_user_role(s))
                        .unwrap_or_default(),
                    created_at: item
                        .get("createdAt")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(Utc::now),
                    last_login: item
                        .get("lastLogin")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    is_active: item
                        .get("isActive")
                        .and_then(|v| v.as_bool().ok())
                        .copied()
                        .unwrap_or(true),
                })
            })
            .collect();

        info!(count = users.len(), "Listed users");
        Ok(users)
    }

    #[instrument(skip(self), fields(table = %self.users_table))]
    async fn update_user(
        &self,
        email: &str,
        name: Option<&str>,
        role: Option<UserRole>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let mut update_parts = Vec::new();
        let mut expression_values = std::collections::HashMap::new();

        if let Some(n) = name {
            update_parts.push("#n = :name");
            expression_values.insert(":name".to_string(), AttributeValue::S(n.to_string()));
        }

        if let Some(r) = role {
            update_parts.push("#r = :role");
            expression_values.insert(":role".to_string(), AttributeValue::S(r.to_string()));
        }

        if let Some(active) = is_active {
            update_parts.push("isActive = :active");
            expression_values.insert(":active".to_string(), AttributeValue::Bool(active));
        }

        if update_parts.is_empty() {
            return Ok(());
        }

        let update_expression = format!("SET {}", update_parts.join(", "));

        let mut request_builder = self
            .client
            .update_item()
            .table_name(&self.users_table)
            .key("email", AttributeValue::S(email.to_string()))
            .update_expression(update_expression);

        // Handle reserved words
        if name.is_some() {
            request_builder =
                request_builder.expression_attribute_names("#n".to_string(), "name".to_string());
        }
        if role.is_some() {
            request_builder =
                request_builder.expression_attribute_names("#r".to_string(), "role".to_string());
        }

        for (key, value) in expression_values {
            request_builder = request_builder.expression_attribute_values(key, value);
        }

        request_builder
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(email = %email, "User updated successfully");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.users_table))]
    async fn count_active_admins(&self) -> Result<usize> {
        let result = self
            .client
            .scan()
            .table_name(&self.users_table)
            .filter_expression("#r = :admin AND isActive = :active")
            .expression_attribute_names("#r".to_string(), "role".to_string())
            .expression_attribute_values(":admin", AttributeValue::S("admin".to_string()))
            .expression_attribute_values(":active", AttributeValue::Bool(true))
            .select(aws_sdk_dynamodb::types::Select::Count)
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let count = result.count().try_into().unwrap_or(0);
        info!(count = count, "Counted active admins");
        Ok(count)
    }
}

#[async_trait]
impl BinRepository for DynamoDbRepository {
    #[instrument(skip(self), fields(table = %self.bins_table))]
    async fn list_bins(&self) -> Result<Vec<BinInfo>> {
        let result = self
            .client
            .scan()
            .table_name(&self.bins_table)
            .filter_expression("isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(true))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let bins: Vec<BinInfo> = result
            .items
            .unwrap_or_default()
            .iter()
            .filter_map(Self::parse_bin_item)
            .collect();

        info!(count = bins.len(), "Listed bins");
        Ok(bins)
    }

    #[instrument(skip(self), fields(table = %self.bins_table))]
    async fn get_bin(&self, bin_id: &Uuid) -> Result<Option<BinInfo>> {
        let result = self
            .client
            .get_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(result.item.as_ref().and_then(Self::parse_bin_item))
    }

    #[instrument(skip(self, request), fields(table = %self.bins_table))]
    async fn create_bin(&self, bin_id: &Uuid, request: &CreateBinRequest) -> Result<()> {
        let now = Utc::now();
        let bin_type = request.bin_type.unwrap_or_default();

        let mut put_item = self
            .client
            .put_item()
            .table_name(&self.bins_table)
            .item("binId", AttributeValue::S(bin_id.to_string()))
            .item("Name", AttributeValue::S(request.name.clone()))
            .item("binType", AttributeValue::S(bin_type.to_string()))
            .item("status", AttributeValue::N("0".to_string()))
            .item("reportsCount", AttributeValue::N("0".to_string()))
            .item("lastUpdated", AttributeValue::S(now.to_rfc3339()))
            .item("isActive", AttributeValue::Bool(true));

        // Add optional address
        if let Some(address) = &request.address {
            put_item = put_item.item("address", AttributeValue::S(address.clone()));
        }

        // Add optional coordinates as a map
        if let Some(coords) = &request.coordinates {
            let coords_map = std::collections::HashMap::from([
                (
                    "latitude".to_string(),
                    AttributeValue::N(coords.latitude.to_string()),
                ),
                (
                    "longitude".to_string(),
                    AttributeValue::N(coords.longitude.to_string()),
                ),
            ]);
            put_item = put_item.item("coordinates", AttributeValue::M(coords_map));
        }

        put_item
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(bin_id = %bin_id, name = %request.name, bin_type = %bin_type, "Bin created successfully");
        Ok(())
    }

    #[instrument(skip(self, request), fields(table = %self.bins_table))]
    async fn update_bin(&self, bin_id: &Uuid, request: &UpdateBinRequest) -> Result<()> {
        let mut update_expression_parts = Vec::new();
        let mut expression_values = std::collections::HashMap::new();

        if let Some(name) = &request.name {
            update_expression_parts.push("#n = :name");
            expression_values.insert(":name".to_string(), AttributeValue::S(name.clone()));
        }

        if let Some(bin_type) = &request.bin_type {
            update_expression_parts.push("binType = :binType");
            expression_values.insert(
                ":binType".to_string(),
                AttributeValue::S(bin_type.to_string()),
            );
        }

        if let Some(address) = &request.address {
            update_expression_parts.push("address = :address");
            expression_values.insert(":address".to_string(), AttributeValue::S(address.clone()));
        }

        if let Some(coords) = &request.coordinates {
            update_expression_parts.push("coordinates = :coords");
            let coords_map = std::collections::HashMap::from([
                (
                    "latitude".to_string(),
                    AttributeValue::N(coords.latitude.to_string()),
                ),
                (
                    "longitude".to_string(),
                    AttributeValue::N(coords.longitude.to_string()),
                ),
            ]);
            expression_values.insert(":coords".to_string(), AttributeValue::M(coords_map));
        }

        if let Some(is_active) = request.is_active {
            update_expression_parts.push("isActive = :active");
            expression_values.insert(":active".to_string(), AttributeValue::Bool(is_active));
        }

        if update_expression_parts.is_empty() {
            return Ok(()); // Nothing to update
        }

        let update_expression = format!("SET {}", update_expression_parts.join(", "));

        let mut request_builder = self
            .client
            .update_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .update_expression(update_expression);

        // Add expression attribute name for reserved word "Name"
        if request.name.is_some() {
            request_builder =
                request_builder.expression_attribute_names("#n".to_string(), "Name".to_string());
        }

        for (key, value) in expression_values {
            request_builder = request_builder.expression_attribute_values(key, value);
        }

        request_builder
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(bin_id = %bin_id, "Bin updated successfully");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.bins_table))]
    async fn delete_bin(&self, bin_id: &Uuid) -> Result<()> {
        // Soft delete - set isActive to false
        self.client
            .update_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .update_expression("SET isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(false))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(bin_id = %bin_id, "Bin deactivated (soft delete)");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.bins_table))]
    async fn list_bins_paginated(
        &self,
        limit: i32,
        cursor: Option<String>,
    ) -> Result<(Vec<BinInfo>, Option<String>)> {
        let mut scan = self
            .client
            .scan()
            .table_name(&self.bins_table)
            .filter_expression("isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(true))
            .limit(limit);

        // Decode cursor to exclusive_start_key
        if let Some(cursor_str) = cursor {
            if let Ok(decoded) = BASE64.decode(&cursor_str) {
                if let Ok(bin_id) = String::from_utf8(decoded) {
                    scan = scan.exclusive_start_key("binId", AttributeValue::S(bin_id));
                }
            }
        }

        let result = scan
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let bins: Vec<BinInfo> = result
            .items
            .unwrap_or_default()
            .iter()
            .filter_map(Self::parse_bin_item)
            .collect();

        // Encode next cursor from LastEvaluatedKey
        let next_cursor = result.last_evaluated_key.and_then(|key| {
            key.get("binId")
                .and_then(|v| v.as_s().ok())
                .map(|bin_id| BASE64.encode(bin_id.as_bytes()))
        });

        info!(
            count = bins.len(),
            has_more = next_cursor.is_some(),
            "Listed bins (paginated)"
        );
        Ok((bins, next_cursor))
    }
}

// =============================================================================
// Webhook Repository Implementation
// =============================================================================

impl DynamoDbRepository {
    fn parse_webhook_item(
        item: &std::collections::HashMap<String, AttributeValue>,
    ) -> Option<WebhookConfig> {
        let webhook_id = item.get("webhookId").and_then(|v| v.as_s().ok()).cloned()?;

        let events = item
            .get("events")
            .and_then(|v| v.as_l().ok())
            .map(|list| list.iter().filter_map(|v| v.as_s().ok().cloned()).collect())
            .unwrap_or_default();

        Some(WebhookConfig {
            webhook_id,
            name: item
                .get("name")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            url: item
                .get("url")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            auth_type: item
                .get("authType")
                .and_then(|v| v.as_s().ok())
                .map(|s| WebhookAuthType::parse(s))
                .unwrap_or_default(),
            auth_header: item.get("authHeader").and_then(|v| v.as_s().ok()).cloned(),
            auth_value: item.get("authValue").and_then(|v| v.as_s().ok()).cloned(),
            events,
            is_active: item
                .get("isActive")
                .and_then(|v| v.as_bool().ok())
                .copied()
                .unwrap_or(true),
            created_at: item
                .get("createdAt")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            updated_at: item
                .get("updatedAt")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            last_triggered_at: item
                .get("lastTriggeredAt")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            success_count: item
                .get("successCount")
                .and_then(|v| v.as_n().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            failure_count: item
                .get("failureCount")
                .and_then(|v| v.as_n().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        })
    }
}

#[async_trait]
impl WebhookRepository for DynamoDbRepository {
    #[instrument(skip(self), fields(table = %self.webhooks_table))]
    async fn list_webhooks(&self) -> Result<Vec<WebhookConfig>> {
        let result = self
            .client
            .scan()
            .table_name(&self.webhooks_table)
            .filter_expression("isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(true))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let webhooks: Vec<WebhookConfig> = result
            .items
            .unwrap_or_default()
            .iter()
            .filter_map(Self::parse_webhook_item)
            .collect();

        info!(count = webhooks.len(), "Listed webhooks");
        Ok(webhooks)
    }

    #[instrument(skip(self), fields(table = %self.webhooks_table))]
    async fn get_webhook(&self, webhook_id: &str) -> Result<Option<WebhookConfig>> {
        let result = self
            .client
            .get_item()
            .table_name(&self.webhooks_table)
            .key("webhookId", AttributeValue::S(webhook_id.to_string()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(result.item.as_ref().and_then(Self::parse_webhook_item))
    }

    #[instrument(skip(self, webhook), fields(table = %self.webhooks_table))]
    async fn create_webhook(&self, webhook: &WebhookConfig) -> Result<()> {
        let events_list: Vec<AttributeValue> = webhook
            .events
            .iter()
            .map(|e| AttributeValue::S(e.clone()))
            .collect();

        let mut put_item = self
            .client
            .put_item()
            .table_name(&self.webhooks_table)
            .item("webhookId", AttributeValue::S(webhook.webhook_id.clone()))
            .item("name", AttributeValue::S(webhook.name.clone()))
            .item("url", AttributeValue::S(webhook.url.clone()))
            .item("authType", AttributeValue::S(webhook.auth_type.to_string()))
            .item("events", AttributeValue::L(events_list))
            .item("isActive", AttributeValue::Bool(webhook.is_active))
            .item(
                "successCount",
                AttributeValue::N(webhook.success_count.to_string()),
            )
            .item(
                "failureCount",
                AttributeValue::N(webhook.failure_count.to_string()),
            );

        if let Some(header) = &webhook.auth_header {
            put_item = put_item.item("authHeader", AttributeValue::S(header.clone()));
        }
        if let Some(value) = &webhook.auth_value {
            put_item = put_item.item("authValue", AttributeValue::S(value.clone()));
        }
        if let Some(created_at) = &webhook.created_at {
            put_item = put_item.item("createdAt", AttributeValue::S(created_at.to_rfc3339()));
        }
        if let Some(updated_at) = &webhook.updated_at {
            put_item = put_item.item("updatedAt", AttributeValue::S(updated_at.to_rfc3339()));
        }

        put_item
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(webhook_id = %webhook.webhook_id, "Webhook created successfully");
        Ok(())
    }

    #[instrument(skip(self, request), fields(table = %self.webhooks_table))]
    async fn update_webhook(&self, webhook_id: &str, request: &UpdateWebhookRequest) -> Result<()> {
        let mut update_parts = Vec::new();
        let mut expression_values = std::collections::HashMap::new();

        if let Some(name) = &request.name {
            update_parts.push("#n = :name");
            expression_values.insert(":name".to_string(), AttributeValue::S(name.clone()));
        }

        if let Some(url) = &request.url {
            update_parts.push("url = :url");
            expression_values.insert(":url".to_string(), AttributeValue::S(url.clone()));
        }

        if let Some(auth_type) = &request.auth_type {
            update_parts.push("authType = :authType");
            expression_values.insert(
                ":authType".to_string(),
                AttributeValue::S(auth_type.to_string()),
            );
        }

        if let Some(auth_header) = &request.auth_header {
            update_parts.push("authHeader = :authHeader");
            expression_values.insert(
                ":authHeader".to_string(),
                AttributeValue::S(auth_header.clone()),
            );
        }

        if let Some(auth_value) = &request.auth_value {
            update_parts.push("authValue = :authValue");
            expression_values.insert(
                ":authValue".to_string(),
                AttributeValue::S(auth_value.clone()),
            );
        }

        if let Some(events) = &request.events {
            update_parts.push("events = :events");
            let events_list: Vec<AttributeValue> = events
                .iter()
                .map(|e| AttributeValue::S(e.clone()))
                .collect();
            expression_values.insert(":events".to_string(), AttributeValue::L(events_list));
        }

        if let Some(is_active) = request.is_active {
            update_parts.push("isActive = :active");
            expression_values.insert(":active".to_string(), AttributeValue::Bool(is_active));
        }

        // Always update updatedAt
        update_parts.push("updatedAt = :updatedAt");
        expression_values.insert(
            ":updatedAt".to_string(),
            AttributeValue::S(Utc::now().to_rfc3339()),
        );

        if update_parts.is_empty() {
            return Ok(());
        }

        let update_expression = format!("SET {}", update_parts.join(", "));

        let mut request_builder = self
            .client
            .update_item()
            .table_name(&self.webhooks_table)
            .key("webhookId", AttributeValue::S(webhook_id.to_string()))
            .update_expression(update_expression);

        // "name" is a reserved word in DynamoDB
        if request.name.is_some() {
            request_builder =
                request_builder.expression_attribute_names("#n".to_string(), "name".to_string());
        }

        for (key, value) in expression_values {
            request_builder = request_builder.expression_attribute_values(key, value);
        }

        request_builder
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(webhook_id = %webhook_id, "Webhook updated successfully");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.webhooks_table))]
    async fn delete_webhook(&self, webhook_id: &str) -> Result<()> {
        // Soft delete - set isActive to false
        self.client
            .update_item()
            .table_name(&self.webhooks_table)
            .key("webhookId", AttributeValue::S(webhook_id.to_string()))
            .update_expression("SET isActive = :active, updatedAt = :updatedAt")
            .expression_attribute_values(":active", AttributeValue::Bool(false))
            .expression_attribute_values(":updatedAt", AttributeValue::S(Utc::now().to_rfc3339()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(webhook_id = %webhook_id, "Webhook deactivated (soft delete)");
        Ok(())
    }
}

// =============================================================================
// API Key Repository Implementation
// =============================================================================

impl DynamoDbRepository {
    fn parse_api_key_item(
        item: &std::collections::HashMap<String, AttributeValue>,
    ) -> Option<ApiKeyRecord> {
        let key_id = item.get("keyId").and_then(|v| v.as_s().ok()).cloned()?;

        let scopes = item
            .get("scopes")
            .and_then(|v| v.as_l().ok())
            .map(|list| list.iter().filter_map(|v| v.as_s().ok().cloned()).collect())
            .unwrap_or_default();

        Some(ApiKeyRecord {
            key_id,
            key_hash: item
                .get("keyHash")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            key_prefix: item
                .get("keyPrefix")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            name: item
                .get("name")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            scopes,
            created_by: item
                .get("createdBy")
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default(),
            created_at: item
                .get("createdAt")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(Utc::now),
            last_used_at: item
                .get("lastUsedAt")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            is_active: item
                .get("isActive")
                .and_then(|v| v.as_bool().ok())
                .copied()
                .unwrap_or(true),
            expires_at: item
                .get("expiresAt")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
        })
    }
}

#[async_trait]
impl ApiKeyRepository for DynamoDbRepository {
    #[instrument(skip(self), fields(table = %self.api_keys_table))]
    async fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>> {
        let result = self
            .client
            .scan()
            .table_name(&self.api_keys_table)
            .filter_expression("isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(true))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let keys: Vec<ApiKeyRecord> = result
            .items
            .unwrap_or_default()
            .iter()
            .filter_map(Self::parse_api_key_item)
            .collect();

        info!(count = keys.len(), "Listed API keys");
        Ok(keys)
    }

    #[instrument(skip(self), fields(table = %self.api_keys_table))]
    async fn get_api_key(&self, key_id: &str) -> Result<Option<ApiKeyRecord>> {
        let result = self
            .client
            .get_item()
            .table_name(&self.api_keys_table)
            .key("keyId", AttributeValue::S(key_id.to_string()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(result.item.as_ref().and_then(Self::parse_api_key_item))
    }

    #[instrument(skip(self, record), fields(table = %self.api_keys_table))]
    async fn create_api_key(&self, record: &ApiKeyRecord) -> Result<()> {
        let scopes_list: Vec<AttributeValue> = record
            .scopes
            .iter()
            .map(|s| AttributeValue::S(s.clone()))
            .collect();

        let mut put_item = self
            .client
            .put_item()
            .table_name(&self.api_keys_table)
            .item("keyId", AttributeValue::S(record.key_id.clone()))
            .item("keyHash", AttributeValue::S(record.key_hash.clone()))
            .item("keyPrefix", AttributeValue::S(record.key_prefix.clone()))
            .item("name", AttributeValue::S(record.name.clone()))
            .item("scopes", AttributeValue::L(scopes_list))
            .item("createdBy", AttributeValue::S(record.created_by.clone()))
            .item(
                "createdAt",
                AttributeValue::S(record.created_at.to_rfc3339()),
            )
            .item("isActive", AttributeValue::Bool(record.is_active));

        if let Some(expires_at) = &record.expires_at {
            put_item = put_item.item("expiresAt", AttributeValue::S(expires_at.to_rfc3339()));
        }

        put_item
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(key_id = %record.key_id, "API key created successfully");
        Ok(())
    }

    #[instrument(skip(self, request), fields(table = %self.api_keys_table))]
    async fn update_api_key(&self, key_id: &str, request: &UpdateApiKeyRequest) -> Result<()> {
        let mut update_parts = Vec::new();
        let mut expression_values = std::collections::HashMap::new();

        if let Some(name) = &request.name {
            update_parts.push("#n = :name");
            expression_values.insert(":name".to_string(), AttributeValue::S(name.clone()));
        }

        if let Some(scopes) = &request.scopes {
            update_parts.push("scopes = :scopes");
            let scopes_list: Vec<AttributeValue> = scopes
                .iter()
                .map(|s| AttributeValue::S(s.clone()))
                .collect();
            expression_values.insert(":scopes".to_string(), AttributeValue::L(scopes_list));
        }

        if let Some(is_active) = request.is_active {
            update_parts.push("isActive = :active");
            expression_values.insert(":active".to_string(), AttributeValue::Bool(is_active));
        }

        if update_parts.is_empty() {
            return Ok(());
        }

        let update_expression = format!("SET {}", update_parts.join(", "));

        let mut request_builder = self
            .client
            .update_item()
            .table_name(&self.api_keys_table)
            .key("keyId", AttributeValue::S(key_id.to_string()))
            .update_expression(update_expression);

        // "name" is a reserved word in DynamoDB
        if request.name.is_some() {
            request_builder =
                request_builder.expression_attribute_names("#n".to_string(), "name".to_string());
        }

        for (key, value) in expression_values {
            request_builder = request_builder.expression_attribute_values(key, value);
        }

        request_builder
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(key_id = %key_id, "API key updated successfully");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.api_keys_table))]
    async fn delete_api_key(&self, key_id: &str) -> Result<()> {
        // Soft delete
        self.client
            .update_item()
            .table_name(&self.api_keys_table)
            .key("keyId", AttributeValue::S(key_id.to_string()))
            .update_expression("SET isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(false))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(key_id = %key_id, "API key deactivated (soft delete)");
        Ok(())
    }
}

// =============================================================================
// Report Repository Implementation (archive & reset)
// =============================================================================

#[async_trait]
impl ReportRepository for DynamoDbRepository {
    #[instrument(skip(self), fields(table = %self.status_reports_table))]
    async fn query_reports(&self, bin_id: &Uuid) -> Result<Vec<StatusReport>> {
        let result = self
            .client
            .query()
            .table_name(&self.status_reports_table)
            .key_condition_expression("binId = :bid")
            .expression_attribute_values(":bid", AttributeValue::S(bin_id.to_string()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let reports: Vec<StatusReport> = result
            .items
            .unwrap_or_default()
            .iter()
            .filter_map(|item| {
                let bin_id = item
                    .get("binId")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| Uuid::parse_str(s).ok())?;
                let created_at = item.get("createdAt").and_then(|v| v.as_s().ok()).cloned()?;
                let status = item
                    .get("status")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
                let source = item
                    .get("source")
                    .and_then(|v| v.as_s().ok())
                    .cloned()
                    .unwrap_or_else(|| "unknown".to_string());

                Some(StatusReport {
                    bin_id,
                    created_at,
                    status,
                    source,
                })
            })
            .collect();

        info!(bin_id = %bin_id, count = reports.len(), "Queried reports");
        Ok(reports)
    }

    #[instrument(skip(self, reports), fields(table = %self.archived_reports_table))]
    async fn archive_reports(
        &self,
        bin_id: &Uuid,
        reports: &[StatusReport],
        batch_id: &str,
        archived_by: &str,
    ) -> Result<usize> {
        if reports.is_empty() {
            return Ok(0);
        }

        let archived_at = Utc::now().to_rfc3339();
        let mut archived = 0;

        // DynamoDB BatchWriteItem supports max 25 items per request
        for chunk in reports.chunks(25) {
            let write_requests: Vec<aws_sdk_dynamodb::types::WriteRequest> = chunk
                .iter()
                .map(|report| {
                    let mut item = std::collections::HashMap::new();
                    item.insert("binId".to_string(), AttributeValue::S(bin_id.to_string()));
                    item.insert(
                        "createdAt".to_string(),
                        AttributeValue::S(report.created_at.clone()),
                    );
                    item.insert(
                        "status".to_string(),
                        AttributeValue::N(report.status.to_string()),
                    );
                    item.insert(
                        "source".to_string(),
                        AttributeValue::S(report.source.clone()),
                    );
                    item.insert(
                        "archivedAt".to_string(),
                        AttributeValue::S(archived_at.clone()),
                    );
                    item.insert(
                        "archiveBatchId".to_string(),
                        AttributeValue::S(batch_id.to_string()),
                    );
                    item.insert(
                        "archivedBy".to_string(),
                        AttributeValue::S(archived_by.to_string()),
                    );

                    aws_sdk_dynamodb::types::WriteRequest::builder()
                        .put_request(
                            aws_sdk_dynamodb::types::PutRequest::builder()
                                .set_item(Some(item))
                                .build()
                                .expect("valid put request"),
                        )
                        .build()
                })
                .collect();

            self.client
                .batch_write_item()
                .request_items(&self.archived_reports_table, write_requests)
                .send()
                .await
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;

            archived += chunk.len();
        }

        info!(bin_id = %bin_id, archived = archived, batch_id = %batch_id, "Archived reports");
        Ok(archived)
    }

    #[instrument(skip(self, reports), fields(table = %self.status_reports_table))]
    async fn delete_reports(&self, bin_id: &Uuid, reports: &[StatusReport]) -> Result<()> {
        if reports.is_empty() {
            return Ok(());
        }

        // DynamoDB BatchWriteItem supports max 25 items per request
        for chunk in reports.chunks(25) {
            let write_requests: Vec<aws_sdk_dynamodb::types::WriteRequest> = chunk
                .iter()
                .map(|report| {
                    let mut key = std::collections::HashMap::new();
                    key.insert("binId".to_string(), AttributeValue::S(bin_id.to_string()));
                    key.insert(
                        "createdAt".to_string(),
                        AttributeValue::S(report.created_at.clone()),
                    );

                    aws_sdk_dynamodb::types::WriteRequest::builder()
                        .delete_request(
                            aws_sdk_dynamodb::types::DeleteRequest::builder()
                                .set_key(Some(key))
                                .build()
                                .expect("valid delete request"),
                        )
                        .build()
                })
                .collect();

            self.client
                .batch_write_item()
                .request_items(&self.status_reports_table, write_requests)
                .send()
                .await
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        }

        info!(bin_id = %bin_id, deleted = reports.len(), "Deleted reports from source table");
        Ok(())
    }

    #[instrument(skip(self), fields(table = %self.bins_table))]
    async fn reset_bin_status(&self, bin_id: &Uuid) -> Result<()> {
        let now = Utc::now().to_rfc3339();

        self.client
            .update_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .update_expression("SET #s = :zero, reportsCount = :zero, lastUpdated = :now")
            .expression_attribute_names("#s", "status")
            .expression_attribute_values(":zero", AttributeValue::N("0".to_string()))
            .expression_attribute_values(":now", AttributeValue::S(now))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(bin_id = %bin_id, "Reset bin status to 0");
        Ok(())
    }
}
