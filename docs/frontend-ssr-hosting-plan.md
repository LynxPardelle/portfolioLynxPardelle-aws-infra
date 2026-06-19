# Frontend SSR Hosting Plan

Review date: 2026-06-18 Central Time.

## Sources and Boundary

Sources read for this plan:

- `Codex.md`
- `README.md`
- `docs/current-state.md`
- `docs/infrastructure-plan.md`
- `docs/iac-spec.md`
- `docs/migration-plan.md`
- `docs/security-and-operations.md`
- `package.json`
- `config/environments.js`
- `bin/portfolio-aws-infra.js`
- `lib/**`
- `.github/workflows/**`

The Angular repo `C:\Users\lince\Documents\GitHub\lynx-portfolio-angular` now owns the release artifact generator and publisher workflow.

## Goal

Move the Angular SSR frontend from Dokploy to AWS without another always-on server, while keeping the frontend code, builds, tests, and artifacts owned by the frontend repo.

The frontend must continue to call:

```text
https://api.lynxpardelle.com
```

That API domain is already cut over to the serverless backend in this infra repo.

## Repo Ownership

Infra repo owns:

- AWS CDK stacks and parameters.
- GitHub OIDC deploy roles and environment deployments.
- Route53, ACM, CloudFront, S3 origin wiring, Lambda SSR wiring, and logs.
- Promotion through `dev` -> `tst` -> `prod`.

Frontend repo owns:

- Angular source code.
- Angular build and test commands.
- SSR server bundle shape.
- Browser/static output shape.
- Versioned release artifact publishing.

No Angular source code, `node_modules`, application `.env` files, or frontend secrets should be copied into this infra repo.

## Cheapest Plausible Target

Use serverless AWS primitives only:

- CloudFront distribution for environment frontend domains after DNS/certificate verification.
- Existing S3 bucket `lynx-portfolio` for versioned browser/static artifacts under an isolated prefix.
- Lambda for Angular SSR, using an artifact built by the frontend repo.
- CloudFront routing:
  - Static asset paths to the existing `assets.lynxpardelle.com` CloudFront origin, which already fronts the `lynx-portfolio` bucket.
  - Dynamic/default routes to the SSR Lambda Function URL origin protected with CloudFront OAC and `AWS_IAM`.
- CloudWatch Logs with bounded retention.
- Route53/ACM through the existing hosted zone/certificate patterns.

No NAT gateway, VPC, EC2, ECS, EKS, or WAF is included by default.

## Artifact Contract

The frontend repo should publish one immutable release under:

```text
s3://lynx-portfolio/frontend/angular-ssr/{env}/releases/{releaseId}/
```

Required files:

```text
manifest.json
browser/
server/
server/ssr-handler.zip
```

Required `manifest.json` fields:

```json
{
  "schemaVersion": 1,
  "app": "lynx-portfolio-angular",
  "environment": "dev",
  "releaseId": "git-sha-or-build-id",
  "sourceCommit": "full-git-sha",
  "apiBaseUrl": "https://api.lynxpardelle.com",
  "nodeRuntime": "nodejs22.x",
  "browserPrefix": "frontend/angular-ssr/dev/releases/{releaseId}/browser",
  "serverBundleKey": "frontend/angular-ssr/dev/releases/{releaseId}/server/ssr-handler.zip",
  "checksums": {
    "server/ssr-handler.zip": "sha256-hex"
  },
  "createdAt": "2026-06-18T00:00:00Z"
}
```

The frontend repo packages this contract with `npm run package:ssr:lambda`.

## Infra Parameters Added

`FrontendStack` publishes these SSM parameters per environment:

```text
/portfolio/{env}/frontend/hosting-architecture
/portfolio/{env}/frontend/api-base-url
/portfolio/{env}/frontend/artifact-bucket-name
/portfolio/{env}/frontend/artifact-base-prefix
/portfolio/{env}/frontend/manifest-key-pattern
/portfolio/{env}/frontend/static-prefix-pattern
/portfolio/{env}/frontend/server-bundle-prefix-pattern
/portfolio/{env}/frontend/ssr-runtime
/portfolio/{env}/frontend/release-id
/portfolio/{env}/frontend/publisher-role-arn
```

Current values use:

```text
artifact bucket: lynx-portfolio
base prefix: frontend/angular-ssr/{env}
API base URL: https://api.lynxpardelle.com
runtime: nodejs22.x
```

With no `FRONTEND_RELEASE_ID`, the stack remains a safe contract/publisher-role deployment. With a release id, it creates the SSR Lambda, IAM-protected Function URL, CloudFront distribution, bounded log group, and dev/tst Route53 records. Prod Route53 remains disabled until the final `lynxpardelle.com` cutover is intentionally executed.

## CI/CD Shape

Keep this repo's existing deployment model:

1. Frontend repo builds and tests Angular SSR.
2. Frontend repo uploads immutable artifacts to the agreed S3 prefix using its environment OIDC publisher role.
3. Infra repo receives the release id through GitHub Environment variable `FRONTEND_RELEASE_ID`.
4. Infra repo deploys CDK through the existing protected branch flow.

Do not add Angular build commands to this repo's workflows.

## Security and Cost Notes

- Frontend artifact publishing should allow S3 writes only to `frontend/angular-ssr/{env}/*`, not the full `lynx-portfolio` bucket.
- The artifact manifest must not contain secrets.
- The SSR Lambda should receive `API_BASE_URL=https://api.lynxpardelle.com` as configuration, not as a committed frontend secret.
- Do not let this stack overwrite the existing `lynx-portfolio` bucket policy; static artifacts route through the current assets distribution to avoid bucket-policy ownership conflicts.
- Use CloudFront OAC for the Lambda Function URL origin.
- Keep logs bounded; start with one-month retention unless production needs a longer retention policy.
- WAF is intentionally excluded unless Alec explicitly approves it later.
