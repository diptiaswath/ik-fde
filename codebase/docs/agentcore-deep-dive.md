# Amazon Bedrock AgentCore — the managed home for the agent you just built

**Supplementary read · Week 15 · ~20 min.** The demo deployed our triage agent to
Lambda because it makes every moving part visible (a simple starting point that any
permits). This doc is the production answer: what AgentCore is, why it exists,
what each service does for the Meridian engagement, and the exact deploy path —
so you can say in an interview *"I'd run it on AgentCore Runtime, here's why,
and here's what I'd still own."*

> Facts below are as of mid-2026. Managed AI services move fast — verify
> against the [AgentCore docs](https://docs.aws.amazon.com/bedrock-agentcore/)
> before quoting specifics to a client.

---

## 1. Why a managed agent runtime exists at all

Run demo 4's Lambda for a month at Meridian and you personally own:

| You built it in the demo | In production it becomes |
|---|---|
| a 60s Lambda timeout | disputes that need a 20-minute investigation — killed mid-run |
| one `DEMO_TOKEN` header | real identity: *which analyst is this agent acting for?* (OBO) |
| `print()`-style spans | traces someone can query at 3 a.m. during an incident |
| env-var API keys | credential rotation, scoping, and a vault |
| "state" = whatever you wrote to a ticket | session memory that survives restarts and scales past one box |
| one function | session isolation between 80 concurrent analysts |

That list is undifferentiated heavy lifting — the exact platform-engineering
80% we talked about in class. AgentCore is AWS packaging that 80% as a
service family so the FDE's effort stays on the 20% that is actually the
client's problem.

**The key architectural fact:** AgentCore is **framework-agnostic and
model-agnostic**. It hosts the agent we wrote with the *OpenAI Agents SDK*
unchanged — also LangGraph, CrewAI, or Strands — calling Claude on Bedrock,
or even models outside Bedrock. It is *hosting for harnesses*, not another
harness. That's why learning the primitives (Agent / tools / handoffs /
guardrails / sessions / tracing) transfers here at zero cost.

## 2. The service family, mapped to Meridian

**Runtime** — serverless agent hosting. Package your agent (any framework),
push a container, get an invocable endpoint. Sessions run in **isolated
microVMs** (one analyst's dispute investigation can never bleed into
another's — the RBAC story from W16 starts at the compute layer). Long-running
sessions (hours, not Lambda's minutes) fit multi-step investigations.
*Meridian use:* the whole demo-2 pipeline, hosted, per-analyst sessions.

**Gateway** — turns existing APIs and Lambdas into **MCP tools** with auth
handled. Instead of hand-writing `load_dispute` wrappers, point Gateway at the
Meridian OpenAPI spec and every route becomes a tool your agent (or any
MCP-speaking agent) can call. *Meridian use:* `/api/v1` → MCP toolset in
minutes; W16 does this by hand so you understand what Gateway automates.

**Memory** — managed short-term (session) and long-term (cross-session,
extracted facts) memory. *Meridian use:* "customer already called twice about
this dispute" persisting across sessions without us running a vector store.

**Identity** — an OAuth-native token vault; the agent gets *scoped, auditable*
credentials to act on behalf of a user, instead of a god-key in an env var.
*Meridian use:* the real version of our `X-Demo-Token` and of W16's
on-behalf-of simulation.

**Observability** — OpenTelemetry traces of every step (model call, tool call,
handoff), wired into CloudWatch. The console spans demo 2 printed by hand are
literally this, productized. *Meridian use:* the trace you show the client —
and the evidence trail when the agent is accused of breaching an SLA.

**Built-in tools** — Code Interpreter (sandboxed code execution) and Browser
(managed headless browsing) as ready-made tools.

## 3. The deploy path (run live against this engagement — see the proof log)

The starter toolkit wraps the whole thing in a CLI. This exact sequence was run
live for the Meridian triage agent — the verbatim capture is in
`../demo/logs/deploy_agentcore.txt`, and the deployable app is
`../demo/deploy/agentcore/app.py`:

```bash
pip install bedrock-agentcore-starter-toolkit

# 1. wrap the agent — 3 lines around ANY framework
# app.py
from bedrock_agentcore import BedrockAgentCoreApp
app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    ...run the demo-2 pipeline here...
    return {"result": ...}

# 2. configure + deploy (formerly `launch`; creates the runtime)
agentcore configure -e app.py -dt direct_code_deploy --non-interactive
agentcore deploy

# 3. invoke it
agentcore invoke '{"dispute_id": 29}'

# 4. leave nothing running you don't own
agentcore destroy
```

Two deployment types, and the difference matters to an FDE:

- **`direct_code_deploy` (the new default)** — pushes your Python straight to
  the managed runtime via S3. No container, no Docker, no build step. IAM
  needed: `bedrock-agentcore:*`, S3, and `iam:PassRole`/role-create for the
  execution role. This is the path the live proof used.
- **Container** — builds an ARM64 image in CodeBuild, pushes to ECR, runs that.
  Adds ECR push + CodeBuild to the IAM ask; use it when you need system deps
  the managed Python runtime doesn't have.

A moves-fast footnote that proves this doc's own warning: between authoring and
the live run, `launch` was renamed `deploy`, `direct_code_deploy` became the
default, and the pip toolkit began recommending an npm successor
(`@aws/agentcore`). The pip path above still works — but verify the CLI surface
against the docs before quoting it to a client.

**Pricing shape** (verify current numbers): consumption-based — you pay for
CPU-seconds and memory-seconds while the agent is actually working, not for
idle deployments. Note how that directly answers the W14 cost-hazard lesson
(idle burn), and note what it does *not* cover: model tokens are billed
separately by Bedrock.

### 3b. Memory — you already deployed one

Look back at the capture: before the runtime existed, the toolkit created a
short-term memory resource —

```text
Creating new STM-only memory...
Created memory: meridian_triage_mem-tgHNJ3Ag5Q
```

That resource is the managed answer to "the customer already called twice
about this dispute." Our triage agent is stateless per invocation; with
Memory, each run *records* what happened and the next run *retrieves* it —
across restarts, across analysts' sessions, with no vector store of ours:

```python
import boto3
from datetime import datetime, timezone

mem = boto3.client("bedrock-agentcore")   # DATA plane (not -control)
MEMORY_ID = "meridian_triage_mem-tgHNJ3Ag5Q"   # printed by `agentcore deploy`

# invocation 1 — record what the agent concluded about dispute 29
mem.create_event(
    memoryId=MEMORY_ID, actorId="analyst-jason", sessionId="dispute-29",
    eventTimestamp=datetime.now(timezone.utc),
    payload=[{"conversational": {
        "role": "ASSISTANT",
        "content": {"text": "Dispute 29: Reg E clock open, no provisional "
                            "credit issued; recommended HUMAN_REVIEW."}}}])

# invocation 2 (later, another session) — pull the prior context back
events = mem.list_events(memoryId=MEMORY_ID, actorId="analyst-jason",
                         sessionId="dispute-29")["events"]
```

Runs on **your own account** (data-plane `bedrock-agentcore:CreateEvent` /
`ListEvents` on the memory the deploy created), or on the IK shared account
while its AWS Lab is **started** from the Lab Control Panel — stopped labs
fail closed with an explicit IAM deny; see
`../demo/deploy/agentcore/README.md`, "IK shared account status."

### 3c. Observability — where the spans went

The deploy also wired OTel delivery. After an invoke, the evidence trail is:

```bash
aws logs tail /aws/bedrock-agentcore/runtimes/<runtime-id>-DEFAULT \
  --log-stream-name-prefix "<date>/[runtime-logs" --follow
aws logs tail /aws/bedrock-agentcore/runtimes/<runtime-id>-DEFAULT \
  --log-stream-names "otel-rt-logs" --since 1h
```

plus the GenAI Observability dashboard the deploy prints
(`https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core`;
first traces take ~10 min). W17 treats this as the auditor's view —
`codebase/labs/w17-prove/agentcore_observability.md`.

## 4. Lambda vs AgentCore Runtime — the decision an FDE defends

| Dimension | Lambda (demo 4) | AgentCore Runtime |
|---|---|---|
| Session length | 15 min hard cap | hours-long sessions |
| Session isolation | shared warm containers | microVM per session |
| Identity for agents | DIY (headers, env keys) | Identity service (OAuth vault, OBO) |
| Tool wiring | hand-written wrappers | Gateway (API → MCP tools) |
| Memory | DIY (DB, tickets) | managed short+long term |
| Tracing | DIY (spans → logs) | OTel built in |
| Cost at pilot scale | ~free | consumption-based; still no idle burn |
| What you learn | everything (visible parts) | the managed shape of the same parts |

The pilot answer for Meridian: **start where the demo is** (Lambda, visible,
cheap, already inside the client's AWS account), **graduate to AgentCore
Runtime** when sessions outgrow 15 minutes or when procurement asks the
identity/isolation questions from W14 — because then you're buying exactly the
controls they asked for, off the shelf.

## 5. Sources

- AgentCore docs: https://docs.aws.amazon.com/bedrock-agentcore/
- Starter toolkit: https://github.com/aws/bedrock-agentcore-starter-toolkit
- AgentCore samples: https://github.com/awslabs/amazon-bedrock-agentcore-samples
- Pricing: https://aws.amazon.com/bedrock/agentcore/pricing/ *(verify before quoting)*
