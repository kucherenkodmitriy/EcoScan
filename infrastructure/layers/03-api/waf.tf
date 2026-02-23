# =============================================================================
# AWS WAF v2 - Web Application Firewall for API Gateway
# =============================================================================
# WAFv2 is not supported in LocalStack, so all resources are conditional

resource "aws_wafv2_web_acl" "api_waf" {
  count = var.use_localstack ? 0 : 1

  name        = "${var.environment}-${var.project_name}-api-waf"
  description = "WAF for EcoScan API Gateway"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: Rate limiting per IP
  rule {
    name     = "rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.environment}-${var.project_name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: AWS Managed SQL Injection Rule Set
  rule {
    name     = "aws-sqli"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.environment}-${var.project_name}-sqli"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: AWS Managed Known Bad Inputs Rule Set
  rule {
    name     = "aws-known-bad-inputs"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.environment}-${var.project_name}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.environment}-${var.project_name}-api-waf"
    sampled_requests_enabled   = true
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-api-waf"
  })
}

# Associate WAF with API Gateway stage
resource "aws_wafv2_web_acl_association" "api_waf_association" {
  count = var.use_localstack ? 0 : 1

  resource_arn = aws_api_gateway_stage.api_stage.arn
  web_acl_arn  = aws_wafv2_web_acl.api_waf[0].arn
}
