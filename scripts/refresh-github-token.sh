#!/bin/bash
set -euo pipefail

TMPFILE=$(mktemp)
trap "rm -f '$TMPFILE'" EXIT

aws lambda invoke --function-name openclaw-github-token-provider --region us-west-2 "$TMPFILE" >/dev/null 2>&1
TOKEN=$(python3 -c "import json; print(json.load(open('$TMPFILE'))['token'])")

systemctl --user set-environment GH_TOKEN="$TOKEN"
/usr/local/bin/openclaw config set env.vars.GH_TOKEN "$TOKEN"
/usr/local/bin/openclaw config set env.vars.GITHUB_TOKEN "$TOKEN"
/usr/local/bin/openclaw gateway restart
