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
