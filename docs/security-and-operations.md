# Security and Operations

## Immediate Security Actions

The old source repo is public and tracks environment-like files with non-placeholder-looking sensitive values. Before deploying new infrastructure, rotate:

- MongoDB root password from `.env.staging`.
- MongoDB app password from `.env.staging`.
- S3 staging access key from `.env.staging`.
- S3 staging secret key from `.env.staging`.
- Any MongoDB URI/password represented in `.example.env`.

This repo must never store `.env` files or copied secrets.

## Target Security Controls

- Use GitHub OIDC to assume AWS deployment roles. Do not store AWS access keys in GitHub secrets if OIDC can be used.
- Use Secrets Manager for unavoidable runtime secrets.
- Prefer Cognito and API Gateway authorizers over custom JWT secrets.
- Use DynamoDB point-in-time recovery in prod.
- Use S3 block public access and CloudFront OAC for media.
- Require HTTPS everywhere.
- Encrypt all data stores with AWS-managed or customer-managed keys as appropriate.
- Keep Lambda IAM policies narrow by resource and action.
- Log security-relevant admin actions.

## Current Risks Not to Replicate

Evidence from AWS review:

- EC2 volume `vol-0bd5f763909f1383b` attached to `LynxServer` returned `Encrypted: false`.
- CloudFront distribution `E10Y59XAIPQY6A` returned `ViewerProtocolPolicy: allow-all`.
- The same distribution returned `OriginProtocolPolicy: http-only`.
- Security group `LynxSG` exposes web ports publicly and has explicit MongoDB ingress rules.

Target architecture should not expose MongoDB ports, should not require SSH, and should not serve HTTP without redirect.

## Operations

### Observability

Each environment should include:

- API Gateway 4xx/5xx metrics.
- Lambda error, throttle, duration, and concurrency metrics.
- DynamoDB throttles and system errors.
- S3 and CloudFront error metrics.
- Structured JSON logs.
- Dashboards per environment.

### Backups

Prod:

- DynamoDB point-in-time recovery.
- S3 versioning.
- Exportable migration snapshots.
- Retention policy documented before launch.

Dev/tst:

- Lower retention.
- Disposable data allowed only if not using production copies.

### Cost Controls

Use serverless-first services to avoid a permanently running EC2 baseline:

- Lambda/API Gateway for request-driven compute.
- DynamoDB on-demand during early migration.
- CloudWatch log retention limits.
- S3 lifecycle rules similar to the current `lynx-portfolio` bucket.

Review AWS Budgets before enabling costly optional services.
