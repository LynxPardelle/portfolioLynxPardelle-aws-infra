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
```

## Current Scope

This repo intentionally starts as a CDK scaffold plus reviewed specs. It does not deploy application resources yet. The first implementation pass should convert the documented specs into CDK constructs in small, reviewable increments.

## Documentation

- `docs/current-state.md`: evidence gathered from the current repo and AWS account.
- `docs/infrastructure-plan.md`: target AWS microservices plan.
- `docs/iac-spec.md`: CDK stack boundaries and environment specs.
- `docs/migration-plan.md`: migration sequence from current backend to AWS.
- `docs/security-and-operations.md`: security issues found and operational controls.
