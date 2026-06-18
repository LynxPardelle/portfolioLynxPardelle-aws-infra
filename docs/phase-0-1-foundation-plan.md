# Plan: Phase 0/1 Foundation

Generated: 2026-06-18 Central Time

## Overview

This plan keeps the migration small and practical. The current portfolio backend is not large, so the first implementation should establish only the AWS/CDK foundation, deployment path, backup path, and resource references needed to rebuild the backend as Lambda microservices without replacing stable assets infrastructure.

The plan intentionally reuses the current `lynx-portfolio` S3 bucket and existing assets CloudFront path. It also defers credential rotation until final cleanup/cutover, per Alec's 2026-06-18 direction. That deferral is an accepted temporary risk and must not lead to copying secrets into this infrastructure repo.

## Evidence Sources

- Current repo plan: `docs/infrastructure-plan.md`
- Current IaC spec: `docs/iac-spec.md`
- Current migration plan: `docs/migration-plan.md`
- Current security notes: `docs/security-and-operations.md`
- Moyra CI/CD reference: `C:\Users\lince\Documents\GitHub\moyra-infra-serverless\.github\workflows\serverless-backend.yml`
- Zoolanding CI/CD reference: `C:\Users\lince\Documents\GitHub\zoolanding-auth-admin\.github\workflows\deploy-dev.yml`, `deploy-test.yml`, `deploy-production.yml`
- Zoolanding CI/CD reference: `C:\Users\lince\Documents\GitHub\zoolanding-cognito-user-lifecycle\.github\workflows\deploy-dev.yml`, `deploy-test.yml`, `deploy-production.yml`

## Decisions

- Use CDK JavaScript in this repo.
- Use protected branches `dev`, `tst`, and `prod`.
- Preserve promotion order: work branch -> `dev` -> `tst` -> `prod`.
- Use GitHub OIDC for AWS deploy credentials.
- Use GitHub Environment variables for `AWS_ROLE_ARN` and `AWS_REGION`, matching Moyra and Zoolanding patterns.
- Reuse the current S3 media bucket `lynx-portfolio`.
- Keep existing `assets.lynxpardelle.com` and CloudFront distribution `EPT5BBK0QX89M` stable during foundation work.
- Back up MongoDB before any migration test.
- Defer credential rotation until the final migration cleanup/cutover window.
- Treat `https://api.lynxpardelle.com` as currently non-working. The goal is to make that domain work again through the new serverless API, not preserve rollback to the old monolith.

## Sprint 0: Guardrails and Backup

Goal: make the migration safe to start without blocking on credential rotation.

### Task 0.1: Record Temporary Credential-Rotation Deferral

- Location: `Codex.md`, `docs/security-and-operations.md`
- Description: document that credential rotation is deferred by decision, and that secrets must not be copied into this repo.
- Acceptance criteria:
  - Deferral is explicit.
  - The security risk is stated.
  - Final rotation remains required before cleanup/cutover.
- Validation:
  - Review docs for no copied secret values.

### Task 0.2: Define MongoDB Backup Procedure

- Location: `docs/migration-plan.md`, optional future `scripts/`
- Description: document and later implement a repeatable backup command for the current MongoDB source.
- Acceptance criteria:
  - Backup happens before migration tests.
  - Backup location is outside application repos.
  - `Codex.md` records timestamp, source target, collection list, and restore command after a real backup.
- Validation:
  - Dry-run the backup command when credentials and target are intentionally provided.

### Task 0.3: Confirm Reused Media Resource Boundaries

- Location: `config/environments.js`, `docs/iac-spec.md`
- Description: keep `lynx-portfolio`, `assets.lynxpardelle.com`, and `EPT5BBK0QX89M` as referenced resources, not replacement resources.
- Acceptance criteria:
  - No new media bucket is planned for Phase 0/1.
  - CDK foundation does not delete, replace, or reconfigure the current assets distribution.
- Validation:
  - `npm run synth` produces no replacement of current media resources.

## Sprint 1: GitHub AWS CI/CD Foundation

Goal: match the existing AWS deployment style used in Moyra and Zoolanding, adapted to CDK and this repo's branches.

### Task 1.1: Add Environment-Aware CDK Deploy Workflow

- Location: `.github/workflows/`
- Description: create CDK deploy workflow(s) using OIDC and GitHub Environments.
- Pattern to copy:
  - Moyra: `permissions: id-token: write`, `aws-actions/configure-aws-credentials`, `vars.AWS_ROLE_ARN`, `vars.AWS_REGION`, `npm ci`, tests, synth, CDK deploy.
  - Zoolanding: deploy job bound to GitHub Environment, promotion guard for higher environments.
- Portfolio adaptation:
  - `dev` push deploys `PortfolioDev`.
  - `tst` push deploys `PortfolioTst` only after promotion from `dev`.
  - `prod` push deploys `PortfolioProd` only after promotion from `tst`.
- Acceptance criteria:
  - No static AWS keys.
  - `id-token: write` and `contents: read` only.
  - `AWS_ROLE_ARN` must be present in each GitHub Environment.
  - `AWS_REGION` defaults to `us-east-1` if unset.
- Validation:
  - Workflow validates missing vars with explicit error.
  - `npm run validate` runs before deploy.

### Task 1.2: Define OIDC Role Inputs

- Location: future CDK foundation stack or setup document
- Description: define per-environment deploy roles that can assume CDK bootstrap roles and deploy only this project's stacks.
- Acceptance criteria:
  - Trust policy limits access to this GitHub repo and intended environment/branch subject.
  - Role name avoids generic `GitHubActions`.
  - Role permissions are scoped to CDK deployment needs.
- Validation:
  - GitHub Actions can call `aws sts get-caller-identity`.
  - CDK deploy uses the expected role ARN.

### Task 1.3: Keep Existing Promotion Validation

- Location: `.github/workflows/validate-promotion-source.yml`
- Description: keep current PR promotion validation and align deploy workflows with it.
- Acceptance criteria:
  - `prod` accepts only `tst`.
  - `tst` accepts only `dev`.
  - `dev` rejects `main`, `tst`, and `prod`.
- Validation:
  - Existing required checks remain green.

## Sprint 2: CDK Foundation Resources

Goal: add only the baseline resources needed before data/API work.

### Task 2.1: Centralize Tags and Environment Helpers

- Location: `lib/`, `config/environments.js`
- Description: remove duplicated tag helper logic and make environment-derived naming explicit.
- Acceptance criteria:
  - Tags include project, environment, and managed-by.
  - Existing synth commands still work.
- Validation:
  - `npm run synth:dev`
  - `npm run synth:tst`
  - `npm run synth:prod`

### Task 2.2: Add SSM Foundation Parameters

- Location: `lib/stacks/data-stack.js` or a dedicated foundation stack
- Description: publish non-secret references such as environment name, API domain, assets bucket name, and current assets distribution id.
- Acceptance criteria:
  - No secret values in SSM plain strings.
  - Names follow `portfolio-{env}-{service}-{resource}` or a documented parameter path.
- Validation:
  - Synth shows only expected parameters.

### Task 2.3: Add Secrets Manager Placeholders

- Location: `lib/stacks/data-stack.js`
- Description: create empty/placeholder secrets for future migration-only values without storing actual credentials in code.
- Acceptance criteria:
  - Secret values are not committed.
  - Prod removal policy retains secrets.
  - Dev/tst cleanup behavior is explicit.
- Validation:
  - Synth/diff reviewed for no plaintext secret values.

### Task 2.4: Add Minimal Observability

- Location: `lib/stacks/observability-stack.js`
- Description: create log retention defaults, SNS alert topic, and basic dashboard/alarms only where real metrics exist.
- Acceptance criteria:
  - No noisy alarms without resources.
  - Log retention is bounded.
  - SNS topic exists without hardcoded personal endpoints.
- Validation:
  - `npm run validate`

## Sprint 3: Data and API Planning Handoff

Goal: prepare the next implementation slice without overbuilding or depending on a broken live API.

### Task 3.1: Model Small Backend Route Families

- Location: `docs/infrastructure-plan.md`, future `lib/stacks/api-stack.js`
- Description: reverse-engineer the old Express app and keep route families simple: public content, admin content, media, auth, operations.
- Acceptance criteria:
  - No unnecessary VPC.
  - No ECS/EC2 recreation.
  - No single giant Lambda as a long-term design.
  - Contract source is the old code and backed-up data, not `https://api.lynxpardelle.com`.
- Validation:
  - Architecture review against current backend route list.

### Task 3.2: Plan DynamoDB Tables by Existing Collections

- Location: `docs/infrastructure-plan.md`, future `lib/stacks/data-stack.js`
- Description: start with per-context tables matching current MongoDB collections, then denormalize later only if needed.
- Acceptance criteria:
  - Migration can be validated by collection counts and checksums.
  - Prod tables use retention and point-in-time recovery.
- Validation:
  - Table design review before implementation.

## Testing Strategy

- Local validation: `npm ci`, `npm run validate`, `npm run synth:dev`, `npm run synth:tst`, `npm run synth:prod`.
- GitHub validation: existing PR checks plus deploy workflow dry-run behavior.
- AWS identity validation: `aws sts get-caller-identity` inside deploy jobs.
- Migration validation: MongoDB backup exists before export/import tests.
- Media validation: current `lynx-portfolio` and `assets.lynxpardelle.com` remain untouched by foundation deploys.

## Risks and Mitigations

- Deferred credential rotation increases exposure risk while migration is in progress.
  - Mitigation: do not copy secrets into the new repo or CI logs; rotate during final cleanup/cutover.
- OIDC trust policy can be too broad.
  - Mitigation: restrict by repository and environment/branch subject; use per-environment GitHub variables.
- Existing media assets could be disrupted if CDK tries to own or replace them.
  - Mitigation: reference only during Phase 0/1.
- Migration can corrupt target data if backup/export is skipped.
  - Mitigation: make MongoDB backup a hard precondition for migration tests.

## Rollback Plan

- Before API cutover, keep the existing backend code, MongoDB backup, and export artifacts as the source of truth.
- If a foundation deploy breaks dev/tst, destroy or roll back only the affected environment stack.
- In prod, retain data resources and avoid destructive changes.
- For media, keep the existing S3 bucket and CloudFront distribution as stable infrastructure.
- Do not plan rollback to the current `https://api.lynxpardelle.com`; it is not a working endpoint.
