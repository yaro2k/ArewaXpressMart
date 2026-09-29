variable "aws_region" {
  type    = string
  default = "eu-west-1"
}
variable "environment" {
  type    = string
  default = "staging"
}
variable "project_name" {
  type    = string
  default = "ArewaExpressMart"
}
variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}
variable "availability_zones" {
  type    = list(string)
  default = ["eu-west-1a", "eu-west-1b"]
}
variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.40.0.0/20", "10.40.16.0/20"]
}
variable "app_subnet_cidrs" {
  type    = list(string)
  default = ["10.40.32.0/20", "10.40.48.0/20"]
}
variable "data_subnet_cidrs" {
  type    = list(string)
  default = ["10.40.64.0/20", "10.40.80.0/20"]
}
variable "database_name" {
  type    = string
  default = "arewaexpressmart"
}
variable "database_engine_version" {
  type    = string
  default = "17"
}
variable "database_instance_class" {
  type    = string
  default = "db.t4g.micro"
}
variable "database_allocated_storage_gb" {
  type    = number
  default = 20
}
variable "database_backup_retention_days" {
  type    = number
  default = 7
}
variable "ecs_cpu" {
  type    = number
  default = 512
}
variable "ecs_memory" {
  type    = number
  default = 1024
}
variable "ecs_desired_count" {
  type    = number
  default = 1
}
variable "container_port" {
  type    = number
  default = 4000
}
variable "domain_name" {
  type    = string
  default = ""
}
variable "route53_zone_id" {
  type        = string
  default     = ""
  description = "Existing public Route 53 hosted-zone ID for domain validation and alias records."
}
variable "manage_acm_certificate" {
  type        = bool
  default     = false
  description = "Request and validate an ACM certificate only when domain ownership and Route 53 access are confirmed."
}
variable "certificate_arn" {
  type        = string
  default     = ""
  description = "Existing validated ACM certificate ARN."
}
variable "state_bucket_name" {
  type    = string
  default = ""
}
variable "common_tags" {
  type    = map(string)
  default = {}
}
variable "single_nat_gateway" {
  type    = bool
  default = true
}
variable "api_image" {
  type        = string
  default     = ""
  description = "Immutable ECR image tag or digest; latest is forbidden."
  validation {
    condition     = var.api_image == "" || (!strcontains(var.api_image, ":latest") && (strcontains(var.api_image, "@sha256:") || can(regex(":([0-9a-f]{7,64})$", var.api_image))))
    error_message = "api_image must be an immutable digest or hexadecimal commit-SHA tag, never latest."
  }
}
variable "migration_cpu" {
  type    = number
  default = 256
}
variable "migration_memory" {
  type    = number
  default = 512
}
variable "database_url_secret_arn" {
  type    = string
  default = ""
}
variable "jwt_access_secret_arn" {
  type    = string
  default = ""
}
variable "google_client_id_secret_arn" {
  type    = string
  default = ""
}
variable "payment_webhook_secret_arn" {
  type    = string
  default = ""
}
variable "github_oidc_subject" {
  type        = string
  default     = "repo:yaro2k/ArewaXpressMart:environment:staging"
  description = "Exact GitHub OIDC subject allowed to deploy staging; keep scoped to the protected staging environment."
  validation {
    condition     = startswith(var.github_oidc_subject, "repo:yaro2k/ArewaXpressMart:") && strcontains(var.github_oidc_subject, ":environment:") && !strcontains(var.github_oidc_subject, "*")
    error_message = "github_oidc_subject must target yaro2k/ArewaXpressMart's protected environment and must not contain wildcards."
  }
}
variable "ecs_service_arn" {
  type        = string
  default     = ""
  description = "Staging ECS service ARN, populated when the ECS service milestone is approved."
}

variable "database_master_username" {
  type    = string
  default = "arewaexpressmart_admin"
}

variable "database_skip_final_snapshot" {
  type    = bool
  default = false
}

variable "database_final_snapshot_identifier" {
  type    = string
  default = "arewaexpressmart-staging-final"
}
