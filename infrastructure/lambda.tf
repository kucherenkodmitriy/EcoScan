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
