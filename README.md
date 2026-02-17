EC2 Instance for OpenClaw

- Setup the instance with minimum access to the internet. (No SSH access, SSM access only)
- Provides IAM role access to Bedrock and SSM.

# Deploy

```
npm install
npx cdk synth --profile {profile} --region {region}
npx cdk deploy --profile {profile} --region {region}
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
