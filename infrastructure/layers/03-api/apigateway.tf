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
  request_templates = {
    "application/json" = "Action=SendMessage&MessageBody=$util.urlEncode(\"{\"\"binId\"\":\"\"$input.params('bin_id')\"\",\"\"status\"\":$input.json('$.status')}\")"
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
      aws_api_gateway_resource.status.id,
      aws_api_gateway_method.post_status.id,
      aws_api_gateway_integration.sqs_integration.id,
      aws_api_gateway_integration_response.sqs_integration_response.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.sqs_integration,
    aws_api_gateway_integration_response.sqs_integration_response
  ]
}

resource "aws_api_gateway_stage" "api_stage" {
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment

  tags = local.common_tags
}

# Lambda permission removed - Lambda is now triggered by SQS, not API Gateway
