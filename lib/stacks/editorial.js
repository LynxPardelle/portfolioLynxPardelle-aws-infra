"use strict";

const path = require("node:path");
const { readFileSync } = require("node:fs");
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const events = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
const gateway = require("aws-cdk-lib/aws-apigatewayv2");
const { HttpJwtAuthorizer } = require("aws-cdk-lib/aws-apigatewayv2-authorizers");
const { HttpLambdaIntegration } = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const { NodejsFunction } = require("aws-cdk-lib/aws-lambda-nodejs");
const logs = require("aws-cdk-lib/aws-logs");
const { buildParameterName, buildResourceName, removalPolicyForEnvironment } = require("../project-helpers");

function addEditorialRoutes(scope, environment, httpApi, articles) {
  const stack = cdk.Stack.of(scope);
  const name = (suffix) => buildResourceName(environment, suffix);
  const drafts = new dynamodb.Table(scope, "EditorialDrafts", {
    tableName: name("editorial-drafts"), partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: environment.name === "prod" },
    removalPolicy: removalPolicyForEnvironment(environment),
  });
  const pool = new cognito.UserPool(scope, "EditorialPool", {
    userPoolName: name("editorial"), selfSignUpEnabled: false, signInAliases: { email: true },
    mfa: cognito.Mfa.REQUIRED, mfaSecondFactor: { otp: true, sms: false },
    removalPolicy: removalPolicyForEnvironment(environment),
  });
  new cognito.CfnUserPoolGroup(scope, "EditorialGroup", { groupName: "editor", userPoolId: pool.userPoolId });
  new cognito.CfnUserPoolGroup(scope, "AdministrationGroup", { groupName: "admin", userPoolId: pool.userPoolId });
  const domain = pool.addDomain("EditorialDomain", { cognitoDomain: { domainPrefix: `${name("editorial")}-${stack.account}` } });
  const site = `https://${environment.frontendHosting.domainName || `${environment.name}.${environment.hostedZoneName}`}`;
  const callbacks = [site, ...(environment.frontendHosting.alternateDomainNames || []).map((alias) => `https://${alias}`)];
  if (environment.name === "dev") callbacks.push("http://localhost:4200", "http://localhost:6161", "http://localhost:6162");
  const loginUrls = callbacks.map((origin) => `${origin}/admin/blog`);
  const login = pool.addClient("EditorialClient", {
    generateSecret: false, preventUserExistenceErrors: true,
    oAuth: { flows: { authorizationCodeGrant: true }, scopes: [cognito.OAuthScope.OPENID], callbackUrls: loginUrls, logoutUrls: loginUrls },
  });
  const branding = new cognito.CfnUserPoolUICustomizationAttachment(scope, "EditorialLoginBranding", {
    clientId: login.userPoolClientId, userPoolId: pool.userPoolId,
    css: readFileSync(path.join(__dirname, "editorial-login.css"), "utf8"),
  });
  branding.node.addDependency(domain);
  const authorizer = new HttpJwtAuthorizer("EditorialAuthorizer", pool.userPoolProviderUrl, { jwtAudience: [login.userPoolClientId] });
  const parameter = buildParameterName(environment, "editorial/ingest-token-sha256");
  const defineFunction = (id, handler, variables) => new NodejsFunction(scope, `Editorial${id}`, {
    functionName: name(`editorial-${handler}`), entry: path.resolve(__dirname, "../../lambda/editorial/index.js"), handler,
    runtime: lambda.Runtime.NODEJS_24_X, bundling: { target: "node24" }, timeout: cdk.Duration.seconds(10),
    environment: variables, logGroup: new logs.LogGroup(scope, `Editorial${id}Logs`, { retention: logs.RetentionDays.ONE_WEEK }),
  });
  const dataVariables = { DRAFTS_TABLE: drafts.tableName, ARTICLES_TABLE: articles.tableName };
  const editor = defineFunction("Editor", "editor", dataVariables);
  drafts.grantReadWriteData(editor);
  articles.grantWriteData(editor);
  const ingest = defineFunction("Ingest", "ingest", { DRAFTS_TABLE: drafts.tableName, INGEST_HASH_PARAMETER: parameter });
  drafts.grant(ingest, "dynamodb:GetItem", "dynamodb:PutItem");
  ingest.addToRolePolicy(new iam.PolicyStatement({ actions: ["ssm:GetParameter"], resources: [stack.formatArn({ service: "ssm", resource: "parameter", resourceName: parameter.slice(1) })] }));
  const config = defineFunction("Config", "config", { LOGIN_DOMAIN: domain.baseUrl(), LOGIN_CLIENT: login.userPoolClientId });
  const automatic = defineFunction("Automatic", "autopublish", dataVariables);
  drafts.grantReadWriteData(automatic);
  articles.grantWriteData(automatic);
  new events.Rule(scope, "EditorialPublicationSchedule", { schedule: events.Schedule.rate(cdk.Duration.minutes(30)), targets: [new targets.LambdaFunction(automatic)] });

  const editorIntegration = new HttpLambdaIntegration("EditorialEditorIntegration", editor);
  for (const [method, suffix] of [["GET", "drafts"], ["PUT", "drafts/{slug}"], ["DELETE", "drafts/{slug}"], ["POST", "drafts/{slug}/{action}"], ["GET", "settings"], ["PUT", "settings"], ["POST", "preview"], ["GET", "test-articles"], ["GET", "test-articles/{slug}"]]) {
    httpApi.addRoutes({ path: `/api/editorial/${suffix}`, methods: [gateway.HttpMethod[method]], integration: editorIntegration,
      authorizer, authorizationScopes: ["openid"] });
  }
  httpApi.addRoutes({ path: "/api/editorial/config", methods: [gateway.HttpMethod.GET], integration: new HttpLambdaIntegration("EditorialConfigIntegration", config) });
  const ingestRoutes = httpApi.addRoutes({ path: "/api/editorial/ingest", methods: [gateway.HttpMethod.POST], integration: new HttpLambdaIntegration("EditorialIngestIntegration", ingest) });
  httpApi.defaultStage?.node.addDependency(...ingestRoutes);
  httpApi.defaultStage?.node.defaultChild.addPropertyOverride("RouteSettings.POST /api/editorial/ingest", {
    ThrottlingBurstLimit: 4, ThrottlingRateLimit: 1,
  });
  new cdk.CfnOutput(scope, "EditorialUserPoolId", { value: pool.userPoolId });
  new cdk.CfnOutput(scope, "EditorialIngestHashParameter", { value: parameter });
  return { authorizer, callbacks };
}

module.exports = { addEditorialRoutes };
