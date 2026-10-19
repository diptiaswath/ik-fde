# W15 Live Demos — Runbook

Four demos, watched (not coded along), building to one payoff: **the agent's
recommendation lands in the live Meridian Ops Console** — problem seen in the
product (W13), solution landed in the product (today). This file is the operator's manual.

| # | Script | What the class sees | Time |
|---|---|---|---|
| 1 | `demo1_primitives.py` | Agent · tool call · handoff · streaming, on Bedrock | ~5 min |
| 2 | `demo2_pipeline.py` (+ `--tripwire` rerun) | the end-to-end pipeline + write-back to the console | ~12 min |
| 3 | `demo3_strands.py` | same agent, second harness (portability) | ~4 min |
| 4 | `deploy/deploy.sh` → `invoke.sh` → `teardown.sh` | deployed endpoint closes the circle | ~8 min |

Every demo accepts `--mock` — identical output shape, zero network, zero keys.
**If anything wobbles live, say so and switch to `--mock`; the lesson survives.**

---

## 0. Pre-class checklist (T-30 min)

```bash
cd "$(git rev-parse --show-toplevel)"/codebase/labs/w15-build/demo
cp .env.example .env                  # fill MERIDIAN_API_KEY (mint: platform README)
cp ../../../aws.env.example aws.env   # AWS keys for the Bedrock beats (or use ~/.aws)
set -a; source aws.env; set +a        # what the W15 technical demo does on camera
                                      # (already exports the two AWS keys — and env
                                      #  vars WIN over ~/.aws, so unset them to go back)
python3 -c "import boto3; print(boto3.client('sts').get_caller_identity()['Arn'])"
python3 demo1_primitives.py --mock    # rehearsal — should end "final agent: Evidence"
curl -s -H "Authorization: Bearer $(grep MERIDIAN_API_KEY .env | cut -d= -f2)" \
  https://ik-fde-casestudy-bank.vercel.app/api/v1/me   # expect your analyst JSON
cd deploy && ./deploy.sh              # stage the FALLBACK copy (see ops decision below)
```

**Deploy ops decision: LIVE deploy at 3:00 on camera; a pre-deployed copy from
T-30 is the fallback if the live deploy wobbles.** (`deploy.sh` re-run updates
the same function, so the live run at 3:00 is safe on top of the fallback.)

Facts to know cold:
- **Models:** Haiku 4.5 (`MODEL_FAST`) for Triage/Evidence, Sonnet 4.5
  (`MODEL_SMART`) for Policy — the routing story. Model choice is a one-line
  `.env` switch (`MODEL_SMART`) — use whichever models your environment enables.
- **Stream by default:** use `ConverseStream` / `run_streamed` — robust across restrictive
  IAM policies, and first tokens reach the user sooner. If a student asks
  why: that's slide "Production reality #1."
- **Login for the console reveal:** `jason.soto@meridianbank.com` (email-only
  login) → open `/disputes/29`.

## 1. Demo 1 — the primitives (`python3 demo1_primitives.py`)

Narrate three beats: (1) the **model** chose to call `load_dispute`, the
**harness** executed it; (2) the **handoff** moved control Triage → Evidence;
(3) everything **streamed**.

Real captured output: [`logs/demo1.txt`](logs/demo1.txt).

## 2. Demo 2 — the end-to-end pipeline (`python3 demo2_pipeline.py`)

Run right after the predict-the-pipeline activity; score predictions against
the stream. Three moments to point at:

Real captured output: [`logs/demo2.txt`](logs/demo2.txt).

Live-run subtlety (predicted by the sharp students): the input guardrail logs
**0 quarantined on live** — the platform API already filters the poisoned
chunk at retrieval (defense in depth). It visibly quarantines chunk 121 in
`--mock`.

**The reveal:** open the Ops Console dispute 29 → **Linked tickets** — the
recommendation the class just watched is IN the product:

![Live Ops Console — dispute 29 with the agent-created tickets](shots/console_dispute29_live.png)

**Rerun with `--tripwire`** to force an uncited money claim and watch the
output guardrail block it into a human-review ticket:

Real captured output: [`logs/demo2_tripwire.txt`](logs/demo2_tripwire.txt).

## 3. Demo 3 — Strands portability (`python3 demo3_strands.py`)

One screen of code, then the run. The point is what DIDN'T change (tool,
instructions, mental model). Deep dive: `../supplementary/strands_agents.md`.

Real captured output: [`logs/demo3.txt`](logs/demo3.txt).

> **On authenticity:** the `logs/*.txt` files are the **verbatim stdout** of the
> demo programs (captured live on Bedrock, ANSI colour stripped) and the console
> image is a **genuine Playwright screenshot** of the live site — nothing is
> rendered, drawn, or generated. Live output varies run to run: for dispute 29
> the policy RAG returns general chunks, so the model usually escalates to
> `HUMAN_REVIEW` (correct — it won't move money on a policy it didn't retrieve),
> and the tripwire may PASS or escalate depending on how it phrases the citation.
> Both are defensible; narrate whichever you get. Verified live on Bedrock
> (Sonnet 4.5 + Haiku 4.5): demos 1–3 and the deployed Lambda all closed the
> circle on dispute 29, and the same pipeline deployed to **AgentCore Runtime**
> closed it too (ticket 9000000018) — the dated verbatim captures are in
> `logs/` (`deploy_agentcore.txt` for the AgentCore run).

## 4. Demo 4 — deploy the circle (`deploy/`)

**Deploy ops decision: LIVE deploy at 3:00 on camera; a pre-deployed copy from
T-30 is the fallback if the live deploy wobbles.**

```bash
cd deploy
./deploy.sh        # LIVE at 3:00, on camera (fallback copy already staged at T-30)
./invoke.sh 29     # LIVE in class: the deployed agent works dispute 29
./teardown.sh      # LIVE, on camera — idle deployments are silent burn
```

`invoke.sh` returns `{guardrail_tripped, ticket_id, recommendation,
see_it_live}` — open `see_it_live` and refresh: a ticket titled
**"Deployed-agent recommendation"** is now in the queue. Laptop → client
estate → product. (If the org blocks public Lambda URLs — some do, via an SCP — `invoke.sh`
auto-falls back to a direct IAM-signed `aws lambda invoke`; same result.) Say the sentence: *"That is the complete circle — and the
managed home for this exact shape is AgentCore Runtime"* (segue to the
AgentCore slide; depth in `../supplementary/agentcore.md`).

### 4b. Optional stretch — the same circle on AgentCore Runtime (`deploy/agentcore/`)

The managed version of demo 4, **verified live** (see `logs/deploy_agentcore.txt`
for the verbatim run — deploy → invoke → ticket in the product → destroy):

```bash
pip install bedrock-agentcore-starter-toolkit
cd deploy/agentcore
agentcore configure -e app.py -n meridian_triage -r us-east-1 \
    -dt direct_code_deploy -rf requirements.txt --non-interactive
agentcore deploy --env MERIDIAN_BASE_URL=$MERIDIAN_BASE_URL \
    --env MERIDIAN_API_KEY=$MERIDIAN_API_KEY
agentcore invoke '{"dispute_id": 29}'
agentcore destroy --agent meridian_triage --force   # same discipline as teardown.sh
```

`app.py` is `deploy/handler.py` re-homed: the identical five-step pipeline, but
the wrapper is 3 lines (`BedrockAgentCoreApp` + `@app.entrypoint` + `app.run()`),
invocations are IAM-authed at the door (no `DEMO_TOKEN`), and there is no
15-minute ceiling. `direct_code_deploy` pushes the Python straight to the
runtime — no container, no Docker, no CodeBuild. Two display gotchas: the CLI's
rich console strips `[chunk NN]` citations from the *displayed* response (it
parses `[…]` as markup — the ticket stored in the product keeps them), and the
toolkit CLI moves fast — commands have already been renamed between releases
(history + current surface: `../supplementary/agentcore.md`). The path above is
exactly what the verbatim log shows; verify the CLI surface before teaching it.

## Regenerating the proof artifacts

```bash
python3 shots_build.py            # real logs (live if creds, else --mock) + real browser shot
python3 shots_build.py --no-web   # logs only, skip the Playwright screenshot
```
All artifacts are authentic: `logs/*.txt` = verbatim program stdout;
`shots/console_dispute29_live.png` = a genuine browser screen capture.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AccessDeniedException` on invoke | the environment may restrict invoke paths — the shipped scripts stream by default; keep to them |
| `not available for this account` | that model isn't enabled in this environment — keep `MODEL_SMART` on an enabled model |
| `UnsupportedParamsError … tools=` | the LiteLLM/Bedrock leak — `litellm.modify_params = True` (already set in the demos; teach it, notebook §3) |
| 401 from Meridian API | key missing/revoked — mint a fresh one (`/api/v1/admin/mint`, see platform repo) |
| Anything else, 60 seconds before the block | `--mock`. Never debug live. |
