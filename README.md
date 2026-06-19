# portfolioLynxPardelle AWS Infrastructure

AWS CDK JavaScript repo for migrating `portfolioLynxPardelle` from the current Dokploy/Docker/MongoDB backend to a full AWS microservices architecture.

## Branch and Environment Model

Protected environment branches:

- `dev`: default branch. New work branches should start from `dev` and merge back into `dev`.
- `tst`: accepts promotion PRs only from `dev`.
- `prod`: accepts promotion PRs only from `tst`.

Direct commits to `dev`, `tst`, and `prod` are blocked by GitHub branch protection. The workflow `.github/workflows/validate-promotion-source.yml` enforces the promotion path that branch protection cannot express by itself.

## Commands

```bash
npm install
npm run synth
npm run synth:dev
npm run synth:tst
npm run synth:prod
npm run migration:inspect -- --dump C:\Users\lince\Downloads\dump
npm run migration:export -- --dump C:\Users\lince\Downloads\dump --env dev --out C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-dynamodb-import\{batch}
```

## Current Scope

This repo contains the CDK foundation for the migration: environment stages, GitHub OIDC deployment workflows, base SSM parameters, placeholder migration secrets, minimal observability, DynamoDB tables for the initial content migration scope, the first public API Gateway/Lambda implementation, and AWS frontend SSR hosting that consumes Angular artifacts from the frontend repo. Angular source, builds, tests, and artifacts stay in the frontend repo.

## Documentation

- `docs/current-state.md`: evidence gathered from the current repo and AWS account.
- `docs/infrastructure-plan.md`: target AWS microservices plan.
- `docs/iac-spec.md`: CDK stack boundaries and environment specs.
- `docs/migration-plan.md`: migration sequence from current backend to AWS.
- `docs/security-and-operations.md`: security issues found and operational controls.
- `docs/phase-0-1-foundation-plan.md`: first implementation plan for guardrails, CI/CD, and foundation CDK.
- `docs/api-reverse-engineering-migration-plan.md`: plan to rebuild the non-working current API as serverless microservices.
- `docs/api-contract-inventory.md`: source-derived route and data-model inventory.
- `docs/mongodb-backup-procedure.md`: backup procedure required before migration tests.
- `docs/oidc-deploy-roles.md`: GitHub OIDC deploy-role setup notes.
- `docs/frontend-ssr-hosting-plan.md`: frontend SSR hosting boundary, artifact contract, and CloudFront/Lambda deployment plan.
