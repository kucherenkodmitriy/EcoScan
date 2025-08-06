resource "aws_dynamodb_table" "trash_bins" {
  name         = "${var.environment}-${var.project_name}-trash-bins"
  billing_mode = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key     = "binId"

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
  name         = "${var.environment}-${var.project_name}-status-reports"
  billing_mode = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key     = "binId"
  range_key    = "createdAt"

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
