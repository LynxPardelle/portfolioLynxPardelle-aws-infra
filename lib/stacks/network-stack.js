"use strict";

const cdk = require("aws-cdk-lib");

class NetworkStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    tagEnvironment(this, props.environment);

    new cdk.CfnOutput(this, "NetworkPlan", {
      value: "Planned: isolated VPC only if Lambda VPC access is required; default target is serverless public API without EC2.",
    });
  }
}

function tagEnvironment(scope, environment) {
  cdk.Tags.of(scope).add("Project", "portfolioLynxPardelle");
  cdk.Tags.of(scope).add("Environment", environment.name);
  cdk.Tags.of(scope).add("ManagedBy", "aws-cdk");
}

module.exports = {
  NetworkStack,
};
