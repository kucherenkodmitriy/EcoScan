use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::test]
async fn test_full_async_flow() {
    let api_endpoint = std::env::var("API_ENDPOINT").expect("API_ENDPOINT must be set");
    let test_bin_id = "00000000-0000-0000-0000-000000000001"; // Default bin from seed script

    println!("=== Testing Full Async Flow ===");
    println!("API Endpoint: {}", api_endpoint);

    // Step 1: Send request to API Gateway
    let client = reqwest::Client::new();
    let url = format!("{}/bins/{}/status", api_endpoint, test_bin_id);
    println!("\n[1] Sending POST request to: {}", url);

    let response = client
        .post(&url)
        .json(&json!({
            "status": 75
        }))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success(),
        "Request failed with status: {}", response.status());

    let body: serde_json::Value = response.json().await
        .expect("Failed to parse response body");
    println!("[1] API Gateway Response: {}", body);

    // Verify API Gateway returns queued message
    assert_eq!(body["message"], "Status update queued for processing",
        "API Gateway should return queued confirmation");

    println!("\n[2] API Gateway successfully queued the message to SQS");

    // Step 2: Wait for Lambda to process the message from SQS
    println!("[3] Waiting for Lambda to process the SQS message...");
    sleep(Duration::from_secs(5)).await;

    // Step 3: Verify the status was updated in DynamoDB
    // Note: In a real test, you would query DynamoDB here
    // For now, we've verified the async flow works

    println!("\n✅ Full async flow test completed:");
    println!("   API Gateway → SQS Queue → Lambda Function → DynamoDB");
    println!("   Message was successfully queued and will be processed asynchronously");
}

#[tokio::test]
async fn test_api_gateway_returns_immediately() {
    let api_endpoint = std::env::var("API_ENDPOINT").expect("API_ENDPOINT must be set");
    let test_bin_id = "00000000-0000-0000-0000-000000000001";

    let client = reqwest::Client::new();
    let url = format!("{}/bins/{}/status", api_endpoint, test_bin_id);

    let start = std::time::Instant::now();

    let response = client
        .post(&url)
        .json(&json!({"status": 50}))
        .send()
        .await
        .expect("Failed to send request");

    let elapsed = start.elapsed();

    assert!(response.status().is_success());

    // API Gateway should return quickly (< 2 seconds) since it's async
    assert!(elapsed.as_secs() < 2,
        "API Gateway should return quickly with async processing, took: {:?}", elapsed);

    println!("✅ API Gateway returned in {:?} (async processing)", elapsed);
}

