#!/usr/bin/env bash
# Deploys the tiny EC2 wrapper scripts from this repo to the OpenClaw dev instance via SSM.
# Usage: bash scripts/deploy-wrappers.sh [--profile <profile>] [--region <region>] [--instance-id <id>]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROFILE="${AWS_PROFILE:-noxx}"
REGION="${AWS_REGION:-us-west-2}"

# Read DevInstanceId from CDK output file (populated by cdk deploy)
OUTPUT_FILE="$REPO_ROOT/output-dev.json"
INSTANCE_ID=$(python3 -c "import json; print(json.load(open('$OUTPUT_FILE'))['CdkEc2Stack']['DevInstanceId'])")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)     PROFILE="$2";     shift 2 ;;
    --region)      REGION="$2";      shift 2 ;;
    --instance-id) INSTANCE_ID="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

deploy_wrapper() {
  local name="$1"
  local src="$SCRIPT_DIR/$name"
  local dest="/home/ssm-user/.openclaw/scripts/$name"

  # Base64-encode the script so it survives SSM JSON escaping (works on macOS + Linux)
  local encoded
  encoded=$(base64 < "$src" | tr -d '\n')

  echo "Deploying $name..."

  local cmd_id
  cmd_id=$(aws ssm send-command \
    --profile "$PROFILE" \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[
      \"mkdir -p /home/ssm-user/.openclaw/scripts\",
      \"echo '${encoded}' | base64 --decode > '${dest}'\",
      \"chmod +x '${dest}'\",
      \"echo 'OK: ${dest}'\"
    ]" \
    --output text \
    --query 'Command.CommandId')

  echo "  Waiting for command $cmd_id..."
  aws ssm wait command-executed \
    --profile "$PROFILE" \
    --region "$REGION" \
    --command-id "$cmd_id" \
    --instance-id "$INSTANCE_ID"

  echo "  Done: $name"
}

deploy_wrapper "get-github-token.sh"
deploy_wrapper "get-git-credential.sh"

echo ""
echo "Wrapper scripts deployed to $INSTANCE_ID."
echo ""
echo "Next: open an SSM session and run the one-time OpenClaw + git config commands:"
echo "  aws ssm start-session --target $INSTANCE_ID --profile $PROFILE --region $REGION --document-name=AWS-StartInteractiveCommand --parameters command='[\"bash -l\"]'"
