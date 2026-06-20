# Dokploy Decommission Report: Lynx Portfolio

Date: 2026-06-19 00:13 Central Time

## Scope

This report covers the Dokploy cleanup for the migrated Lynx Portfolio workload after production traffic was moved to AWS.

Deleted Dokploy resources were limited to the `lynxpardelle` project:

- Application `Frontend`: `jmDwju4WOxqKtAjn0giIn`
- Compose `API`: `F8SfTb07GP1xfI9OPMePc`
- Compose `DB`: `NJvbAQ0CCYxVYKB5nKWQO`

Not in scope:

- EC2 termination.
- Dokploy platform removal.
- Other Dokploy projects.
- Credential rotation or secret revocation, which Alec explicitly deferred until final closure.

## Pre-Delete Evidence

Route53 showed production Lynx Portfolio traffic already pointing to AWS:

- `lynxpardelle.com` A/AAAA alias: `d1h141iw0hg57g.cloudfront.net.`
- `www.lynxpardelle.com` A/AAAA alias: `d1h141iw0hg57g.cloudfront.net.`
- `api.lynxpardelle.com` A/AAAA alias: `d-dovq432mpb.execute-api.us-east-1.amazonaws.com.`
- `assets.lynxpardelle.com` A/AAAA alias: `d3g4a1zyvvyylm.cloudfront.net.`

The EC2-backed DNS records still present were not removed:

- `dokploy.lynxpardelle.com` -> `32.195.120.158`
- `alecfest-voliii.lynxpardelle.com` -> `32.195.120.158`
- `music.lynxpardelle.com` -> `32.195.120.158`
- `origin.pantrylist.lynxpardelle.com` -> `32.195.120.158`

Production checks before deletion:

- `https://lynxpardelle.com/`: `200`, served through CloudFront.
- `https://www.lynxpardelle.com/`: `200`, served through CloudFront.
- `https://api.lynxpardelle.com/health`: `200`, body:

```json
{"status":"ok","app":"lynx-portfolio-back","timestamp":"2026-06-19T06:11:57.124Z","storage":{"mode":"s3-only","bucket":"lynx-portfolio","region":"us-east-1","cdnDomain":"assets.lynxpardelle.com"}}
```

Dokploy inventory before deletion:

| Resource | Type | App name | Source repo | Branch | Domain |
| --- | --- | --- | --- | --- | --- |
| `Frontend` | application | `lynxpardelle-frontend-3iktug` | `lynx-portfolio-angular` | `main` | `lynxpardelle.com` |
| `API` | compose | `lynxpardelle-api-6qfe2b` | `portfolioLynxPardelle` | `main` | `api.lynxpardelle.com` |
| `DB` | compose | `lynxpardelle-db-djvthu` | `portfolioLynxPardelle` | `main` | none |

Docker container snapshot before deletion:

- `lynxpardelle-frontend-3iktug`: 3 containers matched; 2 `exited`, 1 `running` and healthy.
- `lynxpardelle-api-6qfe2b`: 0 containers matched.
- `lynxpardelle-db-djvthu`: 1 container matched; `running` and unhealthy.

Local backup check:

- Path checked: `C:\Users\lince\Downloads\dump`
- Result: path exists.
- File count: `5`
- Total size: `2295` bytes.

Because that local dump looked very small, compose deletion used `deleteVolumes: false`. A prior validated raw volume backup exists in S3 and local Codex output from the migration recovery work, but final data-volume destruction should still be explicit during EC2 retirement.

## Actions Performed

Stop actions:

- `application.stop` for `Frontend`: OK.
- `compose.stop` for `API`: OK.
- `compose.stop` for `DB`: OK.

Delete actions:

- `application.delete` for `Frontend`: OK.
- `compose.delete` for `API` with `deleteVolumes: false`: OK.
- `compose.delete` for `DB` with `deleteVolumes: false`: OK.

`deleteVolumes: false` was intentional so application metadata, routes, and containers are removed while avoiding irreversible data-volume destruction in this pass.

## Post-Delete Evidence

Dokploy project `lynxpardelle`, environment `production`, after deletion:

```json
{
  "projectId": "YfQYg-4tSBsohodK-u2kj",
  "name": "lynxpardelle",
  "environments": [
    {
      "environmentId": "xI1MHlQnOujS_uHyoVnqi",
      "name": "production",
      "applications": [],
      "composes": []
    }
  ]
}
```

Container verification after deletion:

- `lynxpardelle-frontend-3iktug`: `count: 0`
- `lynxpardelle-api-6qfe2b`: `count: 0`
- `lynxpardelle-db-djvthu`: `count: 0`

Production checks after deletion:

- `https://lynxpardelle.com/`: `200`, served through CloudFront.
- `https://www.lynxpardelle.com/`: `200`, served through CloudFront.
- `https://api.lynxpardelle.com/health`: `200`, body:

```json
{"status":"ok","app":"lynx-portfolio-back","timestamp":"2026-06-19T06:13:35.841Z","storage":{"mode":"s3-only","bucket":"lynx-portfolio","region":"us-east-1","cdnDomain":"assets.lynxpardelle.com"}}
```

## Retained Resources

The EC2 instance was not stopped or terminated because Route53 still contains non-portfolio records pointing to `32.195.120.158`:

- `dokploy.lynxpardelle.com`
- `alecfest-voliii.lynxpardelle.com`
- `music.lynxpardelle.com`
- `origin.pantrylist.lynxpardelle.com`

Other Dokploy projects were intentionally retained:

- `PantryList`
- `Moyra`
- `zoolandingpage`

Potential leftover Docker volumes were intentionally retained by using `deleteVolumes: false`. They should be reviewed and deleted during the final EC2 retirement pass after each remaining project has been migrated or explicitly abandoned.

## Security Notes

- The temporary Dokploy API key remains available because Alec explicitly requested not to rotate or revoke credentials until final closure.
- Dokploy API responses can include sensitive integration fields, including GitHub app credentials. Do not store raw Dokploy API responses in repo files, PRs, issue comments, or logs.
- Final closure should include revoking the temporary Dokploy API key, removing unused Dokploy GitHub integrations/webhooks, rotating any credentials exposed through Dokploy responses, and deleting old Mongo/Dokploy data volumes once backups are confirmed.

## Reusable Procedure For Other Dokploy Projects

Use this pattern for each remaining project on the EC2 host.

1. Confirm replacement production traffic.
   - Check Route53 for the exact production hostnames.
   - Verify the replacement host returns healthy responses from AWS or the new target.
   - Keep a before/after probe log.

2. Inventory Dokploy with redacted projections only.
   - List projects and environments.
   - For each candidate app/compose, collect only IDs, names, app names, source repo, branch, domains, and status.
   - Do not print or persist `env`, `password`, `refreshToken`, private keys, webhooks, build secrets, or provider credentials.

3. Confirm backups.
   - Prefer a logical backup plus raw volume backup for databases.
   - Validate that the backup contains application collections or equivalent application data, not only admin metadata.
   - If backup evidence is incomplete, avoid `deleteVolumes: true`.

4. Stop before delete.
   - Applications: `application.stop`, then `application.delete`.
   - Compose resources: `compose.stop`, then `compose.delete`.
   - For database compose resources, use `deleteVolumes: false` unless backup validation and final destruction are explicitly approved.

5. Verify cleanup.
   - Re-query `project.all` and confirm the target project no longer has the deleted apps/composes.
   - Use `docker.getContainersByAppNameMatch` for every removed `appName` and confirm `count: 0`.
   - Re-test production URLs.

6. Final EC2 retirement pass.
   - Re-check Route53 for every record still pointing to the EC2 public IP.
   - Migrate or remove each remaining service.
   - Delete retained volumes and host paths only after every owner/project has signed off.
   - Rotate/revoke Dokploy, GitHub app, database, and app credentials.
   - Terminate EC2 only when no DNS, jobs, data, or project dependencies remain.

## References

- Dokploy API authentication uses `x-api-key`: https://docs.dokploy.com/docs/api
- Dokploy Application API includes `application.stop` and `application.delete`: https://docs.dokploy.com/docs/api/application
- Dokploy Compose API includes `compose.stop` and `compose.delete`: https://docs.dokploy.com/docs/api/reference-compose
- Dokploy Docker API includes container lookup endpoints: https://docs.dokploy.com/docs/api/reference-docker
- Relevant Dokploy issue about stopping before compose deletion: https://github.com/Dokploy/dokploy/issues/4064
