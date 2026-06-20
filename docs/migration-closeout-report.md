# Lynx Portfolio AWS Migration Closeout Report

Date: 2026-06-19 04:54 Central Time

Updated: 2026-06-20 Central Time for non-blocking API/CSP cleanup.

## Verdict

The Lynx Portfolio migration is complete for the portfolio workload:

- `https://lynxpardelle.com` and `https://www.lynxpardelle.com` serve the Angular SSR frontend from AWS CloudFront + Lambda.
- `https://api.lynxpardelle.com` serves the public API from AWS API Gateway + Lambda.
- Runtime media is served from `https://assets.lynxpardelle.com`.
- The old Dokploy `lynxpardelle` project application and compose resources were removed.

Closeout is not fully security-clean until Alec approves the deferred security closure:

- Rotate old exposed or potentially exposed application credentials.
- Revoke the temporary Dokploy API key.
- Review and rotate any Dokploy/GitHub integration credentials exposed through Dokploy responses.
- Review retained Docker/Mongo volumes before deletion.
- Complete the larger EC2 retirement after PantryList, Moyra, and ZoolandingPage dependencies are migrated or explicitly abandoned.

## Release Evidence

Final frontend release now serving production:

- Front repo PR: `LynxPardelle/lynx-portfolio-angular#8`
- Merge commit: `be6edffb6924cdb3f674798b0571b92b516cea8a`
- Merged at: `2026-06-19T10:57:01Z`
- Main Angular validate run: `27821610613`, result `success`

This final release includes the prior assets-CDN migration from PR `#7` plus the follow-up production polish for caught autoplay errors, fixed-footer bottom clearance, and filtered Angora class updates.

Follow-up non-blocking cleanup prepared on 2026-06-20:

- Public API media payloads stop exposing raw S3 `location` fields by default.
- Public API media payloads stop exposing raw `s3Url` fields by default.
- `GET /api/main/file-info/{id}` stops exposing `s3Url`.
- `GET /api/main/get-file/{id}` keeps compatibility redirect behavior and can still use raw S3 metadata internally as a final fallback after `cdnUrl` and generated CDN URLs from `s3Key`.
- File redirects are validated before returning HTTP 302: `https` only and host must be the configured assets CDN domain or configured S3 bucket host.
- Frontend CSP removes `'unsafe-inline'` from `script-src`.
- `style-src 'unsafe-inline'` remains intentionally until Angular/Ngx Angora runtime styles are moved to a nonce or equivalent safer style strategy.

Frontend SSR artifacts for `be6edffb6924cdb3f674798b0571b92b516cea8a`:

| Environment | Workflow run | Result |
| --- | ---: | --- |
| `dev` | `27821610622` | `success` |
| `tst` | `27821672042` | `success` |
| `prod` | `27821672059` | `success` |

Infra deploys for the same frontend release:

| Environment | Workflow run | Result |
| --- | ---: | --- |
| `dev` | `27821785680` | `success` |
| `tst` | `27821917590` | `success` |
| `prod` | `27822046065` | `success` |

GitHub Environment variable check:

- `dev`, `tst`, and `prod` all had `FRONTEND_RELEASE_ID` set to `be6edffb6924cdb3f674798b0571b92b516cea8a`.
- Environment secret lists returned `[]`.
- Repo-level secret and variable lists returned no rows.

S3 artifact check:

- Each environment prefix had 51 objects.
- `manifest.json` existed for all environments.
- SSR zip existed for all environments.
- SSR zip size was `19975234` bytes in each environment.

## Production Smoke Evidence

Production route smoke for the final release returned HTTP `200`, no `api/main/get-file/` strings, and `assets.lynxpardelle.com` references for:

- `https://lynxpardelle.com/`
- `https://lynxpardelle.com/webs`
- `https://lynxpardelle.com/cv`
- `https://lynxpardelle.com/book`
- `https://lynxpardelle.com/music`
- `https://lynxpardelle.com/reel`
- `https://lynxpardelle.com/blog`

The production root HTML had `scriptCount: 4`, `htmlHasGetFile: false`, and `scriptsWithGetFile: []`.

API smoke for the final release returned HTTP `200` and no `api/main/get-file/` strings for:

- `https://api.lynxpardelle.com/health`
- `https://api.lynxpardelle.com/api/main/main`
- `https://api.lynxpardelle.com/api/main/book-imgs`
- `https://api.lynxpardelle.com/api/main/songs`
- `https://api.lynxpardelle.com/api/main/videos`
- `https://api.lynxpardelle.com/api/main/web-sites`
- `https://api.lynxpardelle.com/api/main/cv-sections`
- `https://api.lynxpardelle.com/api/article/articles/1/5/_id/all/all`

The production article endpoint returned exactly:

```json
{"status":"success","total_items":0,"pages":0,"articles":[]}
```

Security headers on `https://lynxpardelle.com/webs` were present:

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

## Assets And Data Audit

The 2026-06-19 post-change data/media audit found:

- `0` public API media objects with `_id` missing both `cdnUrl` and `location`.
- `0` `get-file` strings in public API JSON.
- `0` frontend runtime `get-file` references under `src/app` excluding specs.
- `77` raw S3-origin strings, all in `location` fields and all on media objects that also had `cdnUrl`.

Those raw S3 `location` fields were non-blocking because the frontend `assetUrl(file)` helper:

- Prefers `file.cdnUrl`.
- Rewrites `https://lynx-portfolio.s3.us-east-1.amazonaws.com` to `https://assets.lynxpardelle.com`.
- Returns an empty string instead of constructing legacy API `get-file` URLs when metadata is incomplete.

The 2026-06-20 API cleanup supersedes that residual observation by removing raw S3 `location` and `s3Url` fields from public `files` documents unless the request is the internal `get-file` compatibility redirect path.

Public API endpoint audit:

| Endpoint | HTTP | Result count | Media | Missing URL | `get-file` | Raw S3 |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `/main/main` | `200 OK` | `main` object | 4 | 0 | 0 | 4 |
| `/main/albums` | `200 OK` | `albums: 10` | 10 | 0 | 0 | 10 |
| `/main/book-imgs` | `200 OK` | `bookImgs: 22` | 22 | 0 | 0 | 22 |
| `/main/songs` | `200 OK` | `songs: 8` | 16 | 0 | 0 | 16 |
| `/main/videos` | `200 OK` | `videos: 4` | 1 | 0 | 0 | 1 |
| `/main/web-sites` | `200 OK` | `websites: 9` | 24 | 0 | 0 | 24 |
| `/main/cv-sections` | `200 OK` | `cvSections: 6` | 0 | 0 | 0 | 0 |
| `/article/article-cats` | `200 OK` | `articleCats: 1` | 0 | 0 | 0 | 0 |
| `/article/article-sub-cats` | `200 OK` | `articleSubCats: 1` | 0 | 0 | 0 | 0 |
| `/article/articles/1/5/_id/all/all` | `200 OK` | `articles: 0` | 0 | 0 | 0 | 0 |
| `/article/articles` | `200 OK` | `articles: 0` | 0 | 0 | 0 | 0 |

## Visual And SSR Audit

Production desktop and mobile checks covered:

- `/`
- `/book`
- `/webs`
- `/cv`
- `/music`
- `/reel`
- `/blog`

Findings:

- All routes returned HTTP `200` in direct fetch, desktop Chrome, and mobile Chrome.
- No route was blank-like.
- No route had crash markers.
- No `get-file` runtime requests were observed.
- Menu overlay was visible on desktop/mobile, had 6 rendered links, and did not reproduce the previous white-screen menu bug.
- `/cv` text/colors remained visible.
- `/blog` displayed `No hay artículos.` and did not show `Cargando...`.
- Language button was visible and non-transparent with background `rgb(255, 85, 85)` and color `rgb(0, 0, 0)`.

Non-blocking findings:

- Chrome reported an autoplay `NotAllowedError` from `playAudio`; this was handled in a follow-up frontend polish branch.
- Chrome reported canceled media loads for a WAV and MP4, but direct CDN `HEAD` checks returned `200 OK`.
- Mobile fixed audio controls overlapped some bottom-of-route content; this was handled in a follow-up frontend polish branch.

Visual evidence was saved locally outside tracked source as:

- `C:\Users\lince\Documents\GitHub\lynx-portfolio-angular\Output\prod-ssr-visual-audit-2026-06-19-04-41-30\audit-summary.json`
- `C:\Users\lince\Documents\GitHub\lynx-portfolio-angular\Output\prod-ssr-visual-audit-2026-06-19-04-41-30\console-detail.json`

Final runtime audit after release `be6edffb6924cdb3f674798b0571b92b516cea8a` found no blocking issues:

- Frontend routes `/`, `/book`, `/webs`, `/cv`, `/music`, `/reel`, `/blog`, and `https://www.lynxpardelle.com/` returned HTTP `200`.
- All requested API endpoints returned HTTP `200` with `application/json; charset=utf-8`.
- `api/main/get-file/` had `0` matches across checked HTML and API bodies.
- Browser first load through Playwright with system Chrome returned title `LynxPortfolio`, `0` page errors, and `0` `NotAllowedError` matches.
- Non-blocking observations from the 2026-06-19 final runtime audit were: raw S3 `location` values still accompanied CDN URLs in API payloads, browser console output was still noisy, two WAV requests were canceled with `net::ERR_ABORTED`, and CSP still included `'unsafe-inline'`.
- The 2026-06-20 cleanup addresses the app-owned browser console noise, raw S3 public payload fields, `file-info` `s3Url`, frontend media guards that depended on legacy `location`, and `script-src 'unsafe-inline'`. Remaining intentional security debt: `style-src 'unsafe-inline'` for Angular/Ngx Angora runtime style compatibility.

## AWS Resources Serving Production

Production frontend:

- CloudFront distribution: `E1LHE6N1FDU1U1`
- Distribution status: `Deployed`
- Enabled: `true`
- Aliases: `lynxpardelle.com`, `www.lynxpardelle.com`

Production API:

- API custom domain: `api.lynxpardelle.com`
- Regional domain: `d-dovq432mpb.execute-api.us-east-1.amazonaws.com`
- Endpoint type: `REGIONAL`
- TLS policy: `TLS_1_2`

Portfolio CloudFormation stacks were observed as `CREATE_COMPLETE` or `UPDATE_COMPLETE`.

## Dokploy Decommission Evidence

The Dokploy project `lynxpardelle` was cleaned up after production traffic moved to AWS.

Deleted Dokploy resources:

- Application `Frontend`: `jmDwju4WOxqKtAjn0giIn`
- Compose `API`: `F8SfTb07GP1xfI9OPMePc`
- Compose `DB`: `NJvbAQ0CCYxVYKB5nKWQO`

The detailed decommission evidence is in:

- `docs/dokploy-decommission-report.md`

Important safety note:

- `compose.delete` used `deleteVolumes: false`.
- Retained volumes must not be deleted until backup validation and owner signoff are complete.

## EC2 Retirement Blockers

Do not stop or terminate `LynxServer` yet.

Current blocker evidence:

- EC2 instance `i-061f471ff5edea8a9` is still `running`.
- Volume `vol-0bd5f763909f1383b` is unencrypted.
- Route53 still has 22 A records pointing to `32.195.120.158`.
- Remaining active Dokploy resources exist for PantryList, Moyra, and ZoolandingPage.

Detailed EC2 retirement inventory:

- `docs/ec2-retirement-inventory.md`

## Security And Operations Checklist

| Severity | Item | Status |
| --- | --- | --- |
| P0 | Portfolio serving from old Dokploy resources | Done; no P0 found |
| P1 | Rotate old tracked env/database/S3 credentials | Deferred; requires owner approval |
| P1 | Revoke temporary Dokploy API key | Deferred; requires owner approval |
| P1 | Rotate Dokploy/GitHub integration credentials exposed through Dokploy responses | Deferred; requires owner approval |
| P1 | Review retained Docker/Mongo volumes before deletion | Deferred; requires backup validation and owner signoff |
| P1 | Terminate `LynxServer` | Blocked by remaining non-portfolio projects and DNS records |
| P2 | Remove raw S3 `location` and `s3Url` from public API media payloads | Done in 2026-06-20 follow-up; `get-file` redirect fallback retained |
| P2 | Remove app-owned noisy frontend console diagnostics | Done in 2026-06-20 frontend follow-up |
| P2 | Remove CSP `script-src 'unsafe-inline'` | Done in 2026-06-20 infra follow-up |
| P2 | Remove CSP `style-src 'unsafe-inline'` | Deferred; requires Angular/Ngx Angora nonce or style strategy |
| P2 | Review old CloudFront `E10Y59XAIPQY6A` with no aliases | Later cleanup |
| P2 | Delete merged local frontend work branches | Safe after local branch refresh |
| P2 | Delete merged remote infra work branches | Requires owner confirmation |

## Reusable Dokploy-To-AWS Migration Playbook

Use this sequence for PantryList, Moyra, ZoolandingPage, or other Dokploy workloads.

1. Inventory current state.
   - Identify production domains, test domains, draft aliases, and API domains.
   - Identify Dokploy projects, apps, compose resources, source repos, branches, and app names.
   - Redact raw Dokploy responses because they can include secrets and provider credentials.

2. Confirm backups before deletion.
   - For databases, capture both logical backup and raw volume backup when possible.
   - Validate the backup contains application collections, not only admin metadata.
   - Do not delete volumes if backup evidence is incomplete.

3. Rebuild the backend on AWS.
   - Reverse engineer source routes and data models.
   - Use API Gateway + Lambda for small HTTP APIs.
   - Use DynamoDB when the data model is simple and access patterns are clear.
   - Reuse existing S3 media buckets only when ownership and policies are understood.

4. Rebuild the frontend hosting path.
   - Keep frontend source and infra repos separate.
   - Publish immutable SSR artifacts from the frontend repo.
   - Deploy CloudFront + Lambda SSR from the infra repo.
   - Use environment variables such as `FRONTEND_RELEASE_ID` for reproducible deploys.

5. Preserve promotion controls.
   - Feature/work branch to dev.
   - Dev to tst.
   - Tst to prod.
   - Keep GitHub Environments restricted to matching branches.
   - Use OIDC deploy roles, not long-lived AWS keys.

6. Cut over DNS carefully.
   - Prefer IaC-managed Route53 records.
   - If production records already exist, use explicit UPSERT or import-aware handling to avoid duplicates.
   - Keep MX, TXT, NS, and SOA records untouched unless the migration explicitly requires them.

7. Verify before removing Dokploy.
   - Direct HTTP route smoke.
   - Browser smoke on desktop and mobile.
   - API health and data endpoints.
   - Static metadata files: `robots.txt`, `sitemap.xml`, and web manifests.
   - Security headers and public asset URLs.

8. Remove Dokploy resources after replacement traffic is proven.
   - Stop before delete.
   - Delete apps/composes.
   - Use `deleteVolumes: false` until backups and owner approval are complete.
   - Re-test production URLs after deletion.

9. Final closure.
   - Revoke temporary API keys.
   - Rotate exposed credentials.
   - Delete retained volumes after backup signoff.
   - Remove stale DNS records.
   - Terminate EC2 only when no DNS, jobs, volumes, or app dependencies remain.
