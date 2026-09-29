locals {
  az_indexes = { for index, az in var.availability_zones : az => index }
}

resource "aws_vpc" "staging" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.common_tags, { Name = local.names.vpc })
}

resource "aws_internet_gateway" "staging" {
  vpc_id = aws_vpc.staging.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each                = local.az_indexes
  vpc_id                  = aws_vpc.staging.id
  availability_zone       = each.key
  cidr_block              = var.public_subnet_cidrs[each.value]
  map_public_ip_on_launch = true
  tags                    = merge(local.common_tags, { Name = "${local.name_prefix}-public-${each.key}", tier = "public" })
}

resource "aws_subnet" "app" {
  for_each          = local.az_indexes
  vpc_id            = aws_vpc.staging.id
  availability_zone = each.key
  cidr_block        = var.app_subnet_cidrs[each.value]
  tags              = merge(local.common_tags, { Name = "${local.name_prefix}-app-${each.key}", tier = "application" })
}

resource "aws_subnet" "data" {
  for_each          = local.az_indexes
  vpc_id            = aws_vpc.staging.id
  availability_zone = each.key
  cidr_block        = var.data_subnet_cidrs[each.value]
  tags              = merge(local.common_tags, { Name = "${local.name_prefix}-data-${each.key}", tier = "data" })
}

resource "aws_eip" "nat" {
  count  = var.single_nat_gateway ? 1 : length(var.availability_zones)
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-nat-eip-${count.index + 1}" })
}

resource "aws_nat_gateway" "staging" {
  count         = var.single_nat_gateway ? 1 : length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[var.availability_zones[var.single_nat_gateway ? 0 : count.index]].id
  depends_on    = [aws_internet_gateway.staging]
  tags          = merge(local.common_tags, { Name = "${local.name_prefix}-nat-${count.index + 1}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.staging.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging.id
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-rt-public", tier = "public" })
}

resource "aws_route_table_association" "public" {
  for_each       = local.az_indexes
  route_table_id = aws_route_table.public.id
  subnet_id      = aws_subnet.public[each.key].id
}

resource "aws_route_table" "app" {
  vpc_id = aws_vpc.staging.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.staging[0].id
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-rt-app", tier = "application" })
}

resource "aws_route_table" "data" {
  vpc_id = aws_vpc.staging.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-rt-data", tier = "data" })
}

resource "aws_route_table_association" "app" {
  for_each       = local.az_indexes
  route_table_id = aws_route_table.app.id
  subnet_id      = aws_subnet.app[each.key].id
}

resource "aws_route_table_association" "data" {
  for_each       = local.az_indexes
  route_table_id = aws_route_table.data.id
  subnet_id      = aws_subnet.data[each.key].id
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-sg-alb"
  description = "Public HTTPS ingress for staging ALB"
  vpc_id      = aws_vpc.staging.id
  ingress {
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
    description = "ALB egress"
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-sg-alb" })
}

resource "aws_security_group_rule" "alb_http_redirect" {
  count             = local.https_enabled ? 1 : 0
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  protocol          = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "HTTP only for redirect to HTTPS"
}

resource "aws_security_group" "api" {
  name        = "${local.name_prefix}-sg-api"
  description = "Private ECS application traffic"
  vpc_id      = aws_vpc.staging.id
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
    description = "Application outbound access"
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-sg-api" })
}

resource "aws_security_group_rule" "api_from_alb" {
  type                     = "ingress"
  security_group_id        = aws_security_group.api.id
  protocol                 = "tcp"
  from_port                = var.container_port
  to_port                  = var.container_port
  source_security_group_id = aws_security_group.alb.id
  description              = "ALB to ECS application"
}

resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-sg-db"
  description = "Private PostgreSQL access from application tasks only"
  vpc_id      = aws_vpc.staging.id
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
    description = "Database egress"
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-sg-db" })
}

resource "aws_security_group_rule" "database_from_api" {
  type                     = "ingress"
  security_group_id        = aws_security_group.database.id
  protocol                 = "tcp"
  from_port                = 5432
  to_port                  = 5432
  source_security_group_id = aws_security_group.api.id
  description              = "ECS to PostgreSQL"
}
