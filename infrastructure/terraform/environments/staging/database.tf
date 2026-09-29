resource "aws_db_subnet_group" "staging" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = [for az in var.availability_zones : aws_subnet.data[az].id]
  tags       = merge(local.common_tags, { Name = "${local.name_prefix}-db-subnet-group" })
}

resource "aws_db_instance" "staging" {
  identifier                  = local.names.rds
  engine                      = "postgres"
  engine_version              = var.database_engine_version
  instance_class              = var.database_instance_class
  allocated_storage           = var.database_allocated_storage_gb
  max_allocated_storage       = max(var.database_allocated_storage_gb * 2, 50)
  storage_type                = "gp3"
  storage_encrypted           = true
  publicly_accessible         = false
  port                        = 5432
  db_name                     = var.database_name
  username                    = var.database_master_username
  manage_master_user_password = true
  db_subnet_group_name        = aws_db_subnet_group.staging.name
  vpc_security_group_ids      = [aws_security_group.database.id]
  backup_retention_period     = var.database_backup_retention_days
  backup_window               = "02:00-02:30"
  maintenance_window          = "sun:03:00-sun:03:30"
  multi_az                    = false
  deletion_protection         = false
  skip_final_snapshot         = var.database_skip_final_snapshot
  final_snapshot_identifier   = var.database_skip_final_snapshot ? null : var.database_final_snapshot_identifier
  copy_tags_to_snapshot       = true
  auto_minor_version_upgrade  = true
  apply_immediately           = false
  monitoring_interval         = 0
  tags                        = merge(local.common_tags, { Name = local.names.rds })
}
