resource "aws_lambda_function" "update_bin_status" {
  function_name = "${var.environment}-${var.project_name}-update-bin-status"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2"
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
  runtime       = "provided.al2"
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

resource "aws_iam_role_policy_attachment" "authorizer_logs" {
  role       = aws_iam_role.lambda_authorizer_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
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
# Admin Dashboard API Lambda
# =============================================================================

resource "aws_lambda_function" "admin_dashboard" {
  function_name = "${var.environment}-${var.project_name}-admin-dashboard"
  role          = aws_iam_role.admin_dashboard_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2"
  architectures = [var.lambda_architecture]
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = var.admin_dashboard_zip_path
  source_code_hash = filebase64sha256(var.admin_dashboard_zip_path)

  environment {
    variables = merge(
      {
        ADMIN_USERS_TABLE_NAME    = local.admin_users_table_name
        TRASH_BINS_TABLE_NAME     = local.trash_bins_table_name
        STATUS_REPORTS_TABLE_NAME = local.status_reports_table_name
        JWT_EXPIRY_HOURS          = var.jwt_expiry_hours
        CORS_ALLOWED_ORIGINS      = var.cors_allowed_origins
        AWS_XRAY_TRACING_NAME     = "${var.environment}-${var.project_name}-admin-dashboard"
        AWS_XRAY_CONTEXT_MISSING  = "LOG_ERROR"
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
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          local.admin_users_table_arn,
          local.trash_bins_table_arn,
          local.status_reports_table_arn
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
  runtime       = "provided.al2"
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
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
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
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "contact_form_policy_attachment" {
  role       = aws_iam_role.contact_form_role.name
  policy_arn = aws_iam_policy.contact_form_policy.arn
}
# trigger deploy
# trigger recaptcha deploy
