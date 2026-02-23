use std::sync::Arc;
use std::time::Duration;

use aws_config::timeout::TimeoutConfig;
use aws_lambda_events::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use aws_lambda_events::encodings::Body;
use aws_lambda_events::http::HeaderMap;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_sesv2::types::{Body as SesBody, Content, Destination, EmailContent, Message};
use aws_sdk_sesv2::Client as SesClient;
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
    #[error("SES error: {0}")]
    Ses(String),
    #[error("Validation error: {0}")]
    Validation(String),
}

/// Shared state initialized at cold start
struct HandlerState {
    dynamodb_client: DynamoDbClient,
    ses_client: Option<SesClient>,
    http_client: reqwest::Client,
    table_name: String,
    recaptcha_secret: Option<String>,
    skip_recaptcha: bool,
    min_score: f64,
    notify_email: Option<String>,
    from_email: Option<String>,
    cors_origin: String,
}

fn validate_contact_request(request: &ContactRequest) -> Result<(), HandlerError> {
    // Validate email format
    let email = request.email.trim();
    if email.len() > 254 {
        return Err(HandlerError::Validation(
            "Email address is too long".to_string(),
        ));
    }
    if !email.contains('@') || !email.contains('.') {
        return Err(HandlerError::Validation(
            "Invalid email address format".to_string(),
        ));
    }

    // Validate length limits
    if let Some(name) = &request.name {
        if name.len() > 200 {
            return Err(HandlerError::Validation(
                "Name is too long (max 200 characters)".to_string(),
            ));
        }
    }
    if let Some(company) = &request.company_name {
        if company.len() > 200 {
            return Err(HandlerError::Validation(
                "Company name is too long (max 200 characters)".to_string(),
            ));
        }
    }
    if let Some(org) = &request.organization {
        if org.len() > 200 {
            return Err(HandlerError::Validation(
                "Organization is too long (max 200 characters)".to_string(),
            ));
        }
    }
    if let Some(message) = &request.message {
        if message.len() > 5000 {
            return Err(HandlerError::Validation(
                "Message is too long (max 5000 characters)".to_string(),
            ));
        }
    }

    Ok(())
}

/// Sanitize a string for use in email headers to prevent header injection.
/// Strips carriage returns and newlines.
fn sanitize_for_email_header(input: &str) -> String {
    input.replace(['\r', '\n'], "")
}

async fn verify_recaptcha(
    http_client: &reqwest::Client,
    token: &str,
    secret: &str,
) -> Result<RecaptchaResponse, HandlerError> {
    let params = [("secret", secret), ("response", token)];

    let response = http_client
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

async fn send_notification_email(
    ses_client: &SesClient,
    from_email: &str,
    to_email: &str,
    request: &ContactRequest,
    request_id: &str,
) -> Result<(), HandlerError> {
    let subject = match request.request_type.as_str() {
        "demo" => sanitize_for_email_header(&format!(
            "New Demo Request from {}",
            request.company_name.as_deref().unwrap_or("Unknown Company")
        )),
        _ => sanitize_for_email_header(&format!(
            "New Contact Form Submission from {}",
            request.name.as_deref().unwrap_or("Unknown")
        )),
    };

    let body_text = match request.request_type.as_str() {
        "demo" => format!(
            "New demo request received!\n\n\
             Request ID: {}\n\
             Company: {}\n\
             Email: {}\n\
             Type: Demo Request\n\n\
             ---\n\
             Respond to this inquiry at: {}\n",
            request_id,
            request.company_name.as_deref().unwrap_or("Not provided"),
            request.email,
            request.email
        ),
        _ => format!(
            "New contact form submission received!\n\n\
             Request ID: {}\n\
             Name: {}\n\
             Email: {}\n\
             Organization: {}\n\
             Type: Contact Form\n\n\
             Message:\n{}\n\n\
             ---\n\
             Respond to this inquiry at: {}\n",
            request_id,
            request.name.as_deref().unwrap_or("Not provided"),
            request.email,
            request.organization.as_deref().unwrap_or("Not provided"),
            request.message.as_deref().unwrap_or("No message provided"),
            request.email
        ),
    };

    let subject_content = Content::builder()
        .data(subject)
        .charset("UTF-8")
        .build()
        .map_err(|e| HandlerError::Ses(format!("Failed to build subject: {}", e)))?;

    let body_content = Content::builder()
        .data(body_text)
        .charset("UTF-8")
        .build()
        .map_err(|e| HandlerError::Ses(format!("Failed to build body: {}", e)))?;

    let email_content = EmailContent::builder()
        .simple(
            Message::builder()
                .subject(subject_content)
                .body(SesBody::builder().text(body_content).build())
                .build(),
        )
        .build();

    ses_client
        .send_email()
        .from_email_address(from_email)
        .destination(Destination::builder().to_addresses(to_email).build())
        .content(email_content)
        .send()
        .await
        .map_err(|e| HandlerError::Ses(format!("Failed to send email: {}", e)))?;

    Ok(())
}

fn create_response(
    status_code: i64,
    body: serde_json::Value,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let mut headers = HeaderMap::new();
    headers.insert(
        "Content-Type",
        "application/json"
            .parse()
            .expect("valid Content-Type header"),
    );
    headers.insert(
        "Access-Control-Allow-Origin",
        cors_origin
            .parse()
            .expect("valid Access-Control-Allow-Origin header"),
    );
    headers.insert(
        "Access-Control-Allow-Methods",
        "POST,OPTIONS"
            .parse()
            .expect("valid Access-Control-Allow-Methods header"),
    );
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type"
            .parse()
            .expect("valid Access-Control-Allow-Headers header"),
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
    state: &HandlerState,
) -> Result<ApiGatewayProxyResponse, Error> {
    let cors_origin = state.cors_origin.as_str();

    // Handle CORS preflight
    if event.payload.http_method == "OPTIONS" {
        return Ok(create_response(200, serde_json::json!({}), cors_origin));
    }

    // Parse request body
    let body = event.payload.body.ok_or("Missing request body")?;
    let mut request: ContactRequest =
        serde_json::from_str(&body).map_err(|e| format!("Invalid request body: {}", e))?;

    // Validate input
    if let Err(e) = validate_contact_request(&request) {
        warn!("Validation failed: {}", e);
        return Ok(create_response(
            400,
            serde_json::json!({
                "error": "Validation failed",
                "message": e.to_string()
            }),
            cors_origin,
        ));
    }

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
    let score = if state.skip_recaptcha {
        warn!("SKIP_RECAPTCHA is enabled - skipping reCAPTCHA validation (e2e test mode)");
        1.0 // Perfect score when skipped
    } else {
        // Verify reCAPTCHA secret is configured
        let recaptcha_secret = match &state.recaptcha_secret {
            Some(secret) if !secret.is_empty() => secret.clone(),
            _ => {
                error!("RECAPTCHA_SECRET_KEY is not configured");
                return Ok(create_response(
                    500,
                    serde_json::json!({
                        "error": "Server configuration error",
                        "message": "Please contact us directly at partnerships@ecoscan.city"
                    }),
                    cors_origin,
                ));
            }
        };

        // Verify reCAPTCHA server-side (SECURE!)
        let recaptcha_response = match verify_recaptcha(
            &state.http_client,
            &request.recaptcha_token,
            &recaptcha_secret,
        )
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
                    cors_origin,
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
                cors_origin,
            ));
        }

        // Check reCAPTCHA score (lower score = more likely a bot)
        let score = recaptcha_response.score.unwrap_or(0.0);
        if score < state.min_score {
            warn!(
                "reCAPTCHA score too low for {}: {} (minimum: {})",
                request.email, score, state.min_score
            );
            return Ok(create_response(
                400,
                serde_json::json!({
                    "error": "Security check failed",
                    "message": "Your submission appears automated. Please contact us directly at partnerships@ecoscan.city",
                    "score": score
                }),
                cors_origin,
            ));
        }

        info!(
            "reCAPTCHA passed for {} with score: {}",
            request.email, score
        );

        score
    };

    // Save to DynamoDB
    let request_id = match save_contact_request(
        &state.dynamodb_client,
        &state.table_name,
        &request,
        score,
    )
    .await
    {
        Ok(id) => id,
        Err(e) => {
            error!("Failed to save request: {}", e);
            return Ok(create_response(
                500,
                serde_json::json!({
                    "error": "Failed to save request",
                    "message": "Please try again or contact us at partnerships@ecoscan.city"
                }),
                cors_origin,
            ));
        }
    };

    info!("Request saved with ID: {} (score: {})", request_id, score);

    // Send email notification
    if let (Some(to_email), Some(from_email), Some(ses_client)) =
        (&state.notify_email, &state.from_email, &state.ses_client)
    {
        match send_notification_email(ses_client, from_email, to_email, &request, &request_id).await
        {
            Ok(_) => info!("Notification email sent to {}", to_email),
            Err(e) => {
                // Log error but don't fail the request - email is best-effort
                warn!("Failed to send notification email: {}", e);
            }
        }
    } else {
        info!("Email notifications disabled (NOTIFY_EMAIL or FROM_EMAIL not configured)");
    }

    // Success response
    Ok(create_response(
        200,
        serde_json::json!({
            "success": true,
            "requestId": request_id,
            "message": "Thank you! We've received your request and will respond within 24 hours.",
            "score": score
        }),
        cors_origin,
    ))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Build AWS SDK config with timeouts at cold start
    let timeout_config = TimeoutConfig::builder()
        .connect_timeout(Duration::from_secs(5))
        .operation_timeout(Duration::from_secs(10))
        .build();

    let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .timeout_config(timeout_config)
        .load()
        .await;

    let dynamodb_client = DynamoDbClient::new(&sdk_config);

    // Build SES client only if email config is present
    let notify_email = std::env::var("NOTIFY_EMAIL").ok();
    let from_email = std::env::var("FROM_EMAIL").ok();
    let ses_client = if notify_email.is_some() && from_email.is_some() {
        Some(SesClient::new(&sdk_config))
    } else {
        None
    };

    // Build HTTP client with timeout for reCAPTCHA requests
    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("failed to build HTTP client");

    let state = Arc::new(HandlerState {
        dynamodb_client,
        ses_client,
        http_client,
        table_name: std::env::var("DEMO_REQUESTS_TABLE")
            .unwrap_or_else(|_| "local-ecoscan-demo-requests".to_string()),
        recaptcha_secret: std::env::var("RECAPTCHA_SECRET_KEY").ok(),
        skip_recaptcha: std::env::var("SKIP_RECAPTCHA")
            .map(|v| v.eq_ignore_ascii_case("true"))
            .unwrap_or(false),
        min_score: std::env::var("RECAPTCHA_MIN_SCORE")
            .unwrap_or_else(|_| "0.5".to_string())
            .parse()
            .unwrap_or(0.5),
        notify_email,
        from_email,
        cors_origin: std::env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| "*".to_string()),
    });

    lambda_runtime::run(service_fn(move |event| {
        let state = state.clone();
        async move { function_handler(event, &state).await }
    }))
    .await
}
