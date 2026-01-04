use serde_json::json;

#[tokio::test]
async fn test_update_bin_status_e2e() {
    let api_endpoint = std::env::var("API_ENDPOINT").expect("API_ENDPOINT must be set");
    let test_bin_id = "00000000-0000-0000-0000-000000000001"; // Default bin from seed script

    let client = reqwest::Client::new();
    let url = format!("{}/bins/{}/status", api_endpoint, test_bin_id);
    println!("Testing endpoint: {}", url);

    let response = client
        .post(&url)
        .json(&json!({
            "status": 50
        }))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success(), "Request failed with status: {}", response.status());

    let body: serde_json::Value = response.json().await.expect("Failed to parse response body");
    println!("Received response body: {}", body);

    // With the async SQS architecture, the API Gateway returns a queued message
    assert_eq!(body["message"], "Status update queued for processing");
}
