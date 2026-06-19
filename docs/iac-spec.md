# IaC Specification

## CDK Language and Version

Use JavaScript CDK. Versions checked with npm on 2026-06-18:

- `aws-cdk-lib`: `2.260.0`
- `aws-cdk`: `2.1128.0`
- `constructs`: `10.6.0`

## Current Scaffold

The repo contains these CDK stack boundaries:

- `NetworkStack`
- `DataStack`
- `ApiStack`
- `FrontendStack`
- `EdgeStack`
- `ObservabilityStack`

The next implementation should add real resources stack by stack, with `npm run synth` kept green at each step.

## Stack Responsibilities

### NetworkStack

Default target: avoid VPC unless needed.

Create a VPC only if one of these becomes true:

- DocumentDB is chosen for a transition period.
- Private subnet access is required for a managed database.
- A private integration or fixed egress path is required.

Do not recreate the current EC2/Dokploy network as the target architecture.

### DataStack

Planned resources:

- DynamoDB tables for the current migration scope:
  - `portfolio-{env}-main`
  - `portfolio-{env}-articles`
  - `portfolio-{env}-article-sections`
  - `portfolio-{env}-article-categories`
  - `portfolio-{env}-files`
  - `portfolio-{env}-migration-manifests`
- References to the existing `lynx-portfolio` S3 bucket for media assets.
- Migration prefixes under the existing `lynx-portfolio` S3 bucket for MongoDB export files.
- Secrets Manager secrets for migration-only credentials.
- SSM parameters for output references.

Initial removal policy:

- `dev`: destroy
- `tst`: destroy
- `prod`: retain

Use DynamoDB on-demand billing during migration. Enable point-in-time recovery in `prod`.

### ApiStack

Planned resources:

- API Gateway HTTP API per environment.
- Lambda functions grouped by bounded context.
- JWT authorizer through Cognito where possible.
- Lambda aliases or versions for rollback.
- IAM roles per function with least privilege.
- Compatibility routes derived from the current Express app, especially `/`, `/health`, `/api/main/*`, `/api/article/*`, and any operations routes intentionally kept.

Do not give every function broad S3/DynamoDB permissions. Grant per table and per bucket/prefix.

### EdgeStack

Planned resources:

- Route53 records for API domains.
- ACM certificates in `us-east-1`.
- References to the existing CloudFront media distribution and OAC path for private S3 media delivery.

Current asset distribution `EPT5BBK0QX89M` should be imported or left managed outside CDK until a safe replacement path is ready. Do not delete or replace it blindly.

### FrontendStack

Foundation resources:

- SSM parameters for the Angular SSR hosting artifact contract.
- CloudFormation outputs for the artifact bucket, artifact prefix, and API base URL.

Planned resources after the frontend artifact contract is verified:

- CloudFront distribution for `lynxpardelle.com` and `www.lynxpardelle.com`.
- S3 origin using existing bucket `lynx-portfolio` and prefix `frontend/angular-ssr/{env}/releases/{releaseId}/browser`.
- Lambda SSR origin using an artifact from `frontend/angular-ssr/{env}/releases/{releaseId}/server/ssr-handler.zip`.
- Log groups with bounded retention.
- Route53 records and ACM certificate references following the existing domain patterns.

Do not add Angular source, Angular package installation, or Angular build commands to this repo. Do not create WAF, VPC, NAT, EC2, ECS, or a new S3 bucket by default.

### ObservabilityStack

Planned resources:

- CloudWatch dashboards per environment.
- Log groups with retention.
- Alarms for API 5xx, Lambda errors, throttles, duration, DynamoDB throttles, and S3/CloudFront error signals.
- SNS topic for alerts.
- Budget alarms or AWS Budgets integration.

## Naming

Use:

```text
portfolio-{env}-{service}-{resource}
```

Examples:

- `portfolio-dev-public-content-api`
- `portfolio-tst-files`
- `portfolio-prod-media-bucket`

## GitHub Branch Protection

Required branches:

- `dev`
- `tst`
- `prod`

Protection intent:

- Require PR before merge.
- Require at least one approving review.
- Dismiss stale reviews.
- Require status checks:
  - `Validate promotion source`
  - `CDK validate`
- Require branches to be up to date before merge.
- Restrict direct pushes.
- Enforce admins.
- Do not allow force pushes.
- Do not allow deletions.

Promotion rule:

- `prod` PR source must be `tst`.
- `tst` PR source must be `dev`.
- `dev` PR source must not be `main`, `tst`, or `prod`.

The promotion rule is enforced by `.github/workflows/validate-promotion-source.yml`.

## GitHub Environments

Create GitHub Environments:

- `dev`: deployment branch policy `dev`
- `tst`: deployment branch policy `tst`
- `prod`: deployment branch policy `prod`

Manual reviewers for `prod` can be added later if needed. This first setup focuses on branch protection and promotion integrity.
