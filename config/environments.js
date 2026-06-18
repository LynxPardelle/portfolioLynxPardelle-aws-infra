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

const environments = [
  {
    ...environmentDefaults,
    name: "dev",
    stageId: "PortfolioDev",
    branch: "dev",
    apiDomainName: "api.dev.lynxpardelle.com",
    removalPolicy: "destroy",
  },
  {
    ...environmentDefaults,
    name: "tst",
    stageId: "PortfolioTst",
    branch: "tst",
    apiDomainName: "api.tst.lynxpardelle.com",
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
    removalPolicy: "retain",
  },
];

module.exports = {
  environments,
  expectedAccount,
  defaultRegion,
};
