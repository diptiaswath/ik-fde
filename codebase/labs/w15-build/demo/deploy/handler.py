"""Meridian triage agent as a DEPLOYED endpoint (AWS Lambda).

This is the piece that turns "a script on the FDE's laptop" into "a running
part of the client's estate." The Lambda:

    1. receives {"dispute_id": N} over its Function URL
    2. reads the dispute + evidence from the LIVE Meridian API   (sense)
    3. reasons over Reg E policy on Bedrock (Claude Haiku 4.5)   (think)
    4. runs the citation tripwire                                 (guard)
    5. writes the recommendation back as a ticket                 (act)

...and the Ops Console shows the result. The circle — problem seen in the
product, solution landed in the product — closes in production, not in a demo.

The managed version of exactly this shape is Amazon Bedrock AgentCore Runtime
(see supplementary/agentcore.md). Lambda keeps every moving part visible
and is a simple starting point — which is the point of the lesson.

Runtime deps: boto3 (in the Lambda image) + stdlib only. No layers needed.
"""
import json
import os
import re
import urllib.request
import uuid

import boto3

BASE_URL = os.environ["MERIDIAN_BASE_URL"]
# PRODUCTION NOTE (secrets management — W15 learning objective): an env var is
# rung 1 of the secrets ladder — fine for this pilot, but in production this
# line becomes a runtime fetch under the function's IAM role, e.g.:
#     boto3.client("secretsmanager").get_secret_value(
#         SecretId="meridian/agent/api-key")["SecretString"]
# (or SSM Parameter Store with SecureString; AgentCore Identity vault on the
# managed runtime). Rules either way: never in git, never in a slide, rotate on
# suspicion. The mrdn_ key itself IS the security model: per-learner scoped,
# revocable in one call, attributed on every ticket via learner_id.
API_KEY = os.environ["MERIDIAN_API_KEY"]
DEMO_TOKEN = os.environ["DEMO_TOKEN"]  # simple caller auth — W16 makes this real
MODEL_ID = os.environ.get(
    "MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")

CITATION = re.compile(r"\[chunks?\s*\d[\d,\s\u2013\u2014-]*\]", re.I)  # [chunk 24] or [chunks 21-24, 4]
MONEY_CLAIM = re.compile(r"provisional credit|refund|reimburse", re.I)

bedrock = boto3.client("bedrock-runtime")


def _meridian(path, method="GET", body=None, idem_key=None):
    req = urllib.request.Request(
        BASE_URL + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {API_KEY}",
                 "Content-Type": "application/json",
                 **({"Idempotency-Key": idem_key} if idem_key else {})})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())


def _claude(prompt, max_tokens=500):
    # Streaming API (ConverseStream) — the only invoke path our policy allows,
    # and the right default anyway: first tokens reach users sooner.
    resp = bedrock.converse_stream(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": 0.2})
    return "".join(
        ev["contentBlockDelta"]["delta"].get("text", "")
        for ev in resp["stream"] if "contentBlockDelta" in ev)


def lambda_handler(event, context):
    # Function URLs wrap the payload; accept both direct and HTTP-shaped events.
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    if headers and headers.get("x-demo-token") != DEMO_TOKEN:
        return {"statusCode": 401, "body": json.dumps({"error": "bad token"})}
    body = event
    if "body" in event and isinstance(event["body"], str):
        body = json.loads(event["body"] or "{}")
    dispute_id = int(body.get("dispute_id", 29))

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
    subject = ("HUMAN REVIEW NEEDED — guardrail tripped (deployed agent)"
               if guarded else f"Deployed-agent recommendation — dispute {dispute_id}")
    text = ("[guardrail-blocked output withheld] Uncited money-moving claim; "
            "a human analyst must decide." if guarded else answer)

    # 5. ACT — write back into the product (idempotent)
    ticket = _meridian(
        f"/disputes/{dispute_id}/tickets", "POST",
        {"channel": "chat", "subject": subject, "body": text[:1800]},
        idem_key=f"lambda-{dispute_id}-{uuid.uuid4().hex[:8]}")["ticket"]

    return {"statusCode": 200, "body": json.dumps({
        "dispute_id": dispute_id,
        "guardrail_tripped": guarded,
        "ticket_id": ticket["ticket_id"],
        "recommendation": text,
        "see_it_live": BASE_URL.replace("/api/v1", "") + f"/disputes/{dispute_id}",
    })}
