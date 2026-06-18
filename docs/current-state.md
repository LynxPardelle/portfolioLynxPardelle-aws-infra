# Current State Review

Review date: 2026-06-18 Central Time.

## Sources

Local repo sources:

- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\README.md`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\docs\architecture-overview.md`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\docs\dokploy.md`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\docs\integration-points.md`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\docs\s3-storage.md`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\app.js`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\index.js`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\routes\main.js`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\routes\article.js`
- `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle\package.json`

AWS/GitHub commands used:

- `gh repo view LynxPardelle/portfolioLynxPardelle --json nameWithOwner,visibility,isPrivate,defaultBranchRef,url`
- `aws sts get-caller-identity`
- `aws configure list`
- `aws s3api list-buckets --query "Buckets[].Name" --output json`
- `aws s3api get-bucket-location --bucket lynx-portfolio --output json`
- `aws s3api get-public-access-block --bucket lynx-portfolio --output json`
- `aws s3api get-bucket-versioning --bucket lynx-portfolio --output json`
- `aws s3api get-bucket-encryption --bucket lynx-portfolio --output json`
- `aws s3api get-bucket-cors --bucket lynx-portfolio --output json`
- `aws s3api get-bucket-lifecycle-configuration --bucket lynx-portfolio --output json`
- `aws cloudfront list-distributions`
- `aws cloudfront get-distribution --id EPT5BBK0QX89M`
- `aws cloudfront get-distribution --id E10Y59XAIPQY6A`
- `aws route53 list-hosted-zones`
- `aws route53 list-resource-record-sets --hosted-zone-id Z05088763QG63CC5SE7PN`
- `aws ec2 describe-instances`
- `aws ec2 describe-security-groups --group-names LynxSG`
- `aws ec2 describe-volumes --filters Name=attachment.instance-id,Values=i-061f471ff5edea8a9`
- `aws ecr describe-repositories`
- `aws ecs list-clusters`
- `aws lambda list-functions`
- `aws apigatewayv2 get-apis`
- `aws rds describe-db-instances`
- `aws dynamodb list-tables`
- `aws secretsmanager list-secrets`
- `aws ssm describe-parameters`
- `aws budgets describe-budgets --account-id 765932874577`

## Current Repo

GitHub returned:

```json
{"defaultBranchRef":{"name":"main"},"isPrivate":false,"nameWithOwner":"LynxPardelle/portfolioLynxPardelle","url":"https://github.com/LynxPardelle/portfolioLynxPardelle","visibility":"PUBLIC"}
```

`README.md` says the application is a Node.js/Express portfolio application with MongoDB and S3 storage. It lists these architecture points:

- Backend: Node.js/Express REST API.
- Database: MongoDB with Mongoose ODM.
- Storage: AWS S3 for all file uploads.
- Authentication: JWT-based auth system.
- Deployment: Docker containers with Docker Compose.

`docs/architecture-overview.md` adds:

- Entry points are `app.js` and `index.js`.
- Routes include `/api/main` and `/api/article`.
- Business logic is in `controllers/main.js` and `controllers/article.js`.
- Models are MongoDB schemas in `models/`.
- Deployment is Dokploy with separate Docker stacks.
- Production uses port `6165`.

`docs/dokploy.md` says the recommended production deployment order is:

1. `docker-compose.mongo.yml`
2. `docker-compose.prod.yml`

It also says `docker-compose.prod.yml` is app-only and MongoDB must be deployed first on shared network `lynx-portfolio-back-network`.

## Runtime Shape

`app.js` mounts:

- `/api/main`
- `/api/article`
- `/api/performance`
- `/api/canary` when route import succeeds
- `/api/monitoring` when route import succeeds
- `/api/rollback` when route import succeeds
- `/health`

`index.js` starts the HTTP server immediately and then connects to MongoDB with retry logic. It reports health as `200` when MongoDB is connected and `503` when disconnected.

`routes/main.js` provides:

- Public reads for albums, book images, CV sections, main profile, songs, videos, websites, file retrieval, and S3 status.
- Admin-protected create/update/delete endpoints.
- Admin-protected upload endpoints using in-memory `multer` and S3 validation.

`routes/article.js` provides:

- Public article/category reads.
- Admin-protected article/category create and update endpoints.
- Delete endpoints for article resources.
- Admin-protected upload endpoints.

## Data Model

The current `models/` directory contains:

- `album.js`
- `article.js`
- `articleCat.js`
- `articleSection.js`
- `articleSubCat.js`
- `bookImg.js`
- `cvSection.js`
- `cvSubSection.js`
- `file.js`
- `main.js`
- `song.js`
- `video.js`
- `website.js`

These should become the migration source for DynamoDB table design and data export tooling.

## Current AWS Account and Region

`aws sts get-caller-identity` returned:

```json
{
    "UserId": "AIDA3EVJIFNI6AZSSB2E2",
    "Account": "765932874577",
    "Arn": "arn:aws:iam::765932874577:user/ADMIN-AIM-CLI"
}
```

`aws configure list` returned region `us-east-1`.

## Current S3 and CloudFront

`aws s3api list-buckets` included:

- `lynx-portfolio`
- `lynx-portfolio-cloudfront-logs`

For `lynx-portfolio`:

- `get-bucket-location`: `LocationConstraint` was `null`, which means `us-east-1`.
- `get-public-access-block`: all public access block settings were `true`.
- `get-bucket-versioning`: `Status` was `Enabled`.
- `get-bucket-encryption`: default encryption was `AES256`, bucket key enabled, and `SSE-C` blocked.
- `get-bucket-cors`: failed with `NoSuchCORSConfiguration`.
- `get-bucket-lifecycle-configuration`: lifecycle rule `PortfolioAssetLifecycle`, transition current objects after `90` days to `STANDARD_IA`, noncurrent versions after `30` days to `GLACIER_IR`, abort incomplete multipart uploads after `7` days.

CloudFront distribution `EPT5BBK0QX89M` returned:

- `Status`: `Deployed`
- `DomainName`: `d3g4a1zyvvyylm.cloudfront.net`
- `Aliases`: `assets.lynxpardelle.com`
- Origin: `lynx-portfolio.s3.us-east-1.amazonaws.com`
- `OriginAccessControlId`: `E2K2X9YIC0Z7JX`
- Viewer policy: `redirect-to-https`
- Methods: `GET`, `HEAD`
- Certificate: ACM certificate for `assets.lynxpardelle.com`
- Logging enabled to `lynx-portfolio-cloudfront-logs.s3.amazonaws.com`, prefix `cloudfront-logs/`

## Current DNS

Hosted zone list includes public zone:

- `lynxpardelle.com.` with id `/hostedzone/Z05088763QG63CC5SE7PN`

Selected `lynxpardelle.com` records returned:

- `lynxpardelle.com.` A -> `32.195.120.158`
- `www.lynxpardelle.com.` A -> `32.195.120.158`
- `dokploy.lynxpardelle.com.` A -> `32.195.120.158`
- `music.lynxpardelle.com.` A -> `32.195.120.158`
- `assets.lynxpardelle.com.` A/AAAA alias -> `d3g4a1zyvvyylm.cloudfront.net.`
- `api.lynxpardelle.com.` A/AAAA alias -> `dvawu0149qr16.cloudfront.net.`
- `mongo.lynxpardelle.com.` A/AAAA alias -> `dvawu0149qr16.cloudfront.net.`

`aws cloudfront list-distributions` did not return a distribution with aliases `api.lynxpardelle.com` or `mongo.lynxpardelle.com` in this AWS account. That is evidence only; it does not prove whether the alias target exists elsewhere.

## Current Compute

`aws ec2 describe-instances` returned one relevant instance:

```json
{
    "InstanceId": "i-061f471ff5edea8a9",
    "State": "running",
    "Type": "t3.medium",
    "PublicDnsName": "ec2-32-195-120-158.compute-1.amazonaws.com",
    "PublicIpAddress": "32.195.120.158",
    "PrivateIpAddress": "172.31.43.181",
    "Name": "LynxServer",
    "LaunchTime": "2026-06-09T11:14:52+00:00",
    "SecurityGroups": [
        "LynxSG"
    ]
}
```

`aws ec2 describe-volumes` for that instance returned:

```json
{
    "VolumeId": "vol-0bd5f763909f1383b",
    "Size": 120,
    "VolumeType": "gp3",
    "Encrypted": false,
    "State": "in-use"
}
```

## Current AWS Service Footprint

Commands returned:

- ECR: only `cdk-hnb659fds-container-assets-765932874577-us-east-1`.
- ECS: `[]`.
- RDS: `[]`.
- API Gateway HTTP APIs: existing Moyra and Zoolanding APIs; none named for `portfolioLynxPardelle`.
- DynamoDB: existing Moyra, PantryList, and Zoolanding tables; none named for `portfolioLynxPardelle`.
- Secrets Manager: PantryList secrets only.
- SSM Parameters: CDK bootstrap, Moyra, PantryList, and Zoolanding parameters; none named for `portfolioLynxPardelle`.

## Security Findings

These are findings from evidence gathered in this review:

1. The current public GitHub repo tracks environment-like files. The scan reported:
   - `.env.staging:23 MONGO_ROOT_PASSWORD=non-placeholder-looking-value`
   - `.env.staging:29 MONGO_APP_PASSWORD=non-placeholder-looking-value`
   - `.env.staging:47 S3_STAGING_ACCESS_KEY_ID=non-placeholder-looking-value`
   - `.env.staging:48 S3_STAGING_SECRET_ACCESS_KEY=non-placeholder-looking-value`
   - `.example.env:22 MONGO_APP_PASSWORD=non-placeholder-looking-value`
   - `.example.env:24 MONGO_URI=non-placeholder-looking-value`
2. The current EC2 volume `vol-0bd5f763909f1383b` is not encrypted.
3. CloudFront distribution `E10Y59XAIPQY6A` returned `ViewerProtocolPolicy: allow-all` and an EC2 custom origin with `OriginProtocolPolicy: http-only`.
4. The security group `LynxSG` exposes ports `80` and `443` to `0.0.0.0/0`, and has restricted but explicit MongoDB-related ingress on ports `27017` and `27072`.
5. `docs/s3-storage.md` says to configure S3 bucket public read access, but the actual bucket `lynx-portfolio` blocks public access and uses CloudFront OAC. New IaC should keep the private-bucket/OAC model and update old docs later.

Immediate recommendation: rotate any credentials that match the tracked environment files before deploying new infrastructure.
