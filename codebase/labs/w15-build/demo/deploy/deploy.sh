#!/usr/bin/env bash
# Deploy the Meridian triage agent to AWS Lambda + Function URL.
#
# What this creates (all named meridian-w15-*, all removed by teardown.sh):
#   * IAM role   meridian-w15-agent-role   (logs + bedrock streaming invoke)
#   * Lambda     meridian-w15-agent        (python3.12, handler.py, 60s timeout)
#   * FunctionURL (public URL, but every call must carry X-Demo-Token)
#
# Usage:
#   export AWS creds first (or aws configure). Then:
#     ./deploy.sh
#   It prints the URL + token; test with:
#     ./invoke.sh <dispute_id>
set -euo pipefail
cd "$(dirname "$0")"

REGION="${BEDROCK_REGION:-us-east-1}"
FN=meridian-w15-agent
ROLE=meridian-w15-agent-role

# demo config comes from ../.env (never hardcode). Read it line-by-line so this
# works under `set -u` (process-substitution `source` can leave vars unset).
if [ -f ../.env ]; then
  while IFS='=' read -r k v; do
    case "$k" in MERIDIAN_BASE_URL|MERIDIAN_API_KEY) export "$k=$v" ;; esac
  done < <(grep -E '^(MERIDIAN_BASE_URL|MERIDIAN_API_KEY)=' ../.env)
fi
: "${MERIDIAN_BASE_URL:?set MERIDIAN_BASE_URL (in ../.env or the environment)}"
: "${MERIDIAN_API_KEY:?set MERIDIAN_API_KEY (in ../.env or the environment)}"
DEMO_TOKEN="${DEMO_TOKEN:-$(openssl rand -hex 12)}"

echo "→ IAM role"
cat > /tmp/w15-trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
aws iam create-role --role-name "$ROLE" \
  --assume-role-policy-document file:///tmp/w15-trust.json >/dev/null 2>&1 || true
cat > /tmp/w15-perm.json <<'EOF'
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream",
  "logs:PutLogEvents"],"Resource":"*"},
 {"Effect":"Allow","Action":["bedrock:InvokeModelWithResponseStream"],
  "Resource":"*"}]}
EOF
aws iam put-role-policy --role-name "$ROLE" --policy-name inline \
  --policy-document file:///tmp/w15-perm.json
sleep 8   # IAM propagation

echo "→ package"
rm -f /tmp/w15-agent.zip && zip -qj /tmp/w15-agent.zip handler.py

ROLE_ARN=$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)
ENVJSON="Variables={MERIDIAN_BASE_URL=$MERIDIAN_BASE_URL,MERIDIAN_API_KEY=$MERIDIAN_API_KEY,DEMO_TOKEN=$DEMO_TOKEN}"

echo "→ lambda"
if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --region "$REGION" \
    --zip-file fileb:///tmp/w15-agent.zip >/dev/null
  aws lambda wait function-updated --function-name "$FN" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FN" --region "$REGION" \
    --environment "$ENVJSON" >/dev/null
else
  aws lambda create-function --function-name "$FN" --region "$REGION" \
    --runtime python3.12 --handler handler.lambda_handler \
    --role "$ROLE_ARN" --timeout 60 --memory-size 256 \
    --zip-file fileb:///tmp/w15-agent.zip \
    --environment "$ENVJSON" >/dev/null
fi
aws lambda wait function-updated --function-name "$FN" --region "$REGION"

echo "→ function URL"
aws lambda create-function-url-config --function-name "$FN" --region "$REGION" \
  --auth-type NONE >/dev/null 2>&1 || true
aws lambda add-permission --function-name "$FN" --region "$REGION" \
  --statement-id url-public --action lambda:InvokeFunctionUrl \
  --principal '*' --function-url-auth-type NONE >/dev/null 2>&1 || true
URL=$(aws lambda get-function-url-config --function-name "$FN" --region "$REGION" \
  --query FunctionUrl --output text)

echo
echo "DEPLOYED."
echo "  URL       : $URL"
echo "  X-Demo-Token: $DEMO_TOKEN"
echo "$URL" > .last-url; echo "$DEMO_TOKEN" > .last-token
echo
echo "Invoke:  ./invoke.sh 29"
echo "Teardown after class:  ./teardown.sh   (idle deployments are silent burn)"
