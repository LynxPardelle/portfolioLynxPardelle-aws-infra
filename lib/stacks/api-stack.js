"use strict";

const cdk = require("aws-cdk-lib");
const apigatewayv2 = require("aws-cdk-lib/aws-apigatewayv2");
const iam = require("aws-cdk-lib/aws-iam");
const integrations = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const lambda = require("aws-cdk-lib/aws-lambda");
const nodejs = require("aws-cdk-lib/aws-lambda-nodejs");
const path = require("path");
const { applyPortfolioTags, buildResourceName } = require("../project-helpers");

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
      runtime: lambda.Runtime.NODEJS_20_X,
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
        target: "node20",
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
