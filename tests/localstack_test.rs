use aws_config::BehaviorVersion;
use aws_sdk_dynamodb::{types::AttributeValue, Client};
use reqwest;
use serde_json::json;
use std::env;
use uuid::Uuid;

async fn setup_dynamodb_client() -> Client {
    let config = aws_config::defaults(BehaviorVersion::latest())
        .endpoint_url("http://localhost:4566")
        .region("eu-central-1")
        .load()
        .await;
    Client::new(&config)
}

#[tokio::test]
async fn test_update_bin_status_via_api_gateway_e2e() {
    // --- 1. Setup ---
    let api_endpoint = env::var("API_ENDPOINT").expect("API_ENDPOINT environment variable not set");
    let db_client = setup_dynamodb_client().await;
    let http_client = reqwest::Client::new();

    let bin_id = Uuid::new_v4();
    let trash_bins_table = "dev-ecoscan-trash-bins";
    let status_reports_table = "dev-ecoscan-status-reports";

    // --- 2. Arrange ---
    // Create a bin directly in DynamoDB for the test.
    db_client
        .put_item()
        .table_name(trash_bins_table)
        .item("binId", AttributeValue::S(bin_id.to_string()))
        .item("name", AttributeValue::S("E2E Test Bin".to_string()))
        .send()
        .await
        .expect("Failed to create test bin in DynamoDB");

    println!("Created test bin with ID: {}", bin_id);

    // --- 3. Act ---
    // Send a request to the API Gateway endpoint.
    let status_level = 8;
    let url = format!("{}/bins/{}/status", api_endpoint, bin_id);
    let response = http_client
        .post(&url)
        .json(&json!({ "status": status_level }))
        .send()
        .await
        .expect("Failed to send request to API Gateway");

    // --- 4. Assert ---
    // Check the HTTP response
    assert_eq!(response.status(), 200, "Expected HTTP 200 OK");
    let response_body: serde_json::Value = response.json().await.expect("Failed to parse response body");
    assert_eq!(response_body["success"], true);
    assert!(response_body["message"].as_str().unwrap().contains("80%"));

    println!("API call successful: {}", response_body);

    // Check the database for the new status report
    let result = db_client
        .query()
        .table_name(status_reports_table)
        .key_condition_expression("binId = :id")
        .expression_attribute_values(":id", AttributeValue::S(bin_id.to_string()))
        .limit(1)
        .scan_index_forward(false) // Get the latest report
        .send()
        .await
        .expect("Failed to query DynamoDB for status report");

    let items = result.items();
    assert_eq!(items.len(), 1, "Expected to find one status report");

    let report = &items[0];
    let status_val = report.get("status").unwrap().as_n().unwrap().parse::<i8>().unwrap();
    assert_eq!(status_val, status_level, "The status in the database does not match");

    println!("Successfully verified status update in DynamoDB!");
}
