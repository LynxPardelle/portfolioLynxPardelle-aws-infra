"use strict";

const cdk = require("aws-cdk-lib");
const { NetworkStack } = require("./stacks/network-stack");
const { DataStack } = require("./stacks/data-stack");
const { ApiStack } = require("./stacks/api-stack");
const { EdgeStack } = require("./stacks/edge-stack");
const { FrontendStack } = require("./stacks/frontend-stack");
const { ObservabilityStack } = require("./stacks/observability-stack");
const { AssistantEdgeStack } = require("./stacks/assistant-edge-stack");

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
    const apiStack = new ApiStack(this, `Portfolio-${environment.name}-Api`, {
      ...stackProps,
      tables: dataStack.tables,
    });
    if (environment.name === "prod" && process.env.ASSISTANT_EDGE === "1") {
      if (!apiStack.assistant) throw new Error("ASSISTANT_EDGE requires ASSISTANT_ENABLED=1.");
      new AssistantEdgeStack(this, "Portfolio-prod-AssistantEdge", { ...stackProps, assistant: apiStack.assistant });
    }
    new FrontendStack(this, `Portfolio-${environment.name}-Frontend`, stackProps);
    new EdgeStack(this, `Portfolio-${environment.name}-Edge`, stackProps);
    new ObservabilityStack(this, `Portfolio-${environment.name}-Observability`, stackProps);
  }
}

module.exports = {
  PortfolioEnvironmentStage,
};
