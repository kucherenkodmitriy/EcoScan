resource "aws_dynamodb_table" "trash_bins" {
  name         = "${var.environment}-${var.project_name}-trash-bins"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "binId"

  # Only set capacity when using PROVISIONED mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "binId"
    type = "S"
  }

  # Enable point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable encryption for non-local environments
  dynamic "server_side_encryption" {
    for_each = var.use_localstack ? [] : [1]
    content {
      enabled = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-trash-bins"
      Purpose = "Store trash bin information"
    }
  )
}

resource "aws_dynamodb_table" "status_reports" {
  name         = "${var.environment}-${var.project_name}-status-reports"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "binId"
  range_key    = "createdAt"

  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "binId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # Enable point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable encryption for non-local environments
  dynamic "server_side_encryption" {
    for_each = var.use_localstack ? [] : [1]
    content {
      enabled = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-status-reports"
      Purpose = "Store bin status update history"
    }
  )
}

resource "aws_dynamodb_table" "admin_users" {
  name         = "${var.environment}-${var.project_name}-admin-users"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "email"

  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "email"
    type = "S"
  }

  # Enable point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable encryption for non-local environments
  dynamic "server_side_encryption" {
    for_each = var.use_localstack ? [] : [1]
    content {
      enabled = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-admin-users"
      Purpose = "Store admin user credentials and profiles"
    }
  )
}

resource "aws_dynamodb_table" "webhook_configs" {
  name         = "${var.environment}-${var.project_name}-webhook-configs"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "webhookId"

  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "webhookId"
    type = "S"
  }

  # Enable point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable encryption for non-local environments
  dynamic "server_side_encryption" {
    for_each = var.use_localstack ? [] : [1]
    content {
      enabled = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-webhook-configs"
      Purpose = "Store outbound webhook configurations"
    }
  )
}

resource "aws_dynamodb_table" "api_keys" {
  name         = "${var.environment}-${var.project_name}-api-keys"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "keyId"

  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "keyId"
    type = "S"
  }

  attribute {
    name = "keyHash"
    type = "S"
  }

  global_secondary_index {
    name            = "keyHash-index"
    hash_key        = "keyHash"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  # Enable point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable encryption for non-local environments
  dynamic "server_side_encryption" {
    for_each = var.use_localstack ? [] : [1]
    content {
      enabled = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-api-keys"
      Purpose = "Store external API key configurations"
    }
  )
}

resource "aws_dynamodb_table" "demo_requests" {
  name         = "${var.environment}-${var.project_name}-demo-requests"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "requestId"

  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  attribute {
    name = "requestId"
    type = "S"
  }

  # TTL for GDPR compliance (auto-delete after 90 days)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Enable point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable encryption for non-local environments
  dynamic "server_side_encryption" {
    for_each = var.use_localstack ? [] : [1]
    content {
      enabled = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name         = "${var.project_name}-demo-requests"
      Purpose      = "Store demo/contact form submissions"
      StateRefresh = "2026-01-25-v2"
    }
  )
}
