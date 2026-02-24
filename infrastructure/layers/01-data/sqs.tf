# =============================================================================
# SQS Queues for Status Updates
# =============================================================================
# Moved from 03-api to break circular dependency between compute and api layers.
# This enables unidirectional dependency flow: data → compute → api

# Dead Letter Queue for failed status updates
resource "aws_sqs_queue" "status_updates_dlq" {
  name = "${var.environment}-${var.project_name}-status-updates-dlq"

  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 300     # 5 minutes
  sqs_managed_sse_enabled    = var.use_localstack ? false : true

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-status-updates-dlq"
      Purpose = "Dead letter queue for failed status updates"
    }
  )
}

# Main queue for bin status updates
resource "aws_sqs_queue" "status_updates" {
  name = "${var.environment}-${var.project_name}-status-updates"

  # Message configuration
  message_retention_seconds  = 345600 # 4 days
  visibility_timeout_seconds = 90     # 1.5 minutes (3x Lambda timeout of 30s)
  receive_wait_time_seconds  = 0      # Short polling for responsiveness
  sqs_managed_sse_enabled    = var.use_localstack ? false : true

  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.status_updates_dlq.arn
    maxReceiveCount     = 3 # Retry 3 times before moving to DLQ
  })

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-status-updates"
      Purpose = "Queue for bin status updates from IoT devices"
    }
  )
}

# Allow SNS to send messages to the existing status updates queue
resource "aws_sqs_queue_policy" "status_updates_sns_policy" {
  queue_url = aws_sqs_queue.status_updates.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.status_updates.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.status_updates.arn
          }
        }
      }
    ]
  })
}

# =============================================================================
# Webhook Delivery SQS Queue
# =============================================================================

# Dead Letter Queue for failed webhook deliveries
resource "aws_sqs_queue" "webhook_delivery_dlq" {
  name = "${var.environment}-${var.project_name}-webhook-delivery-dlq"

  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 300
  sqs_managed_sse_enabled    = var.use_localstack ? false : true

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-webhook-delivery-dlq"
      Purpose = "Dead letter queue for failed webhook deliveries"
    }
  )
}

# Main queue for webhook delivery processing
resource "aws_sqs_queue" "webhook_delivery" {
  name = "${var.environment}-${var.project_name}-webhook-delivery"

  message_retention_seconds  = 345600 # 4 days
  visibility_timeout_seconds = 180    # 3 minutes (3x Lambda timeout of 60s)
  receive_wait_time_seconds  = 0
  sqs_managed_sse_enabled    = var.use_localstack ? false : true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.webhook_delivery_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-webhook-delivery"
      Purpose = "Queue for webhook delivery processing"
    }
  )
}

# Allow SNS to send messages to the webhook delivery queue
resource "aws_sqs_queue_policy" "webhook_delivery_sns_policy" {
  queue_url = aws_sqs_queue.webhook_delivery.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.webhook_delivery.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.status_updates.arn
          }
        }
      }
    ]
  })
}
