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
