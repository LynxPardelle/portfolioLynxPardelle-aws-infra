# Codex Context

## 2026-06-17 23:43:39 Central Time

Requested by Alec Jonathan Montano Romero:

- Create a new GitHub repo in `C:\Users\lince\Documents\GitHub` for the AWS migration of `portfolioLynxPardelle`.
- Use JavaScript AWS CDK so the infrastructure can be modified later.
- Model three protected environments: `dev`, `tst`, and `prod`.
- Promotion path: feature/work branches -> `dev` -> `tst` -> `prod`.
- Direct commits to `dev`, `tst`, and `prod` must be blocked; changes must go through PR merge.
- Review the current `portfolioLynxPardelle` repo and current AWS account before writing the IaC plan.

Important current findings:

- Current backend is Node.js/Express with MongoDB/Mongoose, Docker/Dokploy, S3, and CloudFront.
- Current AWS account from `aws sts get-caller-identity`: `765932874577`.
- Current configured AWS region from `aws configure list`: `us-east-1`.
- Current S3 media bucket candidate: `lynx-portfolio`.
- Current CloudFront assets distribution candidate: `EPT5BBK0QX89M`, alias `assets.lynxpardelle.com`.
- Security concern: tracked environment files in the source repo contain non-placeholder-looking sensitive values; rotate before migration.
- Security concern: current EC2 volume attached to `LynxServer` is not encrypted.
- Security concern: one current CloudFront distribution uses `ViewerProtocolPolicy: allow-all` and `OriginProtocolPolicy: http-only`.

Decision:

- New repo starts as an IaC/spec scaffold. Do not copy app code or secrets into it.
- Target architecture is API Gateway + Lambda microservices + DynamoDB + S3/CloudFront + Cognito/Secrets Manager + CloudWatch/EventBridge/SNS.
- Keep existing S3/CloudFront assets as migration/import candidates, not blind replacements.

## 2026-06-17 23:48:04 Central Time

Handoff received in Codex from source thread `019ed93c-51bc-71e2-b068-e1709dd0ede4`.

Confirmed operating constraints:

- Work only inside `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle-aws-infra` unless Alec says otherwise.
- Remote repo is `https://github.com/LynxPardelle/portfolioLynxPardelle-aws-infra`.
- Default branch is `dev`; protected branches are `dev`, `tst`, and `prod`.
- Promotion path remains work branch -> `dev` -> `tst` -> `prod`.
- Do not commit directly to `dev`, `tst`, or `prod`; create a work branch from `dev`.
- Branch protection was reported as applied to `dev`, `tst`, and `prod` with required checks `Validate promotion source / validate` and `CDK validate / validate`, admins included, 1 approval, no force push, and no branch deletion.
- GitHub Environments `dev`, `tst`, and `prod` were reported as existing and restricted to their matching branch.

Suggested first implementation after Alec explicitly confirms start:

- Implement Phase 0/Phase 1 foundation only: OIDC deploy role, base parameters, tags, minimal observability, secrets placeholders, and real foundation CDK.
- Do not copy secrets or old app code.

## 2026-06-18 Central Time

Alec revised migration constraints:

- Do not rotate exposed/possibly exposed credentials now. Defer rotation until the migration is otherwise complete and final cleanup/cutover starts.
- Treat deferred rotation as a temporary accepted risk. Do not copy secrets into this repo, GitHub Actions logs, CDK context, CloudFormation outputs, SSM plain strings, or docs.
- Create a MongoDB backup before any migration test.
- Reuse the current `lynx-portfolio` S3 bucket for media assets. Do not create a new media bucket unless Alec explicitly changes this.
- Keep the serverless migration simple and proportional to the current backend size.
- For GitHub AWS CI/CD, mirror the proven local patterns:
  - Moyra: CDK deploy via GitHub OIDC using environment variables such as `AWS_ROLE_ARN` and `AWS_REGION`.
  - Zoolanding AWS Lambda repos: environment-specific deployment workflows with promotion guards and OIDC.
  - Portfolio adaptation: CDK deployment workflows for `dev`, `tst`, and `prod`, respecting `dev` -> `tst` -> `prod`.

## 2026-06-18 Central Time

Alec clarified the final API migration goal:

- `https://api.lynxpardelle.com` currently does not work and must not be treated as a working rollback target.
- The migration should be a complete serverless rebuild, using reverse engineering of the existing backend code and data model.
- The final state should make `https://api.lynxpardelle.com` serve the portfolio API through AWS serverless microservices.
- Do not preserve an active rollback path to the EC2/Dokploy/Express monolith.
- Use the old backend repository, current MongoDB backup/export, and existing S3 media bucket as the source material for the new implementation.

Observed probe result on 2026-06-18 Central Time:

- `Invoke-WebRequest https://api.lynxpardelle.com/health` timed out after 15 seconds with: `The request was canceled due to the configured HttpClient.Timeout of 15 seconds elapsing.`

## 2026-06-18 Central Time

Started Phase 0/1 execution on branch `work/portfolio-serverless-migration`.

Implemented foundation scope:

- Added source-derived API contract inventory in `docs/api-contract-inventory.md`.
- Added MongoDB backup procedure in `docs/mongodb-backup-procedure.md`; no real backup was executed in this step because no intentional MongoDB URI/cutover window was provided.
- Added GitHub OIDC deploy-role setup notes in `docs/oidc-deploy-roles.md`.
- Added GitHub Actions deploy workflows for `dev`, `tst`, and `prod` using OIDC, `AWS_ROLE_ARN`, `AWS_REGION`, `aws sts get-caller-identity`, and CDK deploy against `PortfolioDev/*`, `PortfolioTst/*`, and `PortfolioProd/*`.
- Updated CDK validate workflow to run `npm test` before `npm run validate`.
- Added `lib/project-helpers.js` for tags, resource names, parameter paths, and environment removal policy.
- Added SSM foundation parameters for environment name, API domain, existing assets bucket/domain/distribution, and migration export prefix.
- Added Secrets Manager placeholder resources without `SecretString` or `GenerateSecretString`.
- Added minimal observability: bounded API log group, SNS alerts topic, and dashboard, with no premature alarms.
- Added `node --test` foundation tests in `test/foundation.test.js`.

Validation run:

- `npm test`
- `npm run validate`
- `npm run synth:dev`
- `npm run synth:tst`
- `npm run synth:prod`

Backup readiness note:

- Local `mongodump` and `mongorestore` commands were not found on this machine during this run.
- The old backend documentation `docs/mongodb-backup-s3.md` says current manual backup operations run through the `mongo-unified` Docker service with `/opt/mongo-unified/scripts/backup_mongo_to_s3.sh manual`.
- A real backup was not executed in this run.

## 2026-06-18 01:35 Central Time

Alec reported the MongoDB backup at `C:\Users\lince\Downloads\dump`.

Implemented DynamoDB migration foundation:

- Added DynamoDB tables in `DataStack` for `main`, `articles`, `article-sections`, `article-categories`, `files`, and `migration-manifests`.
- Added `bson` dependency so local scripts can read `.bson` dump files without requiring `bsondump` in PATH.
- Added migration inventory and DynamoDB batch export scripts:
  - `npm run migration:inspect -- --dump C:\Users\lince\Downloads\dump`
  - `npm run migration:export -- --dump C:\Users\lince\Downloads\dump --env dev --out C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-dynamodb-import\{batch}`

Observed backup inventory:

- `admin.system.users`
- `admin.system.version`

Required application collections were missing:

- `albums`
- `articles`
- `articlecats`
- `articlesections`
- `articlesubcats`
- `bookimgs`
- `cvsections`
- `cvsubsections`
- `files`
- `mains`
- `songs`
- `videos`
- `websites`

Decision:

- Do not use this current dump for Portfolio content migration.
- The export script intentionally refuses to write DynamoDB import files unless all required application collections are present.

## 2026-06-18 02:13 Central Time

Dokploy backup and migration recovery update:

- Alec provided a temporary Dokploy API key for this migration inspection. The key was used only transiently from the shell/API calls and must not be committed, documented, or copied into repo files.
- Dokploy project `lynxpardelle` contains Compose `DB` with app name `lynxpardelle-db-djvthu`; the Mongo container was running but unhealthy.
- The live Mongo container health output showed `MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017`.
- Dokploy's built-in Mongo/Compose manual backup API returned `BAD_REQUEST`, so a temporary Compose job was used for diagnostics and then removed.
- Logical `mongodump` from Dokploy failed because `mongo:27017` refused the connection.
- A raw read-only volume backup was created instead, covering Mongo `data-db`, `configdb`, `mongo-logs`, and `mongo-backups`.
- Temporary Dokploy resources created for this work were cleaned up:
  - temporary Compose `GLNzMFvl9npFsTkM1Dnma`
  - temporary backup config `fsTP29GayFEgqIvOFs-qe`

Validated backup artifacts:

- S3 raw volume backup: `s3://lynx-portfolio/migration/portfolio-prod/dokploy-volume-backups/portfolio-volume-backup-20260618-082600.tar.gz`
- S3 checksum: `s3://lynx-portfolio/migration/portfolio-prod/dokploy-volume-backups/portfolio-volume-backup-20260618-082600.tar.gz.sha256`
- Backup size: `270759335` bytes.
- SHA-256: `4a38a2f0fa95c6c151a80477ceb5b166b216f65b92c0e909c0c4bea8673d55c0`.
- Local verified copy: `C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-dokploy-volume-backup\portfolio-volume-backup-20260618-082600\portfolio-volume-backup-20260618-082600.tar.gz`.

Root cause found while recovering the backup locally:

- The raw Mongo data has `featureCompatibilityVersion: 8.0`.
- Starting the data with Mongo 7 failed with `Wrong mongod version` because FCV `8.0` is not valid for Mongo 7.
- Starting the same restored data with `mongo:8.0` succeeded and returned `{ "ok": 1 }`.
- This strongly indicates the current Dokploy DB image is version-mismatched with the data files: deployed image `lynx-portfolio-back-mongo:2.0.0` is Mongo 7.0 while the data requires Mongo 8.0.

Recovered logical Mongo dump:

- Local logical dump path: `C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-mongo-logical-dump\dump-portfolio-volume-20260618-082600`.
- `npm run migration:inspect -- --dump C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-mongo-logical-dump\dump-portfolio-volume-20260618-082600` returned `validation.ok: true`.
- Recovered `lynx_portfolio` counts:
  - `albums`: 10
  - `articlecats`: 1
  - `articles`: 0
  - `articlesections`: 0
  - `articlesubcats`: 1
  - `bookimgs`: 22
  - `cvsections`: 6
  - `cvsubsections`: 13
  - `files`: 77
  - `mains`: 1
  - `songs`: 8
  - `videos`: 4
  - `websites`: 9

DynamoDB import export:

- Generated dev batch-write export at `C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-dynamodb-import\portfolio-volume-20260618-082600-dev`.
- Migration batch id: `portfolio-volume-20260618-082600`.
- Output file count: 8.

## 2026-06-18 02:20 Central Time

Alec decided to keep the temporary Dokploy API key available for now in case it is needed again during migration work.

Security handling:

- Treat the still-valid key as a temporary accepted risk.
- Do not store the key value in repo files, docs, generated artifacts, GitHub Actions, CloudFormation, SSM, or logs.
- Revisit revocation together with the deferred credential rotation at final cleanup/cutover.

## 2026-06-18 03:45 Central Time

Implemented and deployed the first read-only serverless public API in `dev`.

Implementation:

- Added API Gateway HTTP API and Lambda `portfolio-dev-public-api` in `ApiStack`.
- Added a bundled Node.js 20 Lambda handler at `lambda/public-api/index.js`.
- Exposed `DataStack` DynamoDB table constructs to `ApiStack` through CDK cross-stack references.
- Locked CDK cross-stack reference behavior to `strong` in `cdk.json`.
- Kept the Lambda IAM policy read-only and explicit: `dynamodb:BatchGetItem`, `dynamodb:DescribeTable`, `dynamodb:GetItem`, `dynamodb:Query`, and `dynamodb:Scan`.
- Reused existing media references: S3 bucket `lynx-portfolio` and CDN domain `assets.lynxpardelle.com`.
- Did not copy secrets or old app code into this repository.

Deployed dev endpoint:

- API Gateway endpoint: `https://6rz4b6ydmh.execute-api.us-east-1.amazonaws.com`.
- Lambda function name: `portfolio-dev-public-api`.

Validated commands:

- `npm install` returned `found 0 vulnerabilities`.
- `npm test` passed 13 tests.
- `node --check lambda\public-api\index.js` passed.
- `npm run validate` completed `cdk synth` successfully.
- `npm run diff:dev` showed new API/Lambda resources plus DataStack exports only; no DynamoDB table recreation.
- `npx cdk deploy "PortfolioDev/*" --require-approval never` completed successfully.

Validated dev API behavior:

- `GET /health` returned `status: ok`, bucket `lynx-portfolio`, region `us-east-1`, CDN `assets.lynxpardelle.com`.
- `GET /api/main/main` returned `status: success` and populated `logo`, `backgroundImg`, `CVImage`, and `CVBackground`.
- `GET /api/main/albums` returned 10 albums with populated `img`.
- `GET /api/main/cv-sections` returned 6 sections and populated CV subsections.
- `GET /api/main/book-imgs` returned 22 items.
- `GET /api/main/songs` returned 8 items.
- `GET /api/main/videos` returned 4 items.
- `GET /api/main/web-sites` returned 9 items.
- `GET /api/article/article-cats` returned 1 item.
- `GET /api/article/article-sub-cats` returned 1 item.
- `GET /api/main/file-info/620324b4c602df79df1e8bc9` returned file metadata and CDN URL.
- `GET /api/main/get-file/620324b4c602df79df1e8bc9` returned HTTP 302 to `https://assets.lynxpardelle.com/uploads/main/1758935764920_620324b4c602df79df1e8bc9_Lynx_Pardelle-Cornicem_Caedre_Demo.png`.
- `GET /api/article/articles` returned HTTP 404 with `{"status":"error","message":"No hay artículos."}`, matching the empty recovered articles collection.

Promotion note:

- Dev has been deployed locally from the work branch for validation.
- Repository promotion still needs the protected branch path: work branch PR -> `dev`, then `dev` -> `tst`, then `tst` -> `prod`.

## 2026-06-18 03:49 Central Time

Promotion status:

- Created commit `fc891ee` with the serverless foundation and public API implementation.
- Created follow-up commit `aa8c95a` to make the migration inventory test portable in GitHub Actions Linux runners.
- Pushed branch `work/portfolio-serverless-migration` to origin.
- Opened PR #1: `https://github.com/LynxPardelle/portfolioLynxPardelle-aws-infra/pull/1`.
- GitHub checks for commit `aa8c95a` passed:
  - `Validate promotion source / validate`
  - `CDK validate / validate`
- PR #1 is mergeable but blocked by branch protection because `reviewDecision` is `REVIEW_REQUIRED`.
- Promotion to `dev`, then `tst`, then `prod` cannot continue until PR #1 receives the required approval.

## 2026-06-18 03:56 Central Time

Alec clarified that the repo is single-maintainer and he cannot approve a PR created under his own GitHub identity.

Branch protection adjustment:

- Updated `dev`, `tst`, and `prod` branch protection to set required approving reviews from `1` to `0`.
- Kept required PR/check-based promotion behavior:
  - Required checks remain `Validate promotion source / validate` and `CDK validate / validate`.
  - Strict status checks remain enabled.
  - Admin enforcement remains enabled.
  - Required conversation resolution remains enabled.
  - Force pushes remain disabled.
  - Branch deletion remains disabled.
- This resolves the single-maintainer deadlock while preserving the work branch -> `dev` -> `tst` -> `prod` promotion chain.

Follow-up correction:

- Found `required_linear_history` was enabled on `dev`, `tst`, and `prod`.
- That conflicts with the repository's own `deploy-tst` and `deploy-prod` guards, which intentionally require merge commits from `dev` and `tst` to prove the promotion path.
- Disabled `required_linear_history` on `dev`, `tst`, and `prod`.
- Enabled repository auto-merge so protected PRs can be merged by GitHub after required checks pass when needed.

Required check naming correction:

- GitHub Actions reported both workflow jobs with the same Check Run name: `validate`.
- Updated workflow job display names to unique Check Run names:
  - `Validate promotion source`
  - `CDK validate`
- Branch protection should require these unique Check Run names with GitHub Actions app id `15368`.

## 2026-06-18 04:26 Central Time

API custom domain cutover plan:

- Current Route53 records for `api.lynxpardelle.com` are unmanaged A/AAAA aliases to `dvawu0149qr16.cloudfront.net`.
- API Gateway custom domain names did not exist for `lynxpardelle.com` before this change.
- ACM has an issued API certificate at `arn:aws:acm:us-east-1:765932874577:certificate/c28aa27f-c191-4d88-b2cf-2279a4481e30`.
- The CDK change enables a custom domain only for prod:
  - API Gateway V2 regional domain `api.lynxpardelle.com`.
  - Root API mapping to the prod HTTP API.
  - Route53 A and AAAA alias records in hosted zone `Z05088763QG63CC5SE7PN`.
- The Route53 records use CDK `deleteExisting: true` intentionally because the current records already exist outside this stack and this deployment is the explicit DNS cutover.
- Dev and tst do not get `api.dev.lynxpardelle.com` or `api.tst.lynxpardelle.com` custom domains in this change because no matching certificates were verified.

Local validation:

- `npm test` passed 14 tests.
- `npm run validate` completed `cdk synth` successfully.
- `npm run diff:prod` showed changes only in `PortfolioProd-Portfolio-prod-Api`: API Gateway domain, API mapping, Route53 A/AAAA records, and the CDK custom resource used to delete existing A/AAAA records before replacement.

## 2026-06-18 04:41 Central Time

API custom domain cutover completed:

- PR #4 `work/api-custom-domain-cutover` -> `dev` merged.
- PR #5 `dev` -> `tst` merged.
- PR #6 `tst` -> `prod` merged.
- GitHub Actions reported `success` for the relevant `CDK validate`, `Validate promotion source`, `Deploy Dev`, `Deploy Tst`, and `Deploy Prod` runs.
- Prod CloudFormation output for `PortfolioProd-Portfolio-prod-Api`:
  - `PublicApiEndpoint`: `https://25bxkwpx0k.execute-api.us-east-1.amazonaws.com`
  - `PublicApiCustomDomainName`: `api.lynxpardelle.com`
  - `PublicApiRegionalDomainName`: `d-dovq432mpb.execute-api.us-east-1.amazonaws.com`
- Route53 now has A and AAAA aliases for `api.lynxpardelle.com` pointing to `d-dovq432mpb.execute-api.us-east-1.amazonaws.com`.
- API Gateway custom domain `api.lynxpardelle.com` reports `DomainNameStatus: AVAILABLE`.

Production verification:

- `GET https://api.lynxpardelle.com/health` returned `status: ok`, `app: lynx-portfolio-back`, `storage.mode: s3-only`, `bucket: lynx-portfolio`, and `cdnDomain: assets.lynxpardelle.com`.
- `GET https://api.lynxpardelle.com/api/main/albums` returned success with 10 items.
- `GET https://api.lynxpardelle.com/api/main/main` returned success for id `61fdcd95fe7fd831d4c15f80`.
- `GET https://api.lynxpardelle.com/api/article/articles` returned HTTP 404 with `{"status":"error","message":"No hay artículos."}` because the recovered dump has no articles.
- Browser verification against `https://lynxpardelle.com` loaded `/`, `/webs`, `/reel`, `/book`, `/music`, and `/cv` with top-level HTTP 200 and no console warnings or errors.
- Browser verification captured successful calls to the new API domain, including `/api/main/main`, `/api/main/songs`, `/api/main/web-sites`, `/api/main/videos`, `/api/main/book-imgs`, `/api/main/albums`, and `/api/main/cv-sections`.
- Observed browser `requestfailed` entries were `net::ERR_ABORTED` for the background WAV asset from `assets.lynxpardelle.com`; no failed `api.lynxpardelle.com` requests were observed in the route verification.

Operational notes:

- CDK emitted the expected deprecation warning for `route53.RecordSetOptions#deleteExisting`; it was used intentionally for this one-time cutover from unmanaged DNS records to CDK-owned API Gateway aliases.
- Temporary Dokploy credentials remain intentionally available per Alec's instruction; rotate/revoke them after the migration work is fully complete.

## 2026-06-18 13:50 Central Time

GitHub Actions Node runtime cleanup:

- GitHub API reported the latest `actions/checkout` release as `v7.0.0`.
- GitHub API reported the latest `actions/setup-node` release as `v6.4.0`.
- Updated workflows from `actions/checkout@v4` to `actions/checkout@v7.0.0`.
- Updated workflows from `actions/setup-node@v4` to `actions/setup-node@v6.4.0`.
- Kept project runtime `node-version: 22` unchanged.
- Local validation passed:
  - `npm test` passed 14 tests.
  - `npm run validate` completed `cdk synth` successfully.
- No remaining references to `actions/checkout@v4` or `actions/setup-node@v4` were found under `.github/workflows`.

## 2026-06-18 15:52 Central Time

Frontend AWS hosting foundation decision:

- Work stayed inside `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle-aws-infra`.
- `C:\Users\lince\Documents\GitHub\lynx-portfolio-angular` was not inspected or modified.
- Angular source, builds, tests, and release artifacts remain owned by the frontend repo.
- The infra repo consumes only frontend artifact coordinates and manifest metadata.
- The frontend must keep calling `https://api.lynxpardelle.com`.
- Reuse existing S3 bucket `lynx-portfolio` for frontend release artifacts under `frontend/angular-ssr/{env}/releases/{releaseId}/`.
- Added a contract-only `FrontendStack` that publishes SSM parameters for artifact bucket, prefix patterns, API base URL, SSR runtime, and intended architecture.
- No frontend CloudFront distribution, Lambda SSR function, Function URL, API Gateway origin, Route53 record, WAF, VPC, NAT, EC2, ECS, or new S3 bucket was created in this foundation step.
- Future implementation should deploy CloudFront + S3 static origin + Lambda SSR only after the frontend repo publishes a verified manifest containing browser assets and the SSR bundle key.

## 2026-06-18 16:31 Central Time

Route53 steady-state hardening:

- Removed `deleteExisting` from the API custom-domain A/AAAA records in CDK.
- The one-time cutover from unmanaged DNS records is complete; future deploys should not delete existing Route53 records as part of normal convergence.

## 2026-06-18 18:05 Central Time

Frontend AWS SSR hosting implementation:

- `FrontendStack` now always publishes the artifact contract plus a frontend publisher OIDC role for `LynxPardelle/lynx-portfolio-angular`.
- With no `FRONTEND_RELEASE_ID`, the stack remains safe to deploy as contract/publisher foundation only.
- With `FRONTEND_RELEASE_ID`, the stack creates:
  - Node.js 22 ARM64 Lambda SSR from `s3://lynx-portfolio/frontend/angular-ssr/{env}/releases/{releaseId}/server/ssr-handler.zip`.
  - Lambda Function URL with `AWS_IAM`.
  - CloudFront origin access control for the Function URL.
  - CloudFront distribution with dynamic/default routes to Lambda SSR.
  - Static path behaviors to `assets.lynxpardelle.com` with origin path `frontend/angular-ssr/{env}/releases/{releaseId}/browser`.
  - One-month CloudWatch log retention.
  - Dev/tst Route53 A/AAAA records when configured.
- Prod frontend Route53 records remain disabled by default to avoid replacing existing `lynxpardelle.com` and `www.lynxpardelle.com` A records until final cutover.
- Bucket policy risk was avoided: the stack does not create an `AWS::S3::BucketPolicy` for the existing `lynx-portfolio` bucket because that bucket already has a policy for the current assets CloudFront distribution.
- GitHub Actions deploy workflows pass `FRONTEND_RELEASE_ID` from environment variables into CDK deploy.
- Validation passed:
  - `npm test` exited 0 with 16/16 infra tests passing.
  - `npm run validate` exited 0 with `cdk synth`.
  - `$env:FRONTEND_RELEASE_ID='local-smoke'; npm run validate` exited 0 with `cdk synth`.

## 2026-06-18 18:21 Central Time

Frontend dev OAC permission fix:

- `https://dev.lynxpardelle.com` initially returned HTTP 403 after deploying CloudFront + Lambda SSR.
- CloudFront distribution `E11XU21EUJLB9B` was `Deployed` and aliased to `dev.lynxpardelle.com`.
- The 403 body was Lambda Function URL `AccessDeniedException`, and no Lambda log stream was created, which showed the request was blocked before invoking SSR.
- Kept the Function URL private with `AWS_IAM`.
- Added Lambda resource-policy permissions for CloudFront OAC:
  - `lambda:InvokeFunctionUrl` with `FunctionUrlAuthType: AWS_IAM`.
  - `lambda:InvokeFunction`.
- Added infra tests that assert both CloudFront permissions are synthesized.

## 2026-06-18 19:28 Central Time

Full TST frontend test:

- Requested URL `https://test.lynxpardelle.com/` did not resolve DNS from the local machine; tested canonical deployed host `https://tst.lynxpardelle.com/`.
- Full report saved outside the repo at `C:\Users\lince\Documents\Codex\2026-06-18\lynx-test-full-audit\report.md`.
- Evidence files include Playwright route results, interaction results, Lighthouse JSON, and screenshots under `C:\Users\lince\Documents\Codex\2026-06-18\lynx-test-full-audit`.
- Passed browser checks on TST:
  - Desktop and mobile route checks for `/`, `/webs`, `/book`, `/music`, `/reel`, `/cv`, `/blog`, and `/login` returned top-level HTTP 200.
  - `/webs` loaded 25/25 images, `/book` loaded 23/23 images, `/music` loaded 31/31 images, `/cv` loaded visible content and images, and `/reel` rendered 3 iframes.
  - No horizontal overflow was detected in desktop or mobile route checks.
  - Menu offcanvas remained transparent and menu navigation to `/book` loaded 23/23 images.
  - Language switch to English worked and persisted after reload; language button background was `rgb(255, 85, 85)`.
- Important findings:
  - TST direct route HTML returns the Angular shell only instead of SSR-rendered route content.
  - Blog remains blocked by `/api/article/articles/1/5/_id/all/all` returning HTTP 404 with `No hay artículos.`
  - Demo Reel embeds are present but Dailymotion shows an unavailable/unexpected-error message in the visible player.
  - Lighthouse `/webs` scores were performance 46, accessibility 82, best practices 92, SEO 92; LCP was 23.0s and CLS was 0.489.
  - `robots.txt`, `sitemap.xml`, and `manifest.webmanifest` returned the Angular HTML shell.
  - Common frontend security headers were absent on `https://tst.lynxpardelle.com/webs`.

## 2026-06-18 20:22 Central Time

TST hardening implementation for SSR/static metadata/security headers:

- User decision: keep canonical TST host `https://tst.lynxpardelle.com`; do not add or fix `test.lynxpardelle.com`.
- Changed the public API article-list behavior so an empty articles collection returns HTTP `200` with `{ "status": "success", "total_items": 0, "pages": 0, "articles": [] }` instead of HTTP `404`.
- Added a public API regression test using a simulated DynamoDB client for the empty article-list case.
- Added a CloudFront `ResponseHeadersPolicy` for frontend distributions when a release id is configured:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `X-XSS-Protection`
  - `Permissions-Policy`
  - `X-Powered-By` removal
- The CSP is intentionally compatibility-first for current third-party dependencies and embeds; it includes `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, and `upgrade-insecure-requests`, while allowing the current CDN/API/media/embed hosts.
- Added static CloudFront behaviors for `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `site.webmanifest`, `*.xml`, and `*.webmanifest` so these paths resolve from the published Angular browser artifact instead of Lambda SSR.
- Extended `NG_TRUST_PROXY_HEADERS` for Lambda SSR to include `x-forwarded-for` and `x-forwarded-port`, matching the warnings observed in `/aws/lambda/portfolio-tst-frontend-ssr`.
- Local validation passed:
  - `npm test` exited 0 with 17 tests passing.
  - `npm run validate` exited 0 with `cdk synth`.

## 2026-06-18 20:46 Central Time

TST hardening promotion and remote validation:

- Frontend release used for TST: `a998f6941b91f1228e731bc737cda1ac4515f116`.
- PR #17 promoted infra `dev` -> `tst`; `Deploy Tst` run `27801834602` completed successfully.
- PR #18 promoted infra `tst` -> `prod`; `Deploy Prod` run `27801999288` completed successfully.
- Production API empty-blog behavior now matches the recovered data truth:
  - `GET https://api.lynxpardelle.com/api/article/articles/1/5/_id/all/all` returned HTTP `200`.
  - Body returned exactly: `{"status":"success","total_items":0,"pages":0,"articles":[]}`.
- TST direct HTTP smoke passed:
  - `https://tst.lynxpardelle.com/blog` returned HTTP `200`, SSR HTML, contained `No hay artículos.`, and did not contain `Cargando...`.
  - `https://tst.lynxpardelle.com/webs` returned HTTP `200`, SSR HTML, and did not contain `Cargando...`.
  - `robots.txt`, `sitemap.xml`, and `manifest.webmanifest` returned non-HTML static content types.
  - `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` were present; `X-Powered-By` was absent.
- Browser route smoke on `https://tst.lynxpardelle.com` passed for `/`, `/webs`, `/reel`, `/book`, `/music`, `/cv`, and `/blog`.
  - No route showed `Cargando...` after hydration.
  - Displayed image checks reported `0` broken displayed images across the tested routes.
  - `/reel` displayed 3 Dailymotion iframes and no visible error text in the page DOM.
  - `/blog` displayed `No hay artículos.` after hydration.
  - The language button background was `rgb(255, 85, 85)`.
  - The menu offcanvas opened with a black page background and visible navigation; no white full-screen panel reproduced.
- Lighthouse reports were saved outside the repo at `C:\Users\lince\Documents\Codex\2026-06-18\lynx-tst-lighthouse`.
  - `/blog`: performance `66`, accessibility `87`, best practices `92`, SEO `100`, LCP `3643 ms`, CLS `0.355`.
  - `/webs`: performance `55`, accessibility `87`, best practices `92`, SEO `100`, LCP `3919 ms`, CLS `0.937`.
  - Lighthouse CLI generated JSON/HTML reports but exited with code `1` because Chrome cleanup hit `EPERM` deleting a temporary `lighthouse.*` directory under `%TEMP%`.
- Remaining Lighthouse work is separate from this hardening promotion:
  - `/webs` CLS is mainly from media elements lacking explicit dimensions.
  - Cache TTL findings point at existing `assets.lynxpardelle.com` media assets with TTL `0`; the current migration plan intentionally keeps that existing media CloudFront distribution stable unless separately changed.

## 2026-06-18 21:24 Central Time

Assets cache header operational change:

- Distribution `EPT5BBK0QX89M` serves alias `assets.lynxpardelle.com` from S3 bucket `lynx-portfolio` and previously had no `ResponseHeadersPolicyId` on the default cache behavior.
- Verified before change that `https://assets.lynxpardelle.com/uploads/main/1758935700330_61e2bd90fe7fd831d4c15992_katzeRecordsComMCMB1FullScreen.jpg` returned HTTP `200` without `Cache-Control`.
- Created CloudFront custom response headers policy `portfolio-assets-browser-cache` with id `d8d39ade-9f29-4561-b289-973c4700b305`.
- Attached the policy to distribution `EPT5BBK0QX89M` default cache behavior and waited for deployment.
- Verified after deployment:
  - Default cache behavior `ResponseHeadersPolicyId` is `d8d39ade-9f29-4561-b289-973c4700b305`.
  - Policy custom header item is exactly `Cache-Control: public, max-age=2592000, stale-while-revalidate=86400` with `Override: true`.
  - The same asset URL now returns `Cache-Control: public, max-age=2592000, stale-while-revalidate=86400`.
- Security/operations note: this avoided rewriting S3 objects, so existing `x-amz-storage-class: STANDARD_IA`, `x-amz-server-side-encryption: AES256`, and object versioning state were not changed. The policy intentionally does not use `immutable` so same-key asset replacements can recover after TTL.

## 2026-06-18 21:34 Central Time

TST frontend release update for CV/CLS fixes:

- Frontend merge commit `8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65` was published as a TST SSR artifact by `lynx-portfolio-angular` workflow run `27803506029`.
- Updated GitHub Environment `tst` variable `FRONTEND_RELEASE_ID` to `8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65`.
- Ran infra `Deploy Tst` workflow run `27803563133` from ref `tst` at SHA `0f394844d7d48ffbd0918e444a6993ef5397caed`; guard and deploy jobs completed successfully.
- TST remote validation after deploy:
  - `/`, `/webs`, `/cv`, `/book`, `/music`, `/reel`, and `/blog` returned HTTP `200`.
  - `/webs` SSR HTML contained `portfolio-website-skeleton` and no `Cargando...`.
  - `/cv` browser computed styles showed outer panel red/yellow and nested panel black/white.
  - `/webs` browser check showed `missingDimensionAttrs: 0` after hydration.
  - `/blog` still correctly showed `No hay artículos.`.
  - `https://tst.lynxpardelle.com/webs` response headers included `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
  - `https://tst.lynxpardelle.com/robots.txt` returned `Content-Type: text/plain`.
  - `https://assets.lynxpardelle.com/uploads/main/1758935700330_61e2bd90fe7fd831d4c15992_katzeRecordsComMCMB1FullScreen.jpg` returned `Cache-Control: public, max-age=2592000, stale-while-revalidate=86400`.
- TST Lighthouse `/webs` after fixes: performance `67`, accessibility `87`, best practices `96`, SEO `100`, CLS `0.0612`, LCP `12054 ms`, TBT `118 ms`. Report saved outside repo at `C:\Users\lince\Documents\Codex\2026-06-18\lynx-tst-lighthouse-cv-cls-cache\webs-tst-after-fixes.report.json`.

## 2026-06-18 23:26 Central Time

Production frontend cutover to AWS SSR:

- User confirmed TST looked good, so the frontend release `8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65` was promoted to production.
- Published the production SSR artifact from `lynx-portfolio-angular` workflow run `27806547723`; the run completed successfully.
- Set GitHub Environment `prod` variable `FRONTEND_RELEASE_ID` to `8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65`.
- Initial `Deploy Prod` run `27806591883` failed because CloudFront alias `lynxpardelle.com` was still reserved on an old distribution tenant:
  - Tenant: `dt_33B4aNp61unDbZy3ZRueLcB5QPM`
  - Parent distribution: `E10Y59XAIPQY6A`
  - Route53 and public DNS still pointed `lynxpardelle.com` and `www.lynxpardelle.com` to `32.195.120.158`, so the tenant was stale relative to active traffic.
- Disabled and deleted only the stale tenant `dt_33B4aNp61unDbZy3ZRueLcB5QPM`; `list-conflicting-aliases` then returned `Quantity: 0` for `lynxpardelle.com`.
- Follow-up `Deploy Prod` run `27806880616` failed because orphan LogGroup `/aws/lambda/portfolio-prod-frontend-ssr` already existed. Verified:
  - `aws lambda get-function --function-name portfolio-prod-frontend-ssr` returned `ResourceNotFoundException`.
  - `PortfolioProd-Portfolio-prod-Frontend` did not list that LogGroup as a managed resource.
  - The LogGroup had `storedBytes: 0`.
- Deleted orphan LogGroup `/aws/lambda/portfolio-prod-frontend-ssr`.
- `Deploy Prod` run `27806936790` completed successfully from `prod` SHA `30ad3e8f6607738c958b0a16e7265003fef367cf`.
- Production CloudFront distribution:
  - Id: `E1LHE6N1FDU1U1`
  - Domain: `d1h141iw0hg57g.cloudfront.net`
  - Aliases: `lynxpardelle.com`, `www.lynxpardelle.com`
  - Release output: `8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65`
- Route53 cutover was applied manually because current prod config has `frontendHosting.route53RecordsEnabled: false`:
  - Change id: `/change/C056671828JEVPY0XZU6T`
  - Change reached `INSYNC`.
  - `lynxpardelle.com` A/AAAA and `www.lynxpardelle.com` A/AAAA now alias to `d1h141iw0hg57g.cloudfront.net`.
  - Existing MX, TXT, NS, and SOA records were not changed.
- Production validation:
  - `https://lynxpardelle.com/`, `/webs`, `/cv`, `/book`, `/music`, `/reel`, and `/blog` returned HTTP `200` from CloudFront with non-empty SSR HTML.
  - `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, and `/site.webmanifest` returned HTTP `200` with static content types.
  - `https://api.lynxpardelle.com/api/article/articles/1/5/_id/all/all` returned exactly `{"status":"success","total_items":0,"pages":0,"articles":[]}`.
  - Browser check on production showed no broken in-viewport images for `/webs`, `/book`, `/music`, `/cv`, or `/blog`.
  - `/blog` displayed `No hay artículos.`.
  - Language button computed style: `backgroundColor` `rgb(255, 85, 85)`, `color` `rgb(0, 0, 0)`, `opacity` `1`.
  - `/cv` nested panel titles computed as white text on black background.
- Follow-up: codify the production frontend Route53 records in CDK, including alternate domain `www.lynxpardelle.com`, so the manual cutover does not remain outside IaC.

## 2026-06-18 23:44 Central Time

Production frontend DNS IaC cleanup:

- Added explicit prod frontend Route53 management to CDK without native `AWS::Route53::RecordSet` resources for the already-existing production records.
- `prod` now uses `frontendHosting.route53RecordsEnabled: true` with `route53RecordManagement: "upsert"`.
- The frontend stack now supports two Route53 modes:
  - Default/native mode for environments already managed by CloudFormation, used by `dev` and `tst`.
  - `upsert` mode for production cutover records that already exist outside the stack, using `ChangeResourceRecordSets` with `UPSERT` so deployment updates the existing A/AAAA records instead of trying to create duplicates.
- Production upsert target domains are `lynxpardelle.com` and `www.lynxpardelle.com`, each with A and AAAA alias records to the CloudFront distribution.
- The synthesized prod frontend template with `FRONTEND_PROD_RELEASE_ID=8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65` contained:
  - `Route53RecordSetCount: 0`
  - `FrontendAliasCustomCount: 1`
  - `CloudFrontDistributionCount: 1`
- Current live Route53 records were checked before promotion planning:
  - `lynxpardelle.com` A/AAAA alias to `d1h141iw0hg57g.cloudfront.net.`
  - `www.lynxpardelle.com` A/AAAA alias to `d1h141iw0hg57g.cloudfront.net.`
  - Existing MX, TXT, NS, and SOA records remain separate and are not touched by this frontend alias upsert.
- Validation:
  - A TDD regression test first failed with native duplicate-prone `AWS::Route53::RecordSet` resources.
  - `npm test` passed with 18/18 tests after implementation.
  - `npm run validate` passed.
  - `FRONTEND_PROD_RELEASE_ID=8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65 npm run synth:prod` passed.
  - `FRONTEND_PROD_RELEASE_ID=8ea322a8b3c01a6c53da51c3ccc12ad32c7fbe65 npm run diff:prod` showed the intended frontend additions: one `Custom::PortfolioFrontendAliasRecords`, its limited IAM policy for `route53:ChangeResourceRecordSets` on hosted zone `Z05088763QG63CC5SE7PN`, and the singleton custom-resource Lambda/role. No prod frontend `AWS::Route53::RecordSet` resources were introduced.

## 2026-06-19 00:13 Central Time

Dokploy decommission pass for migrated Lynx Portfolio production:

- Alec confirmed production works and requested removing unneeded Dokploy resources while deferring security/credential cleanup until final closure.
- Route53 showed `lynxpardelle.com`, `www.lynxpardelle.com`, `api.lynxpardelle.com`, and `assets.lynxpardelle.com` already pointed to AWS targets.
- Dokploy project `lynxpardelle` production resources were stopped and deleted:
  - Application `Frontend` / `lynxpardelle-frontend-3iktug`
  - Compose `API` / `lynxpardelle-api-6qfe2b`
  - Compose `DB` / `lynxpardelle-db-djvthu`
- `compose.delete` used `deleteVolumes: false` because the local `C:\Users\lince\Downloads\dump` check found only 5 files totaling 2295 bytes; retained data volumes should be handled during final EC2 retirement after explicit backup confirmation.
- Post-delete Dokploy verification showed project `lynxpardelle` environment `production` with `applications: []` and `composes: []`.
- Post-delete container lookup returned `count: 0` for all three removed app names.
- Post-delete production checks returned `200` for `https://lynxpardelle.com/`, `https://www.lynxpardelle.com/`, and `https://api.lynxpardelle.com/health`.
- EC2 `LynxServer` was intentionally not stopped or terminated because Route53 still has `dokploy.lynxpardelle.com`, `alecfest-voliii.lynxpardelle.com`, `music.lynxpardelle.com`, and `origin.pantrylist.lynxpardelle.com` pointing to `32.195.120.158`.
- Dokploy API responses can include sensitive integration values. Do not persist raw responses; rotate/revoke temporary Dokploy and unused GitHub app credentials during final security closure.

Detailed report:

- `docs/dokploy-decommission-report.md`

## 2026-06-19 00:23 Central Time

EC2 retirement inventory after Lynx Portfolio Dokploy cleanup:

- Created `docs/ec2-retirement-inventory.md` for the remaining blockers to terminating `LynxServer`.
- EC2 `i-061f471ff5edea8a9` is still `running` as `t3.medium` with public IP `32.195.120.158`, security group `LynxSG`, and unencrypted `120` GB `gp3` volume `vol-0bd5f763909f1383b`.
- Route53 in this AWS account still has 22 A records pointing to `32.195.120.158`, mostly ZoolandingPage aliases plus `dokploy.lynxpardelle.com`, `music.lynxpardelle.com`, `alecfest-voliii.lynxpardelle.com`, and `origin.pantrylist.lynxpardelle.com`.
- Public DNS also showed `moyra.org`, `www.moyra.org`, and `test.moyra.org` resolving to `32.195.120.158`; those zones were not present in this AWS account's Route53 hosted zones.
- Remaining active Dokploy resources are:
  - PantryList compose `compose-compress-back-end-port-hiewlq`
  - Moyra frontends `moyra-test-frontend-zjuuts` and `moyra-production-frontend-qoiyw0`
  - ZoolandingPage apps `zoolandingpage-test-m6uwhf` and `zoolandingpage-git-repo-app-sacivw`
- Container lookup showed PantryList, Moyra, and ZoolandingPage still have running healthy containers, so the EC2 must not be stopped yet.
- Recommended migration order: Moyra frontend SSR first, PantryList second, ZoolandingPage third, then final Dokploy/EC2/security closure.

## 2026-06-19 05:09 Central Time

Final frontend polish release and production closeout:

- Frontend PR `LynxPardelle/lynx-portfolio-angular#8` merged to `main` at `2026-06-19T10:57:01Z` with merge commit `be6edffb6924cdb3f674798b0571b92b516cea8a`.
- Main Angular validate run `27821610613` completed with `success`.
- SSR artifact publish runs for release `be6edffb6924cdb3f674798b0571b92b516cea8a` completed with `success`:
  - `dev`: `27821610622`
  - `tst`: `27821672042`
  - `prod`: `27821672059`
- S3 artifact manifests existed for `dev`, `tst`, and `prod`; each environment had 51 objects and `server/ssr-handler.zip` size `19975234` bytes.
- GitHub Environment variable `FRONTEND_RELEASE_ID` was set to `be6edffb6924cdb3f674798b0571b92b516cea8a` for `dev`, `tst`, and `prod`.
- Infra deploy runs completed with `success`:
  - `dev`: `27821785680`
  - `tst`: `27821917590`
  - `prod`: `27822046065`
- Final route smoke for `https://lynxpardelle.com`, `/book`, `/webs`, `/cv`, `/music`, `/reel`, and `/blog` returned HTTP `200`, had no `api/main/get-file/` string, and referenced `assets.lynxpardelle.com`.
- Root HTML script audit returned `htmlHasGetFile: false`, `scriptCount: 4`, and `scriptsWithGetFile: []`.
- API smoke for `/health`, `/api/main/main`, `/api/main/book-imgs`, `/api/main/songs`, `/api/main/videos`, `/api/main/web-sites`, `/api/main/cv-sections`, and `/api/article/articles/1/5/_id/all/all` returned HTTP `200` with no `api/main/get-file/` strings.
- Browser runtime audit through system Chrome returned `LynxPortfolio`, `0` page errors, and `0` `NotAllowedError` matches for the final release.
- The final migration closeout report was added at `docs/migration-closeout-report.md`; it includes release evidence, live smoke evidence, Dokploy cleanup state, remaining security/ops closure items, EC2 retirement blockers, and a reusable Dokploy-to-AWS migration playbook.
- `docs/current-state.md` was marked as a historical pre-migration snapshot to avoid confusing future agents with superseded DNS/API evidence.
- Security closure remains deferred by owner decision: rotate old app/database/S3 credentials, revoke the temporary Dokploy API key, review any Dokploy/GitHub integration credentials, review retained Docker/Mongo volumes, and retire `LynxServer` only after remaining PantryList/Moyra/ZoolandingPage dependencies are moved or abandoned.

## 2026-06-20 Central Time

Non-blocking API/CSP cleanup:

- Branch: `work/nonblocking-api-security-cleanup`.
- Public media payloads no longer expose raw S3 `location` or `s3Url` fields for `files` documents by default.
- `GET /api/main/file-info/{id}` no longer returns `s3Url`; it preserves `cdnUrl`, `s3Key`, checksums, metadata, and timestamps.
- `GET /api/main/get-file/{id}` keeps compatibility redirect behavior with this priority: `cdnUrl`, generated CDN URL from `s3Key`, raw `location`, then raw `s3Url`.
- File redirects are validated before returning HTTP 302: `https` only and host must be the configured assets CDN domain or the configured S3 bucket host. Untrusted migrated/admin URLs are ignored and fall through to the existing 404.
- Frontend CloudFront CSP no longer includes `'unsafe-inline'` in `script-src`.
- `style-src 'unsafe-inline'` intentionally remains because Angular/Ngx Angora runtime styles still need a separate nonce/style strategy before it can be removed safely.
- TDD evidence:
  - Focused infra red run first failed on raw S3 payload exposure, `file-info` `s3Url`, and `script-src 'unsafe-inline'`.
  - Focused green run passed after the cleanup.
- Validation passed:
  - Focused `npm test -- test/public-api.test.js test/foundation.test.js` exited 0 with 21/21 tests passing.
  - `npm test` exited 0 with 26/26 tests passing.
  - `npm run validate` exited 0 with `cdk synth`.
  - `npm audit --omit=dev` exited 0 with `found 0 vulnerabilities`.
  - `git diff --check` exited 0; it only reported expected Windows LF-to-CRLF working-copy warnings.

## 2026-06-20 01:32 Central Time

Non-blocking cleanup release closure:

- Frontend cleanup PR `LynxPardelle/lynx-portfolio-angular#10` merged to `main` with merge commit `4f8d254253f607146d7202c97b24858ae45fe0c8`.
- Infra cleanup PR `LynxPardelle/portfolioLynxPardelle-aws-infra#25` merged to `dev` with merge commit `9a4a1de82a0cf5036ddf8fbab9d03533da9f7d2e`.
- Frontend release `4f8d254253f607146d7202c97b24858ae45fe0c8` was published as SSR artifact for all environments:
  - `dev`: workflow run `27863792815`.
  - `tst`: workflow dispatch run `27863845805`.
  - `prod`: workflow dispatch run `27863845823`.
- GitHub Environment variable `FRONTEND_RELEASE_ID` was set to `4f8d254253f607146d7202c97b24858ae45fe0c8` for `dev`, `tst`, and `prod`.
- Infra deploy and promotion evidence:
  - `Deploy Dev` workflow dispatch run `27863877629` completed successfully after the environment variable update.
  - Promotion PR `#26` merged `dev` -> `tst` with merge commit `6377085b394a96f9bfa581f7afe8789cfc8fdf7d`.
  - `CDK validate` run `27863964120` and `Deploy Tst` run `27863964096` completed successfully.
  - Promotion PR `#27` merged `tst` -> `prod` with merge commit `b8e13e99f379836253019ecedbca8c87fba94a3c`.
  - `CDK validate` run `27864052977` and `Deploy Prod` run `27864052982` completed successfully.
- Production HTTP smoke after deploy returned HTTP `200` for:
  - `https://lynxpardelle.com/`
  - `https://www.lynxpardelle.com/`
  - `/book`, `/webs`, `/cv`, `/music`, `/reel`, and `/blog` on `https://lynxpardelle.com`
  - `/robots.txt`, `/sitemap.xml`, and `/manifest.webmanifest`
  - API endpoints `/health`, `/api/main/main`, `/api/main/book-imgs`, `/api/main/songs`, `/api/main/videos`, `/api/main/web-sites`, `/api/main/cv-sections`, and `/api/article/articles/1/5/_id/all/all`.
- Production CSP check on `https://lynxpardelle.com/webs`:
  - `script-src` no longer contains `'unsafe-inline'`.
  - `style-src` still contains `'unsafe-inline'` intentionally for the current Angular/Ngx Angora runtime style strategy.
- Public production body checks found no `/api/main/get-file/`, no `lynx-portfolio.s3`, no JSON `"location"` key, and no JSON `"s3Url"` key in the checked public media API payloads.
- No browser automation package was present in either repo for an additional Playwright/Puppeteer smoke during this closure; the recorded evidence for this pass is GitHub Actions plus direct production HTTP/CSP/API checks.

## 2026-06-20 Central Time

Security revocation readiness pass:

- Added `docs/security-revocation-runbook.md` with the safe order for revoking the temporary Dokploy API key, reviewing Dokploy/GitHub integrations, inactivating then deleting the old portfolio S3 IAM key candidate, invalidating old Mongo/JWT credentials, and verifying production after each step.
- Rechecked GitHub secrets and variables for `LynxPardelle/portfolioLynxPardelle-aws-infra` and `LynxPardelle/lynx-portfolio-angular`.
  - Repo-level secrets returned no rows for both repos.
  - Repo-level variables returned no rows for both repos.
  - Environment secrets for `dev`, `tst`, and `prod` returned no rows for both repos.
  - Environment variables are the expected OIDC/deploy values only: `AWS_REGION`, `AWS_ROLE_ARN`, and for infra `FRONTEND_RELEASE_ID`.
- Rechecked AWS identity as account `765932874577`, IAM user `ADMIN-AIM-CLI`.
- Active IAM key audit found:
  - `ADMIN-AIM-CLI` key suffix `SFPV3KVU`, active, last used 2026-06-20 01:32 Central Time for `ses` in `us-east-1`.
  - `LynxPortfolioUser` key suffix `U4VFGU3I`, active, last used 2026-06-18 02:09 Central Time for `s3` in `us-east-1`.
- Did not disable or delete AWS access keys in this pass because `ADMIN-AIM-CLI` is the active admin CLI credential and `LynxPortfolioUser` must be dependency-checked against remaining Dokploy/shared-project usage before inactivation.
- Did not delete GitHub OIDC environment variables because current deploy workflows require them and they are not static AWS secrets.
- Did not call the Dokploy API with the temporary key during this pass because revocation requires a key id and raw key handling should stay out of shell history/logs; the runbook gives the UI-first and API alternatives for Alec to revoke it safely.

## 2026-07-09 Central Time

Secrets Manager cost-reduction decision for Portfolio migration source placeholders:

- Scope from delegated AWS context: account `765932874577`, region `us-east-1`, existing Secrets Manager resources `portfolio-dev-migration-mongo-source`, `portfolio-tst-migration-mongo-source`, and `portfolio-prod-migration-mongo-source`, each tagged for `Project=portfolioLynxPardelle`, with `LastAccessedDate=null` and no rotation configured.
- Repo creation point before this change: `lib/stacks/data-stack.js` created `MigrationMongoSourceSecret` as `AWS::SecretsManager::Secret` named `portfolio-{env}-migration-mongo-source`.
- Repo read points found in this pass: no code path in `lib/`, `lambda/`, `scripts/`, or `test/` reads those migration source secrets through `secretsmanager:GetSecretValue`; Mongo backup docs still use shell-provided `MONGODB_URI` and do not read these placeholders.
- New creation point: `lib/stacks/data-stack.js` creates `/portfolio/{env}/migration/mongo-source` through a CDK `AwsCustomResource` call to `ssm:PutParameter` with `Type=SecureString`, `Tier=Standard`, and a non-sensitive placeholder value. CDK/CloudFormation cannot natively create SSM `SecureString`, so the custom resource is create-only, ignores `ParameterAlreadyExists`, and does not overwrite a later real migrated value.
- IAM decision: the custom resource role is limited to `ssm:PutParameter` and `ssm:AddTagsToResource` on the exact parameter ARN `arn:${Partition}:ssm:${Region}:${Account}:parameter/portfolio/{env}/migration/mongo-source`. No `secretsmanager:GetSecretValue` permission is introduced.
- KMS decision: no customer managed KMS key is created. Omitting `KeyId` uses the AWS managed Parameter Store key `alias/aws/ssm`; therefore no explicit `kms:Decrypt` grant is added in this migration. If a future customer managed key is chosen, readers must receive `ssm:GetParameter`/`ssm:GetParameters` on the exact parameter ARN plus `kms:Decrypt` on that key.
- Security tradeoff: SSM SecureString keeps encryption at rest and path-scoped IAM, but using `alias/aws/ssm` does not provide a customer-managed key policy boundary. This is acceptable for these low-use migration placeholders because the existing Secrets Manager resources had no rotation configured and no repo consumers; use a customer managed KMS key later if key-policy isolation becomes more important than the fixed monthly key cost.
- Cost expectation from AWS pricing checked during this change: Parameter Store standard parameters and standard throughput API interactions are listed at no additional charge; AWS managed KMS keys have no monthly key fee, though KMS request usage can still matter at scale. For these three low-use placeholders, expected fixed monthly parameter storage cost is `$0`; this removes the roughly `$1.20/month` Secrets Manager list-price share for 3 of the 7 secrets in the delegated context, plus any calls tied to those three secrets. The full account Secrets Manager line will not drop to `$0` unless the other four secrets are handled separately.
- Safe deployment and rollback: deploy `dev`, validate the SSM parameter exists and is `SecureString`, then promote `dev -> tst -> prod`. This change does not delete the existing Secrets Manager secrets. If rollback is needed, revert this CDK change and redeploy; the old Secrets Manager resources remain available because deletion is intentionally out of scope. After every consumer is confirmed on SSM, schedule old Secrets Manager secrets for deletion with a recovery window, preferably the default 30 days; AWS documents a minimum 7-day recovery window and allows restoring before the window ends.
- Validation command for this change: `npm test -- test/foundation.test.js` passed with 12/12 tests.
- Live AWS verification during this pass: `aws sts get-caller-identity` returned account `765932874577` as IAM user `LynxPortfolioUser`. Read-only `secretsmanager:list-secrets` and `ssm:DescribeParameters` checks failed with `AccessDeniedException`, so no additional live AWS secret/parameter state was verified in this pass.

## 2026-07-09 17:58 Central Time

Completed live AWS migration from Secrets Manager placeholders to SSM Parameter Store using profile `ADMIN-AIM-CLI`:

- `aws sts get-caller-identity --profile ADMIN-AIM-CLI` returned account `765932874577`, ARN `arn:aws:iam::765932874577:user/ADMIN-AIM-CLI`.
- Current CloudFormation templates before deployment had `MigrationMongoSourceSecret` with `DeletionPolicy: Delete` and `UpdateReplacePolicy: Delete` in `dev` and `tst`; `prod` already had `Retain`.
- Added one-time CDK safety flag `RETAIN_OLD_MIGRATION_SECRETS=true` so the first deployment keeps the legacy `AWS::SecretsManager::Secret` logical id but changes its policies to `Retain`.
- Phase 1 CDK diff showed:
  - Added `Custom::PortfolioSecureStringParameter`, provider log group, IAM role, Lambda, and policy.
  - Policy allowed only `ssm:PutParameter` and `ssm:AddTagsToResource` against each exact `/portfolio/{env}/migration/mongo-source` ARN.
  - `dev` and `tst` changed `DeletionPolicy` and `UpdateReplacePolicy` from `Delete` to `Retain`.
- Phase 1 deploy succeeded for:
  - `PortfolioDev/Portfolio-dev-Data`
  - `PortfolioTst/Portfolio-tst-Data`
  - `PortfolioProd/Portfolio-prod-Data`
- `aws ssm describe-parameters` verified:
  - `/portfolio/dev/migration/mongo-source`: `Type=SecureString`, `Tier=Standard`, `KeyId=alias/aws/ssm`, `Version=1`, `LastModifiedDate=2026-07-09T17:52:27.464000-06:00`.
  - `/portfolio/tst/migration/mongo-source`: `Type=SecureString`, `Tier=Standard`, `KeyId=alias/aws/ssm`, `Version=1`, `LastModifiedDate=2026-07-09T17:53:34.739000-06:00`.
  - `/portfolio/prod/migration/mongo-source`: `Type=SecureString`, `Tier=Standard`, `KeyId=alias/aws/ssm`, `Version=1`, `LastModifiedDate=2026-07-09T17:54:41.591000-06:00`.
- Tried to copy any existing current secret values without printing secret values. All three `aws secretsmanager get-secret-value` calls failed with `ResourceNotFoundException`: `Secrets Manager can't find the specified secret value for staging label: AWSCURRENT`. Therefore no real secret value was copied; SSM retains the non-sensitive placeholder value created by CDK.
- Phase 2 CDK diff without `RETAIN_OLD_MIGRATION_SECRETS` showed removal of `MigrationMongoSourceSecret` as `orphan` for `dev`, `tst`, and `prod`.
- Phase 2 deploy succeeded for all three Data stacks. CloudFormation events showed `DELETE_SKIPPED` for `MigrationMongoSourceSecret`, confirming the old secrets were retained rather than deleted by stack update.
- `aws cloudformation list-stack-resources` returned `[]` for logical resource id `MigrationMongoSourceSecret` in all three Data stacks, confirming CloudFormation no longer manages those secrets.
- Scheduled the old Secrets Manager resources for deletion with `--recovery-window-in-days 30`; `delete-secret` returned:
  - `portfolio-dev-migration-mongo-source`, ARN `arn:aws:secretsmanager:us-east-1:765932874577:secret:portfolio-dev-migration-mongo-source-aw0uPE`, `DeletionDate=2026-08-08T17:57:54.895000-06:00`.
  - `portfolio-tst-migration-mongo-source`, ARN `arn:aws:secretsmanager:us-east-1:765932874577:secret:portfolio-tst-migration-mongo-source-GWx0cZ`, `DeletionDate=2026-08-08T17:57:54.890000-06:00`.
  - `portfolio-prod-migration-mongo-source`, ARN `arn:aws:secretsmanager:us-east-1:765932874577:secret:portfolio-prod-migration-mongo-source-2lmuTY`, `DeletionDate=2026-08-08T17:57:54.894000-06:00`.
- Follow-up `describe-secret` and `list-secrets --include-planned-deletion` returned `DeletedDate` timestamps around `2026-07-09T17:57:54-06:00`, with `LastAccessedDate=null` and `RotationEnabled=null`. The AWS CLI returned both date fields exactly as recorded here; do not reinterpret them without rechecking AWS docs/API behavior.
- Recovery command if rollback is needed before final deletion:
  - `aws secretsmanager restore-secret --profile ADMIN-AIM-CLI --region us-east-1 --secret-id portfolio-dev-migration-mongo-source`
  - `aws secretsmanager restore-secret --profile ADMIN-AIM-CLI --region us-east-1 --secret-id portfolio-tst-migration-mongo-source`
  - `aws secretsmanager restore-secret --profile ADMIN-AIM-CLI --region us-east-1 --secret-id portfolio-prod-migration-mongo-source`
- Validation after AWS changes:
  - `npm test -- test/foundation.test.js` passed with 13/13 tests.
  - `npm run synth:dev` passed and printed `80 feature flags are not configured`.
  - `git diff --check` passed; only LF-to-CRLF warnings were printed for changed files.
  - Final `npx cdk diff "PortfolioDev/Portfolio-dev-Data" "PortfolioTst/Portfolio-tst-Data" "PortfolioProd/Portfolio-prod-Data" --profile ADMIN-AIM-CLI` returned `There were no differences` for all three stacks and `Number of stacks with differences: 0`.

## 2026-07-10 11:23 Central Time

Removed unnecessary SSM SecureString migration placeholders after confirming no code consumed the previous Secrets Manager placeholders:

- Repo search found no actual reader for `GetSecretValue`, `ssm:GetParameter`, `ssm:GetParameters`, or `/portfolio/{env}/migration/mongo-source`; the only Mongo credential path in repo docs remains shell-provided `MONGODB_URI`.
- Removed the CDK `AwsCustomResource`/Lambda/IAM/log group path that created `/portfolio/{env}/migration/mongo-source`.
- Removed current docs that described SSM SecureString migration placeholders as part of the intended foundation.
- Deployed the removal to:
  - `PortfolioDev/Portfolio-dev-Data`
  - `PortfolioTst/Portfolio-tst-Data`
  - `PortfolioProd/Portfolio-prod-Data`
- CloudFormation deleted the custom resources, provider Lambdas, IAM policies, and IAM roles. Dev/tst provider log groups were deleted by the stack; prod provider log group was retained by policy and then deleted manually.
- Deleted SSM parameters:
  - `/portfolio/dev/migration/mongo-source`
  - `/portfolio/tst/migration/mongo-source`
  - `/portfolio/prod/migration/mongo-source`
- Verification:
  - `aws ssm describe-parameters --profile ADMIN-AIM-CLI --region us-east-1 --parameter-filters Key=Name,Option=Contains,Values=/portfolio/ --query "Parameters[?contains(Name, 'migration/mongo-source')].{Name:Name,Type:Type,Tier:Tier}" --output json` returned `[]`.
  - `aws logs describe-log-groups --profile ADMIN-AIM-CLI --region us-east-1 --log-group-name-prefix /aws/lambda/portfolio-prod-ssm-secure-parameter-provider --query "logGroups[].logGroupName" --output json` returned `[]`.
  - `npx cdk diff "PortfolioDev/Portfolio-dev-Data" "PortfolioTst/Portfolio-tst-Data" "PortfolioProd/Portfolio-prod-Data" --profile ADMIN-AIM-CLI` returned `There were no differences` for all three stacks and `Number of stacks with differences: 0`.
  - `npm test -- test/foundation.test.js` passed with 12/12 tests.
  - `npm run synth:dev` passed and printed `80 feature flags are not configured`.
  - `git diff --check` passed; only LF-to-CRLF warnings were printed for changed files.
- Existing Secrets Manager resources remain scheduled for deletion from the previous step; do not restore them unless a real consumer is added before the recovery window ends.
