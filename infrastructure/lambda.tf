# This resource defines the Lambda function itself.
# The build script is now responsible for creating the zip file, which is why
# we point directly to the `filename` and don't use the `archive_file` data source.
resource "aws_lambda_function" "update_bin_status" {
  function_name = "${var.environment}-ecoscan-update-bin-status"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2"
  architectures = ["x86_64"]

  filename         = "../services/target/lambda.zip"
  source_code_hash = filebase64sha256("../services/target/lambda.zip")

  environment {
    variables = {
      # Standard AWS Lambda environment variables, required by the Rust runtime
      AWS_LAMBDA_FUNCTION_NAME        = "${var.environment}-ecoscan-update-bin-status"
      AWS_LAMBDA_FUNCTION_MEMORY_SIZE = "128" # Default memory size, as seen in LocalStack
      AWS_LAMBDA_FUNCTION_VERSION     = "$LATEST"
      AWS_LAMBDA_LOG_STREAM_NAME      = "2025/01/01/[$LATEST]placeholder" # Placeholder for local testing
      AWS_LAMBDA_LOG_GROUP_NAME       = "/aws/lambda/${var.environment}-ecoscan-update-bin-status"

      # Application-specific environment variables
      TRASH_BINS_TABLE_NAME     = aws_dynamodb_table.trash_bins.name
      STATUS_REPORTS_TABLE_NAME = aws_dynamodb_table.status_reports.name
      DYNAMODB_ENDPOINT_URL     = var.environment == "local" ? "http://localstack:4566" : ""
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy_attachment
  ]
}

# Contact form handler Lambda function
resource "aws_lambda_function" "contact_form_handler" {
  function_name = "${var.environment}-ecoscan-contact-form"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2"
  architectures = ["x86_64"]

  filename         = "../services/target/contact-form-handler.zip"
  source_code_hash = filebase64sha256("../services/target/contact-form-handler.zip")

  # Actual Lambda resource configuration
  memory_size = 256
  timeout     = 30 # reCAPTCHA verification can take several seconds

  environment {
    variables = {
      AWS_LAMBDA_FUNCTION_NAME        = "${var.environment}-ecoscan-contact-form"
      AWS_LAMBDA_FUNCTION_MEMORY_SIZE = "256"
      AWS_LAMBDA_FUNCTION_VERSION     = "$LATEST"
      AWS_LAMBDA_LOG_STREAM_NAME      = "2025/01/01/[$LATEST]placeholder"
      AWS_LAMBDA_LOG_GROUP_NAME       = "/aws/lambda/${var.environment}-ecoscan-contact-form"

      DEMO_REQUESTS_TABLE   = aws_dynamodb_table.demo_requests.name
      RECAPTCHA_SECRET_KEY  = var.recaptcha_secret_key
      RECAPTCHA_MIN_SCORE   = "0.5"
      SKIP_RECAPTCHA        = var.skip_recaptcha ? "true" : "false"
      DYNAMODB_ENDPOINT_URL = var.environment == "local" ? "http://localstack:4566" : ""
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy_attachment
  ]
}

resource "aws_cloudwatch_log_group" "contact_form_logs" {
  name              = "/aws/lambda/${var.environment}-ecoscan-contact-form"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

