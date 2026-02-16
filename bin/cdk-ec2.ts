#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkEc2Stack } from '../lib/cdk-ec2-stack';

const app = new cdk.App();
new CdkEc2Stack(app, 'CdkEc2Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-west-2',
  },
});