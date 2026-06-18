"use strict";

const cdk = require("aws-cdk-lib");
const { applyPortfolioTags } = require("../project-helpers");

class NetworkStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    applyPortfolioTags(this, props.environment);

    new cdk.CfnOutput(this, "NetworkPlan", {
      value: "Planned: isolated VPC only if Lambda VPC access is required; default target is serverless public API without EC2.",
    });
  }
}

module.exports = {
  NetworkStack,
};
