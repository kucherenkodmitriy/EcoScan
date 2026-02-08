use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use chrono::{DateTime, Utc};
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info, instrument, warn};
use tracing_subscriber::fmt;

/// API Gateway REQUEST-type Authorizer Request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorizerRequest {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    request_type: Option<String>,
    method_arn: String,
    headers: Option<HashMap<String, String>>,
}

/// IAM Policy Document
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PolicyDocument {
    #[serde(rename = "Version")]
    version: String,
    #[serde(rename = "Statement")]
    statement: Vec<Statement>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Statement {
    #[serde(rename = "Action")]
    action: String,
    #[serde(rename = "Effect")]
    effect: String,
    #[serde(rename = "Resource")]
    resource: String,
}

/// Authorizer Response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthorizerResponse {
    principal_id: String,
    policy_document: PolicyDocument,
    context: HashMap<String, String>,
}

impl AuthorizerResponse {
    fn allow(principal_id: &str, resource: &str, key_id: &str, scopes: &[String]) -> Self {
        let mut context = HashMap::new();
        context.insert("keyId".to_string(), key_id.to_string());
        context.insert("scopes".to_string(), scopes.join(","));

        Self {
            principal_id: principal_id.to_string(),
            policy_document: PolicyDocument {
                version: "2012-10-17".to_string(),
                statement: vec![Statement {
                    action: "execute-api:Invoke".to_string(),
                    effect: "Allow".to_string(),
                    resource: Self::build_resource_arn(resource),
                }],
            },
            context,
        }
    }

    fn deny(principal_id: &str, resource: &str) -> Self {
        Self {
            principal_id: principal_id.to_string(),
            policy_document: PolicyDocument {
                version: "2012-10-17".to_string(),
                statement: vec![Statement {
                    action: "execute-api:Invoke".to_string(),
                    effect: "Deny".to_string(),
                    resource: Self::build_resource_arn(resource),
                }],
            },
            context: HashMap::new(),
        }
    }

    /// Build a wildcard resource ARN from the method ARN
    fn build_resource_arn(method_arn: &str) -> String {
        let parts: Vec<&str> = method_arn.split('/').collect();
        if parts.len() >= 2 {
            format!("{}/{}/*", parts[0], parts[1])
        } else {
            method_arn.to_string()
        }
    }
}

/// Shared state for the authorizer
struct AuthorizerState {
    client: Client,
    table_name: String,
}

/// Hash an API key using SHA-256
fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

/// Extract X-API-Key from headers (case-insensitive)
fn extract_api_key(headers: &Option<HashMap<String, String>>) -> Option<String> {
    let headers = headers.as_ref()?;
    // Try common casings first, then do case-insensitive search
    if let Some(key) = headers.get("X-API-Key") {
        return Some(key.clone());
    }
    if let Some(key) = headers.get("x-api-key") {
        return Some(key.clone());
    }
    // Fallback: case-insensitive search
    for (name, value) in headers {
        if name.eq_ignore_ascii_case("x-api-key") {
            return Some(value.clone());
        }
    }
    None
}

/// Create the handler with shared state
#[allow(clippy::type_complexity)]
fn create_handler(
    state: Arc<AuthorizerState>,
) -> impl Fn(
    LambdaEvent<AuthorizerRequest>,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<AuthorizerResponse, Error>> + Send>,
> + Send
       + Sync {
    move |event| {
        let state = state.clone();
        Box::pin(async move { function_handler_inner(event, &state).await })
    }
}

#[instrument(skip(event, state), fields(method_arn))]
async fn function_handler_inner(
    event: LambdaEvent<AuthorizerRequest>,
    state: &AuthorizerState,
) -> Result<AuthorizerResponse, Error> {
    let (request, _context) = event.into_parts();

    tracing::Span::current().record("method_arn", &request.method_arn);
    info!("Processing API key authorization request");

    // Extract API key from headers
    let api_key = match extract_api_key(&request.headers) {
        Some(key) if !key.is_empty() => key,
        _ => {
            warn!("No X-API-Key header provided");
            return Ok(AuthorizerResponse::deny("anonymous", &request.method_arn));
        }
    };

    // Hash the key for lookup
    let key_hash = hash_api_key(&api_key);

    // Query DynamoDB GSI
    let query_result = state
        .client
        .query()
        .table_name(&state.table_name)
        .index_name("keyHash-index")
        .key_condition_expression("keyHash = :hash")
        .expression_attribute_values(":hash", AttributeValue::S(key_hash))
        .send()
        .await;

    let items = match query_result {
        Ok(output) => output.items.unwrap_or_default(),
        Err(e) => {
            error!(error = %e, "Failed to query DynamoDB");
            return Ok(AuthorizerResponse::deny("anonymous", &request.method_arn));
        }
    };

    if items.is_empty() {
        warn!("API key not found");
        return Ok(AuthorizerResponse::deny("anonymous", &request.method_arn));
    }

    let item = &items[0];

    // Check isActive
    let is_active = item
        .get("isActive")
        .and_then(|v| v.as_bool().ok())
        .copied()
        .unwrap_or(false);

    if !is_active {
        warn!("API key is inactive");
        return Ok(AuthorizerResponse::deny("anonymous", &request.method_arn));
    }

    // Check expiry
    if let Some(expires_at) = item
        .get("expiresAt")
        .and_then(|v| v.as_s().ok())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
    {
        if Utc::now() > expires_at {
            warn!("API key has expired");
            return Ok(AuthorizerResponse::deny("anonymous", &request.method_arn));
        }
    }

    let key_id = item
        .get("keyId")
        .and_then(|v| v.as_s().ok())
        .cloned()
        .unwrap_or_default();

    let scopes: Vec<String> = item
        .get("scopes")
        .and_then(|v| v.as_l().ok())
        .map(|list| list.iter().filter_map(|v| v.as_s().ok().cloned()).collect())
        .unwrap_or_default();

    info!(key_id = %key_id, "API key validated successfully");

    // Fire-and-forget lastUsedAt update
    let client = state.client.clone();
    let table = state.table_name.clone();
    let kid = key_id.clone();
    tokio::spawn(async move {
        let _ = client
            .update_item()
            .table_name(&table)
            .key("keyId", AttributeValue::S(kid))
            .update_expression("SET lastUsedAt = :ts")
            .expression_attribute_values(":ts", AttributeValue::S(Utc::now().to_rfc3339()))
            .send()
            .await;
    });

    Ok(AuthorizerResponse::allow(
        &key_id,
        &request.method_arn,
        &key_id,
        &scopes,
    ))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    fmt()
        .json()
        .with_max_level(tracing::Level::INFO)
        .with_current_span(false)
        .with_span_events(tracing_subscriber::fmt::format::FmtSpan::CLOSE)
        .without_time()
        .init();

    info!("API key authorizer starting");

    let table_name =
        std::env::var("API_KEYS_TABLE_NAME").unwrap_or_else(|_| "dev-ecoscan-api-keys".to_string());

    let sdk_config = if let Ok(endpoint) = std::env::var("DYNAMODB_ENDPOINT_URL") {
        info!(endpoint = %endpoint, "Using custom DynamoDB endpoint");
        aws_config::defaults(aws_config::BehaviorVersion::latest())
            .endpoint_url(&endpoint)
            .load()
            .await
    } else {
        aws_config::defaults(aws_config::BehaviorVersion::latest())
            .load()
            .await
    };

    let client = Client::new(&sdk_config);

    let state = Arc::new(AuthorizerState { client, table_name });

    info!("API key authorizer initialized");

    run(service_fn(create_handler(state))).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_api_key() {
        let key = "ek_live_abc123";
        let hash = hash_api_key(key);
        // SHA-256 always produces 64 hex chars
        assert_eq!(hash.len(), 64);
        // Same input produces same output
        assert_eq!(hash, hash_api_key(key));
    }

    #[test]
    fn test_hash_api_key_different_keys() {
        let hash1 = hash_api_key("key1");
        let hash2 = hash_api_key("key2");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_extract_api_key_standard_case() {
        let mut headers = HashMap::new();
        headers.insert("X-API-Key".to_string(), "my-key".to_string());
        assert_eq!(extract_api_key(&Some(headers)), Some("my-key".to_string()));
    }

    #[test]
    fn test_extract_api_key_lowercase() {
        let mut headers = HashMap::new();
        headers.insert("x-api-key".to_string(), "my-key".to_string());
        assert_eq!(extract_api_key(&Some(headers)), Some("my-key".to_string()));
    }

    #[test]
    fn test_extract_api_key_missing() {
        let headers = HashMap::new();
        assert_eq!(extract_api_key(&Some(headers)), None);
    }

    #[test]
    fn test_extract_api_key_none_headers() {
        assert_eq!(extract_api_key(&None), None);
    }

    #[test]
    fn test_authorizer_response_allow() {
        let response = AuthorizerResponse::allow(
            "key-123",
            "arn:aws:execute-api:us-east-1:123:abc/dev/GET/api/bins",
            "key-123",
            &["bins:read".to_string()],
        );
        assert_eq!(response.principal_id, "key-123");
        assert_eq!(response.policy_document.statement[0].effect, "Allow");
        assert_eq!(response.context.get("keyId"), Some(&"key-123".to_string()));
        assert_eq!(
            response.context.get("scopes"),
            Some(&"bins:read".to_string())
        );
    }

    #[test]
    fn test_authorizer_response_deny() {
        let response = AuthorizerResponse::deny(
            "anonymous",
            "arn:aws:execute-api:us-east-1:123:abc/dev/GET/api/bins",
        );
        assert_eq!(response.principal_id, "anonymous");
        assert_eq!(response.policy_document.statement[0].effect, "Deny");
        assert!(response.context.is_empty());
    }

    #[test]
    fn test_build_resource_arn() {
        let method_arn = "arn:aws:execute-api:us-east-1:123:abc/dev/GET/api/bins";
        let result = AuthorizerResponse::build_resource_arn(method_arn);
        assert_eq!(result, "arn:aws:execute-api:us-east-1:123:abc/dev/*");
    }

    #[test]
    fn test_build_resource_arn_single_part() {
        let result =
            AuthorizerResponse::build_resource_arn("arn:aws:execute-api:us-east-1:123:abc");
        assert_eq!(result, "arn:aws:execute-api:us-east-1:123:abc");
    }

    #[test]
    fn test_authorizer_response_allow_multiple_scopes() {
        let response = AuthorizerResponse::allow(
            "key-123",
            "arn/stage/GET/path",
            "key-123",
            &["bins:read".to_string(), "bins:write".to_string()],
        );
        assert_eq!(
            response.context.get("scopes"),
            Some(&"bins:read,bins:write".to_string())
        );
    }

    #[test]
    fn test_authorizer_response_allow_no_scopes() {
        let response = AuthorizerResponse::allow("key-123", "arn/stage/GET/path", "key-123", &[]);
        assert_eq!(response.context.get("scopes"), Some(&"".to_string()));
    }
}
