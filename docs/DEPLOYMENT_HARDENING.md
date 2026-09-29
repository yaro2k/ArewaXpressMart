# Deployment and AWS hardening

The only supported application process is the compiled TypeScript/Prisma server. Archived prototype assets and the retired in-memory server are not deployment entry points.

The backend image is built from `apps/backend/Dockerfile` and is tagged with the immutable commit SHA in CI. Runtime containers run as the non-root `node` user and receive configuration only through environment variables or AWS Secrets Manager/SSM; secrets must never be copied into images.

The production pipeline must use GitHub Actions OIDC with a narrowly scoped AWS role. A release should validate the image, run a backward-compatible Prisma migration as a one-off task, then perform a rolling or blue/green deployment. Rollback restores the previous image and does not attempt a destructive database rollback.

Recommended AWS boundaries are separate development, staging, and production resources, private RDS and ElastiCache subnets, an ALB in front of API instances, restrictive security groups, encrypted storage, CloudTrail, AWS WAF, and CloudWatch alarms. The ALB may call `/health/live`; deployment readiness checks should call `/health/ready`.

This repository does not provision AWS resources or grant deployment credentials. Those steps remain environment-owned infrastructure work.
