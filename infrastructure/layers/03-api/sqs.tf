# SQS Queue for status updates
resource "aws_sqs_queue" "status_updates_dlq" {
  name = "${var.environment}-${var.project_name}-status-updates-dlq"

  message_retention_seconds = 1209600 # 14 days
  visibility_timeout_seconds = 300     # 5 minutes

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-status-updates-dlq"
      Purpose = "Dead letter queue for failed status updates"
    }
  )
}

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
      Purpose = "Queue for bin status updates"
    }
  )
}

# IAM role for API Gateway to send messages to SQS
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

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-apigateway-sqs-role"
    }
  )
}

# IAM policy for API Gateway to send to SQS
resource "aws_iam_policy" "apigateway_sqs_policy" {
  name        = "${var.environment}-${var.project_name}-apigateway-sqs-policy"
  description = "Allow API Gateway to send messages to SQS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.status_updates.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "apigateway_sqs_policy_attachment" {
  role       = aws_iam_role.apigateway_sqs_role.name
  policy_arn = aws_iam_policy.apigateway_sqs_policy.arn
}
