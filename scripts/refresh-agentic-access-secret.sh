#!/bin/bash
set -euo pipefail

# Load nvm so `openclaw` is in PATH regardless of which Node version is active
export NVM_DIR="/home/ssm-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id agentic-api-dev-access-secret \
  --region us-west-2 \
  --query SecretString \
  --output text)

# Write to env file for persistent reference
echo "NOXX_AGENTIC_ACCESS_SECRET=${SECRET_VALUE}" > /home/ssm-user/.openclaw/agentic-access-secret.env

# Keep ~/.bashrc in sync for interactive shell sessions
sed -i '/export NOXX_AGENTIC_ACCESS_SECRET=/d' /home/ssm-user/.bashrc
echo "export NOXX_AGENTIC_ACCESS_SECRET=${SECRET_VALUE}" >> /home/ssm-user/.bashrc

# Update systemd user session
systemctl --user set-environment NOXX_AGENTIC_ACCESS_SECRET="$SECRET_VALUE"

# Set openclaw env vars
openclaw config set env.vars.NOXX_AGENTIC_ACCESS_SECRET "$SECRET_VALUE"
