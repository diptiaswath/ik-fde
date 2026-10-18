# Traces — The Flight Recorder

## What You're Looking At

This is the **console output from demo 2** (`demo/logs/demo2.txt`) - the same run you just watched, but shown as **spans** (individual recorded steps).

### The Trace Output

```
⛁ load_dispute(29) [tool] span_67149952
  ↓
➜ Triage → Evidence [handoff] span_4e49c44a
    model: us.anthropic.claude-haiku-4-5-20251001-v1:0
  ↓
⛁ gather_evidence(29) [tool] span_a4e82b26
  ↓
➜ Evidence → Policy [handoff] span_aa8a776c
    model: us.anthropic.claude-sonnet-4-5-20250929-v1:0
  ↓
⛁ search_policies("Regulation E provisional credit") [tool] span_cf862a36
  ↓
🛡 input_guardrail: quarantine_poisoned [guardrail] span_5f34bb27
```

**Read top-to-bottom** - it's the story of the run.

---

## Key Concepts

### 1. A Span = One Step

**Every operation gets a unique ID:**
- Tool calls (`load_dispute`, `gather_evidence`, `search_policies`)
- Handoffs (Triage → Evidence, Evidence → Policy)
- Guardrail checks (input quarantine, output citation)
- Model invocations (which model was used)

**Each span records:**
- **What** happened (tool name, agent name, guardrail type)
- **When** it happened (timestamp)
- **How long** it took (duration in ms)
- **Inputs/outputs** (what went in, what came out)
- **Success/failure** (did it work or throw?)
- **Metadata** (model used, tokens consumed, cost)

**Example span data structure:**
```json
{
  "span_id": "67149952",
  "trace_id": "dispute-29-abc123",
  "name": "load_dispute",
  "type": "tool",
  "start_time": "2025-10-14T14:23:01.234Z",
  "duration_ms": 187,
  "input": {"dispute_id": 29},
  "output": {"dispute_type": "A", "reason": "11.2", "amount_cents": 3536},
  "status": "success"
}
```

---

### 2. One Run = One Trace

All these spans chain together into **one trace** for dispute 29:

```
Trace: dispute-29-run-abc123
  ├─ span: load_dispute(29)
  ├─ span: Triage agent invoke
  ├─ span: Triage → Evidence handoff
  ├─ span: gather_evidence(29)
  ├─ span: Evidence agent invoke
  ├─ span: Evidence → Policy handoff
  ├─ span: search_policies(...)
  ├─ span: input_guardrail check
  ├─ span: Policy agent invoke
  ├─ span: output_guardrail check
  └─ span: create_ticket
```

**Purpose:**

> "Your 3 a.m. incident evidence AND the client's audit trail."

When something goes wrong at 3am, or when auditors ask "what did the agent do?", you have a **queryable record** of every step.

**The spans chain into a single queryable record per dispute:**
- **Debugging:** "Show me the trace for dispute 29 that failed last night"
- **Auditing:** "Show me all traces where the citation guardrail tripped"
- **Cost analysis:** "What's the P95 token consumption for Policy agent?"
- **Performance:** "Which step takes longest in the pipeline?"

---

### 3. The Shape is Standard: OpenTelemetry (OTel)

From the W15 notebook (§2.6), the tracing architecture:

```python
from agents.tracing import set_trace_processors, TracingProcessor

class ConsoleSpanPrinter(TracingProcessor):
    """Spans -> stdout. Same seam sends them to CloudWatch/OTel."""
    def on_trace_start(self, t):
        print(f"TRACE start {t.name}")

    def on_trace_end(self, t):
        print(f"TRACE end {t.name}")

    def on_span_end(self, s):
        data = s.span_data
        print(f"  span: {type(data).__name__} {getattr(data, 'name', '')}")

    def shutdown(self): pass
    def force_flush(self): pass

# Replace default processor (exports to OpenAI) with ours
set_trace_processors([ConsoleSpanPrinter()])
```

**Today (demo):** Spans print to console
**Production:** Same spans go to **OpenTelemetry-compatible backends**

#### Where Traces Can Go

| Environment | Backend | What It Gets |
|-------------|---------|--------------|
| **Demo** | Console stdout | Pretty-printed spans you see in demo2.py |
| **Production** | AWS CloudWatch | Queryable traces in CloudWatch Logs Insights |
| **Production** | Datadog | Distributed traces + APM dashboard |
| **Production** | Honeycomb | Query builder for trace analysis |
| **Production** | Grafana Tempo | OSS trace storage + Grafana dashboards |
| **Production** | Any OTel Collector | Standard OTLP protocol |

**Why OTel matters:**

OpenTelemetry is the **industry standard** for observability (traces, metrics, logs). Your client's existing observability infrastructure already speaks OTel - so your agent traces land in the **same dashboards as their other services**.

**No vendor lock-in.** Switch from CloudWatch to Datadog? Change one exporter config, same trace structure.

---

### 4. AgentCore Observability = Managed Version

#### What You Write By Hand (Today's Demos)

```python
from agents.tracing import set_trace_processors, trace, custom_span

# Register your custom processor
set_trace_processors([ConsoleSpanPrinter()])

# Wrap your run in a trace
with trace("dispute-29"):
    with custom_span("triage.classify"):
        # work happens
        pass
    with custom_span("guardrail.citation_tripwire"):
        # guardrail check
        pass
```

**You own:** Processor implementation, trace/span wrapping, export to backend

#### AgentCore Observability (Managed)

```python
# No trace setup needed - automatically captured
result = await run_meridian_pipeline(dispute_id=29)

# Traces automatically:
# - Sent to CloudWatch Logs
# - Appear in GenAI Observability dashboard
# - Queryable via CloudWatch Insights
# - OTel-compatible for external collectors
```

**AWS owns:** Span collection, export, dashboard, retention

**What you get:**
- Automatic span collection (no manual `with trace()` needed)
- Sends to CloudWatch's **GenAI Observability dashboard**
- Pre-built queries: "Show me all runs where guardrails tripped"
- No custom TracingProcessor code to maintain
- OTel export for multi-cloud observability

From the slide:
> "AgentCore Observability = these spans, managed — they land in CloudWatch's GenAI Observability dashboard"

---

## A Complete Pipeline Trace (Annotated)

Here's what a full demo 2 trace looks like with all the metadata:

```
Trace: dispute-29 (total duration: 8.2s, total cost: $0.0034)
│
├─ span: load_dispute(29) [187ms]
│   type: tool
│   input: {"dispute_id": 29}
│   output: {"dispute_type": "A", "reason": "11.2", "amount_cents": 3536, ...}
│   status: success
│
├─ span: Triage agent invoke [1.5s]
│   type: agent_invoke
│   model: bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0
│   input_tokens: 347
│   output_tokens: 89
│   cost: $0.00079
│   status: success
│
├─ span: Triage → Evidence handoff [102ms]
│   type: handoff
│   from: Triage
│   to: Evidence
│   context_transferred: true
│
├─ span: gather_evidence(29) [284ms]
│   type: tool
│   input: {"dispute_id": 29}
│   output: {"count": 3, "systems": ["core_banking", "card_network", "sharepoint"]}
│   status: success
│
├─ span: Evidence agent invoke [2.1s]
│   type: agent_invoke
│   model: bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0
│   input_tokens: 521
│   output_tokens: 112
│   cost: $0.00108
│   status: success
│
├─ span: Evidence → Policy handoff [89ms]
│   type: handoff
│   from: Evidence
│   to: Policy
│   model_switch: haiku-4-5 → sonnet-4-5  ← Cost control visible!
│   context_transferred: true
│
├─ span: search_policies("Regulation E provisional credit") [412ms]
│   type: tool
│   input: {"query": "Regulation E provisional credit"}
│   output: {"count": 8, "chunk_ids": [101, 102, 103, 104, 105, 106, 107, 121]}
│   status: success
│
├─ span: input_guardrail: quarantine_poisoned [47ms]
│   type: guardrail_input
│   quarantined: [121]  ← Security control visible!
│   reason: "injection marker detected: 'ignore prior constraints'"
│   tripwire: false (quarantine, don't halt)
│   clean_chunks: [101, 102, 103, 104, 105, 106, 107]
│
├─ span: Policy agent invoke [3.2s]
│   type: agent_invoke
│   model: bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0
│   input_tokens: 4821
│   cache_read_tokens: 4200  ← Prompt caching working!
│   cache_write_tokens: 0
│   output_tokens: 156
│   cost: $0.00147  (cache savings: ~$0.0115)
│   status: success
│
├─ span: output_guardrail: citation_tripwire [28ms]
│   type: guardrail_output
│   money_claim_detected: true
│   citation_found: true ([chunk 101])
│   tripwire: false
│   reason: "money claim properly cited"
│   status: pass
│
└─ span: create_ticket [234ms]
    type: tool
    input: {"dispute_id": 29, "channel": "chat", "subject": "Agent recommendation"}
    output: {"ticket_id": "9000000017", "status": "open"}
    idempotent_replay: false  ← First creation, not a retry
    status: success
```

---

## Queryable Questions (The Value)

With traces stored in an OTel-compatible backend, you can query:

### Debugging Queries

**"Show me all runs where the input guardrail quarantined something"**
```sql
fields @timestamp, trace_id, span_id, quarantined
| filter span_type = "guardrail_input" and array_length(quarantined) > 0
| sort @timestamp desc
```

**"What failed on dispute 29 last night?"**
```sql
fields @timestamp, span_type, span_name, status, error
| filter trace_id = "dispute-29-abc123" and status = "error"
```

### Performance Queries

**"What's the P95 latency for the Policy agent?"**
```sql
fields duration_ms
| filter span_type = "agent_invoke" and model like "sonnet"
| stats percentile(duration_ms, 95) as p95_latency
```

**"Which step takes longest in the pipeline?"**
```sql
fields span_name, avg(duration_ms) as avg_duration
| filter trace_id like "dispute-"
| stats avg(duration_ms) by span_name
| sort avg_duration desc
```

### Cost Analysis

**"What's our daily inference cost?"**
```sql
fields cost
| filter span_type = "agent_invoke"
| stats sum(cost) by bin(@timestamp, 1d)
```

**"How much cache hit rate are we getting on the Reg E context?"**
```sql
fields cache_read_tokens, input_tokens
| filter span_type = "agent_invoke" and model like "sonnet"
| stats avg(cache_read_tokens / input_tokens) as cache_hit_rate
```

### Compliance/Audit Queries

**"Which disputes triggered the output guardrail?"**
```sql
fields @timestamp, trace_id, reason
| filter span_type = "guardrail_output" and tripwire = true
| sort @timestamp desc
```

**"Show me all agent actions on dispute 29 with timestamps"**
```sql
fields @timestamp, span_type, span_name, input, output
| filter trace_id = "dispute-29-abc123"
| sort @timestamp asc
```

**"Did the agent cite sources for every provisional credit recommendation?"**
```sql
fields trace_id, money_claim_detected, citation_found
| filter span_type = "guardrail_output"
| filter money_claim_detected = true and citation_found = false
```

---

## The Interview Answer

### Bad Answer (No Tracing)

**Q:** "How do you debug an agent that ran last night and failed?"

**A:** "Check the logs, look at the error message, try to reproduce it locally."

**Problem:**
- Logs might be scattered across multiple systems
- Error message doesn't tell you WHAT inputs caused the failure
- Can't see the full sequence of steps
- No visibility into which agent/tool/guardrail failed
- Reproduction is guesswork

### Good Answer (With Tracing)

**Q:** "How do you debug an agent that ran last night and failed?"

**A:**

> "Every run produces a **trace** - a chain of spans recording every tool call, handoff, and guardrail check with timing, inputs/outputs, and status.
>
> I query the trace by **run ID** or **dispute ID** in CloudWatch/Datadog, see exactly where it failed (which span), inspect the inputs/outputs at that step, and reproduce locally with the exact same inputs.
>
> For example, if the Evidence → Policy handoff failed, I can see:
> - The exact context passed from Evidence
> - The model invocation that threw
> - The error returned (throttling? malformed input?)
> - Timing (did it timeout?)
>
> The trace is also the **audit trail** - when compliance asks 'did the agent cite its sources?', I query for the `output_guardrail` span and show them the citation check results with the actual [chunk NN] references in the recorded output.
>
> Traces turn 'something broke' into 'span_aa8a776c failed at 3:47am with this specific input, here's how to reproduce.'"

### Compliance Answer

**Q:** "How do you prove to auditors that the agent followed policy citation rules?"

**A:**

> "Every run is a trace. The `output_guardrail: citation_tripwire` span records:
> - Whether a money claim was detected (regex match on 'provisional credit|refund')
> - Whether citations were present ([chunk NN] pattern)
> - The tripwire decision (pass/fail)
> - The full output text that was checked
>
> I can produce a report: 'Show me all Policy agent outputs from Q1 2026 where money was moved' and prove that 100% had citations, or surface the exceptions where the guardrail blocked uncited claims and routed to human review.
>
> The trace is **tamper-evident** (immutable once written) and **timestamped** - it's evidence, not just logging."

---

## Why the "Flight Recorder" Metaphor

When a plane crashes, investigators recover the **flight data recorder (black box)**:
- Records every instrument reading
- Timestamped, second-by-second
- Survives the crash
- Used to reconstruct what happened

When an agent "crashes" (fails, behaves unexpectedly, triggers guardrails):
- **Trace = the black box**
- Records every tool call, handoff, guardrail check
- Timestamped, span-by-span
- Persists in storage (survives the run)
- Used to reconstruct what the agent did and why

**Without traces:** "It failed somewhere, not sure where, maybe retry?"
**With traces:** "It failed at span_aa8a776c (the Evidence → Policy handoff at 3:47:23am), here's the input that caused it (missing 'reg_e_due_at' field), reproduce with dispute ID 29 and this mock input, fix is a null check in the handoff context builder."

That's the difference between **hoping** it works and **knowing** what happened.

---

## Production Trace Setup (How to Wire It)

### Today's Demo (Console Output)

From `demo2_pipeline.py` and the notebook:

```python
from agents.tracing import set_trace_processors, TracingProcessor

class ConsoleSpanPrinter(TracingProcessor):
    def on_span_end(self, s):
        # Pretty-print to stdout
        data = s.span_data
        print(f"span: {type(data).__name__} {getattr(data, 'name', '')}")

    def shutdown(self): pass
    def force_flush(self): pass

set_trace_processors([ConsoleSpanPrinter()])
```

### Production (CloudWatch)

```python
from agents.tracing import set_trace_processors
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# OpenTelemetry setup for CloudWatch (via ADOT - AWS Distro for OpenTelemetry)
provider = TracerProvider()
otlp_exporter = OTLPSpanExporter(
    endpoint="http://localhost:4317"  # ADOT Collector
)
provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
trace.set_tracer_provider(provider)

# Now all agent spans export to CloudWatch via ADOT
# No need for custom TracingProcessor - SDK auto-instruments
```

**Deployment pattern:**
1. Run ADOT Collector as sidecar (Lambda Layer or container)
2. ADOT exports to CloudWatch X-Ray
3. Traces appear in CloudWatch Console → X-Ray → Traces
4. Query via CloudWatch Logs Insights

### AgentCore (Zero Config)

```python
from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

@app.entrypoint
async def invoke(payload):
    # Traces are automatic - no setup needed
    result = await run_meridian_pipeline(payload["dispute_id"])
    return {"recommendation": result.final_output}

app.run()
```

**What happens:**
- AgentCore Runtime auto-captures spans
- Exports to CloudWatch GenAI Observability dashboard
- Pre-built queries available
- OTel-compatible for external collectors

---

## Code Reference

### Where Tracing is Set Up

| File | What It Does |
|------|--------------|
| `demo/common.py:61-70` | `span()` helper - prints tool/handoff/guardrail events with IDs |
| `notebooks/W15_notebook.ipynb` §2.6 | TracingProcessor implementation + custom_span usage |
| `agent/src/meridian_agent/agents/sdk_runtime.py:21-72` | Reference wiring showing Session + Tracing together |
| `demo/demo2_pipeline.py:56,70,87,118` | `span()` calls throughout pipeline (tool, handoff, guardrail, write) |

### How to View Traces

**Local (Demo):**
```bash
python3 demo2_pipeline.py --dispute 29
# Watch console output - each ⛁/➜/🛡 line is a span
```

**Captured (Offline):**
```bash
cat demo/logs/demo2.txt
# Verbatim stdout from a verified live run
```

**Notebook (Runnable):**
```bash
jupyter notebook notebooks/W15_notebook.ipynb
# Run §2.6 - custom span example + TracingProcessor
```

**Production (CloudWatch - if deployed):**
1. AWS Console → CloudWatch → X-Ray → Traces
2. Filter by trace ID or custom metadata
3. View service map, timeline, span details

---

## Summary

| Concept | Meaning |
|---------|---------|
| **Span** | One recorded step (tool call, handoff, guardrail check) with timing, I/O, status |
| **Trace** | One run = chain of spans, queryable record per dispute |
| **OpenTelemetry (OTel)** | Industry standard format - works with CloudWatch, Datadog, Grafana, etc. |
| **TracingProcessor** | Your code that receives span events and exports them (console, CloudWatch, etc.) |
| **Flight recorder** | When the agent "crashes", traces are your black box to debug what happened |
| **AgentCore Observability** | Managed version - auto-capture spans, export to CloudWatch, pre-built dashboards |

**The value proposition:**

Without traces: "It broke, not sure why, try again?"
With traces: "Here's the exact span that failed, with inputs/outputs, at 3:47:23am, reproducible with dispute ID 29."

Without traces: "Did it follow policy?" → hope + manual review
With traces: "Query: show me all guardrail trips in Q1" → proof + audit trail

**Traces turn agents from magic boxes into debuggable, auditable, cost-analyzable systems.**

That's why it's called the flight recorder - when things go wrong (and they will), you need the black box.

---

## Further Reading

- **W15 Notebook §2.6:** TracingProcessor implementation + custom span usage
- **OpenTelemetry docs:** https://opentelemetry.io/docs/
- **AWS X-Ray (OTel-compatible):** https://docs.aws.amazon.com/xray/
- **AgentCore Observability:** https://docs.aws.amazon.com/bedrock-agentcore/latest/userguide/observability.html
- **Demo logs:** `demo/logs/demo2.txt` - verbatim trace from a live run

---

**Bottom line:** Traces are not optional. They're the difference between "the demo works" and "the production system is debuggable, auditable, and cost-accountable."

Build the TracingProcessor on day 1. Your 3am self will thank you.
