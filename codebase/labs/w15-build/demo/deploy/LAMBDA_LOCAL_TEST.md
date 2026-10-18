# Lambda Local Testing - Quick Start

## Test Lambda handler.py Without Deploying

You can test the Lambda handler locally before deploying to AWS, just like AgentCore's mock mode.

---

## Option 1: Mock Mode (Recommended for Testing)

**No AWS account, no API key, no network needed.**

```bash
cd /Users/diptiaswath/Documents/GitHub/ik-fde/codebase/labs/w15-build/demo/deploy

# Run with mock data
MERIDIAN_MOCK=1 python3 test_handler_local.py
```

**What happens:**
- ✅ Reads from fixture data (`../data/fixture.json`)
- ✅ Uses canned AI response (no Bedrock calls)
- ✅ Runs real guardrail logic
- ✅ Returns mock ticket ID
- ✅ No AWS credentials needed
- ✅ $0 cost

**Expected output:**
```
🔧 Running in MOCK mode (no AWS, no API key needed)

============================================================
Testing Lambda handler.py locally
============================================================
Mode: MOCK
Dispute ID: 29
Base URL: http://localhost:3100/api/v1
============================================================

📞 Invoking lambda_handler(event, context)...

✅ Handler returned successfully

============================================================
RESPONSE:
============================================================
Status Code: 200

Body:
{
  "dispute_id": 29,
  "recommendation": "Reg E applies: the bank must resolve or issue provisional credit within 10 business days [chunk 1]...",
  "ticket_id": "MOCK-abc123",
  "guardrail": "passed"
}

============================================================

✨ Mock mode test completed!
   - No AWS calls made
   - No API key used
   - Fixture data used
   - Guardrail logic ran
```

---

## Option 2: Live Mode (Requires API Key)

**Tests against real Meridian API and AWS Bedrock.**

```bash
cd /Users/diptiaswath/Documents/GitHub/ik-fde/codebase/labs/w15-build/demo/deploy

# Set required environment variables
export MERIDIAN_BASE_URL="https://ik-fde-casestudy-bank.vercel.app/api/v1"
export MERIDIAN_API_KEY="mrdn_YOUR_KEY_HERE"

# Run without MERIDIAN_MOCK flag
python3 test_handler_local.py
```

**What happens:**
- ✅ Calls real Meridian API
- ✅ Calls AWS Bedrock (requires AWS credentials)
- ✅ Creates real ticket in Meridian
- ⚠️ Costs money (Bedrock inference charges)

---

## How It Works

The test script (`test_handler_local.py`):

1. **Creates a mock Lambda event:**
   ```python
   event = {
       "body": json.dumps({"dispute_id": 29}),
       "headers": {"X-Demo-Token": "test-token"}
   }
   ```

2. **Calls the handler directly:**
   ```python
   from handler import lambda_handler
   result = lambda_handler(event, context)
   ```

3. **In mock mode, patches functions:**
   - `_meridian()` → reads from fixture
   - `_claude()` → returns canned response

4. **Runs the same pipeline:**
   - Sense → Think → Guard → Act

---

## Comparison: Test Script vs Actual Lambda

| Aspect | Local Test | Deployed Lambda |
|--------|------------|-----------------|
| **Invocation** | `python3 test_handler_local.py` | AWS Lambda invoke (via invoke.sh) |
| **Handler code** | Same `handler.py` | Same `handler.py` |
| **Pipeline logic** | Identical | Identical |
| **Mock mode** | Available | Not available (always live) |
| **AWS credentials** | Only needed for live Bedrock | Always needed |
| **Function URL** | Not used | Used for HTTP access |
| **Cost** | $0 (mock) or Bedrock only (live) | Bedrock + minimal Lambda cost |

---

## The Same Pipeline

Both the local test and deployed Lambda run **identical logic**:

1. **Sense** → Read dispute from Meridian API
2. **Think** → Bedrock reasoning (Claude Haiku 4.5)
3. **Guard** → Citation tripwire
4. **Act** → Write ticket back to Meridian

**The lesson:** Test locally with mock data, deploy when ready. Same code, different environment.

---

## Quick Reference

### Mock Mode (Testing)
```bash
cd /Users/diptiaswath/Documents/GitHub/ik-fde/codebase/labs/w15-build/demo/deploy
MERIDIAN_MOCK=1 python3 test_handler_local.py
```

### Live Mode (Integration Test)
```bash
export MERIDIAN_BASE_URL="https://ik-fde-casestudy-bank.vercel.app/api/v1"
export MERIDIAN_API_KEY="mrdn_YOUR_KEY"
python3 test_handler_local.py
```

### Deploy to AWS (When Ready)
```bash
./deploy.sh
./invoke.sh 29
```

---

## Troubleshooting

### Error: `MERIDIAN_API_KEY not set` (Live Mode)

You're running in live mode without an API key.

**Fix:**
```bash
export MERIDIAN_API_KEY="mrdn_YOUR_KEY"
```

Or use mock mode:
```bash
MERIDIAN_MOCK=1 python3 test_handler_local.py
```

### Error: `No module named 'handler'`

You're not in the deploy directory.

**Fix:**
```bash
cd /Users/diptiaswath/Documents/GitHub/ik-fde/codebase/labs/w15-build/demo/deploy
```

### Error: Bedrock permission denied (Live Mode)

Your AWS credentials don't have Bedrock permissions.

**Fix:** Use mock mode for testing, or configure AWS credentials with Bedrock access.

---

## Why Test Locally?

**Fast iteration:**
- Change handler.py
- Run `MERIDIAN_MOCK=1 python3 test_handler_local.py`
- See results in seconds (no deployment wait)

**Zero cost:**
- Mock mode = $0
- No Lambda invocation charges
- No Bedrock charges

**Offline development:**
- Works without internet (mock mode)
- No AWS account needed (mock mode)
- Portable (runs anywhere Python runs)

**Same code as production:**
- Tests the actual handler.py
- Same guardrail logic
- Same pipeline structure

---

## Next Steps

Once local testing passes:

1. **Deploy to Lambda:**
   ```bash
   ./deploy.sh
   ```

2. **Test deployed Lambda:**
   ```bash
   ./invoke.sh 29
   ```

3. **Verify in Meridian Ops Console:**
   - Open: https://ik-fde-casestudy-bank.vercel.app
   - Login: jason.soto@meridianbank.com
   - Navigate: Disputes → #29 → Linked tickets

4. **Teardown when done:**
   ```bash
   ./teardown.sh
   ```



  | Runtime   | Local Test                                    | Deployed                             |
  |-----------|-----------------------------------------------|--------------------------------------|
  | Lambda    | MERIDIAN_MOCK=1 python3 test_handler_local.py | ./deploy.sh && ./invoke.sh 29        |
  | AgentCore | MERIDIAN_MOCK=1 python3 app.py                | agentcore deploy && agentcore invoke |