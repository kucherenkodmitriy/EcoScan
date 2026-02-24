# =============================================================================
# CloudWatch Alarms for API Gateway
# =============================================================================
# Only created in non-LocalStack environments

locals {
  alarm_sns_topic_arn = var.use_localstack ? "" : data.terraform_remote_state.compute.outputs.alarm_sns_topic_arn
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  count = var.use_localstack ? 0 : 1

  alarm_name          = "${var.environment}-${var.project_name}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "API Gateway 5XX errors > 0 in 5 minutes"
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_sns_topic_arn != "" ? [local.alarm_sns_topic_arn] : []
  ok_actions    = local.alarm_sns_topic_arn != "" ? [local.alarm_sns_topic_arn] : []

  dimensions = {
    ApiName = aws_api_gateway_rest_api.api.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  count = var.use_localstack ? 0 : 1

  alarm_name          = "${var.environment}-${var.project_name}-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = 600
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "API Gateway 4XX errors > 50 in 10 minutes"
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_sns_topic_arn != "" ? [local.alarm_sns_topic_arn] : []
  ok_actions    = local.alarm_sns_topic_arn != "" ? [local.alarm_sns_topic_arn] : []

  dimensions = {
    ApiName = aws_api_gateway_rest_api.api.name
  }

  tags = local.common_tags
}
