use aws_config::BehaviorVersion;
use aws_sdk_secretsmanager::Client as SecretsManagerClient;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info, instrument, warn};
use tracing_subscriber::fmt;

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,  // Subject (email)
    exp: usize,   // Expiration time
    iat: usize,   // Issued at
    role: String, // User role (e.g., "admin")
}

/// API Gateway Token Authorizer Request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorizerRequest {
    #[serde(rename = "type")]
    #[allow(dead_code)] // Part of API contract, may be used for validation later
    request_type: String,
    authorization_token: Option<String>,
    method_arn: String,
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
    fn allow(principal_id: &str, resource: &str, claims: &Claims) -> Self {
        let mut context = HashMap::new();
        context.insert("email".to_string(), claims.sub.clone());
        context.insert("role".to_string(), claims.role.clone());

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
    /// Input:  arn:aws:execute-api:region:account:api-id/stage/METHOD/path
    /// Output: arn:aws:execute-api:region:account:api-id/stage/*
    fn build_resource_arn(method_arn: &str) -> String {
        let parts: Vec<&str> = method_arn.split('/').collect();
        if parts.len() >= 2 {
            // Take everything up to and including the stage, then add wildcard
            format!("{}/{}/*", parts[0], parts[1])
        } else {
            method_arn.to_string()
        }
    }
}

/// Shared state for the authorizer
struct AuthorizerState {
    jwt_secret: String,
}

/// Fetch JWT secret from Secrets Manager or environment variable
async fn get_jwt_secret() -> Result<String, String> {
    // Check for Secrets Manager ARN first (production path)
    if let Ok(secret_arn) = std::env::var("JWT_SECRET_ARN") {
        info!("Fetching JWT secret from Secrets Manager");
        return fetch_from_secrets_manager(&secret_arn).await;
    }

    // Fallback to environment variable (local dev/tests)
    if let Ok(secret) = std::env::var("JWT_SECRET") {
        warn!("Using JWT_SECRET from environment variable (not recommended for production)");
        return Ok(secret);
    }

    Err("Neither JWT_SECRET_ARN nor JWT_SECRET environment variable is set".to_string())
}

/// Fetch secret from AWS Secrets Manager
async fn fetch_from_secrets_manager(secret_arn: &str) -> Result<String, String> {
    let config = aws_config::defaults(BehaviorVersion::latest()).load().await;

    let client = SecretsManagerClient::new(&config);

    let response = client
        .get_secret_value()
        .secret_id(secret_arn)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch secret from Secrets Manager: {}", e))?;

    let secret = response
        .secret_string()
        .ok_or_else(|| "Secret value is not a string".to_string())?
        .to_string();

    info!("Successfully retrieved JWT secret from Secrets Manager");
    Ok(secret)
}

/// Extract Bearer token from Authorization header
fn extract_token(auth_header: &str) -> Option<&str> {
    auth_header.strip_prefix("Bearer ")
}

/// Validate JWT token and return claims
fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());
    let validation = Validation::new(Algorithm::HS256);

    let token_data = decode::<Claims>(token, &decoding_key, &validation)?;
    Ok(token_data.claims)
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
    info!("Processing authorization request");

    // Extract authorization token
    let auth_token = match &request.authorization_token {
        Some(token) => token,
        None => {
            warn!("No authorization token provided");
            return Ok(AuthorizerResponse::deny("anonymous", &request.method_arn));
        }
    };

    // Extract Bearer token
    let token = match extract_token(auth_token) {
        Some(t) => t,
        None => {
            warn!("Invalid authorization header format (expected 'Bearer <token>')");
            return Ok(AuthorizerResponse::deny("anonymous", &request.method_arn));
        }
    };

    // Validate token using secret from state (fetched at cold start)
    match validate_token(token, &state.jwt_secret) {
        Ok(claims) => {
            info!(email = %claims.sub, role = %claims.role, "Token validated successfully");
            Ok(AuthorizerResponse::allow(
                &claims.sub,
                &request.method_arn,
                &claims,
            ))
        }
        Err(e) => {
            warn!(error = %e, "Token validation failed");
            Ok(AuthorizerResponse::deny("anonymous", &request.method_arn))
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize structured JSON logging
    fmt()
        .json()
        .with_max_level(tracing::Level::INFO)
        .with_current_span(false)
        .with_span_events(tracing_subscriber::fmt::format::FmtSpan::CLOSE)
        .without_time() // CloudWatch adds timestamps
        .init();

    info!("Lambda authorizer starting");

    // Load JWT secret at cold start (from Secrets Manager or env var)
    let jwt_secret = match get_jwt_secret().await {
        Ok(secret) => secret,
        Err(e) => {
            error!(error = %e, "Failed to load JWT secret");
            return Err(Error::from(e));
        }
    };

    info!("JWT secret loaded successfully");

    // Create shared state
    let state = Arc::new(AuthorizerState { jwt_secret });

    // Run Lambda with shared state handler
    run(service_fn(create_handler(state))).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use jsonwebtoken::{encode, EncodingKey, Header};

    fn create_test_token(secret: &str, exp_offset: i64) -> String {
        let now = Utc::now().timestamp() as usize;
        let claims = Claims {
            sub: "test@example.com".to_string(),
            exp: (now as i64 + exp_offset) as usize,
            iat: now,
            role: "admin".to_string(),
        };

        encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap()
    }

    #[test]
    fn test_extract_token_valid() {
        let token = extract_token("Bearer my-jwt-token");
        assert_eq!(token, Some("my-jwt-token"));
    }

    #[test]
    fn test_extract_token_no_bearer() {
        let token = extract_token("my-jwt-token");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_token_lowercase_bearer() {
        let token = extract_token("bearer my-jwt-token");
        assert_eq!(token, None);
    }

    #[test]
    fn test_validate_token_success() {
        let secret = "test-secret";
        let token = create_test_token(secret, 3600); // Valid for 1 hour

        let result = validate_token(&token, secret);
        assert!(result.is_ok());

        let claims = result.unwrap();
        assert_eq!(claims.sub, "test@example.com");
        assert_eq!(claims.role, "admin");
    }

    #[test]
    fn test_validate_token_expired() {
        let secret = "test-secret";
        let token = create_test_token(secret, -3600); // Expired 1 hour ago

        let result = validate_token(&token, secret);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_token_wrong_secret() {
        let token = create_test_token("secret-1", 3600);

        let result = validate_token(&token, "secret-2");
        assert!(result.is_err());
    }

    #[test]
    fn test_build_resource_arn() {
        let method_arn = "arn:aws:execute-api:us-east-1:123456789:abc123/dev/GET/admin/bins";
        let result = AuthorizerResponse::build_resource_arn(method_arn);
        assert_eq!(
            result,
            "arn:aws:execute-api:us-east-1:123456789:abc123/dev/*"
        );
    }

    #[test]
    fn test_authorizer_response_allow() {
        let claims = Claims {
            sub: "test@example.com".to_string(),
            exp: 0,
            iat: 0,
            role: "admin".to_string(),
        };

        let response = AuthorizerResponse::allow(
            "test@example.com",
            "arn:aws:execute-api:us-east-1:123:abc/dev/GET/test",
            &claims,
        );

        assert_eq!(response.principal_id, "test@example.com");
        assert_eq!(response.policy_document.statement[0].effect, "Allow");
        assert_eq!(
            response.context.get("email"),
            Some(&"test@example.com".to_string())
        );
        assert_eq!(response.context.get("role"), Some(&"admin".to_string()));
    }

    #[test]
    fn test_authorizer_response_deny() {
        let response = AuthorizerResponse::deny(
            "anonymous",
            "arn:aws:execute-api:us-east-1:123:abc/dev/GET/test",
        );

        assert_eq!(response.principal_id, "anonymous");
        assert_eq!(response.policy_document.statement[0].effect, "Deny");
        assert!(response.context.is_empty());
    }

    #[test]
    fn test_extract_token_empty_after_bearer() {
        // "Bearer " followed by empty string
        let token = extract_token("Bearer ");
        assert_eq!(token, Some("")); // Returns empty string, which will fail validation
    }

    #[test]
    fn test_extract_token_bearer_only() {
        // Just "Bearer" without space and token
        let token = extract_token("Bearer");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_token_with_extra_spaces() {
        // Token with leading/trailing spaces preserved
        let token = extract_token("Bearer  my-token-with-space");
        assert_eq!(token, Some(" my-token-with-space"));
    }

    #[test]
    fn test_validate_token_empty_string() {
        let result = validate_token("", "test-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_token_malformed_jwt() {
        // Not a valid JWT structure (should have 3 base64 parts separated by dots)
        let result = validate_token("not-a-valid-jwt", "test-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_token_incomplete_jwt() {
        // JWT with only 2 parts instead of 3
        let result = validate_token("header.payload", "test-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_token_with_whitespace() {
        let result = validate_token("   ", "test-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_build_resource_arn_single_part() {
        // Edge case: ARN without any slashes
        let result =
            AuthorizerResponse::build_resource_arn("arn:aws:execute-api:us-east-1:123:abc");
        assert_eq!(result, "arn:aws:execute-api:us-east-1:123:abc");
    }

    #[test]
    fn test_build_resource_arn_minimal() {
        // ARN with only api-id/stage
        let method_arn = "arn:aws:execute-api:us-east-1:123:abc/dev";
        let result = AuthorizerResponse::build_resource_arn(method_arn);
        assert_eq!(result, "arn:aws:execute-api:us-east-1:123:abc/dev/*");
    }

    #[test]
    fn test_build_resource_arn_empty() {
        let result = AuthorizerResponse::build_resource_arn("");
        assert_eq!(result, "");
    }

    #[test]
    fn test_build_resource_arn_deeply_nested_path() {
        let method_arn = "arn:aws:execute-api:us-east-1:123:abc/dev/GET/admin/bins/123/details";
        let result = AuthorizerResponse::build_resource_arn(method_arn);
        assert_eq!(result, "arn:aws:execute-api:us-east-1:123:abc/dev/*");
    }

    #[test]
    fn test_claims_serialization() {
        let claims = Claims {
            sub: "user@example.com".to_string(),
            exp: 1234567890,
            iat: 1234567800,
            role: "admin".to_string(),
        };

        let json = serde_json::to_string(&claims).unwrap();
        assert!(json.contains("\"sub\":\"user@example.com\""));
        assert!(json.contains("\"role\":\"admin\""));
    }

    #[test]
    fn test_authorizer_response_allow_resource_wildcard() {
        let claims = Claims {
            sub: "test@example.com".to_string(),
            exp: 0,
            iat: 0,
            role: "viewer".to_string(),
        };

        let response = AuthorizerResponse::allow(
            "test@example.com",
            "arn:aws:execute-api:us-east-1:123:abc/prod/GET/admin/bins/123",
            &claims,
        );

        // Verify the resource ARN is wildcarded
        assert_eq!(
            response.policy_document.statement[0].resource,
            "arn:aws:execute-api:us-east-1:123:abc/prod/*"
        );
    }

    #[test]
    fn test_policy_document_version() {
        let claims = Claims {
            sub: "test@example.com".to_string(),
            exp: 0,
            iat: 0,
            role: "admin".to_string(),
        };

        let response = AuthorizerResponse::allow("test", "arn/stage/GET/path", &claims);
        assert_eq!(response.policy_document.version, "2012-10-17");

        let deny_response = AuthorizerResponse::deny("anon", "arn/stage/GET/path");
        assert_eq!(deny_response.policy_document.version, "2012-10-17");
    }

    #[test]
    fn test_validate_token_different_roles() {
        let secret = "test-secret";

        // Create token with different role
        let now = Utc::now().timestamp() as usize;
        let claims = Claims {
            sub: "viewer@example.com".to_string(),
            exp: now + 3600,
            iat: now,
            role: "viewer".to_string(),
        };

        let token = encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap();

        let result = validate_token(&token, secret);
        assert!(result.is_ok());

        let validated_claims = result.unwrap();
        assert_eq!(validated_claims.role, "viewer");
        assert_eq!(validated_claims.sub, "viewer@example.com");
    }
}
