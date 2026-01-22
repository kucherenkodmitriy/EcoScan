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

use crate::application::{create_bin, delete_bin, get_bin, handle_login, list_bins, update_bin};
use crate::config::Config;
use crate::domain::{AppError, CreateBinRequest, LoginRequest, PublicBinInfo, UpdateBinRequest};
use crate::infrastructure::{DynamoDbRepository, JwtConfig};

/// Shared application state initialized at cold start
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
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
        "Content-Type, Authorization".parse().unwrap(),
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
        "Content-Type, Authorization".parse().unwrap(),
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
        AppError::UserNotFound(_) | AppError::BinNotFound(_) => 404,
        AppError::ValidationError(_) => 400,
        AppError::DatabaseError(_) | AppError::InternalError(_) | AppError::JwtError(_) => 500,
    }
}

/// Build a CORS preflight response for OPTIONS requests
fn cors_preflight_response(cors_origin: &str) -> ApiGatewayProxyResponse {
    let mut headers = HeaderMap::new();
    headers.insert("Access-Control-Allow-Origin", cors_origin.parse().unwrap());
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization".parse().unwrap(),
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
