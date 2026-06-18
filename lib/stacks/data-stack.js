"use strict";

const cdk = require("aws-cdk-lib");

class DataStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    tagEnvironment(this, props.environment);

    new cdk.CfnOutput(this, "DataPlan", {
      value: "Planned: DynamoDB tables for portfolio content, S3 media bucket, Secrets Manager, and migration exports from MongoDB.",
    });
  }
}

function tagEnvironment(scope, environment) {
  cdk.Tags.of(scope).add("Project", "portfolioLynxPardelle");
  cdk.Tags.of(scope).add("Environment", environment.name);
  cdk.Tags.of(scope).add("ManagedBy", "aws-cdk");
}

module.exports = {
  DataStack,
};
