# EC2 Retirement Inventory: LynxServer

Date: 2026-06-19 00:23 Central Time

## Goal

This inventory supports retiring the shared Dokploy EC2 instance after Lynx Portfolio was moved to AWS serverless infrastructure.

Current EC2 anchor:

- Instance: `i-061f471ff5edea8a9`
- Name: `LynxServer`
- State: `running`
- Type: `t3.medium`
- Public IP: `32.195.120.158`
- Private IP: `172.31.43.181`
- Security group: `LynxSG`
- Volume: `vol-0bd5f763909f1383b`
- Volume size/type: `120` GB `gp3`
- Volume encryption: `false`
- Delete on termination: `true`

Do not stop or terminate this instance until every dependency in this report is migrated, deleted by explicit decision, or verified stale.

## Current Portfolio Status

Lynx Portfolio no longer blocks EC2 retirement:

- `lynxpardelle.com` and `www.lynxpardelle.com` now serve from CloudFront `d1h141iw0hg57g.cloudfront.net`.
- `api.lynxpardelle.com` now serves from API Gateway regional domain `d-dovq432mpb.execute-api.us-east-1.amazonaws.com`.
- `assets.lynxpardelle.com` serves from CloudFront/S3.
- Dokploy project `lynxpardelle` has no applications or compose resources remaining.

The portfolio cleanup details are in `docs/dokploy-decommission-report.md`.

## DNS Records Still Pointing To The EC2 Public IP

The following Route53 records in this AWS account still point to `32.195.120.158`:

| Zone | Record | Type | TTL |
| --- | --- | --- | --- |
| `lynxpardelle.com` | `alecfest-voliii.lynxpardelle.com.` | A | 60 |
| `lynxpardelle.com` | `dokploy.lynxpardelle.com.` | A | 300 |
| `lynxpardelle.com` | `music.lynxpardelle.com.` | A | 60 |
| `lynxpardelle.com` | `origin.pantrylist.lynxpardelle.com.` | A | 1800 |
| `zoolandingpage.com.mx` | `alecfest-voliii.zoolandingpage.com.mx.` | A | 60 |
| `zoolandingpage.com.mx` | `crearpaginaweb.zoolandingpage.com.mx.` | A | 300 |
| `zoolandingpage.com.mx` | `despacholegalastralex.zoolandingpage.com.mx.` | A | 60 |
| `erosbarajas.com` | `erosbarajas.com.` | A | 300 |
| `zoolandingpage.com.mx` | `erosbarajas.zoolandingpage.com.mx.` | A | 60 |
| `zoolandingpage.com.mx` | `pamelabetancourt.zoolandingpage.com.mx.` | A | 60 |
| `zoolandingpage.com.mx` | `pokeapi-demo.zoolandingpage.com.mx.` | A | 300 |
| `zoolandingpage.com.mx` | `quierounsitioweb.zoolandingpage.com.mx.` | A | 300 |
| `zoolandingpage.com.mx` | `robertorodriguezrodriguez.zoolandingpage.com.mx.` | A | 300 |
| `zoolandingpage.com.mx` | `sitiosweb.zoolandingpage.com.mx.` | A | 300 |
| `sulandingpage.com` | `sulandingpage.com.` | A | 60 |
| `sulandingpage.com.mx` | `sulandingpage.com.mx.` | A | 60 |
| `zoolandingpage.com.mx` | `test.despacholegalastralex.zoolandingpage.com.mx.` | A | 300 |
| `zoolandingpage.com.mx` | `test.zoolandingpage.com.mx.` | A | 60 |
| `zoolandingpage.com` | `zoolandingpage.com.` | A | 60 |
| `zoolandingpage.com.mx` | `zoolandingpage.com.mx.` | A | 60 |
| `zoositioweb.com` | `zoositioweb.com.` | A | 60 |
| `zoositioweb.com.mx` | `zoositioweb.com.mx.` | A | 60 |

External DNS checked from this machine also showed these Dokploy domains resolving to `32.195.120.158`:

- `moyra.org`
- `www.moyra.org`
- `test.moyra.org`

Those Moyra DNS records are not in the Route53 hosted zones listed by this AWS account, so a separate DNS provider likely owns them.

## Remaining Dokploy Resources

Sanitized Dokploy inventory after removing the Lynx Portfolio project resources:

| Project | Resource | Type | App name | Repo | Branch | Domains |
| --- | --- | --- | --- | --- | --- | --- |
| `PantryList` | `pantrylist-production` | compose | `compose-compress-back-end-port-hiewlq` | `PantryList` | `main` | `pantrylist.lynxpardelle.com` |
| `Moyra` | `Moyra Test Frontend` | application | `moyra-test-frontend-zjuuts` | `moyra-front-angular` | `test` | `test.moyra.org` |
| `Moyra` | `Moyra Production Frontend` | application | `moyra-production-frontend-qoiyw0` | `moyra-front-angular` | `production` | `moyra.org`, `www.moyra.org` |
| `zoolandingpage` | `Test` | application | `zoolandingpage-test-m6uwhf` | `zoolandingpage` | `test` | `test.zoolandingpage.com.mx`, `erosbarajas.zoolandingpage.com.mx`, `alecfest-voliii.lynxpardelle.com`, `alecfest-voliii.zoolandingpage.com.mx`, `pamelabetancourt.zoolandingpage.com.mx` |
| `zoolandingpage` | `ZoolandingPage Front` | application | `zoolandingpage-git-repo-app-sacivw` | `zoolandingpage` | `main` | `zoolandingpage.com.mx`, `music.lynxpardelle.com`, `zoositioweb.com.mx`, `zoositioweb.com`, `zoolandingpage.com`, `sulandingpage.com`, `sulandingpage.com.mx` |

Container lookup after the portfolio cleanup showed remaining services are active:

| App name | Container count | Observed state |
| --- | ---: | --- |
| `compose-compress-back-end-port-hiewlq` | 2 | frontend and backend running, healthy |
| `moyra-test-frontend-zjuuts` | 1 | running, healthy |
| `moyra-production-frontend-qoiyw0` | 1 | running, healthy |
| `zoolandingpage-test-m6uwhf` | 1 | running, healthy |
| `zoolandingpage-git-repo-app-sacivw` | 5 | 1 running healthy, 4 exited |

## Project Classification

### PantryList

Evidence:

- Dokploy has one active compose resource.
- `pantrylist.lynxpardelle.com` points to CloudFront distribution `E244X3QM2RVQYC`.
- That CloudFront distribution has origin `origin.pantrylist.lynxpardelle.com`.
- `origin.pantrylist.lynxpardelle.com` points to the EC2 public IP.
- The local repo contains `frontend`, `backend`, `docker-compose.dokploy.prod.yml`, and a Cognito CDK folder under `infra/cognito`.

Likely migration shape:

- Migrate the frontend to CloudFront + S3 and Lambda SSR only if SSR is actually required by the Angular app.
- Migrate the backend to API Gateway + Lambda if the NestJS API can be split cleanly, or to a minimal containerless Lambda adapter if speed matters.
- Keep Cognito infrastructure in the existing PantryList infra folder or extract a dedicated infra repo only if ownership demands it.
- Replace the CloudFront origin from `origin.pantrylist.lynxpardelle.com` to the new AWS target after backend/frontend migration.

Do not delete:

- `origin.pantrylist.lynxpardelle.com`
- Dokploy compose `pantrylist-production`
- CloudFront `E244X3QM2RVQYC`

until the new PantryList origin and production smoke tests are ready.

### Moyra

Evidence:

- Backend/API is already serverless in `moyra-infra-serverless`.
- Dokploy only hosts the Angular SSR frontend for `moyra.org`, `www.moyra.org`, and `test.moyra.org`.
- `moyra-front-angular` is Angular SSR and has `serve:ssr`.
- Previous Moyra docs intentionally kept SSR in Dokploy because the shared EC2 cost already existed. That assumption no longer holds if the EC2 is being retired.

Likely migration shape:

- Reuse the Lynx Portfolio frontend hosting pattern: frontend repo publishes SSR artifacts; infra repo provisions Lambda SSR, CloudFront, logs, and DNS.
- Production DNS is probably outside Route53 for `moyra.org`; confirm authoritative DNS provider and apex-domain options before implementation.
- Subdomains such as `test.moyra.org` can usually point to CloudFront via CNAME if the DNS provider supports it.
- Apex `moyra.org` needs explicit DNS-provider confirmation because some DNS providers do not support ALIAS/ANAME records at apex.

Do not delete Dokploy Moyra frontends until:

- `moyra.org`, `www.moyra.org`, and `test.moyra.org` have AWS SSR replacements.
- Browser smoke covers public pages, login, admin routes, and API CORS against `api.moyra.org`.

### ZoolandingPage

Evidence:

- Dokploy has two active applications: one test/draft app and one main app.
- Many Route53 records in this AWS account point directly to the EC2.
- The local repo is Angular SSR and already has operational front-door scripts:
  - `ops:sync-managed-aliases`
  - `ops:sync-auth-admin-front-door`
  - `ops:probe-runtime-front-door`
  - `ops:configure-runtime-cache`
  - `ops:configure-runtime-observability`
- The repo has many draft/public-safety tools, so migration must preserve draft alias behavior and publication safety.

Likely migration shape:

- Treat ZoolandingPage as the largest blocker because it owns many active/draft domains.
- Inventory the canonical domains and every public draft alias before changing DNS.
- Reuse existing front-door tooling where it already manages aliases; do not hand-edit DNS for draft domains until the tool ownership is confirmed.
- The target should probably be a shared AWS SSR front door for the Angular app plus managed alias automation, not one CloudFront distribution per draft unless cost/limits are reviewed.

Do not delete:

- `zoolandingpage-test-m6uwhf`
- `zoolandingpage-git-repo-app-sacivw`
- Route53 draft aliases

until each public alias is either migrated, archived, or explicitly abandoned.

## Recommended Migration Order

1. Moyra frontend SSR.
   - Backend is already serverless, so only the frontend remains on Dokploy.
   - Main risk is DNS provider/apex handling for `moyra.org`.

2. PantryList.
   - One compose resource and one CloudFront origin dependency.
   - Needs backend/frontend split review but has fewer public domains than ZoolandingPage.

3. ZoolandingPage.
   - Largest DNS and alias surface.
   - Needs draft-domain inventory and alias automation checks before cutover.

4. Dokploy platform and EC2 final closure.
   - Stop/remove remaining Dokploy apps only after project migrations are live.
   - Delete retained Docker volumes and host paths after backup confirmation.
   - Rotate/revoke temporary Dokploy API key and unused GitHub/Dokploy integrations.
   - Remove `dokploy.lynxpardelle.com`.
   - Terminate `LynxServer`.

## Safety Gates Before EC2 Termination

All of these must be true before terminating `i-061f471ff5edea8a9`:

- No public DNS record resolves to `32.195.120.158`.
- Dokploy `project.all` has no required application or compose resources.
- Docker container lookup shows no required app containers.
- All databases or persistent volumes have validated backups and owner sign-off.
- CloudFront distributions no longer use EC2-backed origins.
- External DNS providers for `moyra.org` and any other non-Route53 zones are updated.
- Credential rotation and key revocation are completed.
- A final production smoke test passes for every migrated public hostname.

## Immediate Next Work Items

1. Moyra frontend AWS SSR migration plan and branch.
   - Inspect `moyra-front-angular` and `moyra-infra-serverless`.
   - Implement the same release artifact + AWS SSR pattern used by Lynx Portfolio.
   - Decide DNS handling for `moyra.org` apex before any production cutover.

2. PantryList architecture discovery.
   - Inspect `frontend`, `backend`, `docker-compose.dokploy.prod.yml`, and `infra/cognito`.
   - Decide whether to split NestJS into Lambdas or use a Lambda adapter first.
   - Plan CloudFront origin replacement away from `origin.pantrylist.lynxpardelle.com`.

3. ZoolandingPage alias inventory.
   - Use the repo's ops tools to list managed aliases.
   - Classify each Route53 record as production, test, draft, stale, or abandoned.
   - Build a migration plan that preserves draft publication safety.

4. Final security closure.
   - Keep deferred for now per Alec's instruction.
   - At final closure, revoke the temporary Dokploy API key and rotate any exposed Dokploy/GitHub integration credentials.
