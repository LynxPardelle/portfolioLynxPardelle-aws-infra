# Migration Plan

## Preconditions

1. Accept the temporary risk that credentials detected in tracked env files in the old public repo will not be rotated until the migration is otherwise complete and the final cleanup/cutover window starts.
2. Confirm final API domains:
   - `api.dev.lynxpardelle.com`
   - `api.tst.lynxpardelle.com`
   - `api.lynxpardelle.com`
3. Keep `assets.lynxpardelle.com` on the existing CloudFront distribution unless Alec explicitly approves a replacement later.
4. Reuse the existing `lynx-portfolio` S3 bucket for media assets.
5. Export a recent MongoDB backup before any migration test.
6. Treat the current `https://api.lynxpardelle.com` endpoint as non-working. Do not use it as the parity source or rollback target.

## Data Migration

### Backup

Before any migration test, create a MongoDB backup from the current source database and store the backup outside the application repository. Record the backup timestamp, source connection target, collection list, and restore command in `Codex.md`.

Current backup check:

- Alec reported backup location: `C:\Users\lince\Downloads\dump`.
- `npm run migration:inspect -- --dump C:\Users\lince\Downloads\dump` currently finds only `admin.system.users` and `admin.system.version`.
- That dump is not sufficient for Portfolio data migration because it does not include the required application collections listed below.

### Export

Build a one-time exporter against the current MongoDB source:

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

Write versioned JSON files to S3:

```text
s3://lynx-portfolio/migration/portfolio-{env}/mongo-export/{timestamp}/{collection}.json
```

### Transform

Transform ObjectIds into stable string ids and preserve references as strings. Store original ObjectIds in `legacyMongoId` fields until all references are validated.

Local transform/export command:

```powershell
npm run migration:export -- --dump C:\Users\lince\Downloads\dump --env dev --out C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-dynamodb-import\{batch}
```

The export command refuses to write output unless all required application collections are present.

### Import

Use idempotent import:

- Put items with deterministic primary keys.
- Store import batch id.
- Record item count and checksum per collection.
- Refuse prod import if source and target counts do not match expected values.

## API Migration

1. Reverse-engineer the route contract from the old Express app, controllers, models, middleware, and services.
2. Build local contract fixtures from backed-up MongoDB data and existing S3 file metadata.
3. Implement public read endpoints first.
4. Run contract tests comparing the new serverless implementation against the reverse-engineered contract and fixtures.
5. Implement admin write endpoints.
6. Implement media upload flow against the existing `lynx-portfolio` bucket.
7. Implement auth migration or replacement.
8. Freeze old writes briefly only if the old backend is still accepting writes at that point.
9. Point DNS/API custom domain `api.lynxpardelle.com` to the new API.

## Rollback

The current public API endpoint is not working, so there is no active monolith rollback target to preserve.

- Before DNS cutover: continue testing on `api.tst.lynxpardelle.com` or raw API Gateway endpoints.
- After DNS cutover: rollback means redeploying the last known-good serverless stack or Lambda version, not routing back to the current monolith.
- For data: keep the MongoDB backup and export artifacts until DynamoDB import is verified.
- For Lambda: use versions/aliases where useful and roll back alias to prior serverless version.
- For DynamoDB: enable point-in-time recovery in prod.
- For media: keep the existing S3 bucket and CloudFront distribution as the stable source of truth during migration.

## Verification

Minimum checks per environment:

- `npm run synth:{env}` succeeds.
- CDK diff is reviewed.
- Public content API parity test passes.
- Admin auth rejects unauthenticated writes.
- Admin CRUD smoke test passes.
- Upload creates S3 object and file metadata.
- CloudFront serves uploaded asset over HTTPS.
- CloudWatch alarms exist and are not in alarm state after smoke.
- No direct branch push is possible on protected branches.
- `https://api.lynxpardelle.com/health` returns from the new serverless API after production cutover.
