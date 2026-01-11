resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.environment}-${var.project_name}-api"
  description = "API for the EcoScan project"

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-api"
    }
  )
}

resource "aws_api_gateway_resource" "bins" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "bins"
}

resource "aws_api_gateway_resource" "bin_id" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.bins.id
  path_part   = "{bin_id}"
}

resource "aws_api_gateway_resource" "status" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.bin_id.id
  path_part   = "status"
}

resource "aws_api_gateway_method" "post_status" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.status.id
  http_method   = "POST"
  authorization = "NONE"

  request_validator_id = aws_api_gateway_request_validator.body_validator.id

  # Request model for validation
  request_models = {
    "application/json" = aws_api_gateway_model.status_update_model.name
  }
}

resource "aws_api_gateway_integration" "sqs_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.status.id
  http_method             = aws_api_gateway_method.post_status.http_method
  integration_http_method = "POST"
  type                    = "AWS"
  credentials             = aws_iam_role.apigateway_sqs_role.arn
  uri                     = "arn:aws:apigateway:${var.aws_region}:sqs:path/${data.aws_caller_identity.current.account_id}/${aws_sqs_queue.status_updates.name}"

  request_parameters = {
    "integration.request.header.Content-Type" = "'application/x-www-form-urlencoded'"
  }

  # Transform the incoming JSON to SQS message format
  # Combine binId from path with status from body into a JSON message
  # Add message attributes for distributed tracing:
  #   - RequestId: API Gateway request ID (for correlation)
  #   - TraceId: X-Ray trace ID (for distributed tracing)
  #   - SourceIp: Client IP address
  request_templates = {
    "application/json" = <<TEMPLATE
Action=SendMessage&MessageBody=$util.urlEncode("{""binId"":""$input.params().path.bin_id"",""status"":$input.json('$.status')}")
TEMPLATE
  }

  # Define how to handle the response
  passthrough_behavior = "NEVER"
}

# Method response for 200 OK
resource "aws_api_gateway_method_response" "status_200" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.post_status.http_method
  status_code = "200"

  response_models = {
    "application/json" = "Empty"
  }
}

# Integration response to return 200 when SQS accepts the message
resource "aws_api_gateway_integration_response" "sqs_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.post_status.http_method
  status_code = aws_api_gateway_method_response.status_200.status_code

  response_templates = {
    "application/json" = jsonencode({
      message = "Status update queued for processing"
    })
  }

  depends_on = [aws_api_gateway_integration.sqs_integration]
}

# Data source to get AWS account ID
data "aws_caller_identity" "current" {}

resource "aws_api_gateway_deployment" "api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha1(jsonencode([
      # Bin status endpoints
      aws_api_gateway_resource.status.id,
      aws_api_gateway_method.post_status.id,
      aws_api_gateway_integration.sqs_integration.id,
      aws_api_gateway_integration_response.sqs_integration_response.id,
      # Auth endpoints
      aws_api_gateway_resource.auth_login.id,
      aws_api_gateway_method.post_auth_login.id,
      aws_api_gateway_integration.auth_login_integration.id,
      # Admin endpoints
      aws_api_gateway_resource.admin_bins.id,
      aws_api_gateway_resource.admin_bin_id.id,
      aws_api_gateway_method.get_admin_bins.id,
      aws_api_gateway_method.post_admin_bins.id,
      aws_api_gateway_method.get_admin_bin.id,
      aws_api_gateway_method.put_admin_bin.id,
      aws_api_gateway_method.delete_admin_bin.id,
      # Authorizer
      aws_api_gateway_authorizer.jwt_authorizer.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.sqs_integration,
    aws_api_gateway_integration_response.sqs_integration_response,
    aws_api_gateway_integration.auth_login_integration,
    aws_api_gateway_integration.get_admin_bins_integration,
    aws_api_gateway_integration.post_admin_bins_integration,
    aws_api_gateway_integration.get_admin_bin_integration,
    aws_api_gateway_integration.put_admin_bin_integration,
    aws_api_gateway_integration.delete_admin_bin_integration,
  ]
}

resource "aws_api_gateway_stage" "api_stage" {
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment

  # Enable detailed CloudWatch metrics
  xray_tracing_enabled = true

  # Access logging configuration
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = local.common_tags
}

# CloudWatch Log Group for API Gateway access logs
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.environment}-${var.project_name}"
  retention_in_days = var.environment == "local" ? 1 : 7

  tags = local.common_tags
}

# Method settings for throttling and caching
resource "aws_api_gateway_method_settings" "api_method_settings" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.api_stage.stage_name
  method_path = "*/*"

  settings {
    # Throttling settings - prevent spam/abuse
    throttling_rate_limit  = var.environment == "local" ? 100 : 1000 # requests per second
    throttling_burst_limit = var.environment == "local" ? 50 : 500   # burst capacity

    # Metrics and logging
    metrics_enabled    = true
    logging_level      = var.environment == "local" ? "INFO" : "ERROR"
    data_trace_enabled = var.environment == "local" ? true : false

    # Caching disabled for real-time updates
    caching_enabled = false
  }
}

# Request validator - validates request body and parameters
resource "aws_api_gateway_request_validator" "body_validator" {
  rest_api_id                 = aws_api_gateway_rest_api.api.id
  name                        = "${var.environment}-${var.project_name}-body-validator"
  validate_request_body       = true
  validate_request_parameters = true
}

# Request model - JSON schema for status update
resource "aws_api_gateway_model" "status_update_model" {
  rest_api_id  = aws_api_gateway_rest_api.api.id
  name         = "StatusUpdateModel"
  description  = "Schema for bin status update request"
  content_type = "application/json"

  schema = jsonencode({
    "$schema" = "http://json-schema.org/draft-04/schema#"
    title     = "StatusUpdateRequest"
    type      = "object"
    required  = ["status"]
    properties = {
      status = {
        type        = "integer"
        minimum     = 0
        maximum     = 100
        description = "Bin fill level percentage (0-100)"
      }
    }
  })
}

# Usage Plan - for rate limiting per API key (optional for future admin keys)
resource "aws_api_gateway_usage_plan" "api_usage_plan" {
  name        = "${var.environment}-${var.project_name}-usage-plan"
  description = "Usage plan for EcoScan API with rate limiting"

  # Throttle limits
  throttle_settings {
    rate_limit  = var.environment == "local" ? 100 : 1000
    burst_limit = var.environment == "local" ? 50 : 500
  }

  # Quota limits (daily)
  quota_settings {
    limit  = var.environment == "local" ? 10000 : 100000
    period = "DAY"
  }

  api_stages {
    api_id = aws_api_gateway_rest_api.api.id
    stage  = aws_api_gateway_stage.api_stage.stage_name
  }

  tags = local.common_tags
}

# Lambda permission removed - Lambda is now triggered by SQS, not API Gateway

# =============================================================================
# ADMIN DASHBOARD API - Lambda Authorizer and Routes
# =============================================================================

# Lambda Authorizer
resource "aws_api_gateway_authorizer" "jwt_authorizer" {
  name                   = "${var.environment}-${var.project_name}-jwt-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.api.id
  authorizer_uri         = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.terraform_remote_state.compute.outputs.lambda_authorizer_arn}/invocations"
  authorizer_credentials = aws_iam_role.apigateway_lambda_role.arn
  type                   = "TOKEN"
  identity_source        = "method.request.header.Authorization"

  # Cache authorization for 5 minutes
  authorizer_result_ttl_in_seconds = var.environment == "local" ? 0 : 300
}

# IAM Role for API Gateway to invoke Lambda Authorizer
resource "aws_iam_role" "apigateway_lambda_role" {
  name = "${var.environment}-${var.project_name}-apigateway-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "apigateway_lambda_policy" {
  name = "${var.environment}-${var.project_name}-apigateway-lambda-policy"
  role = aws_iam_role.apigateway_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          data.terraform_remote_state.compute.outputs.lambda_authorizer_arn,
          data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn
        ]
      }
    ]
  })
}

# =============================================================================
# Auth Resources (/auth/login)
# =============================================================================

resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_resource" "auth_login" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "login"
}

# POST /auth/login - No authorization required
resource "aws_api_gateway_method" "post_auth_login" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.auth_login.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_login_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.auth_login.id
  http_method             = aws_api_gateway_method.post_auth_login.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# =============================================================================
# Admin Resources (/admin/bins)
# =============================================================================

resource "aws_api_gateway_resource" "admin" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "admin"
}

resource "aws_api_gateway_resource" "admin_bins" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "bins"
}

resource "aws_api_gateway_resource" "admin_bin_id" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.admin_bins.id
  path_part   = "{bin_id}"
}

# GET /admin/bins - List all bins (requires JWT)
resource "aws_api_gateway_method" "get_admin_bins" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.admin_bins.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "get_admin_bins_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.admin_bins.id
  http_method             = aws_api_gateway_method.get_admin_bins.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# POST /admin/bins - Create new bin (requires JWT)
resource "aws_api_gateway_method" "post_admin_bins" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.admin_bins.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "post_admin_bins_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.admin_bins.id
  http_method             = aws_api_gateway_method.post_admin_bins.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# GET /admin/bins/{bin_id} - Get single bin (requires JWT)
resource "aws_api_gateway_method" "get_admin_bin" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.admin_bin_id.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id

  request_parameters = {
    "method.request.path.bin_id" = true
  }
}

resource "aws_api_gateway_integration" "get_admin_bin_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.admin_bin_id.id
  http_method             = aws_api_gateway_method.get_admin_bin.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# PUT /admin/bins/{bin_id} - Update bin (requires JWT)
resource "aws_api_gateway_method" "put_admin_bin" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.admin_bin_id.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id

  request_parameters = {
    "method.request.path.bin_id" = true
  }
}

resource "aws_api_gateway_integration" "put_admin_bin_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.admin_bin_id.id
  http_method             = aws_api_gateway_method.put_admin_bin.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# DELETE /admin/bins/{bin_id} - Delete bin (requires JWT)
resource "aws_api_gateway_method" "delete_admin_bin" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.admin_bin_id.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id

  request_parameters = {
    "method.request.path.bin_id" = true
  }
}

resource "aws_api_gateway_integration" "delete_admin_bin_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.admin_bin_id.id
  http_method             = aws_api_gateway_method.delete_admin_bin.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}
