#!/bin/bash
set -euo pipefail

[ "$1" = "get" ] || exit 0

TMPFILE=$(mktemp)
trap "rm -f '$TMPFILE'" EXIT

aws lambda invoke --function-name openclaw-github-token-provider "$TMPFILE" >/dev/null 2>&1
TOKEN=$(python3 -c "import json; print(json.load(open('$TMPFILE'))['token'])")

printf "protocol=https\nhost=github.com\nusername=x-access-token\npassword=%s\n" "$TOKEN"
