"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const cdk = require("aws-cdk-lib");
const { Template } = require("aws-cdk-lib/assertions");

const { ApiStack } = require("../lib/stacks/api-stack");
const { DataStack } = require("../lib/stacks/data-stack");
const { ObservabilityStack } = require("../lib/stacks/observability-stack");
const {
  buildParameterName,
  buildResourceName,
  removalPolicyForEnvironment,
} = require("../lib/project-helpers");

const testEnvironment = {
  account: "123456789012",
  region: "us-east-1",
  name: "dev",
  stageId: "PortfolioDev",
  branch: "dev",
  apiDomainName: "api.dev.lynxpardelle.com",
  hostedZoneName: "lynxpardelle.com",
  hostedZoneId: "Z05088763QG63CC5SE7PN",
  assetDomainName: "assets.lynxpardelle.com",
  currentAssetsBucketName: "lynx-portfolio",
  currentAssetsDistributionId: "EPT5BBK0QX89M",
  removalPolicy: "destroy",
};

test("buildResourceName prefixes portfolio environment and service", () => {
  assert.equal(
    buildResourceName(testEnvironment, "migration", "mongo-source"),
    "portfolio-dev-migration-mongo-source"
  );
});

test("buildParameterName creates stable portfolio parameter paths", () => {
  assert.equal(
    buildParameterName(testEnvironment, "assets/bucket-name"),
    "/portfolio/dev/assets/bucket-name"
  );
});

test("removalPolicyForEnvironment maps environment policy strings", () => {
  assert.equal(removalPolicyForEnvironment(testEnvironment), cdk.RemovalPolicy.DESTROY);
  assert.equal(
    removalPolicyForEnvironment({ ...testEnvironment, removalPolicy: "retain" }),
    cdk.RemovalPolicy.RETAIN
  );
});

test("DataStack publishes non-secret foundation references and placeholder secret", () => {
  const app = new cdk.App();
  const stack = new DataStack(app, "TestDataStack", {
    env: { account: testEnvironment.account, region: testEnvironment.region },
    environment: testEnvironment,
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/portfolio/dev/environment/name",
    Type: "String",
    Value: "dev",
  });
  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/portfolio/dev/api/domain-name",
    Type: "String",
    Value: "api.dev.lynxpardelle.com",
  });
  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/portfolio/dev/assets/bucket-name",
    Type: "String",
    Value: "lynx-portfolio",
  });
  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/portfolio/dev/assets/distribution-id",
    Type: "String",
    Value: "EPT5BBK0QX89M",
  });
  template.hasResourceProperties("AWS::SecretsManager::Secret", {
    Name: "portfolio-dev-migration-mongo-source",
  });
  const secrets = template.findResources("AWS::SecretsManager::Secret");
  const secretResource = Object.values(secrets)[0];
  assert.equal(secretResource.Properties.SecretString, undefined);
  assert.equal(secretResource.Properties.GenerateSecretString, undefined);

  assert.equal(Object.keys(template.findResources("AWS::S3::Bucket")).length, 0);
  assert.equal(Object.keys(template.findResources("AWS::CloudFront::Distribution")).length, 0);
});

test("DataStack creates DynamoDB tables for portfolio content contexts", () => {
  const app = new cdk.App();
  const stack = new DataStack(app, "TestDynamoDataStack", {
    env: { account: testEnvironment.account, region: testEnvironment.region },
    environment: testEnvironment,
  });
  const template = Template.fromStack(stack);

  for (const tableName of [
    "portfolio-dev-main",
    "portfolio-dev-articles",
    "portfolio-dev-article-sections",
    "portfolio-dev-article-categories",
    "portfolio-dev-files",
    "portfolio-dev-migration-manifests",
  ]) {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
    });
  }

  assert.equal(Object.keys(template.findResources("AWS::DynamoDB::Table")).length, 6);
});

test("prod DynamoDB tables enable point in time recovery", () => {
  const app = new cdk.App();
  const stack = new DataStack(app, "TestProdDataStack", {
    env: { account: testEnvironment.account, region: testEnvironment.region },
    environment: { ...testEnvironment, name: "prod", removalPolicy: "retain" },
  });
  const template = Template.fromStack(stack);
  const tables = template.findResources("AWS::DynamoDB::Table");

  for (const table of Object.values(tables)) {
    assert.deepEqual(table.Properties.PointInTimeRecoverySpecification, {
      PointInTimeRecoveryEnabled: true,
    });
  }
});

test("ApiStack creates read-only public Lambda and HTTP API", () => {
  const app = new cdk.App();
  const dataStack = new DataStack(app, "TestApiDataStack", {
    env: { account: testEnvironment.account, region: testEnvironment.region },
    environment: testEnvironment,
  });
  const apiStack = new ApiStack(app, "TestApiStack", {
    env: { account: testEnvironment.account, region: testEnvironment.region },
    environment: testEnvironment,
    tables: dataStack.tables,
  });
  const template = Template.fromStack(apiStack);

  template.hasResourceProperties("AWS::Lambda::Function", {
    FunctionName: "portfolio-dev-public-api",
    Runtime: "nodejs20.x",
    MemorySize: 256,
    Timeout: 10,
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
    Name: "portfolio-dev-public-api",
    ProtocolType: "HTTP",
  });
  assert.equal(Object.keys(template.findResources("AWS::DynamoDB::Table")).length, 0);
  assert.equal(Object.keys(template.findResources("AWS::ApiGatewayV2::DomainName")).length, 0);
});

test("prod ApiStack maps the public API to api.lynxpardelle.com", () => {
  const app = new cdk.App();
  const environment = {
    ...testEnvironment,
    name: "prod",
    apiDomainName: "api.lynxpardelle.com",
    apiCustomDomainEnabled: true,
    apiCertificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/example",
    removalPolicy: "retain",
  };
  const dataStack = new DataStack(app, "TestProdApiDataStack", {
    env: { account: environment.account, region: environment.region },
    environment,
  });
  const apiStack = new ApiStack(app, "TestProdApiStack", {
    env: { account: environment.account, region: environment.region },
    environment,
    tables: dataStack.tables,
  });
  const template = Template.fromStack(apiStack);

  template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", {
    DomainName: "api.lynxpardelle.com",
  });
  template.resourceCountIs("AWS::ApiGatewayV2::ApiMapping", 1);
  template.resourceCountIs("AWS::Route53::RecordSet", 2);
  template.hasResourceProperties("AWS::Route53::RecordSet", {
    Name: "api.lynxpardelle.com.",
    Type: "A",
  });
  template.hasResourceProperties("AWS::Route53::RecordSet", {
    Name: "api.lynxpardelle.com.",
    Type: "AAAA",
  });
});

test("ObservabilityStack creates bounded logs, alerts topic, and dashboard without alarms", () => {
  const app = new cdk.App();
  const stack = new ObservabilityStack(app, "TestObservabilityStack", {
    env: { account: testEnvironment.account, region: testEnvironment.region },
    environment: testEnvironment,
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::Logs::LogGroup", {
    LogGroupName: "/aws/portfolio/dev/api",
    RetentionInDays: 30,
  });
  template.hasResourceProperties("AWS::SNS::Topic", {
    TopicName: "portfolio-dev-ops-alerts",
  });
  template.hasResourceProperties("AWS::CloudWatch::Dashboard", {
    DashboardName: "portfolio-dev-operations-dashboard",
  });
  assert.equal(Object.keys(template.findResources("AWS::CloudWatch::Alarm")).length, 0);
});
