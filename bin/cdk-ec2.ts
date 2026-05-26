#!/usr/bin/env node
import * as dotenv from "dotenv";
dotenv.config();

import * as cdk from "aws-cdk-lib";
import { CdkEc2Stack } from "../lib/cdk-ec2-stack";
import { CdkIamCrossAccountStack } from "../lib/cdk-iam-cross-account-stack";
import { CdkEc2ExternalStack } from "../lib/cdk-ec2-external-stack";

const app = new cdk.App();

// DEV_ACCOUNT_ID takes precedence over CDK_DEFAULT_ACCOUNT so the correct dev
// account is used even when deploying the prod stack with a prod AWS profile.
const devAccountId =
  process.env.DEV_ACCOUNT_ID ?? process.env.CDK_DEFAULT_ACCOUNT;
const prodAccountId = process.env.PROD_ACCOUNT_ID;

new CdkEc2Stack(app, "CdkEc2Stack", {
  env: {
    account: devAccountId,
    region: "us-west-2",
  },
});

// This stack is used for OpenClaw external access so isolated in us-east-2 region
new CdkEc2ExternalStack(app, "CdkEc2ExternalStack", {
  env: {
    account: devAccountId,
    region: "us-east-2",
  },
});

new CdkIamCrossAccountStack(app, "OpenClawCrossAccountProd", {
  trustedRoleArn: `arn:aws:iam::${devAccountId}:role/OpenClawInstanceRole`,
  env: {
    account: prodAccountId,
    region: "us-west-2",
  },
});
