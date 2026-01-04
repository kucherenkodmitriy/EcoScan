locals {
  common_tags = merge(
    var.tags,
    {
      Layer = "api"
    }
  )

  # Note: Lambda is no longer directly integrated with API Gateway
  # Lambda is triggered by SQS events instead
}
