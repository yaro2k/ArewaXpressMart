terraform {
  backend "s3" {
    bucket       = "REPLACE_WITH_TERRAFORM_STATE_BUCKET"
    key          = "arewaexpressmart/staging/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
    encrypt      = true
  }
}
