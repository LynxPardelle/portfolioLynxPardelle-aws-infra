#!/usr/bin/env node
"use strict";

const cdk = require("aws-cdk-lib");
const { PortfolioEnvironmentStage } = require("../lib/portfolio-environment-stage");
const { environments } = require("../config/environments");

const app = new cdk.App();

for (const environment of environments) {
  new PortfolioEnvironmentStage(app, environment.stageId, {
    environment,
    env: {
      account: environment.account,
      region: environment.region,
    },
  });
}
