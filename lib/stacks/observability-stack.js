"use strict";

const cdk = require("aws-cdk-lib");

class ObservabilityStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    new cdk.CfnOutput(this, "ObservabilityPlan", {
      value: "Disconnected observability placeholders retired after the CloudWatch inventory.",
    });
  }
}

module.exports = {
  ObservabilityStack,
};
