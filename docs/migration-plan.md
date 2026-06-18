# Migration Plan

## Preconditions

1. Rotate credentials detected in tracked env files in the old public repo.
2. Confirm final API domains:
   - `api.dev.lynxpardelle.com`
   - `api.tst.lynxpardelle.com`
   - `api.lynxpardelle.com`
3. Decide whether to keep `assets.lynxpardelle.com` on the existing CloudFront distribution or create a new CDK-managed distribution.
4. Export a recent MongoDB backup before any migration test.

## Data Migration

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
s3://portfolio-{env}-migration/mongo-export/{timestamp}/{collection}.json
```

### Transform

Transform ObjectIds into stable string ids and preserve references as strings. Store original ObjectIds in `legacyMongoId` fields until all references are validated.

### Import

Use idempotent import:

- Put items with deterministic primary keys.
- Store import batch id.
- Record item count and checksum per collection.
- Refuse prod import if source and target counts do not match expected values.

## API Migration

1. Implement public read endpoints first.
2. Run contract tests comparing old API responses with new API responses.
3. Implement admin write endpoints.
4. Implement media upload flow.
5. Implement auth migration.
6. Freeze old writes briefly for final production import.
7. Cut DNS/API custom domain to new API.

## Rollback

Keep rollback simple:

- Before DNS cutover: switch test clients back to old API.
- After DNS cutover: restore Route53 alias/custom domain mapping to old endpoint if needed.
- For data: keep MongoDB unchanged until new prod is verified.
- For Lambda: use versions/aliases and roll back alias to prior version.
- For DynamoDB: enable point-in-time recovery in prod.

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
