output "trash_bins_table_name" {
  description = "Name of the trash bins DynamoDB table"
  value       = aws_dynamodb_table.trash_bins.name
}

output "trash_bins_table_arn" {
  description = "ARN of the trash bins DynamoDB table"
  value       = aws_dynamodb_table.trash_bins.arn
}

output "status_reports_table_name" {
  description = "Name of the status reports DynamoDB table"
  value       = aws_dynamodb_table.status_reports.name
}

output "status_reports_table_arn" {
  description = "ARN of the status reports DynamoDB table"
  value       = aws_dynamodb_table.status_reports.arn
}

output "admin_users_table_name" {
  description = "Name of the admin users DynamoDB table"
  value       = aws_dynamodb_table.admin_users.name
}

output "admin_users_table_arn" {
  description = "ARN of the admin users DynamoDB table"
  value       = aws_dynamodb_table.admin_users.arn
}

output "jwt_secret_arn" {
  description = "ARN of the JWT secret in Secrets Manager"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "jwt_secret_name" {
  description = "Name of the JWT secret in Secrets Manager"
  value       = aws_secretsmanager_secret.jwt_secret.name
}

# SQS Queue outputs
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
