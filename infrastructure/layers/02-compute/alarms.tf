# =============================================================================
# CloudWatch Alarms for Lambda Functions and SQS DLQs
# =============================================================================
# Only created in non-LocalStack environments

# SNS Topic for alarm notifications
resource "aws_sns_topic" "alarm_notifications" {
  count = var.use_localstack ? 0 : 1

  name = "${var.environment}-${var.project_name}-alarm-notifications"

  tags = local.common_tags
}

# Optional email subscription (only if alarm_email is set)
resource "aws_sns_topic_subscription" "alarm_email" {
  count = var.use_localstack || var.alarm_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.alarm_notifications[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# Lambda function names for alarm creation
locals {
  lambda_functions = var.use_localstack ? {} : {
    "update-bin-status" = aws_lambda_function.update_bin_status.function_name
    "authorizer"        = aws_lambda_function.authorizer.function_name
    "apikey-authorizer" = aws_lambda_function.api_key_authorizer.function_name
    "admin-dashboard"   = aws_lambda_function.admin_dashboard.function_name
    "contact-form"      = aws_lambda_function.contact_form_handler.function_name
    "webhook-sender"    = aws_lambda_function.webhook_sender.function_name
  }
}

# Lambda Error Alarms - one per function
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = local.lambda_functions

  alarm_name          = "${var.environment}-${var.project_name}-${each.key}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Lambda ${each.key} errors > 0 in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [aws_sns_topic.alarm_notifications[0].arn]
  ok_actions    = [aws_sns_topic.alarm_notifications[0].arn]

  tags = local.common_tags
}

# SQS DLQ Depth Alarms
resource "aws_cloudwatch_metric_alarm" "status_dlq_depth" {
  count = var.use_localstack ? 0 : 1

  alarm_name          = "${var.environment}-${var.project_name}-status-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Status updates DLQ has messages (processing failures)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = local.sqs_dlq_name
  }

  alarm_actions = [aws_sns_topic.alarm_notifications[0].arn]
  ok_actions    = [aws_sns_topic.alarm_notifications[0].arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "webhook_dlq_depth" {
  count = var.use_localstack ? 0 : 1

  alarm_name          = "${var.environment}-${var.project_name}-webhook-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Webhook delivery DLQ has messages (delivery failures)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = local.webhook_sqs_dlq_name
  }

  alarm_actions = [aws_sns_topic.alarm_notifications[0].arn]
  ok_actions    = [aws_sns_topic.alarm_notifications[0].arn]

  tags = local.common_tags
}
