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

# =============================================================================
# IAM Role for API Gateway to send messages to SQS
# =============================================================================

resource "aws_iam_role" "apigateway_sqs_role" {
  name = "${var.environment}-${var.project_name}-apigateway-sqs-role"

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

resource "aws_iam_role_policy" "apigateway_sqs_policy" {
  name = "${var.environment}-${var.project_name}-apigateway-sqs-policy"
  role = aws_iam_role.apigateway_sqs_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = local.sqs_queue_arn
      }
    ]
  })
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

# OPTIONS /bins/{bin_id}/status - CORS preflight (using MOCK integration for simple CORS)
resource "aws_api_gateway_method" "options_status" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.status.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_status_integration" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.options_status.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_status_200" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.options_status.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_status_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.options_status.http_method
  status_code = aws_api_gateway_method_response.options_status_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_status_integration]
}

resource "aws_api_gateway_integration" "sqs_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.status.id
  http_method             = aws_api_gateway_method.post_status.http_method
  integration_http_method = "POST"
  type                    = "AWS"
  credentials             = aws_iam_role.apigateway_sqs_role.arn
  uri                     = "arn:aws:apigateway:${var.aws_region}:sqs:path/${data.aws_caller_identity.current.account_id}/${local.sqs_queue_name}"

  request_parameters = {
    "integration.request.header.Content-Type" = "'application/x-www-form-urlencoded'"
  }

  # Transform the incoming JSON to SQS message format
  # Combine binId from path with status from body into a JSON message
  # Include optional source field (defaults to "qr" if not provided)
  # Add message attributes for distributed tracing:
  #   - RequestId: API Gateway request ID (for correlation)
  #   - TraceId: X-Ray trace ID (for distributed tracing)
  #   - SourceIp: Client IP address
  request_templates = {
    "application/json" = <<TEMPLATE
#set($source = $input.json('$.source'))
#if($source == "" || $source == "null")
#set($source = "qr")
#end
Action=SendMessage&MessageBody=$util.urlEncode("{""binId"":""$input.params().path.bin_id"",""status"":$input.json('$.status'),""source"":$source}")
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
      aws_api_gateway_method.options_status.id,
      aws_api_gateway_integration.options_status_integration.id,
      # Auth endpoints
      aws_api_gateway_resource.auth_login.id,
      aws_api_gateway_method.post_auth_login.id,
      aws_api_gateway_integration.auth_login_integration.id,
      aws_api_gateway_method.options_auth_login.id,
      aws_api_gateway_integration.options_auth_login_integration.id,
      # Admin endpoints
      aws_api_gateway_resource.admin_bins.id,
      aws_api_gateway_resource.admin_bin_id.id,
      aws_api_gateway_method.get_admin_bins.id,
      aws_api_gateway_method.post_admin_bins.id,
      aws_api_gateway_method.get_admin_bin.id,
      aws_api_gateway_method.put_admin_bin.id,
      aws_api_gateway_method.delete_admin_bin.id,
      aws_api_gateway_method.options_admin_bins.id,
      aws_api_gateway_integration.options_admin_bins_integration.id,
      aws_api_gateway_method.options_admin_bin.id,
      aws_api_gateway_integration.options_admin_bin_integration.id,
      aws_api_gateway_authorizer.jwt_authorizer.id,
      # Public report endpoints
      aws_api_gateway_resource.report.id,
      aws_api_gateway_resource.report_bin_id.id,
      aws_api_gateway_method.get_report_bin.id,
      aws_api_gateway_integration.get_report_bin_integration.id,
      aws_api_gateway_method.options_report_bin.id,
      aws_api_gateway_integration.options_report_bin_integration.id,
      # Static resources
      aws_api_gateway_resource.static.id,
      aws_api_gateway_resource.static_report.id,
      aws_api_gateway_method.get_static_report.id,
      aws_api_gateway_integration.get_static_report_integration.id,
      aws_api_gateway_resource.static_login.id,
      aws_api_gateway_method.get_static_login.id,
      aws_api_gateway_integration.get_static_login_integration.id,
      aws_api_gateway_resource.static_dashboard.id,
      aws_api_gateway_method.get_static_dashboard.id,
      aws_api_gateway_integration.get_static_dashboard_integration.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  # Base dependencies (always present)
  # Conditional admin resources are handled by their own resource dependencies
  depends_on = [
    aws_api_gateway_integration.sqs_integration,
    aws_api_gateway_integration_response.sqs_integration_response,
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
      source = {
        type        = "string"
        enum        = ["qr", "iot", "manual"]
        description = "Source of the status report (qr, iot, or manual). Defaults to qr."
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

# Lambda Authorizer for JWT validation
resource "aws_api_gateway_authorizer" "jwt_authorizer" {
  name                   = "${var.environment}-${var.project_name}-jwt-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.api.id
  authorizer_uri         = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.lambda_authorizer_arn}/invocations"
  authorizer_credentials = aws_iam_role.apigateway_lambda_role.arn
  type                   = "TOKEN"
  identity_source        = "method.request.header.Authorization"

  # Cache authorization for 5 minutes
  authorizer_result_ttl_in_seconds = var.environment == "local" ? 0 : 300
}

# IAM Role for API Gateway to invoke Lambda Authorizer and Admin Dashboard
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
          local.lambda_authorizer_arn,
          local.admin_dashboard_arn
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

# OPTIONS /auth/login - CORS preflight
resource "aws_api_gateway_method" "options_auth_login" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.auth_login.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_auth_login_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.auth_login.id
  http_method             = aws_api_gateway_method.options_auth_login.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

resource "aws_api_gateway_integration" "auth_login_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.auth_login.id
  http_method             = aws_api_gateway_method.post_auth_login.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
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

# OPTIONS /admin/bins - CORS preflight
resource "aws_api_gateway_method" "options_admin_bins" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.admin_bins.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_admin_bins_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.admin_bins.id
  http_method             = aws_api_gateway_method.options_admin_bins.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
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
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
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
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# OPTIONS /admin/bins/{bin_id} - CORS preflight
resource "aws_api_gateway_method" "options_admin_bin" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.admin_bin_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_admin_bin_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.admin_bin_id.id
  http_method             = aws_api_gateway_method.options_admin_bin.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
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
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
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
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
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
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# =============================================================================
# Public Report Resources (/report/{bin_id}) - QR code landing page endpoint
# =============================================================================

resource "aws_api_gateway_resource" "report" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "report"
}

resource "aws_api_gateway_resource" "report_bin_id" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.report.id
  path_part   = "{bin_id}"
}

# OPTIONS /report/{bin_id} - CORS preflight
resource "aws_api_gateway_method" "options_report_bin" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.report_bin_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_report_bin_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.report_bin_id.id
  http_method             = aws_api_gateway_method.options_report_bin.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# GET /report/{bin_id} - Get public bin info for QR report page (no auth required)
resource "aws_api_gateway_method" "get_report_bin" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.report_bin_id.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.bin_id" = true
  }
}

resource "aws_api_gateway_integration" "get_report_bin_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.report_bin_id.id
  http_method             = aws_api_gateway_method.get_report_bin.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# =============================================================================
# Static Resources (/static/report.html) - Bin reporting UI
# =============================================================================

resource "aws_api_gateway_resource" "static" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "static"
}

resource "aws_api_gateway_resource" "static_report" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.static.id
  path_part   = "report.html"
}

# GET /static/report.html - Serve static reporting page (no auth required)
resource "aws_api_gateway_method" "get_static_report" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.static_report.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_static_report_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.static_report.id
  http_method             = aws_api_gateway_method.get_static_report.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# GET /static/login.html - Admin login page
resource "aws_api_gateway_resource" "static_login" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.static.id
  path_part   = "login.html"
}

resource "aws_api_gateway_method" "get_static_login" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.static_login.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_static_login_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.static_login.id
  http_method             = aws_api_gateway_method.get_static_login.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}

# GET /static/dashboard.html - Admin dashboard page
resource "aws_api_gateway_resource" "static_dashboard" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.static.id
  path_part   = "dashboard.html"
}

resource "aws_api_gateway_method" "get_static_dashboard" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.static_dashboard.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_static_dashboard_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.static_dashboard.id
  http_method             = aws_api_gateway_method.get_static_dashboard.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${local.admin_dashboard_arn}/invocations"
  credentials             = aws_iam_role.apigateway_lambda_role.arn
}
