locals {
  common_tags = merge(
    var.tags,
    {
      Layer = "data"
    }
  )
}
