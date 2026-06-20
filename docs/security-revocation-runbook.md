# Security Revocation Runbook

Date: 2026-06-20 Central Time

This runbook closes the credential-rotation debt that was intentionally deferred during the Lynx Portfolio migration. It favors staged revocation over broad deletion because the Dokploy EC2 instance and AWS account still host or support other projects.

Do not paste API keys, secret access keys, database passwords, JWT secrets, raw Dokploy API responses, or full AWS access key IDs into issue comments, pull requests, docs, terminal transcripts, or chat.

## Current State

- Lynx Portfolio production is served by AWS, not by the old Dokploy resources.
- The Dokploy `lynxpardelle` production application and compose resources were already deleted with `deleteVolumes: false`.
- The shared Dokploy/EC2 platform still has other projects and must not be stopped as part of this portfolio-only closure.
- GitHub Actions for the infra and frontend repos use OIDC role variables. Those variables are deploy configuration, not static credentials.
- The temporary Dokploy API key should be revoked now that portfolio production is stable, but the key value itself must not be copied into command history or documentation.

## Safe Actions Already Checked

The following checks were run on 2026-06-20 Central Time:

- `LynxPardelle/portfolioLynxPardelle-aws-infra` repo-level GitHub secrets: no rows returned.
- `LynxPardelle/portfolioLynxPardelle-aws-infra` repo-level GitHub variables: no rows returned.
- `LynxPardelle/portfolioLynxPardelle-aws-infra` environment secrets for `dev`, `tst`, and `prod`: no rows returned.
- Infra environment variables are only the expected OIDC/deploy values:
  - `AWS_REGION`
  - `AWS_ROLE_ARN`
  - `FRONTEND_RELEASE_ID`
- `LynxPardelle/lynx-portfolio-angular` repo-level GitHub secrets: no rows returned.
- `LynxPardelle/lynx-portfolio-angular` repo-level GitHub variables: no rows returned.
- `LynxPardelle/lynx-portfolio-angular` environment secrets for `dev`, `tst`, and `prod`: no rows returned.
- Frontend environment variables are only the expected OIDC/deploy values:
  - `AWS_REGION`
  - `AWS_ROLE_ARN`
- Current AWS CLI identity returned account `765932874577` and user `ADMIN-AIM-CLI`.
- Active IAM access keys found during the audit:
  - `ADMIN-AIM-CLI`, suffix `SFPV3KVU`, active, last used 2026-06-20 01:32 Central Time for `ses` in `us-east-1`.
  - `LynxPortfolioUser`, suffix `U4VFGU3I`, active, last used 2026-06-18 02:09 Central Time for `s3` in `us-east-1`.
- The old backend `.env` in the legacy repo contains real-looking Mongo, JWT, and S3 values. Do not copy them into this repo. Treat them as exposed and rotate or invalidate them during final closure.

## Do Not Revoke Yet

Do not revoke or delete these items without a separate dependency check:

- `ADMIN-AIM-CLI` access key suffix `SFPV3KVU`.
  - Reason: it is the active admin CLI credential and was recently used.
- GitHub Environment variables `AWS_ROLE_ARN`, `AWS_REGION`, and `FRONTEND_RELEASE_ID`.
  - Reason: current deploy and artifact promotion workflows require them.
- Shared Dokploy/EC2 resources outside the deleted `lynxpardelle` app/composes.
  - Reason: PantryList, Moyra, and ZoolandingPage still had retained dependencies in the EC2 retirement inventory.
- Retained Docker/Mongo volumes.
  - Reason: they were intentionally kept with `deleteVolumes: false`; delete only after backup validation and owner approval.

## Revocation Order

### 1. Baseline Before Revocation

Run these checks before disabling anything:

```powershell
Invoke-WebRequest https://lynxpardelle.com/ -UseBasicParsing
Invoke-WebRequest https://www.lynxpardelle.com/ -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/health -UseBasicParsing
```

Verify assets through the live site pages and media API payloads instead of requiring the CDN root path to return HTTP 200.

Check the latest GitHub runs:

```powershell
gh run list --repo LynxPardelle/portfolioLynxPardelle-aws-infra --limit 10
gh run list --repo LynxPardelle/lynx-portfolio-angular --limit 10
```

### 2. Revoke The Temporary Dokploy API Key

Preferred path: use the Dokploy UI.

1. Open the Dokploy dashboard as the owner/admin.
2. Go to the profile or API key settings page.
3. Locate the temporary key that was created for this migration inspection.
4. Delete only that temporary key.
5. Do not delete shared Dokploy provider credentials until the remaining Dokploy projects have been inventoried.

API path, only if the key ID is known and the command can be run without logging the key value:

```powershell
$headers = @{ "x-api-key" = $env:DOKPLOY_ADMIN_API_KEY }
$body = @{ apiKeyId = "<dokploy-api-key-id>" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://<dokploy-host>/api/user.deleteApiKey" -Headers $headers -ContentType "application/json" -Body $body
```

Verification:

- Calling a harmless Dokploy endpoint with the revoked temporary key should fail with unauthorized or forbidden status.
- Calling the same endpoint with an owner-approved active admin key should still work.
- Lynx Portfolio production should still return HTTP 200.

### 3. Review Dokploy GitHub Integrations

In Dokploy, inspect Git provider/integration settings and project-level webhooks.

Remove or rotate only integrations that are exclusive to the retired Lynx Portfolio Dokploy deployment. If a GitHub app, deploy key, webhook secret, or provider token is shared by PantryList, Moyra, or ZoolandingPage, keep it until those projects have moved or have their own replacement credentials.

Do not store raw Dokploy API responses while doing this review because Dokploy responses can include sensitive integration fields.

### 4. Inactivate The Old Portfolio S3 IAM Key Candidate

The `LynxPortfolioUser` access key suffix `U4VFGU3I` is the candidate old S3 application key. It should be inactivated first, not deleted first.

Before changing it:

1. Confirm no current GitHub Actions workflows use static AWS access keys.
2. Confirm no remaining Dokploy/PantryList/Moyra/ZoolandingPage scripts use `LynxPortfolioUser`.
3. Confirm current AWS-hosted Lynx Portfolio media and SSR access are not using this IAM user.
4. Keep a current production smoke-test log.

Then disable the key:

```powershell
aws iam update-access-key --user-name LynxPortfolioUser --access-key-id <full-access-key-id> --status Inactive
```

Wait through a monitoring window. Recommended minimum:

- Immediate smoke test after disabling.
- Another smoke test after 1 hour.
- Another smoke test after 24 hours.
- Review AWS access-key last-used data and relevant application logs.

If anything breaks, reactivate the same key while the dependency is investigated:

```powershell
aws iam update-access-key --user-name LynxPortfolioUser --access-key-id <full-access-key-id> --status Active
```

After the monitoring window passes with no dependent usage, delete the key:

```powershell
aws iam delete-access-key --user-name LynxPortfolioUser --access-key-id <full-access-key-id>
```

### 5. Invalidate Old Mongo And App Secrets

The old MongoDB and JWT values in the legacy backend should be treated as exposed. Since the old Dokploy portfolio app/composes were deleted and the new AWS architecture uses DynamoDB/API Gateway/Lambda, these values do not need to remain usable for production portfolio traffic.

Safe closure path:

1. Confirm the backup in `C:\Users\lince\Downloads\dump` or the owner-approved backup location is complete and readable.
2. Confirm no rollback requirement remains.
3. If the retained Mongo volumes will be kept for archival reasons, restrict access and do not run the old app against them.
4. If the retained Mongo volumes are not needed, delete them during the final EC2/Dokploy cleanup window.
5. If a Mongo instance is ever restarted from those volumes before deletion, rotate users/passwords inside Mongo before exposing the service.

### 6. Recheck GitHub Secrets

These repos currently showed no GitHub secrets, but recheck after each cleanup pass:

```powershell
gh secret list --repo LynxPardelle/portfolioLynxPardelle-aws-infra
gh secret list --repo LynxPardelle/lynx-portfolio-angular
gh secret list --repo LynxPardelle/portfolioLynxPardelle-aws-infra --env dev
gh secret list --repo LynxPardelle/portfolioLynxPardelle-aws-infra --env tst
gh secret list --repo LynxPardelle/portfolioLynxPardelle-aws-infra --env prod
gh secret list --repo LynxPardelle/lynx-portfolio-angular --env dev
gh secret list --repo LynxPardelle/lynx-portfolio-angular --env tst
gh secret list --repo LynxPardelle/lynx-portfolio-angular --env prod
```

Do not delete the OIDC environment variables unless the deploy workflow has been replaced.

### 7. Final Production Verification

After every revocation step, verify:

```powershell
Invoke-WebRequest https://lynxpardelle.com/ -UseBasicParsing
Invoke-WebRequest https://lynxpardelle.com/book -UseBasicParsing
Invoke-WebRequest https://lynxpardelle.com/webs -UseBasicParsing
Invoke-WebRequest https://lynxpardelle.com/cv -UseBasicParsing
Invoke-WebRequest https://lynxpardelle.com/music -UseBasicParsing
Invoke-WebRequest https://lynxpardelle.com/reel -UseBasicParsing
Invoke-WebRequest https://lynxpardelle.com/blog -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/health -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/api/main/main -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/api/main/book-imgs -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/api/main/songs -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/api/main/videos -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/api/main/web-sites -UseBasicParsing
Invoke-WebRequest https://api.lynxpardelle.com/api/main/cv-sections -UseBasicParsing
```

If any critical route fails after an IAM key is inactivated, reactivate the key and investigate the dependency before deleting anything.

## Public References

- Dokploy API authentication uses `x-api-key`: https://docs.dokploy.com/docs/api
- Dokploy API key deletion endpoint: https://docs.dokploy.com/docs/api/reference-user
- GitHub personal access token management and deletion: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- AWS IAM access key update command: https://docs.aws.amazon.com/cli/latest/reference/iam/update-access-key.html
- AWS IAM access key delete command: https://docs.aws.amazon.com/cli/latest/reference/iam/delete-access-key.html
- AWS IAM access key list command: https://docs.aws.amazon.com/cli/latest/reference/iam/list-access-keys.html
