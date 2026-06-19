"use strict";

const expectedAccount = "765932874577";
const defaultRegion = "us-east-1";

const environmentDefaults = {
  account: process.env.CDK_DEFAULT_ACCOUNT || expectedAccount,
  region: process.env.CDK_DEFAULT_REGION || defaultRegion,
  hostedZoneName: "lynxpardelle.com",
  hostedZoneId: "Z05088763QG63CC5SE7PN",
  assetDomainName: "assets.lynxpardelle.com",
  currentAssetsBucketName: "lynx-portfolio",
  currentAssetsDistributionId: "EPT5BBK0QX89M",
};

function buildFrontendHostingConfig(environmentName) {
  const artifactBasePrefix = `frontend/angular-ssr/${environmentName}`;
  const releaseId =
    process.env[`FRONTEND_${environmentName.toUpperCase()}_RELEASE_ID`] ||
    process.env.FRONTEND_RELEASE_ID ||
    "";
  return {
    architecture: "cloudfront-s3-lambda-ssr",
    apiBaseUrl: "https://api.lynxpardelle.com",
    artifactBucketName: environmentDefaults.currentAssetsBucketName,
    artifactBasePrefix,
    staticOriginDomainName: environmentDefaults.assetDomainName,
    publisherRepository: "LynxPardelle/lynx-portfolio-angular",
    releaseId,
    manifestKeyPattern: `${artifactBasePrefix}/releases/{releaseId}/manifest.json`,
    staticPrefixPattern: `${artifactBasePrefix}/releases/{releaseId}/browser`,
    serverBundlePrefixPattern: `${artifactBasePrefix}/releases/{releaseId}/server`,
    manifestKey: releaseId ? `${artifactBasePrefix}/releases/${releaseId}/manifest.json` : "",
    staticPrefix: releaseId ? `${artifactBasePrefix}/releases/${releaseId}/browser` : "",
    serverBundleKey: releaseId ? `${artifactBasePrefix}/releases/${releaseId}/server/ssr-handler.zip` : "",
    ssrRuntime: "nodejs22.x",
    ssrMemorySizeMb: 512,
    ssrTimeoutSeconds: 15,
    cachePriceClass: "PRICE_CLASS_100",
  };
}

const environments = [
  {
    ...environmentDefaults,
    name: "dev",
    stageId: "PortfolioDev",
    branch: "dev",
    apiDomainName: "api.dev.lynxpardelle.com",
    frontendHosting: {
      ...buildFrontendHostingConfig("dev"),
      domainName: "dev.lynxpardelle.com",
      certificateArn: "arn:aws:acm:us-east-1:765932874577:certificate/4b008cec-97a6-447e-bf2f-9165e435b363",
      route53RecordsEnabled: true,
    },
    removalPolicy: "destroy",
  },
  {
    ...environmentDefaults,
    name: "tst",
    stageId: "PortfolioTst",
    branch: "tst",
    apiDomainName: "api.tst.lynxpardelle.com",
    frontendHosting: {
      ...buildFrontendHostingConfig("tst"),
      domainName: "tst.lynxpardelle.com",
      certificateArn: "arn:aws:acm:us-east-1:765932874577:certificate/4b008cec-97a6-447e-bf2f-9165e435b363",
      route53RecordsEnabled: true,
    },
    removalPolicy: "destroy",
  },
  {
    ...environmentDefaults,
    name: "prod",
    stageId: "PortfolioProd",
    branch: "prod",
    apiDomainName: "api.lynxpardelle.com",
    apiCustomDomainEnabled: true,
    apiCertificateArn: "arn:aws:acm:us-east-1:765932874577:certificate/c28aa27f-c191-4d88-b2cf-2279a4481e30",
    frontendHosting: {
      ...buildFrontendHostingConfig("prod"),
      domainName: "lynxpardelle.com",
      alternateDomainNames: ["www.lynxpardelle.com"],
      certificateArn: "arn:aws:acm:us-east-1:765932874577:certificate/4b008cec-97a6-447e-bf2f-9165e435b363",
      route53RecordsEnabled: true,
      route53RecordManagement: "upsert",
    },
    removalPolicy: "retain",
  },
];

module.exports = {
  environments,
  expectedAccount,
  defaultRegion,
};
