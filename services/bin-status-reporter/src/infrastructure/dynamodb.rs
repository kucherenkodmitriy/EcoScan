use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_credential_types::Credentials;
use aws_sdk_dynamodb::{types::AttributeValue, Client};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::{
    calculate_fullness_default, error::RepositoryError, BinRepository, BinStatus, ReportSource,
    ReportValue, Result, DEFAULT_WINDOW_SIZE,
};

pub struct DynamoDbRepository {
    client: Client,
    bins_table: String,
    reports_table: String,
}

impl DynamoDbRepository {
    pub fn new_with_client(client: Client, bins_table: String, reports_table: String) -> Self {
        Self {
            client,
            bins_table,
            reports_table,
        }
    }

    /// Internal method to fetch recent reports, used by both update_status and get_recent_reports
    async fn get_recent_reports_internal(
        &self,
        bin_id: &Uuid,
        limit: usize,
    ) -> Result<Vec<ReportValue>> {
        let result = self
            .client
            .query()
            .table_name(&self.reports_table)
            .key_condition_expression("binId = :bin_id")
            .expression_attribute_values(":bin_id", AttributeValue::S(bin_id.to_string()))
            .scan_index_forward(false) // Descending order (newest first)
            .limit(limit as i32)
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let reports = result
            .items()
            .iter()
            .filter_map(|item| {
                item.get("status")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|n| n.parse::<i32>().ok())
                    .map(ReportValue::new)
            })
            .collect();

        Ok(reports)
    }

    pub async fn new() -> Result<Self> {
        let is_local = std::env::var("DYNAMODB_ENDPOINT_URL").is_ok();
        let client = if is_local {
            let endpoint_url = std::env::var("DYNAMODB_ENDPOINT_URL").unwrap();
            println!(
                "[DEBUG] LocalStack environment detected. Using endpoint: {}",
                &endpoint_url
            );

            let credentials = Credentials::new("test", "test", None, None, "local");
            let config = aws_sdk_dynamodb::Config::builder()
                .behavior_version_latest()
                .region(aws_config::Region::new("eu-central-1"))
                .credentials_provider(credentials)
                .endpoint_url(endpoint_url)
                .build();
            Client::from_conf(config)
        } else {
            // For real AWS, use the default provider chain.
            let region_provider = RegionProviderChain::default_provider().or_else("eu-central-1");
            let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
                .region(region_provider)
                .load()
                .await;
            Client::new(&config)
        };

        let bins_table = std::env::var("TRASH_BINS_TABLE_NAME").map_err(|_| {
            RepositoryError::ValidationError(
                "TRASH_BINS_TABLE_NAME environment variable not set".to_string(),
            )
        })?;
        let reports_table = std::env::var("STATUS_REPORTS_TABLE_NAME").map_err(|_| {
            RepositoryError::ValidationError(
                "STATUS_REPORTS_TABLE_NAME environment variable not set".to_string(),
            )
        })?;
        println!(
            "[DEBUG] Using bins_table: {} | reports_table: {}",
            bins_table, reports_table
        );
        Ok(Self {
            client,
            bins_table,
            reports_table,
        })
    }

    pub async fn get_average_status(&self, bin_id: &Uuid) -> Result<f64> {
        let result = self
            .client
            .get_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let item = result
            .item()
            .ok_or_else(|| RepositoryError::DatabaseError("Bin not found".to_string()))?;

        let status = item
            .get("status")
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse::<i32>().ok())
            .unwrap_or(0);

        let reports_count = item
            .get("reportsCount")
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse::<i32>().ok())
            .unwrap_or(0);

        if reports_count == 0 {
            return Ok(0.0);
        }

        Ok(status as f64)
    }
}

#[async_trait]
impl BinRepository for DynamoDbRepository {
    async fn create_bin(&self, bin_id: &Uuid, name: &str) -> Result<()> {
        self.client
            .put_item()
            .table_name(&self.bins_table)
            .item("binId", AttributeValue::S(bin_id.to_string()))
            .item("Name", AttributeValue::S(name.to_string()))
            .item("status", AttributeValue::N("0".to_string()))
            .item("reportsCount", AttributeValue::N("0".to_string()))
            .item("lastUpdated", AttributeValue::S(Utc::now().to_rfc3339()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn update_status(
        &self,
        bin_id: &Uuid,
        _status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<()> {
        // Fetch recent reports for weighted average calculation
        let recent_reports = self
            .get_recent_reports_internal(bin_id, DEFAULT_WINDOW_SIZE)
            .await?;

        // Calculate weighted average of recent reports
        let weighted_average = calculate_fullness_default(&recent_reports);

        // Get current reports count for incrementing
        let result = self
            .client
            .get_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let reports_count = result
            .item()
            .and_then(|item| item.get("reportsCount"))
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse::<i32>().ok())
            .unwrap_or(0);

        let new_reports_count = reports_count + 1;

        // Update bin with weighted average status
        self.client
            .update_item()
            .table_name(&self.bins_table)
            .key("binId", AttributeValue::S(bin_id.to_string()))
            .update_expression("SET #s = :s, #u = :u, #rc = :rc")
            .expression_attribute_names("#s", "status")
            .expression_attribute_names("#u", "lastUpdated")
            .expression_attribute_names("#rc", "reportsCount")
            .expression_attribute_values(":s", AttributeValue::N(weighted_average.to_string()))
            .expression_attribute_values(":u", AttributeValue::S(timestamp.to_rfc3339()))
            .expression_attribute_values(":rc", AttributeValue::N(new_reports_count.to_string()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn add_report(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        source: ReportSource,
        timestamp: DateTime<Utc>,
    ) -> Result<()> {
        self.client
            .put_item()
            .table_name(&self.reports_table)
            .item("binId", AttributeValue::S(bin_id.to_string()))
            .item("createdAt", AttributeValue::S(timestamp.to_rfc3339()))
            .item("status", AttributeValue::N(status.value().to_string()))
            .item("source", AttributeValue::S(source.to_string()))
            .send()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn get_recent_reports(&self, bin_id: &Uuid, limit: usize) -> Result<Vec<ReportValue>> {
        self.get_recent_reports_internal(bin_id, limit).await
    }
}
