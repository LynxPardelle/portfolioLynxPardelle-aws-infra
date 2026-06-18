"use strict";

const cdk = require("aws-cdk-lib");
const { applyPortfolioTags } = require("../project-helpers");

class EdgeStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    applyPortfolioTags(this, props.environment);

    new cdk.CfnOutput(this, "EdgePlan", {
      value: "Planned: Route53, ACM in us-east-1, CloudFront for assets, and API custom domains per environment.",
    });
  }
}

module.exports = {
  EdgeStack,
};
