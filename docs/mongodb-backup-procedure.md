# MongoDB Backup Procedure

Generated: 2026-06-18 Central Time

## Purpose

Create a repeatable backup before any migration test from MongoDB to DynamoDB. The backup is required because the live `https://api.lynxpardelle.com` endpoint is not a reliable source of truth; migration validation depends on the current database state.

## Rules

- Do not store MongoDB credentials in this repo.
- Do not commit backup files.
- Store backup output outside application repositories.
- Record evidence in `Codex.md` after a real backup: timestamp, source target, collections, output path, S3 export prefix if uploaded, and restore command.
- Do not rotate credentials until final cleanup/cutover, per current migration decision.

## Required Tools

- `mongodump`
- `mongorestore`
- AWS CLI only if uploading export artifacts to S3
- Node.js dependencies from this repo for dump inspection/export.

## Local Backup Command Template

Use PowerShell with the MongoDB URI supplied only through the current shell environment:

```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "C:\Users\lince\Documents\Codex\Output\portfolioLynxPardelle-mongodb-backups"
$backupPath = Join-Path $backupRoot $timestamp
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

if (-not $env:MONGODB_URI) {
  throw "MONGODB_URI is required in the current shell environment."
}

mongodump --uri="$env:MONGODB_URI" --out="$backupPath"
```

The `Output` location follows Alec's preference for generated artifacts. Do not place backups inside `portfolioLynxPardelle` or `portfolioLynxPardelle-aws-infra`.

## Collection Checklist

The backup should include collections corresponding to these models:

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

If any collection is missing, record it explicitly before continuing.

Use the repo guardrail before any DynamoDB export:

```powershell
npm run migration:inspect -- --dump C:\Users\lince\Downloads\dump
```

If the output only contains `admin.system.users` and `admin.system.version`, the backup was taken from the admin database only and cannot be used for Portfolio content migration. Re-run `mongodump` against the application database, or omit `--db admin` if the source URI already points at the correct database.

## Optional Export Artifact Upload

After creating sanitized JSON exports for migration tests, store them under the existing media bucket:

```text
s3://lynx-portfolio/migration/portfolio-{env}/mongo-export/{timestamp}/
```

This prefix reuses the current bucket without creating a new media bucket.

## Restore Command Template

Use only against an intentional restore target:

```powershell
if (-not $env:MONGODB_RESTORE_URI) {
  throw "MONGODB_RESTORE_URI is required in the current shell environment."
}

mongorestore --uri="$env:MONGODB_RESTORE_URI" "C:\path\to\backup\database-name"
```

## Validation

- Backup directory exists outside app repos.
- Expected collections are present.
- Restore command is documented but not run against production.
- `Codex.md` is updated with backup evidence after the real backup.
