"use strict";

const path = require("node:path");
const fs = require("node:fs");
const cdk = require("aws-cdk-lib");
const { HttpMethod } = require("aws-cdk-lib/aws-apigatewayv2");
const { HttpLambdaIntegration } = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const bedrock = require("aws-cdk-lib/aws-bedrock");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const events = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const logs = require("aws-cdk-lib/aws-logs");
const s3 = require("aws-cdk-lib/aws-s3");
const s3vectors = require("aws-cdk-lib/aws-s3vectors");
const ssm = require("aws-cdk-lib/aws-ssm");
const { buildParameterName, buildResourceName, removalPolicyForEnvironment } = require("../project-helpers");

function addAssistant(scope, environment, api, editorial, tables) {
  const bundle = path.resolve(__dirname, "../../.assistant-build");
  if (!fs.existsSync(path.join(bundle, "strands", "__init__.py"))) {
    throw new Error("Run python scripts/package-assistant.py before synthesizing the assistant.");
  }
  const stack = cdk.Stack.of(scope);
  const name = (suffix) => buildResourceName(environment, suffix);
  const retention = removalPolicyForEnvironment(environment);
  const sourceBucket = new s3.Bucket(scope, "AssistantCorpus", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.S3_MANAGED, enforceSSL: true,
    removalPolicy: retention, autoDeleteObjects: environment.name !== "prod",
  });
  const vectorBucket = new s3vectors.CfnVectorBucket(scope, "AssistantVectorBucket", { vectorBucketName: `${name("blog-vectors")}-${stack.account}` });
  const index = new s3vectors.CfnIndex(scope, "AssistantVectorIndex", {
    vectorBucketArn: vectorBucket.attrVectorBucketArn, indexName: "articles", dataType: "float32", dimension: 1024,
    distanceMetric: "cosine", metadataConfiguration: { nonFilterableMetadataKeys: ["AMAZON_BEDROCK_TEXT", "AMAZON_BEDROCK_METADATA"] },
  });
  const embeddingArn = `arn:${stack.partition}:bedrock:${stack.region}::foundation-model/amazon.titan-embed-text-v2:0`;
  const knowledgeRole = new iam.Role(scope, "AssistantKnowledgeRole", { assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com", {
    conditions: { StringEquals: { "aws:SourceAccount": stack.account }, ArnLike: { "aws:SourceArn": stack.formatArn({ service: "bedrock", resource: "knowledge-base", resourceName: "*" }) } },
  }) });
  const sourceGrant = sourceBucket.grantRead(knowledgeRole, "published/*");
  const knowledgePolicy = new iam.Policy(scope, "AssistantKnowledgePolicy", { roles: [knowledgeRole], statements: [
    new iam.PolicyStatement({ actions: ["bedrock:InvokeModel"], resources: [embeddingArn] }),
    new iam.PolicyStatement({ actions: ["s3vectors:GetIndex", "s3vectors:GetVectors", "s3vectors:PutVectors", "s3vectors:DeleteVectors", "s3vectors:ListVectors", "s3vectors:QueryVectors"], resources: [index.attrIndexArn] }),
  ] });
  const kb = new bedrock.CfnKnowledgeBase(scope, "AssistantKnowledgeBase", {
    name: name("blog-kb"), roleArn: knowledgeRole.roleArn,
    knowledgeBaseConfiguration: { type: "VECTOR", vectorKnowledgeBaseConfiguration: { embeddingModelArn: embeddingArn } },
    storageConfiguration: { type: "S3_VECTORS", s3VectorsConfiguration: { vectorBucketArn: vectorBucket.attrVectorBucketArn, indexArn: index.attrIndexArn } },
  });
  kb.node.addDependency(knowledgePolicy);
  sourceGrant.applyBefore(kb);
  const data = new bedrock.CfnDataSource(scope, "AssistantDataSource", {
    name: "published-blog", knowledgeBaseId: kb.attrKnowledgeBaseId, dataDeletionPolicy: "DELETE",
    dataSourceConfiguration: { type: "S3", s3Configuration: { bucketArn: sourceBucket.bucketArn, inclusionPrefixes: ["published/"] } },
    vectorIngestionConfiguration: { chunkingConfiguration: { chunkingStrategy: "FIXED_SIZE", fixedSizeChunkingConfiguration: { maxTokens: 220, overlapPercentage: 15 } } },
  });
  const guardrail = new bedrock.CfnGuardrail(scope, "AssistantGuardrail", {
    name: name("blog-guardrail"), blockedInputMessaging: "Request blocked.", blockedOutputsMessaging: "Response blocked.",
    contentPolicyConfig: { filtersConfig: [
      { type: "PROMPT_ATTACK", inputStrength: "HIGH", outputStrength: "NONE" },
      { type: "MISCONDUCT", inputStrength: "MEDIUM", outputStrength: "MEDIUM" },
    ] },
    sensitiveInformationPolicyConfig: { piiEntitiesConfig: ["AWS_ACCESS_KEY", "AWS_SECRET_KEY", "PASSWORD", "EMAIL", "PHONE"]
      .map((type) => ({ type, action: "BLOCK" })) },
  });
  const guardrailVersion = new bedrock.CfnGuardrailVersion(scope, "AssistantGuardrailVersion", { guardrailIdentifier: guardrail.attrGuardrailId });
  const quotas = new dynamodb.Table(scope, "AssistantQuotas", {
    tableName: name("assistant-quotas"), partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, timeToLiveAttribute: "expiresAt", removalPolicy: retention,
  });
  const flag = new ssm.StringParameter(scope, "AssistantFlag", { parameterName: buildParameterName(environment, "assistant/status"), stringValue: "paused" });
  const saltPath = buildParameterName(environment, "assistant/ip-salt");
  const modelId = "amazon.nova-micro-v1:0";
  const createFunction = (id, handler, seconds, concurrency, vars) => new lambda.Function(scope, id, {
    functionName: name(id === "AssistantQuery" ? "assistant-query" : "assistant-indexer"), handler,
    code: lambda.Code.fromAsset(bundle), runtime: lambda.Runtime.PYTHON_3_13,
    timeout: cdk.Duration.seconds(seconds), reservedConcurrentExecutions: concurrency, memorySize: 512, environment: vars,
    logGroup: new logs.LogGroup(scope, `${id}Logs`, { retention: logs.RetentionDays.ONE_WEEK }),
  });
  const shared = { ARTICLES_TABLE: tables.articles.tableName, KNOWLEDGE_BASE_ID: kb.attrKnowledgeBaseId };
  const query = createFunction("AssistantQuery", "app.handler", 25, 3, { ...shared, QUOTA_TABLE: quotas.tableName,
    GUARDRAIL_ID: guardrail.attrGuardrailId, GUARDRAIL_VERSION: guardrailVersion.attrVersion, MODEL_ID: modelId,
    AI_STATUS_PARAMETER: flag.parameterName, IP_SALT_PARAMETER: saltPath, WEB_ORIGINS: editorial.callbacks.join(","),
  });
  tables.articles.grantReadData(query);
  quotas.grant(query, "dynamodb:UpdateItem", "dynamodb:GetItem");
  flag.grantRead(query);
  query.addToRolePolicy(new iam.PolicyStatement({ actions: ["ssm:GetParameter"], resources: [stack.formatArn({ service: "ssm", resource: "parameter", resourceName: saltPath.slice(1) })] }));
  query.addToRolePolicy(new iam.PolicyStatement({ actions: ["bedrock:Retrieve"], resources: [kb.attrKnowledgeBaseArn] }));
  query.addToRolePolicy(new iam.PolicyStatement({ actions: ["bedrock:ApplyGuardrail"], resources: [guardrail.attrGuardrailArn] }));
  query.addToRolePolicy(new iam.PolicyStatement({ actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "bedrock:CountTokens"], resources: [
    `arn:${stack.partition}:bedrock:${stack.region}::foundation-model/${modelId}`,
  ] }));
  const indexer = createFunction("AssistantIndexer", "indexer.handler", 90, 1, { ...shared,
    SOURCE_BUCKET: sourceBucket.bucketName, SOURCE_ID: data.attrDataSourceId, SECTIONS_TABLE: tables.articleSections.tableName,
  });
  tables.articles.grantReadData(indexer);
  tables.articleSections.grantReadData(indexer);
  sourceBucket.grantReadWrite(indexer);
  indexer.addToRolePolicy(new iam.PolicyStatement({ actions: ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"], resources: [kb.attrKnowledgeBaseArn] }));
  if (environment.name === "prod") {
    new events.Rule(scope, "AssistantIndexSchedule", { schedule: events.Schedule.rate(cdk.Duration.minutes(30)), targets: [new targets.LambdaFunction(indexer)] });
    const budgetMetric = query.logGroup.addMetricFilter("BudgetWarnings", {
      filterPattern: logs.FilterPattern.literal('"portfolio_assistant_budget_alert"'),
      metricNamespace: "LynxPortfolio", metricName: "AssistantBudgetWarning", metricValue: "1",
    });
    new cloudwatch.Alarm(scope, "AssistantBudgetWarning", {
      alarmName: name("assistant-estimated-cost-warning"), metric: budgetMetric.metric({ statistic: "sum" }),
      threshold: 1, evaluationPeriods: 1, treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
  api.addRoutes({ path: "/api/editorial/assistant", methods: [HttpMethod.POST], integration: new HttpLambdaIntegration("AssistantBeta", query),
    authorizer: editorial.authorizer, authorizationScopes: ["openid"] });
  new cdk.CfnOutput(scope, "AssistantSaltParameter", { value: saltPath });
  return query;
}

module.exports = { addAssistant };
