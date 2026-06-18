"use strict";

const cdk = require("aws-cdk-lib");
const { NetworkStack } = require("./stacks/network-stack");
const { DataStack } = require("./stacks/data-stack");
const { ApiStack } = require("./stacks/api-stack");
const { EdgeStack } = require("./stacks/edge-stack");
const { ObservabilityStack } = require("./stacks/observability-stack");

class PortfolioEnvironmentStage extends cdk.Stage {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { environment } = props;
    const stackProps = {
      env: props.env,
      environment,
      description: `Portfolio backend ${environment.name} environment scaffold.`,
    };

    new NetworkStack(this, `Portfolio-${environment.name}-Network`, stackProps);
    const dataStack = new DataStack(this, `Portfolio-${environment.name}-Data`, stackProps);
    new ApiStack(this, `Portfolio-${environment.name}-Api`, {
      ...stackProps,
      tables: dataStack.tables,
    });
    new EdgeStack(this, `Portfolio-${environment.name}-Edge`, stackProps);
    new ObservabilityStack(this, `Portfolio-${environment.name}-Observability`, stackProps);
  }
}

module.exports = {
  PortfolioEnvironmentStage,
};
