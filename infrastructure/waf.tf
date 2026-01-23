# WAF for API Gateway protection against spam and abuse
resource "aws_wafv2_web_acl" "api_protection" {
  name  = "${var.environment}-${var.project_name}-api-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: Rate limiting - configurable requests per 5 minutes per IP
  # Default: 100 for production, can be set via var.waf_rate_limit
  # For e2e tests, set higher (e.g., 1000) to avoid test failures
  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {
        custom_response {
          response_code            = 429
          custom_response_body_key = "rate_limit_response"
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: Block known bad IPs (AWS managed rule)
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AmazonIpReputationList"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSIPReputationList"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: Block common attack patterns
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Geographic restriction (optional - uncomment to restrict to specific regions)
  # rule {
  #   name     = "GeoBlockRule"
  #   priority = 4
  #
  #   action {
  #     block {}
  #   }
  #
  #   statement {
  #     not_statement {
  #       statement {
  #         geo_match_statement {
  #           country_codes = ["US", "CA", "GB", "DE", "CZ", "EU"] # Allow only these countries
  #         }
  #       }
  #     }
  #   }
  #
  #   visibility_config {
  #     cloudwatch_metrics_enabled = true
  #     metric_name                = "GeoBlockRule"
  #     sampled_requests_enabled   = true
  #   }
  # }

  custom_response_body {
    key = "rate_limit_response"
    content = jsonencode({
      error   = "Too many requests"
      message = "Please wait a few minutes before trying again"
    })
    content_type = "APPLICATION_JSON"
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-api-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${var.project_name}-api-waf"
    Environment = var.environment
  }
}

# Associate WAF with API Gateway
resource "aws_wafv2_web_acl_association" "api_waf_association" {
  resource_arn = aws_api_gateway_stage.api_stage.arn
  web_acl_arn  = aws_wafv2_web_acl.api_protection.arn
}

# CloudWatch alarm for high rate limit blocks
resource "aws_cloudwatch_metric_alarm" "rate_limit_alarm" {
  alarm_name          = "${var.environment}-${var.project_name}-high-rate-limit-blocks"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "50"
  alarm_description   = "Alert when rate limiting blocks exceed 50 in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.api_protection.name
    Region = var.aws_region
    Rule   = "RateLimitRule"
  }

  # Optional: Add SNS topic for notifications
  # alarm_actions = [aws_sns_topic.alerts.arn]
}
