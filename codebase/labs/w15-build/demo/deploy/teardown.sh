#!/usr/bin/env bash
# Remove everything deploy.sh created. Run this AFTER EVERY CLASS —
# the W14 lesson: idle deployments are silent burn.
set -uo pipefail
REGION="${BEDROCK_REGION:-us-east-1}"
FN=meridian-w15-agent
ROLE=meridian-w15-agent-role

aws lambda delete-function-url-config --function-name "$FN" --region "$REGION" 2>/dev/null
aws lambda delete-function --function-name "$FN" --region "$REGION" 2>/dev/null
aws iam delete-role-policy --role-name "$ROLE" --policy-name inline 2>/dev/null
aws iam delete-role --role-name "$ROLE" 2>/dev/null
rm -f "$(dirname "$0")/.last-url" "$(dirname "$0")/.last-token"
echo "torn down: $FN, $ROLE"
