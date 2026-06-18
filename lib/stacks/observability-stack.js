"use strict";

const cdk = require("aws-cdk-lib");

class ObservabilityStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    tagEnvironment(this, props.environment);

    new cdk.CfnOutput(this, "ObservabilityPlan", {
      value: "Planned: CloudWatch dashboards, alarms, structured logs, X-Ray where useful, budget alarms, and rollback runbooks.",
    });
  }
}

function tagEnvironment(scope, environment) {
  cdk.Tags.of(scope).add("Project", "portfolioLynxPardelle");
  cdk.Tags.of(scope).add("Environment", environment.name);
  cdk.Tags.of(scope).add("ManagedBy", "aws-cdk");
}

module.exports = {
  ObservabilityStack,
};
