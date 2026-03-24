#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkEc2Stack } from '../lib/cdk-ec2-stack';
import { CdkIamCrossAccountStack } from '../lib/cdk-iam-cross-account-stack';

const app = new cdk.App();

const devAccountId = process.env.CDK_DEFAULT_ACCOUNT;
const prodAccountId = process.env.PROD_ACCOUNT_ID;

new CdkEc2Stack(app, 'CdkEc2Stack', {
  env: {
    account: devAccountId,
    region: 'us-west-2',
  },
});

if (prodAccountId) {
  new CdkIamCrossAccountStack(app, 'OpenClawCrossAccountProd', {
    trustedRoleArn: `arn:aws:iam::${devAccountId}:role/OpenClawInstanceRole`,
    env: {
      account: prodAccountId,
      region: 'us-west-2',
    },
  });
}
