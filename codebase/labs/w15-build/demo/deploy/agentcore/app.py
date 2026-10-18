"""Meridian triage agent on Amazon Bedrock AgentCore Runtime.

The SAME sense->think->guard->act pipeline as the Lambda deploy (../handler.py),
re-homed onto the managed runtime that supplementary/agentcore.md teaches:

    1. receives {"dispute_id": N} via `agentcore invoke`
    2. reads the dispute + evidence from the LIVE Meridian API   (sense)
    3. reasons over Reg E policy on Bedrock (Claude Haiku 4.5)   (think)
    4. runs the citation tripwire                                 (guard)
    5. writes the recommendation back as a ticket                 (act)

What changed vs Lambda, and why it's the lesson:
  - no DEMO_TOKEN header — AgentCore invocations are IAM-authed at the door
    (and AgentCore Identity is the production OBO answer, see W16)
  - no 15-minute ceiling — sessions run in per-session microVMs
  - the wrapper is 3 lines: BedrockAgentCoreApp + @app.entrypoint + app.run()

Runtime deps: bedrock-agentcore + boto3 + stdlib. See requirements.txt.

$0 floor (no AWS, no keys, no network): MERIDIAN_MOCK=1 python3 app.py
serves the SAME two-route AgentCore contract (GET /ping, POST /invocations)
on :8080 against the bundled W15 fixture — see README.md in this folder.
"""
import json
import os
import re
import urllib.request
import uuid
from pathlib import Path

MOCK = os.environ.get("MERIDIAN_MOCK") == "1"

try:
    from bedrock_agentcore import BedrockAgentCoreApp
except ImportError:
    # The runtime contract is just two HTTP routes — small enough to hold in
    # your head, and in a stdlib shim. `pip install bedrock-agentcore` gives
    # you the real wrapper; this keeps the $0 floor at zero installs.
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class BedrockAgentCoreApp:
        def entrypoint(self, fn):
            self._fn = fn
            return fn

        def run(self, port=8080):
            fn = self._fn

            class H(BaseHTTPRequestHandler):
                def _send(self, code, obj):
                    body = json.dumps(obj).encode()
                    self.send_response(code)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(body)

                def do_GET(self):
                    self._send(200, {"status": "Healthy"}
                               if self.path == "/ping" else {"error": "not found"})

                def do_POST(self):
                    if self.path != "/invocations":
                        return self._send(404, {"error": "not found"})
                    n = int(self.headers.get("Content-Length", 0))
                    payload = json.loads(self.rfile.read(n) or b"{}")
                    self._send(200, fn(payload))

            print("(stdlib shim) AgentCore contract on :%d — GET /ping, POST /invocations" % port)
            HTTPServer(("127.0.0.1", port), H).serve_forever()

BASE_URL = os.environ.get(
    "MERIDIAN_BASE_URL", "https://ik-fde-casestudy-bank.vercel.app/api/v1")
API_KEY = os.environ.get("MERIDIAN_API_KEY", "")
MODEL_ID = os.environ.get(
    "MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
if not MOCK and not API_KEY:
    raise SystemExit("Set MERIDIAN_API_KEY (or run the $0 floor: MERIDIAN_MOCK=1)")

CITATION = re.compile(r"\[chunks?\s*\d[\d,\s–—-]*\]", re.I)  # [chunk 24] or [chunks 21-24, 4]
MONEY_CLAIM = re.compile(r"provisional credit|refund|reimburse", re.I)

app = BedrockAgentCoreApp()

# mock backend = the same fixture every W15 demo uses (../../data/fixture.json);
# it is NOT packaged into the cloud deploy — cloud runs are always live
_FIXTURE = (json.loads((Path(__file__).parents[2] / "data" / "fixture.json").read_text())
            if MOCK else None)


def _meridian(path, method="GET", body=None, idem_key=None):
    if MOCK:
        did = path.split("/")[2] if path.startswith("/disputes/") else None
        bundle = _FIXTURE["disputes"].get(did or "", {})
        if path.endswith("/evidence"):
            return {"evidence": bundle.get("evidence", [])}
        if path.endswith("/tickets"):
            return {"ticket": {"ticket_id": f"MOCK-{uuid.uuid4().hex[:6]}",
                               "dispute_id": did, "subject": body["subject"]}}
        if path.startswith("/policies"):
            return {"chunks": _FIXTURE["policy_chunks"][:6]}
        d = dict(bundle["dispute"])
        d["amount_cents"] = bundle["transaction"]["amount_cents"]
        return {"dispute": d}
    req = urllib.request.Request(
        BASE_URL + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {API_KEY}",
                 "Content-Type": "application/json",
                 **({"Idempotency-Key": idem_key} if idem_key else {})})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())


def _claude(prompt, max_tokens=500):
    if MOCK:
        return ("Reg E applies: the bank must resolve or issue provisional "
                "credit within 10 business days [chunk 1]. The clock on this "
                "dispute is already breached and provisional credit has not "
                "been issued. Recommend immediate provisional credit and "
                "human confirmation.\nRECOMMENDATION: HUMAN_REVIEW")
    import boto3  # deferred so the $0 floor never touches AWS
    resp = boto3.client("bedrock-runtime").converse_stream(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": 0.2})
    return "".join(
        ev["contentBlockDelta"]["delta"].get("text", "")
        for ev in resp["stream"] if "contentBlockDelta" in ev)


@app.entrypoint
def invoke(payload):
    dispute_id = int((payload or {}).get("dispute_id", 29))

    # 1-2. SENSE — read the product
    d = _meridian(f"/disputes/{dispute_id}")["dispute"]
    ev = _meridian(f"/disputes/{dispute_id}/evidence")["evidence"]
    chunks = _meridian("/policies?query=regulation+e+provisional+credit")["chunks"][:6]

    # 3. THINK — one grounded Bedrock call
    policy_text = "\n".join(
        f"[chunk {c['chunk_id']}] {c['section']}: {c['content']}" for c in chunks)
    answer = _claude(
        "You are the Policy agent at Meridian Bank.\n"
        f"Dispute: {json.dumps({k: str(d.get(k)) for k in ('dispute_id','dispute_type','reason_code','amount_cents','sla_breached','reg_e_due_at','provisional_credit_issued')})}\n"
        f"Evidence on file: {len(ev)} artifact(s) across "
        f"{len({e['source_system'] for e in ev})} system(s).\n"
        f"Policy context:\n{policy_text}\n\n"
        "In 3-4 sentences: does Regulation E provisional credit apply, and what "
        "should the analyst do? Every provisional-credit statement MUST cite its "
        "chunk as [chunk NN]. End with one line "
        "'RECOMMENDATION: <ISSUE_PROVISIONAL_CREDIT | DENY | HUMAN_REVIEW>'.")

    # 4. GUARD — the tripwire travels WITH the agent into production
    guarded = bool(MONEY_CLAIM.search(answer)) and not CITATION.search(answer)
    subject = ("HUMAN REVIEW NEEDED — guardrail tripped (AgentCore agent)"
               if guarded else f"AgentCore-agent recommendation — dispute {dispute_id}")
    text = ("[guardrail-blocked output withheld] Uncited money-moving claim; "
            "a human analyst must decide." if guarded else answer)

    # 5. ACT — write back into the product (idempotent)
    ticket = _meridian(
        f"/disputes/{dispute_id}/tickets", "POST",
        {"channel": "chat", "subject": subject, "body": text[:1800]},
        idem_key=f"agentcore-{dispute_id}-{uuid.uuid4().hex[:8]}")["ticket"]

    return {
        "dispute_id": dispute_id,
        "guardrail_tripped": guarded,
        "ticket_id": ticket["ticket_id"],
        "recommendation": text,
        "see_it_live": BASE_URL.replace("/api/v1", "") + f"/disputes/{dispute_id}",
    }


if __name__ == "__main__":
    app.run()
