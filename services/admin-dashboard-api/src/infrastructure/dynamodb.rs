use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use chrono::{DateTime, Utc};
use tracing::{info, instrument};
use uuid::Uuid;

use crate::config::Config;
use crate::domain::{
    AdminUser, AppError, BinInfo, BinRepository, Result, UpdateBinRequest, UserRepository, UserRole,
};

pub struct DynamoDbRepository {
    client: Client,
    users_table: String,
    bins_table: String,
}

impl DynamoDbRepository {
    pub async fn new(config: &Config) -> Result<Self> {
        let sdk_config = if let Some(endpoint) = &config.dynamodb_endpoint {
            info!(endpoint = %endpoint, "Using custom DynamoDB endpoint (LocalStack)");
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .endpoint_url(endpoint)
                .region(aws_config::Region::new(config.aws_region.clone()))
                .load()
                .await
        } else {
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .region(aws_config::Region::new(config.aws_region.clone()))
                .load()
                .await
        };

        let client = Client::new(&sdk_config);

        Ok(Self {
            client,
            users_table: config.admin_users_table.clone(),
            bins_table: config.trash_bins_table.clone(),
        })
    }

    fn parse_user_role(role_str: &str) -> UserRole {
        match role_str.to_lowercase().as_str() {
            "admin" => UserRole::Admin,
            "operator" => UserRole::Operator,
            _ => UserRole::Viewer,
        }
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
            .item("passwordHash", AttributeValue::S(user.password_hash.clone()))
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
}

#[async_trait]
impl BinRepository for DynamoDbRepository {
    #[instrument(skip(self), fields(table = %self.bins_table))]
    async fn list_bins(&self) -> Result<Vec<BinInfo>> {
        let result = self
            .client
            .scan()
            .table_name(&self.bins_table)
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let bins: Vec<BinInfo> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                let bin_id = item
                    .get("binId")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| Uuid::parse_str(s).ok())?;

                Some(BinInfo {
                    bin_id,
                    name: item
                        .get("Name")
                        .and_then(|v| v.as_s().ok())
                        .cloned()
                        .unwrap_or_else(|| "Unknown".to_string()),
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
            })
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

        match result.item {
            Some(item) => {
                let bin = BinInfo {
                    bin_id: *bin_id,
                    name: item
                        .get("Name")
                        .and_then(|v| v.as_s().ok())
                        .cloned()
                        .unwrap_or_else(|| "Unknown".to_string()),
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
                };
                Ok(Some(bin))
            }
            None => Ok(None),
        }
    }

    #[instrument(skip(self), fields(table = %self.bins_table))]
    async fn create_bin(&self, bin_id: &Uuid, name: &str) -> Result<()> {
        let now = Utc::now();

        self.client
            .put_item()
            .table_name(&self.bins_table)
            .item("binId", AttributeValue::S(bin_id.to_string()))
            .item("Name", AttributeValue::S(name.to_string()))
            .item("status", AttributeValue::N("0".to_string()))
            .item("reportsCount", AttributeValue::N("0".to_string()))
            .item("lastUpdated", AttributeValue::S(now.to_rfc3339()))
            .item("isActive", AttributeValue::Bool(true))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        info!(bin_id = %bin_id, name = %name, "Bin created successfully");
        Ok(())
    }

    #[instrument(skip(self, request), fields(table = %self.bins_table))]
    async fn update_bin(&self, bin_id: &Uuid, request: &UpdateBinRequest) -> Result<()> {
        let mut update_expression_parts = Vec::new();
        let mut expression_values = std::collections::HashMap::new();

        if let Some(name) = &request.name {
            update_expression_parts.push("Name = :name");
            expression_values.insert(":name".to_string(), AttributeValue::S(name.clone()));
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
}
