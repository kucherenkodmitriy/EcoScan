use aws_sdk_dynamodb::{types::AttributeValue, Client};
use aws_config::meta::region::RegionProviderChain;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use async_trait::async_trait;

use crate::error::AppError;
use crate::domain::{BinRepository, BinStatus};

pub struct DynamoDbRepository {
    client: Client,
    bins_table: String,
    reports_table: String,
}

impl DynamoDbRepository {
    pub async fn new() -> Result<Self, AppError> {
        let region_provider = RegionProviderChain::default_provider().or_else("eu-central-1");
        let config = aws_config::from_env().region(region_provider).load().await;
        let client = Client::new(&config);
        let bins_table = std::env::var("TRASH_BINS_TABLE")
            .map_err(|e| AppError::InternalError(e.to_string()))?;
        let reports_table = std::env::var("STATUS_REPORTS_TABLE")
            .map_err(|e| AppError::InternalError(e.to_string()))?;
        Ok(Self { client, bins_table, reports_table })
    }
}

#[async_trait]
impl BinRepository for DynamoDbRepository {
    async fn update_status(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<(), AppError> {
        self.client
            .update_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .update_expression("SET #s = :s, #u = :u")
            .expression_attribute_names("#s", "status")
            .expression_attribute_names("#u", "lastUpdated")
            .expression_attribute_values(":s", AttributeValue::S(status.to_string()))
            .expression_attribute_values(":u", AttributeValue::S(timestamp.to_rfc3339()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn add_report(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<(), AppError> {
        self.client
            .put_item()
            .table_name(&self.reports_table)
            .item("binId", AttributeValue::S(bin_id.to_string()))
            .item("createdAt", AttributeValue::S(timestamp.to_rfc3339()))
            .item("status", AttributeValue::S(status.to_string()))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }
}
