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
