# SES Email Identity (verify your email domain)
resource "aws_ses_email_identity" "partnerships" {
  email = "partnerships@ecoscan.city"
}

# SES Configuration Set for tracking
resource "aws_ses_configuration_set" "contact_forms" {
  name = "${var.environment}-${var.project_name}-contact-forms"
}

# SES Sending Quota Alarm - Alert when approaching daily limit
resource "aws_cloudwatch_metric_alarm" "ses_sending_quota" {
  alarm_name          = "${var.environment}-${var.project_name}-ses-quota-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Send"
  namespace           = "AWS/SES"
  period              = "3600"
  statistic           = "Sum"
  threshold           = "40" # Alert when more than 40 emails sent per hour
  alarm_description   = "Warning: High email sending volume detected"
  treat_missing_data  = "notBreaching"

  # Optional: Add SNS topic for notifications
  # alarm_actions = [aws_sns_topic.alerts.arn]
}

# IAM role for Lambda to send emails via SES
resource "aws_iam_role_policy" "lambda_ses_policy" {
  name = "${var.environment}-${var.project_name}-lambda-ses-policy"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = "partnerships@ecoscan.city"
          }
        }
      }
    ]
  })
}

# Budget alarm to prevent cost overruns
resource "aws_budgets_budget" "ses_budget" {
  name              = "${var.environment}-${var.project_name}-ses-budget"
  budget_type       = "COST"
  limit_amount      = "10"
  limit_unit        = "USD"
  time_period_start = "2026-01-01_00:00"
  time_unit         = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Simple Email Service"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["partnerships@ecoscan.city"]
  }
}
