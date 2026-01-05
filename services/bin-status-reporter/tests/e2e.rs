use serde_json::json;
use std::env;

#[tokio::test]
async fn test_update_bin_status_e2e() {
    // 1. Get API Endpoint from environment variable
    let api_endpoint = env::var("API_ENDPOINT").expect("API_ENDPOINT environment variable not set");
    let bin_id = "00000000-0000-0000-0000-000000000001"; // The default bin seeded by our script
    let url = format!("{}/bins/{}/status", api_endpoint, bin_id);

    println!("Testing endpoint: {}", url);

    // 2. Make the HTTP request
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&json!({ "status": 50 }))
        .send()
        .await
        .expect("Failed to send request");

    // 3. Assert the response
    assert_eq!(response.status(), 200, "Expected status code 200");

    let response_body: serde_json::Value = response
        .json()
        .await
        .expect("Failed to parse response body");
    println!("Received response body: {}", response_body);

    assert_eq!(
        response_body["success"], true,
        "Expected success to be true"
    );
    assert!(
        response_body["message"].as_str().is_some(),
        "Expected a message string"
    );
}
