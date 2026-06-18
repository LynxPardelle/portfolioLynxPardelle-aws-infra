# API Reverse Engineering Migration Plan

Generated: 2026-06-18 Central Time

## Goal

Reconstruct the current `portfolioLynxPardelle` backend as AWS serverless microservices. The final public API domain remains `https://api.lynxpardelle.com`, but the current live endpoint is not working and is not the source of truth.

Source of truth for the rebuild:

- Existing backend code in `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle`
- MongoDB backup/export from the current database
- Existing S3 media bucket `lynx-portfolio`
- Existing media CDN domain `assets.lynxpardelle.com`

## Current Endpoint Status

On 2026-06-18 Central Time, a probe to `https://api.lynxpardelle.com/health` timed out after 15 seconds. Because of that, parity tests must not depend on the live production API domain. Contract tests should be derived from code behavior, route definitions, representative backed-up data, and local execution where possible.

## Route Families to Rebuild

The current Express app mounts these API surfaces:

- `/`
- `/health`
- `/api/main`
- `/api/article`
- `/api/performance`
- `/api/canary`
- `/api/monitoring`
- `/api/rollback`

Recommended target mapping:

| Source surface | Target service | Notes |
| --- | --- | --- |
| `/`, `/health` | Operations Lambda | Health and metadata only. |
| `/api/main/*` public reads | Public Content Lambda | Albums, book images, CV, main profile, songs, videos, websites, files, S3 status. |
| `/api/article/*` public reads | Public Content Lambda or Articles Lambda | Articles, categories, subcategories, pagination/search. |
| `/api/main/*` writes | Admin Content Lambda | Authenticated CRUD. |
| `/api/article/*` writes | Admin Content Lambda or Articles Admin Lambda | Authenticated CRUD and section/category management. |
| Upload routes | Media Lambda | Prefer presigned uploads where compatible; keep existing S3 key conventions. |
| `/api/performance`, `/api/canary`, `/api/monitoring`, `/api/rollback` | Operations Lambda or omit-by-decision | Rebuild only useful operational endpoints; do not recreate obsolete EC2 rollback behavior. |

## Data Models to Reverse Engineer

Current MongoDB/Mongoose models:

- `album`
- `article`
- `articleCat`
- `articleSection`
- `articleSubCat`
- `bookImg`
- `cvSection`
- `cvSubSection`
- `file`
- `main`
- `song`
- `video`
- `website`

Migration rule:

- Preserve legacy MongoDB `_id` values as string ids or `legacyMongoId` until all references are validated.
- Preserve relationships currently implemented with Mongoose refs.
- Verify collection counts and reference integrity before importing into prod DynamoDB.

## Implementation Sprints

### Sprint 1: Contract Inventory

Goal: produce a route/model contract from the old backend code.

Tasks:

- Enumerate every Express route, method, auth requirement, request params, request body fields, and response shape.
- Map every controller method to models and S3 operations.
- Identify routes that are public, admin-only, upload-specific, or obsolete operations routes.
- Save the inventory as `docs/api-contract-inventory.md`.

Validation:

- Inventory includes all mounted routes from `app.js` and `routes/*.js`.
- Inventory marks `/api/rollback/*` as obsolete unless explicitly kept for serverless operations.

### Sprint 2: Backup and Fixtures

Goal: create safe test data for migration and contract tests.

Tasks:

- Create MongoDB backup outside app repos.
- Export each collection to JSON.
- Store export artifacts under `s3://lynx-portfolio/migration/portfolio-{env}/mongo-export/{timestamp}/`.
- Build sanitized local fixtures for automated tests without committing secrets.

Validation:

- Collection list matches the model inventory.
- Backup timestamp, source target, collection list, and restore command are recorded in `Codex.md`.

### Sprint 3: DynamoDB and S3 Mapping

Goal: define the target data shape before writing Lambdas.

Tasks:

- Define DynamoDB tables for the current content migration scope: main content, articles, article sections, article categories/subcategories, files, and migration manifests.
- Define keys and GSIs from actual read/query patterns.
- Define S3 key compatibility for existing media paths.

Validation:

- Each route can be answered from the proposed DynamoDB access pattern.
- No route requires a scan-heavy design unless accepted as temporary for small admin-only data.
- Local migration export refuses incomplete MongoDB dumps before writing DynamoDB import files.

### Sprint 4: Public API Rebuild

Goal: bring up the read-only public API first.

Tasks:

- Implement `/health`.
- Implement public `/api/main/*` reads.
- Implement public `/api/article/*` reads.
- Deploy to `api.tst.lynxpardelle.com`.

Validation:

- Contract tests pass against fixtures.
- Manual smoke tests verify representative portfolio pages can fetch content.

### Sprint 5: Admin, Auth, and Media

Goal: rebuild authenticated management paths.

Tasks:

- Replace or migrate JWT auth with Cognito/API Gateway authorizers where practical.
- Implement admin CRUD routes.
- Implement upload flow against `lynx-portfolio`.
- Write audit events for admin changes.

Validation:

- Unauthenticated writes fail.
- Admin CRUD smoke passes.
- Upload creates or references S3 objects and file metadata.

### Sprint 6: Production Cutover

Goal: make `https://api.lynxpardelle.com` work through the new serverless backend.

Tasks:

- Run final import into prod DynamoDB.
- Deploy prod stack.
- Point `api.lynxpardelle.com` at the new API.
- Run health, public reads, admin auth, and upload smoke tests.

Validation:

- `https://api.lynxpardelle.com/health` returns from the new serverless API.
- Public content routes return expected data from DynamoDB/S3.
- No route depends on EC2/Dokploy.

## Non-Goals

- Do not preserve an active rollback path to the current monolithic backend.
- Do not recreate EC2, Dokploy, Docker Compose, or MongoDB as the target architecture.
- Do not create a new S3 media bucket unless Alec explicitly changes the decision.
- Do not rotate credentials until final cleanup/cutover, per current accepted-risk decision.

## Risks

- The live API is unavailable, so behavior must be inferred from code and data.
- Some old operations routes may describe obsolete deployment/rollback workflows.
- Deferred credential rotation remains a security risk until final cleanup.
- Upload routes currently accept large multipart requests through Express; Lambda should prefer presigned S3 flows where the frontend can support it.
