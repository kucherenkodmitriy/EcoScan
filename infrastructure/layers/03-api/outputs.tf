output "api_gateway_id" {
  description = "ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.api.id
}

output "api_gateway_invoke_url" {
  description = "Invoke URL for the API Gateway stage"
  value       = aws_api_gateway_stage.api_stage.invoke_url
}

output "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.api.execution_arn
}

output "sqs_queue_arn" {
  description = "ARN of the status updates SQS queue"
  value       = aws_sqs_queue.status_updates.arn
}

output "sqs_queue_url" {
  description = "URL of the status updates SQS queue"
  value       = aws_sqs_queue.status_updates.url
}

output "sqs_queue_name" {
  description = "Name of the status updates SQS queue"
  value       = aws_sqs_queue.status_updates.name
}

output "sqs_dlq_arn" {
  description = "ARN of the dead letter queue"
  value       = aws_sqs_queue.status_updates_dlq.arn
}
