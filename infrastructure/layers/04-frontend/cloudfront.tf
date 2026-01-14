# Parse API Gateway URL components
# URL format: https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
locals {
  # Remove https:// prefix
  api_url_no_protocol = replace(local.api_gateway_url, "https://", "")
  # Extract domain (everything before first /)
  api_gateway_domain = split("/", local.api_url_no_protocol)[0]
  # Extract path (everything after domain)
  api_gateway_path = "/${join("/", slice(split("/", local.api_url_no_protocol), 1, length(split("/", local.api_url_no_protocol))))}"
}

# CloudFront Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "frontend" {
  count = var.use_localstack ? 0 : 1

  name                              = "${var.environment}-${var.project_name}-frontend-oac"
  description                       = "OAC for EcoScan frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "frontend" {
  count = var.use_localstack ? 0 : 1

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.environment} EcoScan Frontend"
  price_class         = var.environment == "prod" ? "PriceClass_All" : "PriceClass_100"

  # Custom domain aliases (optional)
  aliases = var.custom_domain != "" ? [var.custom_domain] : []

  # S3 Origin for static files
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend[0].id
  }

  # API Gateway Origin for /api/* requests
  origin {
    domain_name = local.api_gateway_domain
    origin_id   = "APIGateway"
    origin_path = local.api_gateway_path

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior - S3 static files
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = var.default_ttl
    max_ttl                = var.max_ttl
    compress               = true
  }

  # Cache behavior for API requests - /api/*
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "APIGateway"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Accept", "Content-Type", "Origin"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # SPA routing - custom error responses redirect to index.html
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  # SSL/TLS configuration
  viewer_certificate {
    # Use custom certificate if domain is provided, otherwise use CloudFront default
    cloudfront_default_certificate = var.custom_domain == ""
    acm_certificate_arn            = var.custom_domain != "" ? var.acm_certificate_arn : null
    ssl_support_method             = var.custom_domain != "" ? "sni-only" : null
    minimum_protocol_version       = var.custom_domain != "" ? "TLSv1.2_2021" : "TLSv1"
  }

  # Geo restrictions (none by default)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-frontend-cdn"
  })
}

# CloudFront cache invalidation is done via CI/CD after deployment
