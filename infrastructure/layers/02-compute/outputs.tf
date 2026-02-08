output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.update_bin_status.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.update_bin_status.arn
}

output "lambda_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.update_bin_status.invoke_arn
}

output "lambda_exec_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_exec_role.arn
}

# Lambda Authorizer outputs
output "lambda_authorizer_arn" {
  description = "ARN of the Lambda authorizer function"
  value       = aws_lambda_function.authorizer.arn
}

output "lambda_authorizer_name" {
  description = "Name of the Lambda authorizer function"
  value       = aws_lambda_function.authorizer.function_name
}

# Admin Dashboard Lambda outputs
output "admin_dashboard_lambda_arn" {
  description = "ARN of the Admin Dashboard Lambda function"
  value       = aws_lambda_function.admin_dashboard.arn
}

output "admin_dashboard_lambda_name" {
  description = "Name of the Admin Dashboard Lambda function"
  value       = aws_lambda_function.admin_dashboard.function_name
}

# Contact Form Handler Lambda outputs
output "contact_form_lambda_arn" {
  description = "ARN of the Contact Form Handler Lambda function"
  value       = aws_lambda_function.contact_form_handler.arn
}

output "contact_form_lambda_name" {
  description = "Name of the Contact Form Handler Lambda function"
  value       = aws_lambda_function.contact_form_handler.function_name
}

output "contact_form_invoke_arn" {
  description = "Invoke ARN of the Contact Form Handler Lambda function"
  value       = aws_lambda_function.contact_form_handler.invoke_arn
}

# Webhook Sender Lambda outputs
output "webhook_sender_lambda_arn" {
  description = "ARN of the Webhook Sender Lambda function"
  value       = aws_lambda_function.webhook_sender.arn
}

output "webhook_sender_lambda_name" {
  description = "Name of the Webhook Sender Lambda function"
  value       = aws_lambda_function.webhook_sender.function_name
}

# API Key Authorizer Lambda outputs
output "api_key_authorizer_arn" {
  description = "ARN of the API Key Authorizer Lambda function"
  value       = aws_lambda_function.api_key_authorizer.arn
}

output "api_key_authorizer_name" {
  description = "Name of the API Key Authorizer Lambda function"
  value       = aws_lambda_function.api_key_authorizer.function_name
}
