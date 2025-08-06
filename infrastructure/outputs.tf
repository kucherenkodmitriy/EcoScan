output "api_gateway_invoke_url" {
  description = "The invoke URL for the API Gateway stage."
  value       = aws_api_gateway_stage.api_stage.invoke_url
}

output "trash_bins_table_name" {
  description = "The name of the DynamoDB table for trash bins."
  value       = aws_dynamodb_table.trash_bins.name
}

output "api_gateway_id" {
  description = "The ID of the API Gateway REST API."
  value       = aws_api_gateway_rest_api.api.id
}
