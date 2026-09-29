locals {
  name_prefix = "${lower(var.project_name)}-${var.environment}"
  common_tags = merge({ Project = var.project_name, Environment = var.environment, ManagedBy = "Terraform" }, var.common_tags)
  names       = { vpc = "${local.name_prefix}-vpc", alb = "${local.name_prefix}-alb", ecr = "${local.name_prefix}-ecr", ecs = "${local.name_prefix}-ecs", api = "${local.name_prefix}-api", rds = "${local.name_prefix}-rds" }
}
