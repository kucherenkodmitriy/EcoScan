//! Repository implementations for the bin-status-reporter service

use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::{
    BinRepository, 
    BinStatus,
    error::RepositoryError,
    Result
};

/// Implementation of BinRepository for DynamoDB
pub struct DynamoBinRepository {
    client: aws_sdk_dynamodb::Client,
    table_name: String,
}

impl DynamoBinRepository {
    /// Create a new DynamoBinRepository
    pub fn new(client: aws_sdk_dynamodb::Client, table_name: impl Into<String>) -> Self {
        Self {
            client,
            table_name: table_name.into(),
        }
    }
}

#[async_trait]
impl BinRepository for DynamoBinRepository {
    async fn update_status(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<()> {
        let status_value = status.value();
        
        // First get current status and count
        let result = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let item = result.item().ok_or_else(|| RepositoryError::NotFound("Bin not found".to_string()))?;
        
        let current_status = item.get("status")
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse::<i32>().ok())
            .unwrap_or(0);
            
        let reports_count = item.get("reportsCount")
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse::<i32>().ok())
            .unwrap_or(0);

        // Calculate new average
        let new_average = if reports_count == 0 {
            status_value
        } else {
            ((current_status * reports_count) + status_value) / (reports_count + 1)
        };
        
        self.client
            .update_item()
            .table_name(&self.table_name)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .update_expression("SET #s = :s, #u = :u, #rc = #rc + :one")
            .expression_attribute_names("#s", "status")
            .expression_attribute_names("#u", "lastUpdated")
            .expression_attribute_names("#rc", "reportsCount")
            .expression_attribute_values(":s", AttributeValue::N(new_average.to_string()))
            .expression_attribute_values(":u", AttributeValue::S(timestamp.to_rfc3339()))
            .expression_attribute_values(":one", AttributeValue::N("1".to_string()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
            
        Ok(())
    }

    async fn add_report(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<()> {
        let status_value = status.value();
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .item("binId", AttributeValue::S(bin_id.to_string()))
            .item("status", AttributeValue::N(status_value.to_string()))
            .item("reportsCount", AttributeValue::N("1".to_string()))
            .item("lastUpdated", AttributeValue::S(timestamp.to_rfc3339()))
            .item("location", AttributeValue::S("Test Location".to_string()))
            .item("type", AttributeValue::S("general".to_string()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
            
        Ok(())
    }
}
