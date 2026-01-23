resource "aws_dynamodb_table" "trash_bins" {
  name           = "${var.environment}-${var.project_name}-trash-bins"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "binId"

  attribute {
    name = "binId"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-trash-bins"
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "status_reports" {
  name           = "${var.environment}-${var.project_name}-status-reports"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "binId"
  range_key      = "createdAt"

  attribute {
    name = "binId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-status-reports"
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "demo_requests" {
  name           = "${var.environment}-${var.project_name}-demo-requests"
  billing_mode   = "PROVISIONED"
  read_capacity  = 2
  write_capacity = 2
  hash_key       = "requestId"
  range_key      = "createdAt"

  attribute {
    name = "requestId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    range_key       = "createdAt"
    write_capacity  = 2
    read_capacity   = 2
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name        = "${var.project_name}-demo-requests"
    Environment = var.environment
    Purpose     = "Contact form and demo request submissions"
  }
}

