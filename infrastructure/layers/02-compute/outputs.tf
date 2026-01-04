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
