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
    variables = {
      # Standard AWS Lambda environment variables
      AWS_LAMBDA_FUNCTION_NAME        = "${var.environment}-${var.project_name}-update-bin-status"
      AWS_LAMBDA_FUNCTION_MEMORY_SIZE = tostring(var.lambda_memory_size)
      AWS_LAMBDA_FUNCTION_VERSION     = "$LATEST"
      AWS_LAMBDA_LOG_STREAM_NAME      = "2025/01/01/[$LATEST]placeholder"
      AWS_LAMBDA_LOG_GROUP_NAME       = "/aws/lambda/${var.environment}-${var.project_name}-update-bin-status"

      # Application-specific environment variables
      TRASH_BINS_TABLE_NAME     = local.trash_bins_table_name
      STATUS_REPORTS_TABLE_NAME = local.status_reports_table_name
      DYNAMODB_ENDPOINT_URL     = local.dynamodb_endpoint_url

      # Enable X-Ray tracing
      AWS_XRAY_TRACING_NAME    = "${var.environment}-${var.project_name}-update-bin-status"
      AWS_XRAY_CONTEXT_MISSING = "LOG_ERROR"
    }
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
