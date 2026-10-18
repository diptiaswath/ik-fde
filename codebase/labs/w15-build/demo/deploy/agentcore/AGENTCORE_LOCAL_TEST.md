# AgentCore Local Testing - Quick Start

## The Server is Not Hanging

When you run `MERIDIAN_MOCK=1 python3 app.py`, the server **starts successfully** and waits for requests on `http://localhost:8080`.

This is normal behavior - web servers run indefinitely until you stop them (Ctrl+C).

---

## How to Test Locally (Rung 0)

### Step 1: Start the Server

In your first terminal:

```bash
cd /Users/diptiaswath/Documents/GitHub/ik-fde/codebase/labs/w15-build/demo/deploy/agentcore

# Start the mock server (no AWS, no API key needed)
MERIDIAN_MOCK=1 python3 app.py
```

**What you'll see:** The terminal will appear to "hang" but it's actually running a web server.

If using the stdlib shim (no bedrock-agentcore installed), you'll see:
```
(stdlib shim) AgentCore contract on :8080 — GET /ping, POST /invocations
```

**Leave this terminal running.**

---

### Step 2: Test the Server

Open a **second terminal** and run:

```bash
cd /Users/diptiaswath/Documents/GitHub/ik-fde/codebase/labs/w15-build/demo/deploy/agentcore

# Test 1: Health check
curl http://127.0.0.1:8080/ping

# Test 2: Process a dispute
curl -s -X POST http://127.0.0.1:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"dispute_id": 29}'
```

---

## Expected Responses

### Health Check (`/ping`)

```json
{"status": "Healthy"}
```

### Agent Invocation (`/invocations`)

```json
{
  "dispute_id": 29,
  "guardrail_tripped": false,
  "ticket_id": "MOCK-abc123",
  "recommendation": "Type A dispute (fraud, reason 10.4). Regulation E clock breached. Recommend ISSUE_PROVISIONAL_CREDIT per policy [chunk 101].",
  "see_it_live": "https://ik-fde-casestudy-bank.vercel.app/disputes/29"
}
```

---

## What's Happening

**Mock Mode (`MERIDIAN_MOCK=1`):**
- Reads from bundled fixture data (`../../data/fixture.json`)
- Uses canned mock responses (no Bedrock API calls)
- Runs real citation guardrail
- Returns mock ticket ID (format: `MOCK-xxxxxx`)
- **No AWS account needed**
- **No API key needed**
- **No network calls**

**The AgentCore Contract:**
- `GET /ping` → health check
- `POST /invocations` → run the agent with JSON payload

This is the same contract AWS Bedrock AgentCore Runtime expects when you deploy.

---

## Stop the Server

Go back to the first terminal and press **Ctrl+C**.

---

## Next Steps

Once you've tested locally, see `README.md` for:
- **Rung 1:** Deploy to AWS AgentCore Runtime
- **Rung 2:** Invoke the deployed agent
- **Rung 3:** Observe traces and destroy

---

## Troubleshooting

### Port already in use

```bash
# Find what's using port 8080
lsof -i :8080

# Kill the process (use the PID from above)
kill -9 <PID>

# Or use a different port
PORT=8081 MERIDIAN_MOCK=1 python3 app.py
# Then curl http://127.0.0.1:8081/ping
```

### Connection refused

Make sure the server (Terminal 1) is still running. If you see `Ctrl+C`, you stopped it - restart with `MERIDIAN_MOCK=1 python3 app.py`.

### No response / timeout

Check the server terminal for error messages. The mock mode should work without any dependencies beyond Python stdlib.

---

## Comparison: Local vs Deployed

| Aspect | Local Mock (Rung 0) | Deployed (Rungs 1-3) |
|--------|---------------------|----------------------|
| **Command** | `MERIDIAN_MOCK=1 python3 app.py` | `agentcore invoke '{"dispute_id": 29}'` |
| **Data source** | Fixture file | Live Meridian API |
| **AI model** | Canned response | AWS Bedrock (Claude Haiku 4.5) |
| **Ticket created** | Mock ID | Real ticket in Meridian |
| **Cost** | $0 | Bedrock inference cost |
| **AWS account** | Not needed | Required |
| **Use case** | Testing, CI, learning | Production |

---

## Same Pipeline, Different Runtime

Both `handler.py` (Lambda) and `app.py` (AgentCore) run the exact same logic:

1. **Sense** → Read dispute from Meridian API
2. **Think** → Bedrock reasoning (Claude Haiku 4.5)
3. **Guard** → Citation tripwire
4. **Act** → Write ticket back to Meridian

**The lesson:** The primitives (sense/think/guard/act) stay the same. Only the runtime wrapper changes.

| Aspect | Lambda (`../handler.py`) | AgentCore (`app.py`) |
|--------|--------------------------|----------------------|
| **Packaging** | Manual zip | Toolkit handles it |
| **IAM Role** | Manual creation | Toolkit creates scoped role |
| **Timeout** | 60 seconds | No ceiling (per-session microVMs) |
| **Wrapper code** | ~150 lines | 3 lines (`@app.entrypoint`) |
| **Pipeline logic** | **Same** | **Same** |

---

## Quick Reference

**Start mock server:**
```bash
MERIDIAN_MOCK=1 python3 app.py
```

**Test (in second terminal):**
```bash
curl http://127.0.0.1:8080/ping
curl -X POST http://127.0.0.1:8080/invocations -d '{"dispute_id": 29}'
```

**Stop server:**
Press `Ctrl+C` in the server terminal
