pub mod domain;
pub mod application;
pub mod infrastructure;

use lambda_runtime::{Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use tracing::{info, error, debug};

use crate::application::handle_status_update;
use crate::domain::{StatusUpdateRequest, StatusUpdateResponse, BinStatus};
use crate::infrastructure::dynamodb::DynamoDbRepository;

pub use domain::error::AppError;

// Handler for direct Lambda invocation
pub async fn update_bin_status(
    event: LambdaEvent<StatusUpdateRequest>,
) -> Result<StatusUpdateResponse, Error> {
    info!(
        "Lambda invocation started - RequestId: {:?}, BinId: {}, Status: {}", 
        event.context.request_id, 
        event.payload.bin_id, 
        event.payload.status
    );

    let repo = match DynamoDbRepository::new().await {
        Ok(repo) => {
            info!("Successfully initialized DynamoDB repository");
            repo
        }
        Err(e) => {
            error!("Failed to initialize DynamoDB repository: {}", e);
            return Err(Box::new(e));
        }
    };

    match handle_status_update(&repo, event.payload).await {
        Ok(response) => {
            info!(
                "Status update completed successfully - Message: {}, Timestamp: {}", 
                response.message, 
                response.updated_at
            );
            Ok(response)
        }
        Err(e) => {
            error!("Error processing status update: {}", e);
            Err(Box::new(e))
        }
    }
}

// API Gateway V2 HTTP API event structure
// See: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
#[derive(Debug, Deserialize, Serialize)]
struct ApiGatewayEvent {
    #[serde(rename = "version")]
    pub version: String,
    #[serde(rename = "routeKey")]
    pub route_key: String,
    #[serde(rename = "rawPath")]
    pub raw_path: String,
    #[serde(rename = "rawQueryString")]
    pub raw_query_string: String,
    #[serde(rename = "headers")]
    pub headers: std::collections::HashMap<String, String>,
    #[serde(rename = "requestContext")]
    pub request_context: serde_json::Value,
    #[serde(rename = "pathParameters")]
    pub path_parameters: Option<std::collections::HashMap<String, String>>,
    #[serde(rename = "queryStringParameters")]
    pub query_string_parameters: Option<std::collections::HashMap<String, String>>,
    #[serde(rename = "stageVariables")]
    pub stage_variables: Option<std::collections::HashMap<String, String>>,
    #[serde(rename = "body")]
    pub body: Option<String>,
    #[serde(rename = "isBase64Encoded")]
    pub is_base64_encoded: bool,
}

// Status update request from API Gateway
#[derive(Debug, Deserialize, Serialize)]
struct StatusUpdateBody {
    status: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ApiGatewayResponse {
    pub status_code: i32,
    pub body: String,
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub headers: std::collections::HashMap<String, String>,
}

// Handler for API Gateway events
pub async fn api_gateway_handler(
    event: LambdaEvent<serde_json::Value>,
) -> Result<ApiGatewayResponse, Error> {
    info!("Received API Gateway event");
    
    // Log the raw event payload for debugging
    let raw_payload = event.payload.to_string();
    info!("Raw event payload: {}", raw_payload);
    
    // Log detailed information about the event payload
    info!("Event payload type: {}", event.payload);
    info!("Event payload keys: {:?}", event.payload.as_object().map(|o| o.keys().collect::<Vec<_>>()).unwrap_or_default());
    
    // Check if this is a direct invocation with bin_id
    if let Some(bin_id) = event.payload.get("bin_id") {
        info!("Detected direct invocation with bin_id: {}", bin_id);
    }
    
    // Check for API Gateway V2 HTTP API event structure
    if let (Some(version), Some(route_key)) = (event.payload.get("version"), event.payload.get("routeKey")) {
        info!("Detected API Gateway V2 HTTP API event - Version: {}, Route: {}", version, route_key);
    }
    
    // Try to deserialize as ApiGatewayEvent first
    match serde_json::from_value::<ApiGatewayEvent>(event.payload.clone()) {
        Ok(gateway_event) => {
            info!("Successfully deserialized as ApiGatewayEvent");
            // Process the API Gateway event
            process_api_gateway_event(gateway_event).await
        },
        Err(e) => {
            // If deserialization as ApiGatewayEvent fails, try direct StatusUpdateRequest
            info!("Failed to deserialize as ApiGatewayEvent: {}", e);
            match serde_json::from_value::<StatusUpdateRequest>(event.payload.clone()) {
                Ok(direct_request) => {
                    info!("Successfully deserialized as direct StatusUpdateRequest");
                    // Process as direct invocation
                    process_direct_invocation(direct_request, event.context).await
                },
                Err(e2) => {
                    error!("Failed to deserialize event: {}", e2);
                    Ok(ApiGatewayResponse {
                        status_code: 400,
                        body: serde_json::json!({
                            "error": "Invalid request format",
                            "details": format!("Could not deserialize event: {}", e2),
                            "expected_format": "Either API Gateway V2 HTTP API event or direct StatusUpdateRequest"
                        }).to_string(),
                        headers: std::collections::HashMap::new(),
                    })
                }
            }
        }
    }
}

/// Process an API Gateway V2 HTTP API event
async fn process_api_gateway_event(
    api_gateway_event: ApiGatewayEvent,
) -> Result<ApiGatewayResponse, Error> {
    info!("Processing API Gateway event");
    debug!("API Gateway Event - Version: {}, Route: {}", api_gateway_event.version, api_gateway_event.route_key);
    debug!("Path: {}, Query: {:?}", api_gateway_event.raw_path, api_gateway_event.raw_query_string);
    debug!("Path Parameters: {:?}", api_gateway_event.path_parameters);
    debug!("Headers: {:?}", api_gateway_event.headers);
    
    // Extract bin_id from path parameters
    let bin_id = match api_gateway_event.path_parameters
        .as_ref()
        .and_then(|params| params.get("binId")) {
        Some(id) => id,
        None => {
            error!("Missing binId in path parameters. Available parameters: {:?}", 
                  api_gateway_event.path_parameters);
            return Ok(ApiGatewayResponse {
                status_code: 400,
                body: serde_json::json!({ 
                    "error": "Missing binId in path parameters",
                    "details": "The request URL must include a binId parameter",
                    "available_parameters": api_gateway_event.path_parameters
                }).to_string(),
                headers: std::collections::HashMap::new(),
            });
        }
    };
    
    // Parse status from request body
    let body = api_gateway_event.body.unwrap_or_else(|| "{}".to_string());
    debug!("Request body: {}", body);
    
    match serde_json::from_str::<StatusUpdateBody>(&body) {
        Ok(StatusUpdateBody { status }) => {
            // Extract the numeric value from the status object
            match status.get("value").and_then(|v| v.as_i64()) {
                Some(value) if (0..=10).contains(&value) => {
                    let status_value = value as i32;
                    debug!("Extracted status value: {}", status_value);
                    
                    // Create the status update request
                    let request = StatusUpdateRequest {
                        bin_id: match bin_id.parse() {
                            Ok(id) => id,
                            Err(e) => {
                                error!("Invalid bin_id format: {}", e);
                                return Ok(ApiGatewayResponse {
                                    status_code: 400,
                                    body: serde_json::json!({ 
                                        "error": format!("Invalid bin_id format: {}", e),
                                        "details": "The binId must be a valid UUID"
                                    }).to_string(),
                                    headers: std::collections::HashMap::new(),
                                });
                            }
                        },
                        status: match BinStatus::new(status_value) {
                            Ok(status) => status,
                            Err(e) => {
                                error!("Invalid status value: {}", e);
                                return Ok(ApiGatewayResponse {
                                    status_code: 400,
                                    body: serde_json::json!({ 
                                        "error": format!("Invalid status value: {}", e),
                                        "details": "Status must be an integer between 0 and 10"
                                    }).to_string(),
                                    headers: std::collections::HashMap::new(),
                                });
                            }
                        },
                    };
                    
                    // Process the status update
                    process_status_update(request).await
                },
                _ => {
                    error!("Invalid status value. Must be between 0 and 10");
                    Ok(ApiGatewayResponse {
                        status_code: 400,
                        body: serde_json::json!({ 
                            "error": "Invalid status value",
                            "details": "Status must be an integer between 0 and 10"
                        }).to_string(),
                        headers: std::collections::HashMap::new(),
                    })
                }
            }
        },
        Err(e) => {
            error!("Failed to parse request body: {}", e);
            Ok(ApiGatewayResponse {
                status_code: 400,
                body: serde_json::json!({ 
                    "error": format!("Invalid request body: {}", e),
                    "details": "Request body must be a JSON object with a 'status' field containing a 'value' between 0 and 10"
                }).to_string(),
                headers: std::collections::HashMap::new(),
            })
        }
    }
}

/// Process a direct Lambda invocation with StatusUpdateRequest
async fn process_direct_invocation(
    request: StatusUpdateRequest,
    _context: lambda_runtime::Context,
) -> Result<ApiGatewayResponse, Error> {
    info!("Processing direct invocation with bin_id: {}", request.bin_id);
    process_status_update(request).await
}

/// Process a status update request and return an API Gateway response
async fn process_status_update(
    request: StatusUpdateRequest,
) -> Result<ApiGatewayResponse, Error> {
    // Initialize the DynamoDB repository
    let repo = match DynamoDbRepository::new().await {
        Ok(repo) => {
            info!("Successfully initialized DynamoDB repository");
            repo
        },
        Err(e) => {
            error!("Failed to initialize DynamoDB repository: {}", e);
            return Ok(ApiGatewayResponse {
                status_code: 500,
                body: serde_json::json!({ 
                    "error": "Internal server error",
                    "details": format!("Failed to initialize database: {}", e)
                }).to_string(),
                headers: std::collections::HashMap::new(),
            });
        }
    };
    
    // Process the status update
    match handle_status_update(&repo, request).await {
        Ok(response) => {
            info!("Status update completed successfully - Message: {}, Timestamp: {}", 
                response.message, response.updated_at);
                
            let mut headers = std::collections::HashMap::new();
            headers.insert("Content-Type".to_string(), "application/json".to_string());
            
            Ok(ApiGatewayResponse {
                status_code: 200,
                body: serde_json::to_string(&response)
                    .unwrap_or_else(|_| "{\"error\":\"Failed to serialize response\"}".to_string()),
                headers,
            })
        },
        Err(e) => {
            error!("Error processing status update: {}", e);
            Ok(ApiGatewayResponse {
                status_code: 500,
                body: serde_json::json!({ 
                    "error": "Internal server error",
                    "details": format!("Failed to process status update: {}", e)
                }).to_string(),
                headers: std::collections::HashMap::new(),
            })
        }
    }


}

#[cfg(test)]
mod tests {
    use super::*;
    use lambda_runtime::LambdaEvent;
    use crate::domain::{BinStatus, StatusUpdateRequest};
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn test_bin_status_creation() {
        let status = BinStatus::new(5).unwrap();
        assert_eq!(status.value(), 5);
    }

    #[test]
    fn test_bin_status_validation() {
        assert!(BinStatus::new(11).is_err());
        assert!(BinStatus::new(-1).is_err());
    }

    #[tokio::test]
    async fn test_process_status_update_request() {
        let request = StatusUpdateRequest {
            bin_id: Uuid::new_v4(),
            status: BinStatus::new(7).unwrap(),
        };
        
        let response = process_status_update(request).await.unwrap();
        assert_eq!(response.status_code, 200);
        assert!(!response.body.is_empty(), "Response body should not be empty");
        assert!(response.body.contains("70%"));
    }

    #[test]
    fn test_status_update_request_serialization() {
        let request = StatusUpdateRequest {
            bin_id: Uuid::new_v4(),
            status: BinStatus::new(5).unwrap(),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        let deserialized: StatusUpdateRequest = serde_json::from_str(&json).unwrap();
        
        assert_eq!(request.bin_id, deserialized.bin_id);
        assert_eq!(request.status.value(), deserialized.status.value());
    }

    #[test]
    fn test_status_update_response_serialization() {
        let response = StatusUpdateResponse {
            success: true,
            message: "Test message".to_string(),
            updated_at: Utc::now(),
        };
        
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: StatusUpdateResponse = serde_json::from_str(&json).unwrap();
        
        assert_eq!(response.success, deserialized.success);
        assert_eq!(response.message, deserialized.message);
    }
}
