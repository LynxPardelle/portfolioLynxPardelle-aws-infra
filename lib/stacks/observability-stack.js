"use strict";

const cdk = require("aws-cdk-lib");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const logs = require("aws-cdk-lib/aws-logs");
const sns = require("aws-cdk-lib/aws-sns");
const {
  applyPortfolioTags,
  buildResourceName,
  removalPolicyForEnvironment,
} = require("../project-helpers");

class ObservabilityStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { environment } = props;
    applyPortfolioTags(this, environment);
    const removalPolicy = removalPolicyForEnvironment(environment);

    new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName: `/aws/portfolio/${environment.name}/api`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy,
    });

    const alertsTopic = new sns.Topic(this, "AlertsTopic", {
      topicName: buildResourceName(environment, "ops", "alerts"),
      displayName: `Portfolio ${environment.name} operational alerts`,
    });
    alertsTopic.applyRemovalPolicy(removalPolicy);

    const dashboard = new cloudwatch.Dashboard(this, "OperationsDashboard", {
      dashboardName: buildResourceName(environment, "operations", "dashboard"),
    });
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# Portfolio ${environment.name} operations\n\nFoundation dashboard. Add API, Lambda, DynamoDB, and S3 widgets as those resources are implemented.`,
        width: 24,
        height: 3,
      })
    );

    new cdk.CfnOutput(this, "ObservabilityPlan", {
      value: "Foundation: bounded API log group, alerts SNS topic, and operations dashboard. Alarms are added when API/Lambda/DynamoDB resources exist.",
    });
  }
}

module.exports = {
  ObservabilityStack,
};
