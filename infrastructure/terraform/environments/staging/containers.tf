resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}-ecr"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-ecr" })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy     = jsonencode({ rules = [{ rulePriority = 1, description = "Retain newest 20 staging images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }, action = { type = "expire" } }] })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}/api"
  retention_in_days = 14
  tags              = merge(local.common_tags, { Name = "/ecs/${local.name_prefix}/api" })
}

resource "aws_cloudwatch_log_group" "migration" {
  name              = "/ecs/${local.name_prefix}/migration"
  retention_in_days = 14
  tags              = merge(local.common_tags, { Name = "/ecs/${local.name_prefix}/migration" })
}

resource "aws_iam_role" "execution" {
  name               = "${local.name_prefix}-ecs-execution-role"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "execution" {
  role = aws_iam_role.execution.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"], Resource = aws_ecr_repository.backend.arn },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = ["${aws_cloudwatch_log_group.api.arn}:*", "${aws_cloudwatch_log_group.migration.arn}:*"] },
    { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = local.runtime_secret_arns }
  ] })
}

resource "aws_iam_role" "api_task" {
  name               = "${local.name_prefix}-api-task-role"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
  tags               = local.common_tags
}

resource "aws_iam_role" "migration_task" {
  name               = "${local.name_prefix}-migration-task-role"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
  tags               = local.common_tags
}

locals {
  runtime_secret_arns = compact([aws_db_instance.staging.master_user_secret[0].secret_arn, var.database_url_secret_arn, var.jwt_access_secret_arn, var.google_client_id_secret_arn, var.payment_webhook_secret_arn])
  common_runtime_environment = [
    { name = "NODE_ENV", value = "production" }, { name = "PORT", value = tostring(var.container_port) },
    { name = "WEB_ORIGIN", value = var.domain_name == "" ? "https://${local.name_prefix}.invalid" : "https://${var.domain_name}" },
    { name = "JWT_ISSUER", value = "arewaxpressmart-api" }, { name = "JWT_AUDIENCE", value = "arewaxpressmart-web" },
    { name = "ACCESS_TOKEN_TTL_SECONDS", value = "900" }, { name = "REFRESH_TOKEN_TTL_DAYS", value = "30" },
    { name = "EMAIL_VERIFICATION_TTL_MINUTES", value = "30" }, { name = "PASSWORD_RESET_TTL_MINUTES", value = "30" },
    { name = "RATE_LIMIT_WINDOW_SECONDS", value = "60" }, { name = "RATE_LIMIT_MAX_REQUESTS", value = "60" }
  ]
  api_secrets = concat(
    var.database_url_secret_arn == "" ? [] : [{ name = "DATABASE_URL", valueFrom = var.database_url_secret_arn }],
    var.jwt_access_secret_arn == "" ? [] : [{ name = "JWT_ACCESS_SECRET", valueFrom = var.jwt_access_secret_arn }],
    var.google_client_id_secret_arn == "" ? [] : [{ name = "GOOGLE_CLIENT_ID", valueFrom = var.google_client_id_secret_arn }],
    var.payment_webhook_secret_arn == "" ? [] : [{ name = "PAYMENT_WEBHOOK_SECRET", valueFrom = var.payment_webhook_secret_arn }]
  )
  migration_secrets    = var.database_url_secret_arn == "" ? [] : [{ name = "DATABASE_URL", valueFrom = var.database_url_secret_arn }]
  api_secrets_with_jwt = local.api_secrets
}

resource "aws_ecs_cluster" "staging" {
  name = local.names.ecs
  setting {
    name  = "containerInsights"
    value = "disabled"
  }
  tags = local.common_tags
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api_task.arn
  container_definitions    = jsonencode([{ name = "api", image = var.api_image, essential = true, portMappings = [{ containerPort = var.container_port, hostPort = var.container_port, protocol = "tcp" }], environment = local.common_runtime_environment, secrets = local.api_secrets_with_jwt, logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = aws_cloudwatch_log_group.api.name, "awslogs-region" = var.aws_region, "awslogs-stream-prefix" = "api" } } }])
  tags                     = local.common_tags
}

resource "aws_ecs_task_definition" "migration" {
  family                   = "${local.name_prefix}-migration"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.migration_cpu
  memory                   = var.migration_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.migration_task.arn
  container_definitions    = jsonencode([{ name = "migration", image = var.api_image, essential = true, command = ["npx", "prisma", "migrate", "deploy"], environment = local.common_runtime_environment, secrets = local.migration_secrets, logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = aws_cloudwatch_log_group.migration.name, "awslogs-region" = var.aws_region, "awslogs-stream-prefix" = "migration" } } }])
  tags                     = local.common_tags
}
