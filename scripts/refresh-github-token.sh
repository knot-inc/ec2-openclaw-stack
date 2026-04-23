#!/bin/bash
set -euo pipefail

# Load nvm so `openclaw` is in PATH regardless of which Node version is active
export NVM_DIR="/home/ssm-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

TMPFILE=$(mktemp)
trap "rm -f '$TMPFILE'" EXIT

aws lambda invoke --function-name openclaw-github-token-provider --region us-west-2 "$TMPFILE" >/dev/null 2>&1
TOKEN=$(python3 -c "import json; print(json.load(open('$TMPFILE'))['token'])")

# Write token to EnvironmentFile so gateway picks it up on next start (survives reboots too)
echo "GH_TOKEN=${TOKEN}" > /home/ssm-user/.openclaw/github-token.env

# Also update the running systemd session so gh CLI works immediately
systemctl --user set-environment GH_TOKEN="$TOKEN"

# Update openclaw config (takes effect on next gateway start)
openclaw config set env.vars.GH_TOKEN "$TOKEN"
openclaw config set env.vars.GITHUB_TOKEN "$TOKEN"
