locals {
  common_tags = merge(
    var.tags,
    {
      Layer = "compute"
    }
  )

  # Get DynamoDB table names and ARNs from data layer
  trash_bins_table_name     = data.terraform_remote_state.data.outputs.trash_bins_table_name
  status_reports_table_name = data.terraform_remote_state.data.outputs.status_reports_table_name
  admin_users_table_name    = data.terraform_remote_state.data.outputs.admin_users_table_name
  demo_requests_table_name  = data.terraform_remote_state.data.outputs.demo_requests_table_name
  trash_bins_table_arn      = data.terraform_remote_state.data.outputs.trash_bins_table_arn
  status_reports_table_arn  = data.terraform_remote_state.data.outputs.status_reports_table_arn
  admin_users_table_arn     = data.terraform_remote_state.data.outputs.admin_users_table_arn
  demo_requests_table_arn   = data.terraform_remote_state.data.outputs.demo_requests_table_arn

  # Get JWT secret from data layer
  jwt_secret_arn = data.terraform_remote_state.data.outputs.jwt_secret_arn

  # Get SQS queue info from data layer (no circular dependency)
  sqs_queue_arn  = data.terraform_remote_state.data.outputs.sqs_queue_arn
  sqs_queue_name = data.terraform_remote_state.data.outputs.sqs_queue_name

  # Lambda environment-specific endpoint
  dynamodb_endpoint_url = var.use_localstack ? "http://localstack:4566" : ""
}
