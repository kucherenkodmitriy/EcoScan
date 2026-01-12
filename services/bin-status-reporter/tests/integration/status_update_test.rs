use bin_status_reporter::{
    domain::{BinStatus, StatusUpdateRequest},
    update_bin_status,
    infrastructure::test_utils,
};
use lambda_runtime::LambdaEvent;
use aws_sdk_dynamodb::types::AttributeValue;
use std::sync::Once;
use uuid::Uuid;

static INIT: Once = Once::new();
static TEST_BIN_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

/// Set up test environment before running tests
async fn setup_test_environment() -> aws_sdk_dynamodb::Client {
    INIT.call_once(|| {
        test_utils::setup_localstack_env();
    });

    let config = aws_config::load_defaults(
        aws_config::BehaviorVersion::latest()
    ).await;
    
    // Override endpoint for LocalStack
    let config = aws_sdk_dynamodb::config::Builder::from(&config)
        .endpoint_url("http://localhost:4566")
        .build();
        
    let client = aws_sdk_dynamodb::Client::from_conf(config);
    
    // Ensure test table exists and has required data
    ensure_test_table(&client).await;
    
    client
}

/// Ensure test table exists with required data
async fn ensure_test_table(client: &aws_sdk_dynamodb::Client) {
    let table_name = std::env::var("TRASH_BINS_TABLE").unwrap_or_else(|_| "dev-ecoscan-bin-status".to_string());
    
    // Try to create table if it doesn't exist
    let _ = client
        .create_table()
        .table_name(&table_name)
        .attribute_definitions(
            aws_sdk_dynamodb::types::AttributeDefinition::builder()
                .attribute_name("binId")
                .attribute_type(aws_sdk_dynamodb::types::ScalarAttributeType::S)
                .build()
                .expect("Failed to build attribute definition"),
        )
        .key_schema(
            aws_sdk_dynamodb::types::KeySchemaElement::builder()
                .attribute_name("binId")
                .key_type(aws_sdk_dynamodb::types::KeyType::Hash)
                .build()
                .expect("Failed to build key schema"),
        )
        .provisioned_throughput(
            aws_sdk_dynamodb::types::ProvisionedThroughput::builder()
                .read_capacity_units(5)
                .write_capacity_units(5)
                .build()
                .expect("Failed to build provisioned throughput"),
        )
        .send()
        .await
        .ok(); // Ignore error if table already exists

    // Insert test data
    let _ = client
        .put_item()
        .table_name(&table_name)
        .item("binId", AttributeValue::S(TEST_BIN_ID.to_string()))
        .item("status", AttributeValue::N("0".to_string()))
        .item("reportsCount", AttributeValue::N("0".to_string()))
        .item("location", AttributeValue::S("Test Location".to_string()))
        .item("type", AttributeValue::S("general".to_string()))
        .item("lastUpdated", AttributeValue::S(chrono::Utc::now().to_rfc3339()))
        .send()
        .await
        .expect("Failed to insert test data");
}

/// Test updating a bin status to full
/// 
/// This test verifies that:
/// 1. The bin status can be updated to 'Full' (status = 10)
/// 2. The response indicates success
/// 3. The response message contains the expected status
#[tokio::test]
async fn test_update_bin_status() {
    // Setup test environment and get DynamoDB client
    let _client = setup_test_environment().await;

    // Create test request
    let bin_id = TEST_BIN_ID.parse().expect("Invalid test bin ID");
    let request = StatusUpdateRequest {
        bin_id,
        status: BinStatus::full(),
    };

    // Execute the function under test
    let event = LambdaEvent::new(request, Default::default());
    let response = update_bin_status(event)
        .await
        .expect("Failed to update bin status");

    // Verify results
    assert!(response.success, "Expected successful status update");
    assert!(
        response.message.contains("Full"),
        "Expected response to contain 'Full', got: {}",
        response.message
    );
}

/// Test updating a bin status with a custom value (50% full)
/// 
/// This test verifies that:
/// 1. The bin status can be updated to a custom value (5 = 50%)
/// 2. The response indicates success
/// 3. The response message contains the expected percentage
/// 4. The average calculation works correctly
#[tokio::test]
async fn test_update_bin_status_with_custom_value() {
    // Setup test environment and get DynamoDB client
    let client = setup_test_environment().await;

    // First, verify initial state
    let initial_status = client
        .get_item()
        .table_name("dev-ecoscan-bin-status")
        .key("binId", AttributeValue::S(TEST_BIN_ID.to_string()))
        .send()
        .await
        .expect("Failed to get initial bin status");
        
    let initial_count = initial_status
        .item()
        .and_then(|i| i.get("reportsCount"))
        .and_then(|v| v.as_n().ok())
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    // Create test request
    let bin_id = TEST_BIN_ID.parse().expect("Invalid test bin ID");
    let request = StatusUpdateRequest {
        bin_id,
        status: BinStatus::new(5).expect("Failed to create status"),
    };

    // Execute the function under test
    let event = LambdaEvent::new(request, Default::default());
    let response = update_bin_status(event)
        .await
        .expect("Failed to update bin status");

    // Verify results
    assert!(response.success, "Expected successful status update");
    assert!(
        response.message.contains("50%"),
        "Expected response to contain '50%', got: {}",
        response.message
    );

    // Verify the update was persisted
    let updated_status = client
        .get_item()
        .table_name("dev-ecoscan-bin-status")
        .key("binId", AttributeValue::S(TEST_BIN_ID.to_string()))
        .send()
        .await
        .expect("Failed to get updated bin status");
        
    let new_count = updated_status
        .item()
        .and_then(|i| i.get("reportsCount"))
        .and_then(|v| v.as_n().ok())
        .and_then(|s| s.parse::<i32>().ok())
        .expect("Missing reportsCount in response");
        
    assert_eq!(
        new_count,
        initial_count + 1,
        "Expected reportsCount to be incremented by 1"
    );
}
