"use strict";

const cdk = require("aws-cdk-lib");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const logs = require("aws-cdk-lib/aws-logs");
const route53 = require("aws-cdk-lib/aws-route53");
const targets = require("aws-cdk-lib/aws-route53-targets");
const s3 = require("aws-cdk-lib/aws-s3");
const ssm = require("aws-cdk-lib/aws-ssm");
const { applyPortfolioTags, buildParameterName, buildResourceName } = require("../project-helpers");

class FrontendStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { environment } = props;
    applyPortfolioTags(this, environment);

    const frontend = environment.frontendHosting;
    if (!frontend) {
      throw new Error(`Missing frontendHosting configuration for ${environment.name}.`);
    }

    addStringParameter(this, environment, "FrontendArchitectureParameter", "frontend/hosting-architecture", frontend.architecture);
    addStringParameter(this, environment, "FrontendApiBaseUrlParameter", "frontend/api-base-url", frontend.apiBaseUrl);
    addStringParameter(this, environment, "FrontendArtifactBucketParameter", "frontend/artifact-bucket-name", frontend.artifactBucketName);
    addStringParameter(this, environment, "FrontendArtifactBasePrefixParameter", "frontend/artifact-base-prefix", frontend.artifactBasePrefix);
    addStringParameter(this, environment, "FrontendManifestKeyPatternParameter", "frontend/manifest-key-pattern", frontend.manifestKeyPattern);
    addStringParameter(this, environment, "FrontendStaticPrefixPatternParameter", "frontend/static-prefix-pattern", frontend.staticPrefixPattern);
    addStringParameter(this, environment, "FrontendServerBundlePrefixPatternParameter", "frontend/server-bundle-prefix-pattern", frontend.serverBundlePrefixPattern);
    addStringParameter(this, environment, "FrontendSsrRuntimeParameter", "frontend/ssr-runtime", frontend.ssrRuntime);
    addStringParameter(this, environment, "FrontendReleaseIdParameter", "frontend/release-id", frontend.releaseId || "not-configured");

    const publisherRole = createFrontendPublisherRole(this, environment, frontend);
    addStringParameter(this, environment, "FrontendPublisherRoleArnParameter", "frontend/publisher-role-arn", publisherRole.roleArn);

    new cdk.CfnOutput(this, "FrontendArtifactBucketName", {
      value: frontend.artifactBucketName,
    });
    new cdk.CfnOutput(this, "FrontendArtifactBasePrefix", {
      value: frontend.artifactBasePrefix,
    });
    new cdk.CfnOutput(this, "FrontendApiBaseUrl", {
      value: frontend.apiBaseUrl,
    });
    new cdk.CfnOutput(this, "FrontendPublisherRoleArn", {
      value: publisherRole.roleArn,
    });

    if (!frontend.releaseId) {
      new cdk.CfnOutput(this, "FrontendPlan", {
        value: "Foundation only: set FRONTEND_RELEASE_ID to deploy Lambda SSR and CloudFront from the published Angular artifact.",
      });
      return;
    }

    const artifactBucket = s3.Bucket.fromBucketName(this, "FrontendArtifactBucket", frontend.artifactBucketName);
    const serverBundleKey = requiredValue(frontend.serverBundleKey, "serverBundleKey", environment);
    const staticPrefix = requiredValue(frontend.staticPrefix, "staticPrefix", environment);
    const ssrFunctionName = buildResourceName(environment, "frontend", "ssr");

    const ssrLogGroup = new logs.LogGroup(this, "FrontendSsrLogGroup", {
      logGroupName: `/aws/lambda/${ssrFunctionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: environment.removalPolicy === "retain" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const ssrFunction = new lambda.Function(this, "FrontendSsrFunction", {
      functionName: ssrFunctionName,
      description: `Angular SSR frontend for portfolio ${environment.name}.`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "index.handler",
      code: lambda.Code.fromBucket(artifactBucket, serverBundleKey),
      memorySize: frontend.ssrMemorySizeMb || 512,
      timeout: cdk.Duration.seconds(frontend.ssrTimeoutSeconds || 15),
      environment: {
        API_BASE_URL: frontend.apiBaseUrl,
        NG_ALLOWED_HOSTS: allowedHostsForEnvironment(environment, frontend).join(","),
        NG_TRUST_PROXY_HEADERS: "x-forwarded-host,x-forwarded-proto",
        NODE_ENV: "production",
      },
    });
    ssrFunction.node.addDependency(ssrLogGroup);

    const functionUrl = ssrFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });

    const ssrOrigin = origins.FunctionUrlOrigin.withOriginAccessControl(functionUrl, {
      readTimeout: cdk.Duration.seconds(frontend.ssrTimeoutSeconds || 15),
      keepaliveTimeout: cdk.Duration.seconds(5),
    });
    const staticOrigin = new origins.HttpOrigin(frontend.staticOriginDomainName || environment.assetDomainName, {
      originPath: `/${staticPrefix}`,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    if (frontend.domainName && !frontend.certificateArn) {
      throw new Error(`Missing frontendHosting.certificateArn for ${environment.name} custom domain ${frontend.domainName}.`);
    }

    const certificate = frontend.certificateArn
      ? acm.Certificate.fromCertificateArn(this, "FrontendCertificate", frontend.certificateArn)
      : undefined;

    const distribution = new cloudfront.Distribution(this, "FrontendDistribution", {
      comment: `Lynx Pardelle Angular SSR frontend (${environment.name})`,
      domainNames: frontend.domainName ? [frontend.domainName, ...(frontend.alternateDomainNames || [])] : undefined,
      certificate,
      priceClass: priceClassFromConfig(frontend.cachePriceClass),
      defaultBehavior: {
        origin: ssrOrigin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
    });
    const distributionArn = cdk.Stack.of(this).formatArn({
      service: "cloudfront",
      region: "",
      resource: "distribution",
      resourceName: distribution.distributionId,
    });
    ssrFunction.addPermission("AllowCloudFrontInvokeFunctionUrl", {
      principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunctionUrl",
      sourceArn: distributionArn,
      functionUrlAuthType: lambda.FunctionUrlAuthType.AWS_IAM,
    });
    ssrFunction.addPermission("AllowCloudFrontInvokeFunction", {
      principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: distributionArn,
    });

    for (const pathPattern of ["assets/*", "*.js", "*.css", "*.ico", "*.png", "*.jpg", "*.jpeg", "*.webp", "*.svg", "*.json"]) {
      distribution.addBehavior(pathPattern, staticOrigin, {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      });
    }

    if (frontend.route53RecordsEnabled && frontend.domainName) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "FrontendHostedZone", {
        hostedZoneId: environment.hostedZoneId,
        zoneName: environment.hostedZoneName,
      });
      new route53.ARecord(this, "FrontendAliasARecord", {
        zone: hostedZone,
        recordName: frontend.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
      new route53.AaaaRecord(this, "FrontendAliasAaaaRecord", {
        zone: hostedZone,
        recordName: frontend.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    addStringParameter(this, environment, "FrontendDistributionDomainParameter", "frontend/distribution-domain-name", distribution.distributionDomainName);
    addStringParameter(this, environment, "FrontendServerBundleKeyParameter", "frontend/server-bundle-key", serverBundleKey);

    new cdk.CfnOutput(this, "FrontendReleaseId", {
      value: frontend.releaseId,
    });
    new cdk.CfnOutput(this, "FrontendDistributionDomainName", {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "FrontendSsrFunctionName", {
      value: ssrFunction.functionName,
    });
  }
}

function addStringParameter(scope, environment, id, parameterPath, value) {
  return new ssm.StringParameter(scope, id, {
    parameterName: buildParameterName(environment, parameterPath),
    stringValue: value,
  });
}

function createFrontendPublisherRole(scope, environment, frontend) {
  const repository = requiredValue(frontend.publisherRepository, "publisherRepository", environment);
  const oidcProviderArn = `arn:aws:iam::${environment.account}:oidc-provider/token.actions.githubusercontent.com`;
  const artifactPrefix = `${frontend.artifactBasePrefix}/`;
  const bucketArn = `arn:aws:s3:::${frontend.artifactBucketName}`;
  const role = new iam.Role(scope, "FrontendPublisherRole", {
    roleName: buildResourceName(environment, "frontend", "publisher"),
    description: `GitHub OIDC publisher for ${repository} ${environment.name} Angular SSR artifacts.`,
    assumedBy: new iam.FederatedPrincipal(
      oidcProviderArn,
      {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": `repo:${repository}:environment:${environment.name}`,
        },
      },
      "sts:AssumeRoleWithWebIdentity"
    ),
  });

  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["s3:ListBucket"],
      resources: [bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": [`${artifactPrefix}*`],
        },
      },
    })
  );
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: [`${bucketArn}/${artifactPrefix}*`],
    })
  );

  return role;
}

function requiredValue(value, fieldName, environment) {
  if (!value) {
    throw new Error(`Missing frontendHosting.${fieldName} for ${environment.name}.`);
  }
  return value;
}

function priceClassFromConfig(value) {
  switch (value) {
    case "PRICE_CLASS_ALL":
      return cloudfront.PriceClass.PRICE_CLASS_ALL;
    case "PRICE_CLASS_200":
      return cloudfront.PriceClass.PRICE_CLASS_200;
    case "PRICE_CLASS_100":
    default:
      return cloudfront.PriceClass.PRICE_CLASS_100;
  }
}

function allowedHostsForEnvironment(environment, frontend) {
  return [
    frontend.domainName,
    ...(frontend.alternateDomainNames || []),
    environment.hostedZoneName,
    `www.${environment.hostedZoneName}`,
    `dev.${environment.hostedZoneName}`,
    `tst.${environment.hostedZoneName}`,
    "*.cloudfront.net",
    `*.lambda-url.${environment.region}.on.aws`,
  ].filter(Boolean);
}

module.exports = {
  FrontendStack,
};
