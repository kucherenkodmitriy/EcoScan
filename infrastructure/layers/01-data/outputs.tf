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
