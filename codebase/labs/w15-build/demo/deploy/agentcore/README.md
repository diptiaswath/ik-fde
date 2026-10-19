# Deploy the triage agent to Bedrock AgentCore Runtime — the CLI ladder

The same sense→think→guard→act pipeline as the Lambda deploy (`../handler.py`),
re-homed onto the managed runtime. Everything here is driven from the terminal —
the same `agentcore` CLI ladder you'd run on a client engagement. The whole
sequence was run live against this engagement on 2026-07-12; the verbatim
capture is `../../logs/deploy_agentcore.txt` and excerpts below quote it.

Concept background: `../../../supplementary/agentcore.md` (the service family,
Lambda-vs-AgentCore decision, pricing shape).

---

## Rung 0 — the $0 floor (no AWS account, no keys, no network)

The AgentCore Runtime contract is just two HTTP routes: `GET /ping` and
`POST /invocations`. Prove you understand it on your laptop:

```bash
MERIDIAN_MOCK=1 python3 app.py          # serves :8080 against the W15 fixture
# in a second terminal:
curl -s http://127.0.0.1:8080/ping
curl -s -X POST http://127.0.0.1:8080/invocations -d '{"dispute_id": 29}'
```

You get the full pipeline — fixture reads, a canned mock "brain", the real
citation tripwire, a `MOCK-…` ticket id — with zero installs beyond Python.
(If `bedrock-agentcore` isn't installed, `app.py` falls back to a stdlib shim
that serves the same two routes; the contract is small enough to hand-roll.)

This floor is what CI can run, what the class runs, and what you rehearse with.

## Rung 1 — configure + deploy (your own AWS account)

> Cost note: the deploy itself is pennies (S3 + a consumption-billed runtime
> with no idle burn), but it is a real cloud resource — always finish the
> ladder with `agentcore destroy`.

```bash
pip install bedrock-agentcore-starter-toolkit

export MERIDIAN_BASE_URL="https://ik-fde-casestudy-bank.vercel.app/api/v1"
export MERIDIAN_API_KEY="mrdn_..."       # your scoped analyst key

agentcore configure -e app.py -dt direct_code_deploy --non-interactive
agentcore deploy --env MERIDIAN_BASE_URL=$MERIDIAN_BASE_URL \
                 --env MERIDIAN_API_KEY=$MERIDIAN_API_KEY
```

What you'll see (verbatim from the live capture):

```text
Creating new STM-only memory...
⏳ Creating memory resource (this may take 30-180 seconds)...
Created memory: meridian_triage_mem-tgHNJ3Ag5Q
...
✓ Role created: arn:aws:iam::…:role/AmazonBedrockAgentCoreSDKRuntime-us-east-1-…
...
✓ Deployment package ready: 18.67 MB
✅ Agent created/updated: arn:aws:bedrock-agentcore:us-east-1:…:runtime/meridian_triage-od4fT79qSQ
🔍 GenAI Observability Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core
```

Note what the toolkit did for you, because on an engagement you must be able
to name it: created a short-term **Memory** resource, minted a scoped
**execution role**, packaged your code to S3 (`direct_code_deploy` — no
Docker), created the **Runtime**, and wired **Observability** log delivery.
Each of those is a thing the Lambda path made you do by hand.

IAM needed on the deploying identity: `bedrock-agentcore:*`, S3, and
`iam:PassRole`/role-create. On locked-down accounts this is exactly where you
stall — see the "IK shared account" note below.

## Rung 2 — invoke

```bash
agentcore invoke '{"dispute_id": 29}'
```

From the capture — the agent read the live dispute, reasoned on Bedrock
(Claude Haiku 4.5), passed the tripwire, and wrote ticket **9000000018** back
into the product:

```text
Response:
{"dispute_id": 29, "guardrail_tripped": false, "ticket_id": "9000000018",
 "recommendation": "Regulation E provisional credit applies …
 RECOMMENDATION: HUMAN_REVIEW", "see_it_live":
 "https://ik-fde-casestudy-bank.vercel.app/disputes/29"}
```

Caveat from the capture: the CLI's rich console strips `[chunk NN]` citations
when *displaying* the response (it parses `[]` as markup) — the ticket stored
in the product keeps them. Verify against the product, not the pretty-printer:

```bash
curl -s -H "Authorization: Bearer $MERIDIAN_API_KEY" \
  https://ik-fde-casestudy-bank.vercel.app/api/v1/disputes/29/tickets
```

## Rung 3 — observe, then leave nothing running

```bash
aws logs tail /aws/bedrock-agentcore/runtimes/<runtime-id>-DEFAULT \
  --log-stream-name-prefix "…/[runtime-logs" --follow

agentcore destroy        # runtime + role + memory: gone
```

The GenAI Observability dashboard link is printed by `agentcore deploy`
(traces take ~10 min to appear on first launch).

**Where the traces actually live.** Every span (the runtime invoke, memory
`CreateEvent`/`ListEvents`, model calls) lands in the **`aws/spans`** log group —
the GenAI Observability views render from it. On the shared training account the
dashboard's sessions/traces *list views* can spin indefinitely (verified
2026-07-30); the spans are still all there. The dependable query:

```bash
aws logs start-query --log-group-name aws/spans \
  --start-time <epoch-3h> --end-time <epoch-now> \
  --query-string 'fields @timestamp, name, attributes.session.id
                  | sort @timestamp desc | limit 20'
```

Console captures of all of this — the runtime registry, the runtime record
(versions + DEFAULT endpoint), the memory resource, and the spans query with
live results — are in `course/assets/aws-console/*_2026-07-30.jpg`.

**See the result in the product.** Every invoke ends as a ticket on
`/disputes/29` — the three-step portal walkthrough (annotated screenshots with
arrows) is in `../../../DEPLOY_IT_YOURSELF.md` → “Find it in the portal.”

---

## IK shared account status

The shared `intksrtuser09` account is governed by the lab provider's **Lab
Control Panel**: while the AWS Lab is **stopped**, the key carries an explicit
IAM deny on `bedrock:*` and `bedrock-agentcore:*` and rungs 1–3 fail closed;
pressing **Start** lifts the deny (and the panel shows the current key —
credentials rotate). Three captures are the proof of record:
`../../logs/deploy_agentcore.txt` (2026-07-12, the original full ladder — the
verbatim excerpts above quote it), `../../logs/deploy_agentcore_2026-07-22.txt`
(re-verification: deploy → invoke → Memory create_event/list_events →
`aws logs tail` → destroy, all live the same day), and
`../../logs/agentcore_session_2026-07-30.txt` (status → invoke → ticket
9000000024 verified in the product API with citations intact → memory
round-trip → logs tail → the aws/spans query — the run the 2026-07-30 console
screenshots correspond to). Rung 0 always works, lab or no lab. On your own AWS
account you need `BedrockAgentCoreFullAccess` plus S3 and `iam:PassRole`.
