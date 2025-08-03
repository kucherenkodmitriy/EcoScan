pub mod application;
pub mod domain;
pub mod infrastructure;

pub use domain::error::AppError;

use aws_lambda_events::event::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use aws_lambda_events::http::HeaderMap;
use lambda_runtime::{Error, LambdaEvent};
use serde::Deserialize;
use tracing::{error, info};
use uuid::Uuid;

use crate::application::handle_status_update;
use crate::domain::{BinStatus, StatusUpdateRequest};
use crate::infrastructure::dynamodb::DynamoDbRepository;

#[derive(Debug, Deserialize)]
struct StatusUpdateBody {
    status: i8,
}

pub async fn api_gateway_handler(
    event: LambdaEvent<ApiGatewayProxyRequest>,
) -> Result<ApiGatewayProxyResponse, Error> {
    info!("Received API Gateway event: {:?}", event);

    let request = match parse_request(event.payload) {
        Ok(req) => req,
        Err(resp) => return Ok(resp),
    };

    let repo = match DynamoDbRepository::new().await {
        Ok(repo) => repo,
        Err(e) => {
            error!("Failed to initialize DynamoDB repository: {}", e);
            return Ok(build_response(500, "Internal Server Error"));
        }
    };

    match handle_status_update(&repo, request).await {
        Ok(response) => {
            info!("Status update successful: {}", response.message);
            let body = serde_json::to_string(&response).unwrap_or_default();
            Ok(ApiGatewayProxyResponse {
                status_code: 200,
                body: Some(body.into()),
                headers: {
                    let mut map = HeaderMap::new();
                    map.insert("Content-Type", "application/json".parse().unwrap());
                    map
                },
                ..Default::default()
            })
        }
        Err(e) => {
            error!("Error processing status update: {}", e);
            Ok(build_response(500, "Failed to process status update"))
        }
    }
}

fn parse_request(event: ApiGatewayProxyRequest) -> Result<StatusUpdateRequest, ApiGatewayProxyResponse> {
    let bin_id_str = event
        .path_parameters
        .get("bin_id")
        .ok_or_else(|| build_response(400, "Missing 'bin_id' in path"))?;

    let bin_id = Uuid::parse_str(bin_id_str)
        .map_err(|_| build_response(400, "Invalid 'bin_id' format"))?;

    let body_str = event.body.as_deref().unwrap_or("");
    let update_body: StatusUpdateBody = serde_json::from_str(body_str)
        .map_err(|_| build_response(400, "Invalid request body"))?;

    let status = BinStatus::new(update_body.status as i32)
        .map_err(|e| build_response(400, &e.to_string()))?;

    Ok(StatusUpdateRequest { bin_id, status })
}

fn build_response(status_code: i64, body: &str) -> ApiGatewayProxyResponse {
    ApiGatewayProxyResponse {
        status_code,
        body: Some(serde_json::json!({ "error": body }).to_string().into()),
        headers: {
            let mut map = HeaderMap::new();
            map.insert("Content-Type", "application/json".parse().unwrap());
            map
        },
        ..Default::default()
    }
}
