"use strict";

const cdk = require("aws-cdk-lib");
const apigatewayv2 = require("aws-cdk-lib/aws-apigatewayv2");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const iam = require("aws-cdk-lib/aws-iam");
const integrations = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const lambda = require("aws-cdk-lib/aws-lambda");
const nodejs = require("aws-cdk-lib/aws-lambda-nodejs");
const route53 = require("aws-cdk-lib/aws-route53");
const targets = require("aws-cdk-lib/aws-route53-targets");
const path = require("path");
const { applyPortfolioTags, buildResourceName } = require("../project-helpers");
const { addEditorialRoutes } = require("./editorial");
const { addAssistant } = require("./assistant");

class ApiStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { environment, tables } = props;
    if (!tables) {
      throw new Error("ApiStack requires DynamoDB tables from DataStack.");
    }

    applyPortfolioTags(this, props.environment);

    const publicApiFunction = new nodejs.NodejsFunction(this, "PublicApiFunction", {
      functionName: buildResourceName(environment, "public-api"),
      description: `Read-only public portfolio API for ${environment.name}.`,
      entry: path.join(__dirname, "..", "..", "lambda", "public-api", "index.js"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ENVIRONMENT_NAME: environment.name,
        MAIN_TABLE: tables.main.tableName,
        ARTICLES_TABLE: tables.articles.tableName,
        ARTICLE_SECTIONS_TABLE: tables.articleSections.tableName,
        ARTICLE_CATEGORIES_TABLE: tables.articleCategories.tableName,
        FILES_TABLE: tables.files.tableName,
        ASSETS_BUCKET: environment.currentAssetsBucketName,
        ASSETS_DOMAIN: environment.assetDomainName,
      },
      bundling: {
        target: "node24",
        sourceMap: true,
        minify: false,
      },
    });

    const readableTables = [
      tables.main,
      tables.articles,
      tables.articleSections,
      tables.articleCategories,
      tables.files,
    ];
    publicApiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "dynamodb:BatchGetItem",
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
      ],
      resources: readableTables.flatMap((table) => [
        table.tableArn,
        `${table.tableArn}/index/*`,
      ]),
    }));

    const integration = new integrations.HttpLambdaIntegration(
      "PublicApiIntegration",
      publicApiFunction
    );

    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: buildResourceName(environment, "public-api"),
      description: `Portfolio ${environment.name} public read API.`,
      corsPreflight: {
        allowHeaders: ["content-type", "authorization"],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowOrigins: ["*"],
      },
    });

    httpApi.addRoutes({
      path: "/",
      methods: [apigatewayv2.HttpMethod.ANY],
      integration,
    });
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigatewayv2.HttpMethod.ANY],
      integration,
    });
    this.httpApi = httpApi;
    this.editorial = addEditorialRoutes(this, environment, httpApi, tables.articles);
    const contentEditor = new nodejs.NodejsFunction(this, "PortfolioEditor", {
      functionName: buildResourceName(environment, "content-editor"),
      entry: path.join(__dirname, "..", "..", "lambda", "portfolio-editor", "index.js"),
      handler: "handler", runtime: lambda.Runtime.NODEJS_24_X, timeout: cdk.Duration.seconds(10),
      bundling: { target: "node24" },
      environment: { MAIN_TABLE: tables.main.tableName, FILES_TABLE: tables.files.tableName },
    });
    contentEditor.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query", "dynamodb:PutItem", "dynamodb:DeleteItem"], resources: [tables.main.tableArn],
      conditions: { "ForAllValues:StringEquals": { "dynamodb:LeadingKeys": [
        "MAIN", "MAIN#websites", "MAIN#bookimgs", "MAIN#videos", "MAIN#albums", "MAIN#songs",
      ] } },
    }));
    tables.files.grant(contentEditor, "dynamodb:GetItem", "dynamodb:Scan");
    const adminIntegration = new integrations.HttpLambdaIntegration("PortfolioEditorIntegration", contentEditor);
    for (const [suffix, methods] of [
      ["content", ["GET"]], ["media", ["GET"]], ["content/{collection}", ["GET", "POST"]],
      ["content/{collection}/{id}", ["PUT", "DELETE"]],
    ]) {
      httpApi.addRoutes({ path: `/api/admin/${suffix}`, methods: methods.map((method) => apigatewayv2.HttpMethod[method]),
        integration: adminIntegration, authorizer: this.editorial.authorizer, authorizationScopes: ["openid"] });
    }
    if (environment.assistantEnabled) this.assistant = addAssistant(this, environment, httpApi, this.editorial, tables);

    if (environment.apiCustomDomainEnabled) {
      if (!environment.apiCertificateArn) {
        throw new Error(`Missing apiCertificateArn for ${environment.name} custom API domain.`);
      }
      if (!environment.hostedZoneId) {
        throw new Error(`Missing hostedZoneId for ${environment.name} custom API domain.`);
      }

      const certificate = acm.Certificate.fromCertificateArn(
        this,
        "ApiDomainCertificate",
        environment.apiCertificateArn
      );
      const domainName = new apigatewayv2.DomainName(this, "ApiDomainName", {
        domainName: environment.apiDomainName,
        certificate,
        endpointType: apigatewayv2.EndpointType.REGIONAL,
        securityPolicy: apigatewayv2.SecurityPolicy.TLS_1_2,
      });
      new apigatewayv2.ApiMapping(this, "ApiRootMapping", {
        api: httpApi,
        domainName,
      });

      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
        hostedZoneId: environment.hostedZoneId,
        zoneName: environment.hostedZoneName,
      });
      const aliasTarget = route53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          domainName.regionalDomainName,
          domainName.regionalHostedZoneId
        )
      );

      new route53.ARecord(this, "ApiDomainAliasA", {
        zone: hostedZone,
        recordName: environment.apiDomainName,
        target: aliasTarget,
      });
      new route53.AaaaRecord(this, "ApiDomainAliasAAAA", {
        zone: hostedZone,
        recordName: environment.apiDomainName,
        target: aliasTarget,
      });

      new cdk.CfnOutput(this, "PublicApiCustomDomainName", {
        value: domainName.name,
      });
      new cdk.CfnOutput(this, "PublicApiRegionalDomainName", {
        value: domainName.regionalDomainName,
      });
    }

    new cdk.CfnOutput(this, "PublicApiEndpoint", {
      value: httpApi.apiEndpoint,
    });
    new cdk.CfnOutput(this, "PublicApiFunctionName", {
      value: publicApiFunction.functionName,
    });
  }
}

module.exports = {
  ApiStack,
};
