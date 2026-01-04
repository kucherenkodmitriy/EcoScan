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
  trash_bins_table_arn      = data.terraform_remote_state.data.outputs.trash_bins_table_arn
  status_reports_table_arn  = data.terraform_remote_state.data.outputs.status_reports_table_arn

  # Get SQS queue info from api layer
  sqs_queue_arn  = data.terraform_remote_state.api.outputs.sqs_queue_arn
  sqs_queue_name = data.terraform_remote_state.api.outputs.sqs_queue_name

  # Lambda environment-specific endpoint
  dynamodb_endpoint_url = var.use_localstack ? "http://localstack:4566" : ""
}
