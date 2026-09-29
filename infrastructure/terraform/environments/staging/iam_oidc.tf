resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = local.common_tags
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [var.github_oidc_subject]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${local.name_prefix}-github-deploy-role"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_trust.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrAuthentication"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "EcrPushStagingImage"
    effect    = "Allow"
    actions   = ["ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart"]
    resources = [aws_ecr_repository.backend.arn]
  }
  statement {
    sid       = "RegisterTaskDefinitions"
    effect    = "Allow"
    actions   = ["ecs:RegisterTaskDefinition"]
    resources = ["*"]
  }
  statement {
    sid       = "RunMigrationTask"
    effect    = "Allow"
    actions   = ["ecs:RunTask"]
    resources = [aws_ecs_task_definition.migration.arn]
  }
  statement {
    sid       = "DescribeDeploymentState"
    effect    = "Allow"
    actions   = ["ecs:DescribeClusters", "ecs:DescribeServices", "ecs:DescribeTasks", "ecs:DescribeTaskDefinition", "ecs:ListTasks"]
    resources = ["*"]
  }
  dynamic "statement" {
    for_each = var.ecs_service_arn == "" ? [] : [var.ecs_service_arn]
    content {
      sid       = "UpdateStagingService"
      effect    = "Allow"
      actions   = ["ecs:UpdateService"]
      resources = [statement.value]
    }
  }
  statement {
    sid       = "ReadDeploymentLogs"
    effect    = "Allow"
    actions   = ["logs:DescribeLogStreams", "logs:GetLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*", "${aws_cloudwatch_log_group.migration.arn}:*"]
  }
  statement {
    sid       = "PassOnlyStagingTaskRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.execution.arn, aws_iam_role.api_task.arn, aws_iam_role.migration_task.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
