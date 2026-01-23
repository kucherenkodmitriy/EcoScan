use aws_lambda_events::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use aws_lambda_events::encodings::Body;
use aws_lambda_events::http::HeaderMap;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use chrono::Utc;
use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde::Deserialize;
use std::collections::HashMap;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContactRequest {
    // For demo requests
    company_name: Option<String>,
    // For contact forms
    name: Option<String>,
    organization: Option<String>,
    message: Option<String>,
    // Common fields
    email: String,
    recaptcha_token: String,
    #[serde(default)]
    request_type: String, // "demo" or "contact"
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Fields are populated by deserialization
struct RecaptchaResponse {
    success: bool,
    score: Option<f64>,
    action: Option<String>,
    challenge_ts: Option<String>,
    hostname: Option<String>,
    #[serde(rename = "error-codes")]
    error_codes: Option<Vec<String>>,
}

#[derive(Debug, thiserror::Error)]
enum HandlerError {
    #[error("DynamoDB error: {0}")]
    DynamoDb(String),
    #[error("HTTP error: {0}")]
    Http(String),
}

async fn verify_recaptcha(token: &str, secret: &str) -> Result<RecaptchaResponse, HandlerError> {
    let client = reqwest::Client::new();
    let params = [("secret", secret), ("response", token)];

    let response = client
        .post("https://www.google.com/recaptcha/api/siteverify")
        .form(&params)
        .send()
        .await
        .map_err(|e| HandlerError::Http(format!("reCAPTCHA request failed: {}", e)))?;

    let recaptcha_response: RecaptchaResponse = response
        .json()
        .await
        .map_err(|e| HandlerError::Http(format!("Failed to parse reCAPTCHA response: {}", e)))?;

    Ok(recaptcha_response)
}

async fn save_contact_request(
    client: &DynamoDbClient,
    table_name: &str,
    request: &ContactRequest,
    recaptcha_score: f64,
) -> Result<String, HandlerError> {
    let request_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    // TTL: expire after 90 days for GDPR compliance
    let ttl = (Utc::now().timestamp() + 90 * 24 * 60 * 60).to_string();

    let mut item = HashMap::new();
    item.insert(
        "requestId".to_string(),
        AttributeValue::S(request_id.clone()),
    );
    item.insert("createdAt".to_string(), AttributeValue::S(created_at));
    item.insert(
        "email".to_string(),
        AttributeValue::S(request.email.clone()),
    );
    item.insert(
        "recaptchaScore".to_string(),
        AttributeValue::N(recaptcha_score.to_string()),
    );
    item.insert("ttl".to_string(), AttributeValue::N(ttl));
    item.insert(
        "status".to_string(),
        AttributeValue::S("pending".to_string()),
    );
    item.insert(
        "requestType".to_string(),
        AttributeValue::S(request.request_type.clone()),
    );

    // Add request-specific fields
    if let Some(company) = &request.company_name {
        item.insert(
            "companyName".to_string(),
            AttributeValue::S(company.clone()),
        );
    }
    if let Some(name) = &request.name {
        item.insert("name".to_string(), AttributeValue::S(name.clone()));
    }
    if let Some(org) = &request.organization {
        item.insert("organization".to_string(), AttributeValue::S(org.clone()));
    }
    if let Some(msg) = &request.message {
        item.insert("message".to_string(), AttributeValue::S(msg.clone()));
    }

    client
        .put_item()
        .table_name(table_name)
        .set_item(Some(item))
        .send()
        .await
        .map_err(|e| HandlerError::DynamoDb(format!("Failed to save to DynamoDB: {}", e)))?;

    Ok(request_id)
}

fn create_response(status_code: i64, body: serde_json::Value) -> ApiGatewayProxyResponse {
    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    headers.insert("Access-Control-Allow-Origin", "*".parse().unwrap());
    headers.insert(
        "Access-Control-Allow-Methods",
        "POST,OPTIONS".parse().unwrap(),
    );
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type".parse().unwrap(),
    );

    ApiGatewayProxyResponse {
        status_code,
        headers,
        multi_value_headers: HeaderMap::new(),
        body: Some(Body::Text(body.to_string())),
        is_base64_encoded: false,
    }
}

async fn function_handler(
    event: LambdaEvent<ApiGatewayProxyRequest>,
) -> Result<ApiGatewayProxyResponse, Error> {
    // Handle CORS preflight
    if event.payload.http_method == "OPTIONS" {
        return Ok(create_response(200, serde_json::json!({})));
    }

    // Get environment variables
    let table_name = std::env::var("DEMO_REQUESTS_TABLE")
        .unwrap_or_else(|_| "local-ecoscan-demo-requests".to_string());
    let recaptcha_secret = std::env::var("RECAPTCHA_SECRET_KEY").ok();

    // Skip reCAPTCHA validation (for e2e tests only)
    let skip_recaptcha = std::env::var("SKIP_RECAPTCHA")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    // Minimum required reCAPTCHA score
    let min_score: f64 = std::env::var("RECAPTCHA_MIN_SCORE")
        .unwrap_or_else(|_| "0.5".to_string())
        .parse()
        .unwrap_or(0.5);

    // Parse request body
    let body = event.payload.body.ok_or("Missing request body")?;
    let mut request: ContactRequest =
        serde_json::from_str(&body).map_err(|e| format!("Invalid request body: {}", e))?;

    // Auto-detect request type if not provided
    if request.request_type.is_empty() {
        request.request_type = if request.company_name.is_some() {
            "demo".to_string()
        } else {
            "contact".to_string()
        };
    }

    info!(
        "Processing {} request from: {} (type: {})",
        request.request_type, request.email, request.request_type
    );

    // reCAPTCHA validation (can be skipped for e2e tests)
    let score = if skip_recaptcha {
        warn!("SKIP_RECAPTCHA is enabled - skipping reCAPTCHA validation (e2e test mode)");
        1.0 // Perfect score when skipped
    } else {
        // Verify reCAPTCHA secret is configured
        let recaptcha_secret = match recaptcha_secret {
            Some(secret) if !secret.is_empty() => secret,
            _ => {
                error!("RECAPTCHA_SECRET_KEY is not configured");
                return Ok(create_response(
                    500,
                    serde_json::json!({
                        "error": "Server configuration error",
                        "message": "Please contact us directly at partnerships@ecoscan.city"
                    }),
                ));
            }
        };

        // Verify reCAPTCHA server-side (SECURE!)
        let recaptcha_response = match verify_recaptcha(&request.recaptcha_token, &recaptcha_secret)
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                error!("reCAPTCHA verification error: {}", e);
                return Ok(create_response(
                    400,
                    serde_json::json!({
                        "error": "Verification failed",
                        "message": "Please try again or contact us directly at partnerships@ecoscan.city"
                    }),
                ));
            }
        };

        // Check if reCAPTCHA validation succeeded
        if !recaptcha_response.success {
            warn!(
                "reCAPTCHA validation failed for {}: {:?}",
                request.email, recaptcha_response.error_codes
            );
            return Ok(create_response(
                400,
                serde_json::json!({
                    "error": "Security validation failed",
                    "message": "Please try again. If the problem persists, contact us at partnerships@ecoscan.city"
                }),
            ));
        }

        // Check reCAPTCHA score (lower score = more likely a bot)
        let score = recaptcha_response.score.unwrap_or(0.0);
        if score < min_score {
            warn!(
                "reCAPTCHA score too low for {}: {} (minimum: {})",
                request.email, score, min_score
            );
            return Ok(create_response(
                400,
                serde_json::json!({
                    "error": "Security check failed",
                    "message": "Your submission appears automated. Please contact us directly at partnerships@ecoscan.city",
                    "score": score
                }),
            ));
        }

        info!(
            "reCAPTCHA passed for {} with score: {}",
            request.email, score
        );

        score
    };

    // Save to DynamoDB
    let config = aws_config::load_from_env().await;
    let client = DynamoDbClient::new(&config);

    let request_id = match save_contact_request(&client, &table_name, &request, score).await {
        Ok(id) => id,
        Err(e) => {
            error!("Failed to save request: {}", e);
            return Ok(create_response(
                500,
                serde_json::json!({
                    "error": "Failed to save request",
                    "message": "Please try again or contact us at partnerships@ecoscan.city"
                }),
            ));
        }
    };

    info!("Request saved with ID: {} (score: {})", request_id, score);

    // Success response
    Ok(create_response(
        200,
        serde_json::json!({
            "success": true,
            "requestId": request_id,
            "message": "Thank you! We've received your request and will respond within 24 hours.",
            "score": score
        }),
    ))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    lambda_runtime::run(service_fn(function_handler)).await
}
