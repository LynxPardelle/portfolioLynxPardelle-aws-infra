# AWS Microservices Infrastructure Plan

## Goal

Move the unstable current backend from EC2/Dokploy/Docker/MongoDB into AWS-managed microservices using JavaScript AWS CDK. The target should support three protected environments: `dev`, `tst`, and `prod`.

## Target Architecture

Recommended AWS baseline:

- API Gateway HTTP API for public and admin API entry points.
- Lambda functions for microservices.
- DynamoDB for portfolio content and operational state.
- S3 for media assets, uploads, exports, and migration artifacts.
- CloudFront for media delivery.
- Cognito for admin authentication, or a short transition layer that preserves JWT only during migration.
- Secrets Manager for external credentials and migration-only secrets.
- EventBridge for scheduled jobs and async maintenance.
- SNS for operational alerts.
- CloudWatch logs, metrics, dashboards, and alarms.
- Route53 and ACM for custom domains.

## Microservice Boundaries

### Public Content API

Purpose: public read endpoints that power the portfolio site.

Source endpoints:

- `GET /api/main/albums`
- `GET /api/main/book-imgs`
- `GET /api/main/cv-sections`
- `GET /api/main/main`
- `GET /api/main/songs`
- `GET /api/main/videos`
- `GET /api/main/web-sites`
- `GET /api/article/article/:id`
- `GET /api/article/article-cats`
- `GET /api/article/article-sub-cats`
- `GET /api/article/articles/:page?/:ipp?/:sort?/:rootAccess?/:type?/:search?`

Target:

- Lambda read handlers behind API Gateway.
- DynamoDB read models optimized for portfolio page reads.
- CloudFront caching where response volatility allows it.

### Admin Content API

Purpose: authenticated admin CRUD for portfolio content.

Source endpoints:

- Current create/update/delete endpoints in `routes/main.js`.
- Current create/update/delete endpoints in `routes/article.js`.

Target:

- Cognito-protected API Gateway routes.
- Lambda write handlers.
- DynamoDB conditional writes for optimistic concurrency.
- Audit events in DynamoDB or CloudWatch Logs.

### Media API

Purpose: uploads, file metadata, S3 object lifecycle, and CDN invalidation.

Source endpoints:

- `/api/main/upload-file-*`
- `/api/article/upload-file-*`
- `/api/main/get-file/:id`
- `/api/main/file-info/:id`
- `/api/main/s3-status`

Target:

- Presigned S3 upload URLs instead of passing large files through Lambda where possible.
- S3 object keys compatible with the existing bucket structure: `uploads/albums`, `uploads/articles`, `uploads/main`, `uploads/websites`, `uploads/songs`, and `backups`.
- File metadata in DynamoDB.
- CloudFront invalidation only when overwrite/delete requires it.

### Auth API

Purpose: replace custom JWT login safely.

Source:

- `POST /api/main/login`
- `services/jwt.js`
- `middlewares/authenticated.js`
- `middlewares/is_admin.js`

Target:

- Preferred: Cognito user pool for admin accounts, API Gateway JWT authorizer.
- Migration option: temporary Lambda authorizer that accepts current JWT while admin users are moved.
- Store no static JWT secret in repo. Use Secrets Manager only if a transition secret is unavoidable.

### Operations API

Purpose: preserve useful health, monitoring, rollback, and canary behavior without keeping EC2.

Source endpoints:

- `/health`
- `/api/performance/*`
- `/api/canary/*`
- `/api/monitoring/*`
- `/api/rollback/*`

Target:

- Health Lambda endpoint per environment.
- CloudWatch alarms and dashboards instead of app-local monitoring state where possible.
- EventBridge schedules for checks and cleanup.
- Rollback procedure based on Lambda aliases, API Gateway stage routing, and retained DynamoDB/S3 backups.

## Data Design Direction

Use DynamoDB tables per bounded context first, not one giant table on day one:

- `portfolio-{env}-main`
- `portfolio-{env}-articles`
- `portfolio-{env}-article-sections`
- `portfolio-{env}-article-categories`
- `portfolio-{env}-files`
- `portfolio-{env}-media-jobs`
- `portfolio-{env}-audit-events`

Reason: the current MongoDB models map naturally to separate collections. A per-context DynamoDB design is easier to migrate and verify than an immediate single-table redesign.

After migration stabilizes, high-read paths can be denormalized into read models.

## Environment Model

| Environment | Branch | Domain target | Data deletion policy |
| --- | --- | --- | --- |
| dev | `dev` | `api.dev.lynxpardelle.com` | destroy allowed |
| tst | `tst` | `api.tst.lynxpardelle.com` | destroy allowed |
| prod | `prod` | `api.lynxpardelle.com` | retain |

The current account evidence only confirms one AWS account: `765932874577`. The initial CDK config uses one account with environment-prefixed names. If separate AWS accounts are created later, `config/environments.js` should be updated and branch protection kept the same.

## Deployment Flow

1. Work branch from `dev`.
2. PR into `dev`.
3. CDK synth and tests must pass.
4. Merge into `dev`.
5. PR from `dev` into `tst`.
6. Deploy/test `tst`.
7. PR from `tst` into `prod`.
8. Deploy prod with manual approval through GitHub Environment protection if configured later.

## Migration Phases

### Phase 0: Guardrails

- Keep the new repo protected.
- Rotate exposed/possibly exposed credentials from tracked env files.
- Add IAM OIDC deployment role for GitHub Actions with least privilege.
- Confirm DNS ownership and desired prod/test/dev API domains.

### Phase 1: Foundation

- Implement CDK stacks for environment config, tags, SSM parameters, Secrets Manager placeholders, log groups, SNS topics, and budgets.
- Import or reference existing hosted zone `lynxpardelle.com`.
- Decide whether to import `lynx-portfolio` assets bucket into CDK or create environment-specific buckets.

### Phase 2: Data and Media

- Build DynamoDB tables.
- Build S3 media bucket policy with CloudFront OAC.
- Build migration export from MongoDB to S3 JSON.
- Build import Lambdas or one-time scripts into DynamoDB.

### Phase 3: API Slice 1

- Implement Public Content API first.
- Keep old backend live.
- Compare responses from old and new APIs with contract tests.

### Phase 4: Admin and Auth

- Add Cognito/admin auth.
- Implement admin writes.
- Add audit trail.
- Add presigned upload flow.

### Phase 5: Cutover

- Put new API behind `api.tst.lynxpardelle.com`.
- Run parity tests.
- Cut `api.lynxpardelle.com` to new API only after validated `tst`.
- Keep EC2 rollback path until prod is stable.

### Phase 6: Decommission

- Remove Dokploy app backend after backup and verification.
- Lock or remove MongoDB public/DNS exposure.
- Remove stale CloudFront/DNS entries after confirming no traffic.
