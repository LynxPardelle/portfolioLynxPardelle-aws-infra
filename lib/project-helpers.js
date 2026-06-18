"use strict";

const cdk = require("aws-cdk-lib");

function applyPortfolioTags(scope, environment) {
  cdk.Tags.of(scope).add("Project", "portfolioLynxPardelle");
  cdk.Tags.of(scope).add("Environment", environment.name);
  cdk.Tags.of(scope).add("ManagedBy", "aws-cdk");
}

function buildResourceName(environment, service, resource) {
  return ["portfolio", environment.name, service, resource].filter(Boolean).join("-");
}

function buildParameterName(environment, parameterPath) {
  const normalizedPath = parameterPath.replace(/^\/+/, "");
  return `/portfolio/${environment.name}/${normalizedPath}`;
}

function removalPolicyForEnvironment(environment) {
  if (environment.removalPolicy === "retain") {
    return cdk.RemovalPolicy.RETAIN;
  }
  return cdk.RemovalPolicy.DESTROY;
}

module.exports = {
  applyPortfolioTags,
  buildParameterName,
  buildResourceName,
  removalPolicyForEnvironment,
};
