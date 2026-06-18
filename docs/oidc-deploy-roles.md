# GitHub OIDC Deploy Roles

Generated: 2026-06-18 Central Time

## Purpose

Define the AWS IAM inputs required by the GitHub Actions deploy workflows. The workflows use GitHub OIDC and GitHub Environment variables, matching the proven Moyra CDK pattern and Zoolanding environment-deploy pattern.

## GitHub Environment Variables

Create these variables in each GitHub Environment: `dev`, `tst`, and `prod`.

| Variable | Required | Value |
| --- | --- | --- |
| `AWS_ROLE_ARN` | yes | ARN of the matching environment deploy role |
| `AWS_REGION` | no | Defaults to `us-east-1` in workflows |

No static AWS access keys should be stored in GitHub secrets for deployment.

## Recommended Role Names

- `portfolio-dev-github-oidc-deploy`
- `portfolio-tst-github-oidc-deploy`
- `portfolio-prod-github-oidc-deploy`

## Trust Policy Shape

Use a trust policy limited to this repository and the intended branch/environment subject. Exact `sub` values should be verified against GitHub's OIDC token behavior for this repo and environment setup before production use.

Template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::765932874577:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:LynxPardelle/portfolioLynxPardelle-aws-infra:*"
        }
      }
    }
  ]
}
```

Tighten `sub` to branch or environment-specific subjects after validating the exact token claim:

- `dev` should only deploy from branch/environment `dev`.
- `tst` should only deploy from branch/environment `tst`.
- `prod` should only deploy from branch/environment `prod`.

## Permission Boundary

The deploy role must be able to assume the CDK bootstrap roles needed for lookup, file publishing, image publishing if ever used, and CloudFormation deploy.

Minimum shape:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeCDKBootstrapRoles",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "iam:ResourceTag/aws-cdk:bootstrap-role": [
            "lookup",
            "file-publishing",
            "image-publishing",
            "deploy"
          ]
        }
      }
    }
  ]
}
```

The CloudFormation execution role attached through CDK bootstrap controls what resources the deployment can create. Keep that policy aligned to this project's resources and avoid broad account-level permissions when practical.

## Validation

The workflow validation path is:

1. GitHub Environment has `AWS_ROLE_ARN`.
2. Workflow requests `permissions: id-token: write` and `contents: read`.
3. `aws-actions/configure-aws-credentials` assumes the role.
4. `aws sts get-caller-identity` prints the expected role identity.
5. `npx cdk deploy "Portfolio{Env}/*" --require-approval never` deploys the matching environment only.

## Security Notes

- Do not put AWS access keys in GitHub secrets for deploy.
- Do not widen trust policy to all repos.
- Do not deploy prod from `dev` or `tst`; branch protection and deploy guards must remain in place.
- If the deploy role fails to assume CDK bootstrap roles, fix the role permissions rather than adding static credentials.
