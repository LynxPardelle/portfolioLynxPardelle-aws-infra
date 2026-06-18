"use strict";

const cdk = require("aws-cdk-lib");

class ApiStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    tagEnvironment(this, props.environment);

    new cdk.CfnOutput(this, "ApiPlan", {
      value: "Planned: API Gateway HTTP API with Lambda microservices for public content, admin content, media, auth, and operations.",
    });
  }
}

function tagEnvironment(scope, environment) {
  cdk.Tags.of(scope).add("Project", "portfolioLynxPardelle");
  cdk.Tags.of(scope).add("Environment", environment.name);
  cdk.Tags.of(scope).add("ManagedBy", "aws-cdk");
}

module.exports = {
  ApiStack,
};
