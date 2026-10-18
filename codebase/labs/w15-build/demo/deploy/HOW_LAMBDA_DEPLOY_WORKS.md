# How Lambda Deployment Works

## Quick Answer

**Where does it deploy?** YOUR AWS account (whatever account your AWS CLI is configured for)

**What does it need?** A valid API key for the hosted Meridian instance at `https://ik-fde-casestudy-bank.vercel.app`

**Why can't it use localhost?** The Lambda runs in AWS cloud, not on your laptop. It can't reach `localhost:3100` on your machine.

---

## The Setup

### 1. Configure .env

Edit `../env` to have:

```bash
MERIDIAN_BASE_URL=https://ik-fde-casestudy-bank.vercel.app/api/v1
MERIDIAN_API_KEY=mrdn_YOUR_VALID_HOSTED_KEY_HERE
BEDROCK_REGION=us-east-1
MODEL_FAST=bedrock/converse/us.anthropic.claude-haiku-4-5-20251001-v1:0
MODEL_SMART=bedrock/converse/us.anthropic.claude-haiku-4-5-20251001-v1:0
```

**Key point:** The API key must work with the **hosted instance**, not localhost.

### 2. Deploy

```bash
./deploy.sh
```

**What this creates in YOUR AWS account:**

| Resource | Name | Purpose |
|----------|------|---------|
| IAM Role | `meridian-w15-agent-role` | Gives Lambda permission to write logs + call Bedrock |
| Lambda Function | `meridian-w15-agent` | The actual agent code (handler.py) |
| Function URL | `https://xxxxx.lambda-url.us-east-1.on.aws/` | Public endpoint to invoke the Lambda |

**Environment variables passed to Lambda:**
- `MERIDIAN_BASE_URL` - from your .env
- `MERIDIAN_API_KEY` - from your .env
- `DEMO_TOKEN` - randomly generated (for simple auth)

### 3. Invoke

```bash
./invoke.sh 29
```

This sends `{"dispute_id": 29}` to your Lambda's Function URL.

---

## What Happens When You Invoke

```
┌─────────────────────────────────────────────────────────┐
│ 1. invoke.sh → Lambda Function URL                      │
│    POST https://xxxxx.lambda-url.us-east-1.on.aws/      │
│    Body: {"dispute_id": 29}                             │
│    Header: X-Demo-Token: abc123                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Lambda (handler.py) in YOUR AWS account              │
│    - Validates token                                    │
│    - Reads env vars (BASE_URL, API_KEY)                 │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Lambda → Meridian API (hosted instance)              │
│    GET https://ik-fde-casestudy-bank.vercel.app/api/v1  │
│        /disputes/29                                     │
│    Header: Authorization: Bearer mrdn_YOUR_KEY          │
│                                                         │
│    ✅ This works because Lambda is in AWS cloud         │
│       and can reach public HTTPS URLs                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Lambda → AWS Bedrock (YOUR AWS account)              │
│    bedrock.converse_stream(                             │
│      modelId="claude-haiku-4-5",                        │
│      messages=[dispute data...]                         │
│    )                                                    │
│                                                         │
│    ✅ Uses IAM role created by deploy.sh                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Lambda runs guardrail check                          │
│    - Does recommendation cite policy chunks?            │
│    - Pass: write ticket                                 │
│    - Fail: escalate to human                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Lambda → Meridian API (write-back)                   │
│    POST https://ik-fde-casestudy-bank.vercel.app/api/v1 │
│         /disputes/29/tickets                            │
│    Body: {                                              │
│      "body": "AI recommendation...",                    │
│      "escalated_to_human": false                        │
│    }                                                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Lambda → You (response)                              │
│    {                                                    │
│      "statusCode": 200,                                 │
│      "body": {                                          │
│        "dispute_id": 29,                                │
│        "ticket_id": 9000000019,                         │
│        "guardrail": "passed"                            │
│      }                                                  │
│    }                                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Verify in Ops Console

1. Open: https://ik-fde-casestudy-bank.vercel.app
2. Login as: `jason.soto@meridianbank.com`
3. Navigate: Disputes → Dispute #29 → Linked tickets
4. You'll see the ticket created by your Lambda

**The circle closes:** Problem seen in product (W13) → Solution landed in product (W15)

---

## Local Testing Flow (MERIDIAN_MOCK=1)

When you run `MERIDIAN_MOCK=1 python3 test_handler_local.py` instead of deploying:

```
┌─────────────────────────────────────────────────────────┐
│ 1. test_handler_local.py → handler.lambda_handler()     │
│    Direct Python function call                          │
│    event = {"body": '{"dispute_id": 29}'}               │
│    context = MockContext()                              │
│                                                          │
│    🏠 Running on YOUR LAPTOP (not AWS)                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. handler.py (same code, mocked dependencies)          │
│    - Validates token (mocked)                           │
│    - Reads env vars (set by test script)                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. handler._meridian() → FIXTURE DATA                   │
│    Reads from: ../data/fixture.json                     │
│    Returns: {"dispute": {...}, "evidence": [...]}       │
│                                                          │
│    ❌ NO network calls                                  │
│    ❌ NO Meridian API                                   │
│    ✅ Instant, deterministic                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. handler._claude() → CANNED RESPONSE                  │
│    Returns: "Reg E applies... [chunk 1]... HUMAN_REVIEW"│
│                                                          │
│    ❌ NO Bedrock calls                                  │
│    ❌ NO AWS credentials needed                         │
│    ✅ Instant, $0 cost                                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. handler runs guardrail check                         │
│    - Does recommendation cite policy chunks?            │
│    - Pass: write ticket                                 │
│    - Fail: escalate to human                            │
│                                                          │
│    ✅ REAL GUARDRAIL LOGIC (same as deployed)           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. handler._meridian() → MOCK TICKET                    │
│    Returns: {"ticket_id": "MOCK-abc123"}                │
│                                                          │
│    ❌ NO ticket created in Meridian                     │
│    ✅ Mock ID for testing                               │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. test_handler_local.py prints response to terminal    │
│    {                                                    │
│      "statusCode": 200,                                 │
│      "body": {                                          │
│        "dispute_id": 29,                                │
│        "ticket_id": "MOCK-abc123",                      │
│        "guardrail": "passed"                            │
│      }                                                  │
│    }                                                    │
│                                                          │
│    💻 Output in terminal (not HTTP response)            │
└─────────────────────────────────────────────────────────┘
```

### Key Differences: Local vs Deployed

| Step | Local Test (Mock) | Deployed Lambda |
|------|-------------------|-----------------|
| **Invocation** | Python function call | HTTP POST to Function URL |
| **Environment** | Your laptop | AWS Lambda runtime |
| **Meridian API** | Fixture file | Real HTTPS API calls |
| **Bedrock** | Canned text | Real Claude Haiku 4.5 |
| **Guardrail** | ✅ Same code | ✅ Same code |
| **Ticket** | Mock ID | Real ticket in Meridian |
| **Cost** | $0 | Bedrock + Lambda (minimal) |
| **Speed** | Instant | 2-5 seconds |
| **Network** | None | Required |
| **AWS credentials** | Not needed | Required |

### What Stays the Same

**Both local and deployed run identical:**
- ✅ Pipeline structure (Sense → Think → Guard → Act)
- ✅ Guardrail logic (citation checks)
- ✅ Error handling
- ✅ Response format
- ✅ handler.py code

**Only the data sources change** (fixture vs API, canned vs Bedrock).

---

## Common Issues

### Error: "Connection refused"

**Problem:** `.env` has `MERIDIAN_BASE_URL=http://localhost:3100`

**Fix:** Change to `https://ik-fde-casestudy-bank.vercel.app/api/v1`

**Why:** Lambda runs in AWS cloud, can't reach localhost on your laptop

### Error: "401 Unauthorized"

**Problem:** API key in `.env` only works with localhost, not hosted instance

**Fix:** Get valid API key for hosted instance from course materials

### How to check if API key is valid

```bash
curl -H "Authorization: Bearer YOUR_KEY_HERE" \
  https://ik-fde-casestudy-bank.vercel.app/api/v1/me

# Should return analyst info, not {"error": "unauthorized"}
```

---

## Teardown

After class, remove everything from YOUR AWS account:

```bash
./teardown.sh
```

This deletes:
- Lambda function `meridian-w15-agent`
- IAM role `meridian-w15-agent-role`
- Function URL

**Why teardown matters:** Idle Lambda functions with Function URLs cost nothing, but it's good hygiene to clean up demos.

---

## Security Notes

### Current Approach (Demo)
- API key stored in Lambda environment variables
- Visible in AWS Lambda console
- Fine for learning/demo

### Production Approach (W15 Learning Objective)
- Store API key in AWS Secrets Manager
- Lambda fetches at runtime via IAM role
- Never visible in console
- Supports rotation

See `handler.py` lines 30-38 for the production pattern.

---

## Quick Reference

**Deploy:**
```bash
cd deploy
./deploy.sh
```

**Invoke:**
```bash
./invoke.sh 29
```

**Check Lambda in AWS Console:**
```
https://console.aws.amazon.com/lambda
→ Functions → meridian-w15-agent
```

**Teardown:**
```bash
./teardown.sh
```
