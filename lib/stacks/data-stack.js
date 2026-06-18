"use strict";

const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const ssm = require("aws-cdk-lib/aws-ssm");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
const {
  applyPortfolioTags,
  buildParameterName,
  buildResourceName,
  removalPolicyForEnvironment,
} = require("../project-helpers");

class DataStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { environment } = props;
    applyPortfolioTags(this, environment);

    const migrationExportPrefix = `migration/portfolio-${environment.name}/mongo-export`;

    addStringParameter(this, environment, "EnvironmentNameParameter", "environment/name", environment.name);
    addStringParameter(this, environment, "ApiDomainNameParameter", "api/domain-name", environment.apiDomainName);
    addStringParameter(this, environment, "AssetsBucketNameParameter", "assets/bucket-name", environment.currentAssetsBucketName);
    addStringParameter(this, environment, "AssetsDomainNameParameter", "assets/domain-name", environment.assetDomainName);
    addStringParameter(this, environment, "AssetsDistributionIdParameter", "assets/distribution-id", environment.currentAssetsDistributionId);
    addStringParameter(this, environment, "MigrationExportPrefixParameter", "migration/export-prefix", migrationExportPrefix);

    const tables = {
      main: createPortfolioTable(this, environment, "MainContentTable", "main", { entityIndex: true }),
      articles: createPortfolioTable(this, environment, "ArticlesTable", "articles", { entityIndex: true }),
      articleSections: createPortfolioTable(this, environment, "ArticleSectionsTable", "article-sections", { entityIndex: true }),
      articleCategories: createPortfolioTable(this, environment, "ArticleCategoriesTable", "article-categories", { entityIndex: true }),
      files: createPortfolioTable(this, environment, "FilesTable", "files", { entityIndex: true }),
      migrationManifests: createPortfolioTable(this, environment, "MigrationManifestsTable", "migration-manifests"),
    };
    this.tables = tables;

    addStringParameter(this, environment, "MainTableNameParameter", "dynamodb/main-table-name", tables.main.tableName);
    addStringParameter(this, environment, "ArticlesTableNameParameter", "dynamodb/articles-table-name", tables.articles.tableName);
    addStringParameter(this, environment, "ArticleSectionsTableNameParameter", "dynamodb/article-sections-table-name", tables.articleSections.tableName);
    addStringParameter(this, environment, "ArticleCategoriesTableNameParameter", "dynamodb/article-categories-table-name", tables.articleCategories.tableName);
    addStringParameter(this, environment, "FilesTableNameParameter", "dynamodb/files-table-name", tables.files.tableName);
    addStringParameter(this, environment, "MigrationManifestsTableNameParameter", "dynamodb/migration-manifests-table-name", tables.migrationManifests.tableName);

    const migrationSecret = new secretsmanager.CfnSecret(this, "MigrationMongoSourceSecret", {
      name: buildResourceName(environment, "migration", "mongo-source"),
      description: `Placeholder for ${environment.name} MongoDB migration source credentials. Do not commit secret values.`,
    });
    migrationSecret.applyRemovalPolicy(removalPolicyForEnvironment(environment));

    new cdk.CfnOutput(this, "DataPlan", {
      value: "Foundation: existing S3 media references, SSM parameters, and migration secret placeholder. DynamoDB tables are planned for the next data phase.",
    });
  }
}

function addStringParameter(scope, environment, id, parameterPath, value) {
  return new ssm.StringParameter(scope, id, {
    parameterName: buildParameterName(environment, parameterPath),
    stringValue: value,
  });
}

function createPortfolioTable(scope, environment, id, resourceName, options = {}) {
  const table = new dynamodb.Table(scope, id, {
    tableName: buildResourceName(environment, resourceName),
    partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecoverySpecification: environment.name === "prod"
      ? { pointInTimeRecoveryEnabled: true }
      : undefined,
    removalPolicy: removalPolicyForEnvironment(environment),
  });

  if (options.entityIndex) {
    table.addGlobalSecondaryIndex({
      indexName: "ByEntity",
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
    });
  }

  return table;
}

module.exports = {
  DataStack,
};
