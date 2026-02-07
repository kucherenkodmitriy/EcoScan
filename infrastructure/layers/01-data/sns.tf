# =============================================================================
# SNS Topic for Status Updates Fan-out
# =============================================================================
# Enables fan-out of bin status updates to multiple consumers:
# - Existing SQS queue (bin-status-reporter) - unchanged behavior
# - New webhook delivery SQS queue (webhook-sender)

resource "aws_sns_topic" "status_updates" {
  name = "${var.environment}-${var.project_name}-status-updates"

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-status-updates"
      Purpose = "Fan-out bin status updates to multiple consumers"
    }
  )
}

# Subscribe existing SQS queue to SNS topic
# raw_message_delivery = true ensures the message format is unchanged,
# so bin-status-reporter requires zero code changes
resource "aws_sns_topic_subscription" "status_updates_sqs" {
  topic_arn            = aws_sns_topic.status_updates.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.status_updates.arn
  raw_message_delivery = true
}

# Subscribe webhook delivery SQS queue to SNS topic
resource "aws_sns_topic_subscription" "webhook_sqs" {
  topic_arn            = aws_sns_topic.status_updates.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.webhook_delivery.arn
  raw_message_delivery = true
}
