EC2 Instance for OpenClaw

- Setup the instance with minimum access to the internet. (No SSH access, SSM access only)
- Provides IAM role access to Bedrock and SSM.

# Deploy

## EC2 + dev instance role

Deploys the OpenClaw EC2 instances and their IAM role (`OpenClawInstanceRole`) into the dev account. This is the standard deploy you run for any change to the EC2 or its permissions.

```
npm install
npx cdk synth --profile {profile} --region {region}
pnpm deploy:ec2-dev
```

> **Important:** If you also need cross-account prod access, deploy with `PROD_ACCOUNT_ID` set so the `sts:AssumeRole` policy is added to the instance role. Without it, the bot won't be able to assume the prod cross-account role at runtime:
> ```
> PROD_ACCOUNT_ID=<prod-account-id> pnpm deploy:ec2-dev
> ```

## Cross-account role (prod access)

Use this when you need OpenClaw to read AWS resources in the **prod account** (CloudWatch alarms, Step Functions executions, Lambda invocations). This deploys a single IAM role (`OpenClawCrossAccountRole`) into the prod account that trusts the dev account's `OpenClawInstanceRole`.

Only needs to be run once (or when prod permissions change). Requires prod AWS credentials to be setup as `noxx-prod`.

`DEV_ACCOUNT_ID` must be set explicitly — CDK overwrites `CDK_DEFAULT_ACCOUNT` with the prod account when using the prod profile, so the trust policy would point to the wrong account without it.

```
DEV_ACCOUNT_ID=<dev-account-id> PROD_ACCOUNT_ID=<prod-account-id> pnpm deploy:iam-cross-account-prod
```

Once deployed, the OpenClaw bot can assume the prod role at runtime using `sts:AssumeRole` — no credentials are stored on the instance.

> **When to use:** Any time OpenClaw needs to inspect prod AWS resources (e.g. to investigate a CloudWatch alarm from `#z-notification-prod` and create a Linear task).

# Connect to the instance

```
aws ssm start-session --target {instance-id} --profile={profile} --region={region} --document-name=AWS-StartInteractiveCommand --parameters command='["bash -l"]'
```

Then you can install OpenClaw, following the instructions in the [OpenClaw Document](https://docs.openclaw.ai/start/getting-started). Skip setup for LLM/models at onboarding.

Then setup below so you can use Bedrock from the instance. (ref: https://docs.openclaw.ai/providers/bedrock). Make sure to replace `us-east-1` with the region of your Bedrock instance.

```
openclaw config set models.bedrockDiscovery.enabled true
openclaw config set models.bedrockDiscovery.region us-east-1

# Set the workaround env vars
echo 'export AWS_PROFILE=default' >> ~/.bashrc
echo 'export AWS_REGION=us-east-1' >> ~/.bashrc
source ~/.bashrc

# Verify models are discovered
openclaw models list
```
