# =============================================================================
# CloudWatch Log Groups (explicit, with retention)
# =============================================================================

resource "aws_cloudwatch_log_group" "update_bin_status" {
  name              = "/aws/lambda/${var.environment}-${var.project_name}-update-bin-status"
  retention_in_days = var.use_localstack ? 1 : 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/${var.environment}-${var.project_name}-authorizer"
  retention_in_days = var.use_localstack ? 1 : 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_key_authorizer" {
  name              = "/aws/lambda/${var.environment}-${var.project_name}-apikey-authorizer"
  retention_in_days = var.use_localstack ? 1 : 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "admin_dashboard" {
  name              = "/aws/lambda/${var.environment}-${var.project_name}-admin-dashboard"
  retention_in_days = var.use_localstack ? 1 : 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "contact_form_handler" {
  name              = "/aws/lambda/${var.environment}-${var.project_name}-contact-form"
  retention_in_days = var.use_localstack ? 1 : 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "webhook_sender" {
  name              = "/aws/lambda/${var.environment}-${var.project_name}-webhook-sender"
  retention_in_days = var.use_localstack ? 1 : 14
  tags              = local.common_tags
}

# =============================================================================
# Lambda Functions
# =============================================================================

resource "aws_lambda_function" "update_bin_status" {
  function_name = "${var.environment}-${var.project_name}-update-bin-status"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = [var.lambda_architecture]
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  environment {
    variables = merge(
      {
        # Application-specific environment variables
        TRASH_BINS_TABLE_NAME     = local.trash_bins_table_name
        STATUS_REPORTS_TABLE_NAME = local.status_reports_table_name

        # Enable X-Ray tracing
        AWS_XRAY_TRACING_NAME    = "${var.environment}-${var.project_name}-update-bin-status"
        AWS_XRAY_CONTEXT_MISSING = "LOG_ERROR"
      },
      # Only set DYNAMODB_ENDPOINT_URL for LocalStack
      var.use_localstack ? {
        DYNAMODB_ENDPOINT_URL = local.dynamodb_endpoint_url
      } : {}
    )
  }

  # Enable active X-Ray tracing
  tracing_config {
    mode = "Active"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-update-bin-status"
    }
  )

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy_attachment,
    aws_iam_role_policy_attachment.lambda_sqs_policy_attachment
  ]
}

# SQS Event Source Mapping - Lambda triggered by SQS messages
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = local.sqs_queue_arn
  function_name    = aws_lambda_function.update_bin_status.arn

  # Batch configuration
  batch_size                         = var.lambda_sqs_batch_size
  maximum_batching_window_in_seconds = 0 # Process immediately

  # Error handling
  function_response_types = ["ReportBatchItemFailures"]

  # Scaling configuration
  scaling_config {
    maximum_concurrency = var.lambda_max_concurrency
  }

  enabled = true
}

# =============================================================================
# Lambda Authorizer - JWT Token Validation
# =============================================================================

resource "aws_lambda_function" "authorizer" {
  function_name = "${var.environment}-${var.project_name}-authorizer"
  role          = aws_iam_role.lambda_authorizer_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = [var.lambda_architecture]
  memory_size   = 128
  timeout       = 10

  filename         = var.authorizer_zip_path
  source_code_hash = filebase64sha256(var.authorizer_zip_path)

  environment {
    variables = var.use_localstack ? {
      # LocalStack: use JWT_SECRET directly (simpler than configuring Secrets Manager endpoint)
      JWT_SECRET = var.jwt_secret
      } : {
      # Production: fetch from Secrets Manager
      JWT_SECRET_ARN = local.jwt_secret_arn
    }
  }

  tracing_config {
    mode = "Active"
  }

  lifecycle {
    precondition {
      condition     = !var.use_localstack || length(var.jwt_secret) >= 32
      error_message = "jwt_secret must be at least 32 characters when use_localstack is true."
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-authorizer"
    }
  )
}

# Minimal IAM role for authorizer - only needs to execute
resource "aws_iam_role" "lambda_authorizer_role" {
  name = "${var.environment}-${var.project_name}-authorizer-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "authorizer_logs_policy" {
  name = "${var.environment}-${var.project_name}-authorizer-logs-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.authorizer.arn}:*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "authorizer_logs" {
  role       = aws_iam_role.lambda_authorizer_role.name
  policy_arn = aws_iam_policy.authorizer_logs_policy.arn
}

# Policy for authorizer to read JWT secret from Secrets Manager
resource "aws_iam_policy" "authorizer_secrets_policy" {
  name        = "${var.environment}-${var.project_name}-authorizer-secrets-policy"
  description = "IAM policy for Lambda authorizer to read JWT secret from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = local.jwt_secret_arn
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "authorizer_secrets_attachment" {
  role       = aws_iam_role.lambda_authorizer_role.name
  policy_arn = aws_iam_policy.authorizer_secrets_policy.arn
}

# =============================================================================
# API Key Authorizer Lambda
# =============================================================================

resource "aws_lambda_function" "api_key_authorizer" {
  function_name = "${var.environment}-${var.project_name}-apikey-authorizer"
  role          = aws_iam_role.api_key_authorizer_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = [var.lambda_architecture]
  memory_size   = 128
  timeout       = 10

  filename         = var.apikey_authorizer_zip_path
  source_code_hash = filebase64sha256(var.apikey_authorizer_zip_path)

  environment {
    variables = merge(
      {
        API_KEYS_TABLE_NAME = local.api_keys_table_name
      },
      var.use_localstack ? {
        DYNAMODB_ENDPOINT_URL = local.dynamodb_endpoint_url
      } : {}
    )
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-apikey-authorizer"
    }
  )
}

# IAM role for API Key Authorizer Lambda
resource "aws_iam_role" "api_key_authorizer_role" {
  name = "${var.environment}-${var.project_name}-apikey-authorizer-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Policy for API Key Authorizer Lambda
resource "aws_iam_policy" "api_key_authorizer_policy" {
  name = "${var.environment}-${var.project_name}-apikey-authorizer-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.api_key_authorizer.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          local.api_keys_table_arn,
          "${local.api_keys_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_key_authorizer_policy_attachment" {
  role       = aws_iam_role.api_key_authorizer_role.name
  policy_arn = aws_iam_policy.api_key_authorizer_policy.arn
}

# =============================================================================
# Admin Dashboard API Lambda
# =============================================================================

resource "aws_lambda_function" "admin_dashboard" {
  function_name = "${var.environment}-${var.project_name}-admin-dashboard"
  role          = aws_iam_role.admin_dashboard_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = [var.lambda_architecture]
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = var.admin_dashboard_zip_path
  source_code_hash = filebase64sha256(var.admin_dashboard_zip_path)

  environment {
    variables = merge(
      {
        ADMIN_USERS_TABLE_NAME      = local.admin_users_table_name
        TRASH_BINS_TABLE_NAME       = local.trash_bins_table_name
        STATUS_REPORTS_TABLE_NAME   = local.status_reports_table_name
        WEBHOOK_CONFIGS_TABLE_NAME  = local.webhook_configs_table_name
        API_KEYS_TABLE_NAME         = local.api_keys_table_name
        ARCHIVED_REPORTS_TABLE_NAME = local.archived_reports_table_name
        JWT_EXPIRY_HOURS            = var.jwt_expiry_hours
        CORS_ALLOWED_ORIGINS        = var.cors_allowed_origins
        FROM_EMAIL                  = var.from_email
        FRONTEND_URL                = var.frontend_url
        AWS_XRAY_TRACING_NAME       = "${var.environment}-${var.project_name}-admin-dashboard"
        AWS_XRAY_CONTEXT_MISSING    = "LOG_ERROR"
      },
      var.use_localstack ? {
        # LocalStack: use env vars directly
        DYNAMODB_ENDPOINT_URL = local.dynamodb_endpoint_url
        JWT_SECRET            = var.jwt_secret
        } : {
        # Production: fetch secret from Secrets Manager
        JWT_SECRET_ARN = local.jwt_secret_arn
      }
    )
  }

  lifecycle {
    precondition {
      condition     = !var.use_localstack || length(var.jwt_secret) >= 32
      error_message = "jwt_secret must be at least 32 characters when use_localstack is true."
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-admin-dashboard"
    }
  )
}

# IAM role for Admin Dashboard Lambda
resource "aws_iam_role" "admin_dashboard_role" {
  name = "${var.environment}-${var.project_name}-admin-dashboard-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Policy for Admin Dashboard Lambda - access to all DynamoDB tables and Secrets Manager
resource "aws_iam_policy" "admin_dashboard_policy" {
  name = "${var.environment}-${var.project_name}-admin-dashboard-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.admin_dashboard.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          local.admin_users_table_arn,
          local.trash_bins_table_arn,
          local.status_reports_table_arn,
          local.webhook_configs_table_arn,
          local.api_keys_table_arn,
          "${local.api_keys_table_arn}/index/*",
          local.archived_reports_table_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = local.jwt_secret_arn
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = var.from_email != "" ? "arn:aws:ses:${var.aws_region}:*:identity/${var.from_email}" : "*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "admin_dashboard_policy_attachment" {
  role       = aws_iam_role.admin_dashboard_role.name
  policy_arn = aws_iam_policy.admin_dashboard_policy.arn
}

# =============================================================================
# Contact Form Handler Lambda
# =============================================================================

resource "aws_lambda_function" "contact_form_handler" {
  function_name = "${var.environment}-${var.project_name}-contact-form"
  role          = aws_iam_role.contact_form_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = [var.lambda_architecture]
  memory_size   = 256
  timeout       = 30 # reCAPTCHA verification can take several seconds

  filename         = var.contact_form_zip_path
  source_code_hash = filebase64sha256(var.contact_form_zip_path)

  environment {
    variables = merge(
      {
        DEMO_REQUESTS_TABLE  = local.demo_requests_table_name
        RECAPTCHA_MIN_SCORE  = "0.5"
        SKIP_RECAPTCHA       = var.skip_recaptcha ? "true" : "false"
        RECAPTCHA_SECRET_KEY = var.recaptcha_secret_key
        NOTIFY_EMAIL         = var.notify_email
        FROM_EMAIL           = var.from_email
        CORS_ALLOWED_ORIGINS = var.cors_allowed_origins
      },
      var.use_localstack ? {
        DYNAMODB_ENDPOINT_URL = local.dynamodb_endpoint_url
      } : {}
    )
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-contact-form"
    }
  )
}

# IAM role for Contact Form Handler Lambda
resource "aws_iam_role" "contact_form_role" {
  name = "${var.environment}-${var.project_name}-contact-form-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Policy for Contact Form Handler Lambda
resource "aws_iam_policy" "contact_form_policy" {
  name = "${var.environment}-${var.project_name}-contact-form-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.contact_form_handler.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem"
        ]
        Resource = local.demo_requests_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = var.from_email != "" ? "arn:aws:ses:${var.aws_region}:*:identity/${var.from_email}" : "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "contact_form_policy_attachment" {
  role       = aws_iam_role.contact_form_role.name
  policy_arn = aws_iam_policy.contact_form_policy.arn
}

# =============================================================================
# Webhook Sender Lambda
# =============================================================================

resource "aws_lambda_function" "webhook_sender" {
  function_name = "${var.environment}-${var.project_name}-webhook-sender"
  role          = aws_iam_role.webhook_sender_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = [var.lambda_architecture]
  memory_size   = var.lambda_memory_size
  timeout       = 60

  filename         = var.webhook_sender_zip_path
  source_code_hash = filebase64sha256(var.webhook_sender_zip_path)

  environment {
    variables = merge(
      {
        WEBHOOK_CONFIGS_TABLE_NAME = local.webhook_configs_table_name
        WEBHOOK_TIMEOUT_SECS       = "10"
        AWS_XRAY_TRACING_NAME      = "${var.environment}-${var.project_name}-webhook-sender"
        AWS_XRAY_CONTEXT_MISSING   = "LOG_ERROR"
      },
      var.use_localstack ? {
        DYNAMODB_ENDPOINT_URL = local.dynamodb_endpoint_url
      } : {}
    )
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-webhook-sender"
    }
  )

  depends_on = [
    aws_iam_role_policy_attachment.webhook_sender_policy_attachment
  ]
}

# SQS Event Source Mapping for webhook delivery
resource "aws_lambda_event_source_mapping" "webhook_sqs_trigger" {
  event_source_arn = local.webhook_sqs_queue_arn
  function_name    = aws_lambda_function.webhook_sender.arn

  batch_size                         = 1
  maximum_batching_window_in_seconds = 0

  function_response_types = ["ReportBatchItemFailures"]

  enabled = true
}

# IAM role for Webhook Sender Lambda
resource "aws_iam_role" "webhook_sender_role" {
  name = "${var.environment}-${var.project_name}-webhook-sender-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Policy for Webhook Sender Lambda
resource "aws_iam_policy" "webhook_sender_policy" {
  name = "${var.environment}-${var.project_name}-webhook-sender-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.webhook_sender.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Resource = local.webhook_configs_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = local.webhook_sqs_queue_arn
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "webhook_sender_policy_attachment" {
  role       = aws_iam_role.webhook_sender_role.name
  policy_arn = aws_iam_policy.webhook_sender_policy.arn
}
