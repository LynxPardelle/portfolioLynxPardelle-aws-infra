"use strict";

const cdk = require("aws-cdk-lib");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const cf = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const lambda = require("aws-cdk-lib/aws-lambda");
const pricing = require("aws-cdk-lib/aws-pricingplanmanager");
const route53 = require("aws-cdk-lib/aws-route53");
const targets = require("aws-cdk-lib/aws-route53-targets");
const waf = require("aws-cdk-lib/aws-wafv2");
const { applyPortfolioTags, buildResourceName } = require("../project-helpers");

class AssistantEdgeStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    const { environment, assistant } = props;
    applyPortfolioTags(this, environment);
    const name = buildResourceName(environment, "assistant-edge");
    const domain = `ai.${environment.hostedZoneName}`;
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", { hostedZoneId: environment.hostedZoneId, zoneName: environment.hostedZoneName });
    const certificate = new acm.Certificate(this, "Certificate", { domainName: domain, validation: acm.CertificateValidation.fromDns(zone) });
    const url = new lambda.CfnUrl(this, "AssistantUrl", { authType: "AWS_IAM", targetFunctionArn: assistant.functionArn });
    const oac = new cf.CfnOriginAccessControl(this, "AssistantOriginControl", { originAccessControlConfig: {
      name, originAccessControlOriginType: "lambda", signingBehavior: "always", signingProtocol: "sigv4",
    } });
    const acl = new waf.CfnWebACL(this, "AssistantAcl", { name, scope: "CLOUDFRONT", defaultAction: { allow: {} },
      visibilityConfig: { cloudWatchMetricsEnabled: true, sampledRequestsEnabled: false, metricName: name },
      rules: [{ name: "ViewerRate", priority: 1, action: { block: {} },
        statement: { rateBasedStatement: { aggregateKeyType: "IP", limit: 60, evaluationWindowSec: 300 } },
        visibilityConfig: { cloudWatchMetricsEnabled: true, sampledRequestsEnabled: false, metricName: `${name}-rate` },
      }],
    });
    const viewerAddress = new cf.Function(this, "AssistantViewerAddress", {
      runtime: cf.FunctionRuntime.JS_2_0,
      code: cf.FunctionCode.fromInline(`function handler(event) {
        event.request.headers['x-portfolio-viewer-ip'] = { value: event.viewer.ip };
        return event.request;
      }`),
    });
    const distribution = new cf.Distribution(this, "AssistantDistribution", {
      domainNames: [domain], certificate, webAclId: acl.attrArn,
      defaultBehavior: { origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split("/", url.attrFunctionUrl))),
        cachePolicy: cf.CachePolicy.CACHING_DISABLED, originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY, allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        functionAssociations: [{ function: viewerAddress, eventType: cf.FunctionEventType.VIEWER_REQUEST }],
      },
    });
    distribution.node.defaultChild.addPropertyOverride("DistributionConfig.Origins.0.OriginAccessControlId", oac.attrId);
    const distributionArn = this.formatArn({ service: "cloudfront", region: "", resource: "distribution", resourceName: distribution.distributionId });
    new lambda.CfnPermission(this, "AllowOriginUrl", { action: "lambda:InvokeFunctionUrl", functionName: assistant.functionArn,
      principal: "cloudfront.amazonaws.com", sourceArn: distributionArn, functionUrlAuthType: "AWS_IAM" });
    new lambda.CfnPermission(this, "AllowOriginInvoke", { action: "lambda:InvokeFunction", functionName: assistant.functionArn,
      principal: "cloudfront.amazonaws.com", sourceArn: distributionArn, invokedViaFunctionUrl: true });
    const subscription = new pricing.CfnSubscription(this, "FreePlan", { planFamily: "CloudFront", planTier: "FREE", resourceArns: [distributionArn, acl.attrArn] });
    const record = new route53.ARecord(this, "AssistantAlias", { zone, recordName: domain, target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)) });
    record.node.addDependency(subscription);
    new cdk.CfnOutput(this, "AssistantFreeSubscription", { value: subscription.ref });
    new cdk.CfnOutput(this, "AssistantPublicEndpoint", { value: `https://${domain}/blog-assistant` });
  }
}

module.exports = { AssistantEdgeStack };
