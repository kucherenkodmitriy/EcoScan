pub mod application;
pub mod config;
pub mod domain;
pub mod infrastructure;

use std::sync::Arc;

use aws_lambda_events::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use aws_lambda_events::encodings::Body;
use aws_lambda_events::http::HeaderMap;
use lambda_runtime::{Error, LambdaEvent};
use serde_json::json;
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

use crate::application::{
    create_api_key, create_bin, create_webhook, delete_api_key, delete_bin, delete_webhook,
    get_api_key, get_bin, get_bin_external, get_webhook, handle_forgot_password, handle_login,
    handle_reset_password, list_api_keys, list_bins, list_bins_external, list_webhooks,
    update_api_key, update_bin, update_webhook,
};
use crate::config::Config;
use crate::domain::{
    AppError, CreateApiKeyRequest, CreateBinRequest, CreateWebhookRequest, ForgotPasswordRequest,
    LoginRequest, PublicBinInfo, ResetPasswordRequest, UpdateApiKeyRequest, UpdateBinRequest,
    UpdateWebhookRequest,
};
use crate::infrastructure::{DynamoDbRepository, EmailService, JwtConfig};

/// Shared application state initialized at cold start
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub email_service: Arc<EmailService>,
}

/// Build a successful JSON response with CORS headers
fn success_response(
    status_code: i64,
    body: serde_json::Value,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    headers.insert("Access-Control-Allow-Origin", cors_origin.parse().unwrap());
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-API-Key".parse().unwrap(),
    );
    headers.insert(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS".parse().unwrap(),
    );

    ApiGatewayProxyResponse {
        status_code,
        headers,
        multi_value_headers: HeaderMap::new(),
        body: Some(Body::Text(body.to_string())),
        is_base64_encoded: false,
    }
}

/// Build an error JSON response with CORS headers
fn error_response(status_code: i64, message: &str, cors_origin: &str) -> ApiGatewayProxyResponse {
    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    headers.insert("Access-Control-Allow-Origin", cors_origin.parse().unwrap());
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-API-Key".parse().unwrap(),
    );
    headers.insert(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS".parse().unwrap(),
    );

    ApiGatewayProxyResponse {
        status_code,
        headers,
        multi_value_headers: HeaderMap::new(),
        body: Some(Body::Text(json!({ "error": message }).to_string())),
        is_base64_encoded: false,
    }
}

/// Map AppError to HTTP status code
fn error_to_status_code(error: &AppError) -> i64 {
    match error {
        AppError::InvalidCredentials | AppError::AuthenticationError(_) => 401,
        AppError::UserNotFound(_)
        | AppError::BinNotFound(_)
        | AppError::WebhookNotFound(_)
        | AppError::ApiKeyNotFound(_) => 404,
        AppError::ValidationError(_) | AppError::ResetTokenInvalid => 400,
        AppError::DatabaseError(_) | AppError::InternalError(_) | AppError::JwtError(_) => 500,
    }
}

/// Build a CORS preflight response for OPTIONS requests
fn cors_preflight_response(cors_origin: &str) -> ApiGatewayProxyResponse {
    let mut headers = HeaderMap::new();
    headers.insert("Access-Control-Allow-Origin", cors_origin.parse().unwrap());
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-API-Key".parse().unwrap(),
    );
    headers.insert(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS".parse().unwrap(),
    );
    headers.insert("Access-Control-Max-Age", "86400".parse().unwrap());

    ApiGatewayProxyResponse {
        status_code: 200,
        headers,
        multi_value_headers: HeaderMap::new(),
        body: None,
        is_base64_encoded: false,
    }
}

/// Build an HTML response
fn html_response(html: &str) -> ApiGatewayProxyResponse {
    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "text/html; charset=utf-8".parse().unwrap());
    headers.insert("Cache-Control", "public, max-age=3600".parse().unwrap());

    ApiGatewayProxyResponse {
        status_code: 200,
        headers,
        multi_value_headers: HeaderMap::new(),
        body: Some(Body::Text(html.to_string())),
        is_base64_encoded: false,
    }
}

/// Embedded static HTML for bin reporting page
const REPORT_HTML: &str = include_str!("../static/report.html");

/// Embedded static HTML for admin login page
const LOGIN_HTML: &str = include_str!("../static/login.html");

/// Embedded static HTML for admin dashboard page
const DASHBOARD_HTML: &str = include_str!("../static/dashboard.html");

/// Extract path parameter from API Gateway event
fn get_path_param(event: &ApiGatewayProxyRequest, name: &str) -> Option<String> {
    event.path_parameters.get(name).map(|v| v.to_string())
}

/// Create the Lambda handler with shared state
///
/// This returns a closure that captures the AppState, allowing config
/// to be loaded once at cold start and reused across invocations.
#[allow(clippy::type_complexity)]
pub fn create_handler(
    state: AppState,
) -> impl Fn(
    LambdaEvent<ApiGatewayProxyRequest>,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<ApiGatewayProxyResponse, Error>> + Send>,
> + Send
       + Sync {
    move |event| {
        let state = state.clone();
        Box::pin(async move { api_handler_inner(event, &state).await })
    }
}

/// Main Lambda handler for API Gateway requests
#[instrument(skip(event, state), fields(path = %event.payload.path.as_deref().unwrap_or("unknown")))]
async fn api_handler_inner(
    event: LambdaEvent<ApiGatewayProxyRequest>,
    state: &AppState,
) -> Result<ApiGatewayProxyResponse, Error> {
    let (request, _context) = event.into_parts();

    let method = request.http_method.as_str();
    let path = request.path.as_deref().unwrap_or("");

    info!(method = %method, path = %path, "Handling request");

    let config = &state.config;
    let cors_origin = config.cors_allowed_origins.as_str();

    // Initialize repository
    let repo = match DynamoDbRepository::new(config).await {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "Failed to initialize repository");
            return Ok(error_response(500, "Internal server error", cors_origin));
        }
    };

    // Route the request
    let response = match (method, path) {
        // Handle CORS preflight requests for all paths
        ("OPTIONS", _) => cors_preflight_response(cors_origin),

        // Static pages (no auth required - auth handled client-side with JWT)
        ("GET", "/static/report.html") => html_response(REPORT_HTML),
        ("GET", "/static/login.html") => html_response(LOGIN_HTML),
        ("GET", "/static/dashboard.html") => html_response(DASHBOARD_HTML),

        // Login endpoint (no auth required)
        ("POST", p) if p.ends_with("/auth/login") => {
            handle_login_request(&request, &repo, config, cors_origin).await
        }

        // Forgot password (no auth required)
        ("POST", p) if p.ends_with("/auth/forgot-password") => {
            handle_forgot_password_request(
                &request,
                &repo,
                &state.email_service,
                config,
                cors_origin,
            )
            .await
        }

        // Reset password (no auth required)
        ("POST", p) if p.ends_with("/auth/reset-password") => {
            handle_reset_password_request(&request, &repo, cors_origin).await
        }

        // Public bin info for QR report page (no auth required)
        ("GET", p) if p.contains("/report/") => {
            let bin_id = get_path_param(&request, "bin_id");
            handle_get_public_bin(&repo, bin_id, cors_origin).await
        }

        // List bins
        ("GET", p) if p.ends_with("/admin/bins") => handle_list_bins(&repo, cors_origin).await,

        // Get single bin
        ("GET", p) if p.contains("/admin/bins/") => {
            let bin_id = get_path_param(&request, "bin_id");
            handle_get_bin(&repo, bin_id, cors_origin).await
        }

        // Create bin
        ("POST", p) if p.ends_with("/admin/bins") => {
            handle_create_bin(&request, &repo, cors_origin).await
        }

        // Update bin
        ("PUT", p) if p.contains("/admin/bins/") => {
            let bin_id = get_path_param(&request, "bin_id");
            handle_update_bin(&request, &repo, bin_id, cors_origin).await
        }

        // Delete bin
        ("DELETE", p) if p.contains("/admin/bins/") => {
            let bin_id = get_path_param(&request, "bin_id");
            handle_delete_bin(&repo, bin_id, cors_origin).await
        }

        // List webhooks
        ("GET", p) if p.ends_with("/admin/webhooks") => {
            handle_list_webhooks(&repo, cors_origin).await
        }

        // Create webhook
        ("POST", p) if p.ends_with("/admin/webhooks") => {
            handle_create_webhook(&request, &repo, cors_origin).await
        }

        // Get single webhook
        ("GET", p) if p.contains("/admin/webhooks/") => {
            let webhook_id = extract_last_path_segment(p);
            handle_get_webhook(&repo, webhook_id, cors_origin).await
        }

        // Update webhook
        ("PUT", p) if p.contains("/admin/webhooks/") => {
            let webhook_id = extract_last_path_segment(p);
            handle_update_webhook(&request, &repo, webhook_id, cors_origin).await
        }

        // Delete webhook
        ("DELETE", p) if p.contains("/admin/webhooks/") => {
            let webhook_id = extract_last_path_segment(p);
            handle_delete_webhook(&repo, webhook_id, cors_origin).await
        }

        // =================================================================
        // External API endpoints (protected by API key authorizer)
        // =================================================================

        // List bins (external API with pagination)
        ("GET", p) if p.ends_with("/api/bins") => {
            let limit = extract_query_param(&request, "limit").and_then(|v| v.parse::<i32>().ok());
            let cursor = extract_query_param(&request, "cursor");
            handle_list_bins_external(&repo, limit, cursor, cors_origin).await
        }

        // Get single bin (external API)
        ("GET", p) if p.contains("/api/bins/") => {
            let bin_id = get_path_param(&request, "bin_id");
            handle_get_bin_external(&repo, bin_id, cors_origin).await
        }

        // =================================================================
        // Admin API key management endpoints
        // =================================================================

        // List API keys
        ("GET", p) if p.ends_with("/admin/api-keys") => {
            handle_list_api_keys(&repo, cors_origin).await
        }

        // Create API key
        ("POST", p) if p.ends_with("/admin/api-keys") => {
            let created_by = extract_authorizer_context(&request, "email")
                .unwrap_or_else(|| "unknown".to_string());
            handle_create_api_key(&request, &repo, &created_by, cors_origin).await
        }

        // Get single API key
        ("GET", p) if p.contains("/admin/api-keys/") => {
            let key_id = extract_last_path_segment(p);
            handle_get_api_key(&repo, key_id, cors_origin).await
        }

        // Update API key
        ("PUT", p) if p.contains("/admin/api-keys/") => {
            let key_id = extract_last_path_segment(p);
            handle_update_api_key(&request, &repo, key_id, cors_origin).await
        }

        // Delete API key
        ("DELETE", p) if p.contains("/admin/api-keys/") => {
            let key_id = extract_last_path_segment(p);
            handle_delete_api_key(&repo, key_id, cors_origin).await
        }

        // Not found
        _ => {
            warn!(method = %method, path = %path, "Route not found");
            error_response(404, "Not found", cors_origin)
        }
    };

    Ok(response)
}

async fn handle_login_request(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    config: &Config,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    // Parse request body
    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let login_request: LoginRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse login request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    // Create JWT config
    let jwt_config = JwtConfig {
        secret: config.jwt_secret.clone(),
        expiry_hours: config.jwt_expiry_hours,
    };

    // Handle login
    match handle_login(repo, login_request, &jwt_config).await {
        Ok(response) => success_response(200, serde_json::to_value(response).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_forgot_password_request(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    email_service: &EmailService,
    config: &Config,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let forgot_request: ForgotPasswordRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse forgot password request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match handle_forgot_password(repo, email_service, forgot_request, &config.frontend_url).await {
        Ok(response) => success_response(200, serde_json::to_value(response).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_reset_password_request(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let reset_request: ResetPasswordRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse reset password request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match handle_reset_password(repo, reset_request).await {
        Ok(response) => success_response(200, serde_json::to_value(response).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_list_bins(repo: &DynamoDbRepository, cors_origin: &str) -> ApiGatewayProxyResponse {
    match list_bins(repo).await {
        Ok(bins) => success_response(200, json!({ "bins": bins }), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_get_bin(
    repo: &DynamoDbRepository,
    bin_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let bin_id = match bin_id.and_then(|s| Uuid::parse_str(&s).ok()) {
        Some(id) => id,
        None => return error_response(400, "Invalid bin ID", cors_origin),
    };

    match get_bin(repo, &bin_id).await {
        Ok(bin) => success_response(200, serde_json::to_value(bin).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_create_bin(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let create_request: CreateBinRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse create bin request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match create_bin(repo, create_request).await {
        Ok(bin) => success_response(201, serde_json::to_value(bin).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_update_bin(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    bin_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let bin_id = match bin_id.and_then(|s| Uuid::parse_str(&s).ok()) {
        Some(id) => id,
        None => return error_response(400, "Invalid bin ID", cors_origin),
    };

    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let update_request: UpdateBinRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse update bin request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match update_bin(repo, &bin_id, update_request).await {
        Ok(bin) => success_response(200, serde_json::to_value(bin).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_delete_bin(
    repo: &DynamoDbRepository,
    bin_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let bin_id = match bin_id.and_then(|s| Uuid::parse_str(&s).ok()) {
        Some(id) => id,
        None => return error_response(400, "Invalid bin ID", cors_origin),
    };

    match delete_bin(repo, &bin_id).await {
        Ok(()) => success_response(
            200,
            json!({ "message": "Bin deleted successfully" }),
            cors_origin,
        ),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

/// Extract the last path segment (e.g., webhook ID from /admin/webhooks/{id})
fn extract_last_path_segment(path: &str) -> Option<String> {
    path.split('/').next_back().map(|s| s.to_string())
}

// =============================================================================
// Webhook Handlers
// =============================================================================

async fn handle_list_webhooks(
    repo: &DynamoDbRepository,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    match list_webhooks(repo).await {
        Ok(webhooks) => success_response(200, json!({ "webhooks": webhooks }), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_get_webhook(
    repo: &DynamoDbRepository,
    webhook_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let webhook_id = match webhook_id {
        Some(id) if !id.is_empty() => id,
        _ => return error_response(400, "Invalid webhook ID", cors_origin),
    };

    match get_webhook(repo, &webhook_id).await {
        Ok(webhook) => success_response(200, serde_json::to_value(webhook).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_create_webhook(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let create_request: CreateWebhookRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse create webhook request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match create_webhook(repo, create_request).await {
        Ok(webhook) => success_response(201, serde_json::to_value(webhook).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_update_webhook(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    webhook_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let webhook_id = match webhook_id {
        Some(id) if !id.is_empty() => id,
        _ => return error_response(400, "Invalid webhook ID", cors_origin),
    };

    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let update_request: UpdateWebhookRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse update webhook request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match update_webhook(repo, &webhook_id, update_request).await {
        Ok(webhook) => success_response(200, serde_json::to_value(webhook).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_delete_webhook(
    repo: &DynamoDbRepository,
    webhook_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let webhook_id = match webhook_id {
        Some(id) if !id.is_empty() => id,
        _ => return error_response(400, "Invalid webhook ID", cors_origin),
    };

    match delete_webhook(repo, &webhook_id).await {
        Ok(()) => success_response(
            200,
            json!({ "message": "Webhook deleted successfully" }),
            cors_origin,
        ),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

/// Extract a query string parameter from the API Gateway request
fn extract_query_param(event: &ApiGatewayProxyRequest, name: &str) -> Option<String> {
    event
        .query_string_parameters
        .iter()
        .find(|(k, _)| *k == name)
        .map(|(_, v)| v.to_string())
}

/// Extract value from API Gateway authorizer context
fn extract_authorizer_context(event: &ApiGatewayProxyRequest, key: &str) -> Option<String> {
    event
        .request_context
        .authorizer
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

// =============================================================================
// External API Handlers
// =============================================================================

async fn handle_list_bins_external(
    repo: &DynamoDbRepository,
    limit: Option<i32>,
    cursor: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    match list_bins_external(repo, limit, cursor).await {
        Ok(response) => success_response(200, serde_json::to_value(response).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_get_bin_external(
    repo: &DynamoDbRepository,
    bin_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let bin_id = match bin_id.and_then(|s| Uuid::parse_str(&s).ok()) {
        Some(id) => id,
        None => return error_response(400, "Invalid bin ID", cors_origin),
    };

    match get_bin_external(repo, &bin_id).await {
        Ok(bin) => success_response(200, serde_json::to_value(bin).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

// =============================================================================
// API Key Admin Handlers
// =============================================================================

async fn handle_list_api_keys(
    repo: &DynamoDbRepository,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    match list_api_keys(repo).await {
        Ok(keys) => success_response(200, json!({ "api_keys": keys }), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_create_api_key(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    created_by: &str,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let create_request: CreateApiKeyRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse create API key request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match create_api_key(repo, create_request, created_by).await {
        Ok(response) => success_response(201, serde_json::to_value(response).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_get_api_key(
    repo: &DynamoDbRepository,
    key_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let key_id = match key_id {
        Some(id) if !id.is_empty() => id,
        _ => return error_response(400, "Invalid API key ID", cors_origin),
    };

    match get_api_key(repo, &key_id).await {
        Ok(key) => success_response(200, serde_json::to_value(key).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_update_api_key(
    request: &ApiGatewayProxyRequest,
    repo: &DynamoDbRepository,
    key_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let key_id = match key_id {
        Some(id) if !id.is_empty() => id,
        _ => return error_response(400, "Invalid API key ID", cors_origin),
    };

    let body = match &request.body {
        Some(b) => b,
        None => return error_response(400, "Request body is required", cors_origin),
    };

    let update_request: UpdateApiKeyRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to parse update API key request");
            return error_response(400, "Invalid request body", cors_origin);
        }
    };

    match update_api_key(repo, &key_id, update_request).await {
        Ok(key) => success_response(200, serde_json::to_value(key).unwrap(), cors_origin),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

async fn handle_delete_api_key(
    repo: &DynamoDbRepository,
    key_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let key_id = match key_id {
        Some(id) if !id.is_empty() => id,
        _ => return error_response(400, "Invalid API key ID", cors_origin),
    };

    match delete_api_key(repo, &key_id).await {
        Ok(()) => success_response(
            200,
            json!({ "message": "API key deleted successfully" }),
            cors_origin,
        ),
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}

/// Public endpoint for QR report page - returns limited bin info without auth
async fn handle_get_public_bin(
    repo: &DynamoDbRepository,
    bin_id: Option<String>,
    cors_origin: &str,
) -> ApiGatewayProxyResponse {
    let bin_id = match bin_id.and_then(|s| Uuid::parse_str(&s).ok()) {
        Some(id) => id,
        None => return error_response(400, "Invalid bin ID", cors_origin),
    };

    match get_bin(repo, &bin_id).await {
        Ok(bin) => {
            // Check if bin is active
            if !bin.is_active {
                return error_response(404, "Bin not found", cors_origin);
            }
            // Return only public info
            let public_info = PublicBinInfo::from(&bin);
            success_response(200, serde_json::to_value(public_info).unwrap(), cors_origin)
        }
        Err(e) => {
            let status = error_to_status_code(&e);
            error_response(status, &e.to_string(), cors_origin)
        }
    }
}
