#!/usr/bin/env bash
# Call the deployed agent: ./invoke.sh [dispute_id]
#
# Tries the public Function URL first. Some AWS orgs block public Lambda URLs
# (an SCP denies FunctionUrlAuthType=NONE) — if so we fall back to a direct,
# IAM-signed `aws lambda invoke`, which proves the deployed agent runs the same.
set -euo pipefail
cd "$(dirname "$0")"
DID="${1:-29}"
REGION="${BEDROCK_REGION:-us-east-1}"
FN=meridian-w15-agent

URL=$(cat .last-url 2>/dev/null || true)
TOKEN=$(cat .last-token 2>/dev/null || true)

if [ -n "$URL" ] && [ -n "$TOKEN" ]; then
  RESP=$(curl -s -X POST "$URL" -H "Content-Type: application/json" \
    -H "X-Demo-Token: $TOKEN" -d "{\"dispute_id\": $DID}")
  if ! grep -q '"Message":.*Forbidden' <<<"$RESP"; then
    echo "$RESP" | python3 -m json.tool; exit 0
  fi
  echo "# Function URL is blocked by org policy — using direct IAM invoke instead." >&2
fi

aws lambda invoke --function-name "$FN" --region "$REGION" \
  --cli-binary-format raw-in-base64-out \
  --payload "{\"dispute_id\": $DID}" /tmp/w15-invoke-out.json >/dev/null
python3 -c "import json,sys; b=json.load(open('/tmp/w15-invoke-out.json')); print(json.dumps(json.loads(b['body']) if 'body' in b else b, indent=2))"
