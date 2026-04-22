#!/bin/bash
set -euo pipefail

TMPFILE=$(mktemp)
trap "rm -f '$TMPFILE'" EXIT

aws lambda invoke --function-name openclaw-github-token-provider "$TMPFILE" >/dev/null 2>&1
TOKEN=$(python3 -c "import json; print(json.load(open('$TMPFILE'))['token'])")

echo "{\"protocolVersion\":1,\"values\":{\"value\":\"${TOKEN}\"}}"
