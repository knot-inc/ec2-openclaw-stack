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
>
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

## External Claw EC2 instance

Use this to create OpenClaw for accessing external service(e.g. Moltbook). This Claw is isolated and have a minimum access to our system to mitigate the risk of security issue.

```
pnpm deploy:ec2-external
```

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

# GitHub Identity (noxx-hal[bot])

OpenClaw (HAL) authenticates to GitHub as `noxx-hal[bot]` using a GitHub App instead of a personal access token. This gives all HAL actions (PRs, comments, commits) a proper bot identity on GitHub.

## How it works

- A Lambda function (`openclaw-github-token-provider`, `us-west-2`) retrieves the GitHub App credentials from AWS Secrets Manager (`/openclaw/github-app`), generates a JWT, and exchanges it for a short-lived installation token (valid 1 hour).
- Two wrapper scripts on the EC2 instance call this Lambda:
  - `get-git-credential.sh` — Git credential helper; called automatically by git on every HTTPS clone/push/pull.
  - `refresh-github-token.sh` — called by a cron job every 50 minutes to refresh the token in the systemd environment and OpenClaw config.
- The cron job also updates `GH_TOKEN` via `systemctl --user set-environment` so the `gh` CLI picks it up in shell commands.

## Deploying wrapper scripts

The wrapper scripts are version-controlled in `scripts/` and deployed to the EC2 via SSM:

```bash
pnpm run deploy:scripts
```

Run this any time the scripts change. It deploys `get-git-credential.sh` and `refresh-github-token.sh` to `/home/ssm-user/.openclaw/scripts/` on the instance.

## One-time EC2 setup

After deploying the CDK stack and running `pnpm run deploy:scripts`, open an SSM session and run:

```bash
# 1. Set GH_TOKEN in systemd environment (needed for gh CLI)
GH_TOKEN=$(aws lambda invoke --function-name openclaw-github-token-provider --region us-west-2 /tmp/gh-tok.json >/dev/null 2>&1 && python3 -c "import json; print(json.load(open('/tmp/gh-tok.json'))['token'])")
systemctl --user set-environment GH_TOKEN=$GH_TOKEN
echo "export GH_TOKEN=${GH_TOKEN}" >> ~/.bashrc

# 2. Set tokens in OpenClaw config
openclaw config set env.vars.GH_TOKEN "$GH_TOKEN"
openclaw config set env.vars.GITHUB_TOKEN "$GH_TOKEN"

# 3. Set git identity and credential helper
git config --global user.name "noxx-hal[bot]"
git config --global user.email "noxx-hal[bot]@users.noreply.github.com"
git config --global credential.helper "/home/ssm-user/.openclaw/scripts/get-git-credential.sh"

# 4. Install cronie (not installed by default on Amazon Linux), enable it, and add the cron job
#    The job runs refresh-github-token.sh every 50 min (tokens expire after 1 hour).
#    Logs are written to /tmp/refresh-github-token.log for debugging.
sudo yum install -y cronie
sudo systemctl enable crond
sudo systemctl start crond
(crontab -l 2>/dev/null; echo '*/50 * * * * /home/ssm-user/.openclaw/scripts/refresh-github-token.sh >> /tmp/refresh-github-token.log 2>&1') | crontab -

# Verify the job was added
crontab -l

# 5. Restart the gateway to apply
openclaw gateway restart
```
