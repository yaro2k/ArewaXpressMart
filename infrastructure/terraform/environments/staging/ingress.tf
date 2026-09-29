locals {
  manage_certificate = var.manage_acm_certificate && var.domain_name != "" && var.route53_zone_id != ""
  https_enabled      = var.certificate_arn != "" || local.manage_certificate
  certificate_arn    = var.certificate_arn != "" ? var.certificate_arn : try(aws_acm_certificate.staging[0].arn, "")
}

resource "aws_lb" "staging" {
  name                       = local.names.alb
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = [for az in var.availability_zones : aws_subnet.public[az].id]
  drop_invalid_header_fields = true
  tags                       = merge(local.common_tags, { Name = local.names.alb })
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-tg-api"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.staging.id

  health_check {
    enabled             = true
    path                = "/health/ready"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-tg-api" })
}

resource "aws_acm_certificate" "staging" {
  count             = local.manage_certificate ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-acm" })
}

resource "aws_route53_record" "certificate_validation" {
  for_each = local.manage_certificate ? {
    for option in aws_acm_certificate.staging[0].domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  } : {}
  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "staging" {
  count                   = local.manage_certificate ? 1 : 0
  certificate_arn         = aws_acm_certificate.staging[0].arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_lb_listener" "https" {
  count             = local.https_enabled ? 1 : 0
  load_balancer_arn = aws_lb.staging.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
  depends_on = [aws_acm_certificate_validation.staging]
}

resource "aws_lb_listener" "http_redirect" {
  count             = local.https_enabled ? 1 : 0
  load_balancer_arn = aws_lb.staging.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_route53_record" "staging_alias" {
  count   = var.domain_name != "" && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = true
  }
}
