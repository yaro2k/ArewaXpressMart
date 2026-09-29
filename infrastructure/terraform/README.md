# ArewaExpressMart Terraform foundation

This is a resource-free Terraform foundation for staging. `environments/staging` defines provider/version constraints, non-secret variables, naming, tags, backend design, and useful outputs. AWS resources are intentionally added only in later approval-gated milestones.

## Initialization and validation

Terraform is not currently installed in this environment. When available (version `>= 1.10.0, < 2.0.0`), run from `environments/staging`:

```bash
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
```

## Remote state bootstrap

The S3 state bucket and locking are not created by this stack. A separately reviewed bootstrap process must create an encrypted, versioned, public-access-blocked state bucket and grant a narrowly scoped infrastructure role access. Terraform 1.10+ S3 native locking uses `use_lockfile = true`; the backend bucket placeholder must be supplied through uncommitted `-backend-config` values before `terraform init`.

State key: `arewaexpressmart/staging/terraform.tfstate`. Never commit backend credentials or secret values.

## Staging workflow

```bash
terraform init -backend-config=backend.staging.hcl
terraform fmt -check -recursive
terraform validate
terraform plan -var-file=terraform.tfvars
```

Apply is not authorized by this milestone. Future applies require an approved plan and short-lived AWS credentials.

## Secret handling

Committed variables contain only non-secret settings. `DATABASE_URL`, database passwords, JWT secrets, OAuth credentials, payment secrets, email credentials, and Redis credentials must be provisioned through Secrets Manager/SSM and injected into ECS tasks with narrowly scoped roles. They must never be Terraform outputs, committed tfvars, Docker layers, or workflow logs.

## Recovery

Use S3 versioning to recover Terraform state and state locking to prevent concurrent writes. Infrastructure changes are rolled forward or restored through reviewed state recovery. Application database migrations remain backward-compatible and are not destructively rolled back by Terraform.
