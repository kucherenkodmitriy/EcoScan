locals {
  common_tags = merge(
    var.tags,
    {
      Layer = "api"
    }
  )

  # Get SQS queue info from data layer (no circular dependency)
  sqs_queue_arn  = data.terraform_remote_state.data.outputs.sqs_queue_arn
  sqs_queue_url  = data.terraform_remote_state.data.outputs.sqs_queue_url
  sqs_queue_name = data.terraform_remote_state.data.outputs.sqs_queue_name

  # Get Lambda ARNs from compute layer (deployed before api layer)
  lambda_authorizer_arn = data.terraform_remote_state.compute.outputs.lambda_authorizer_arn
  admin_dashboard_arn   = data.terraform_remote_state.compute.outputs.admin_dashboard_lambda_arn
}
