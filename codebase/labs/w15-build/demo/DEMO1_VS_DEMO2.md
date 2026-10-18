# Demo 1 vs Demo 2: What's the Difference?

## Quick Comparison

| Aspect | Demo 1: Primitives | Demo 2: Pipeline |
|--------|-------------------|------------------|
| **Purpose** | Teach the primitives | Show the complete circle |
| **Time** | ~5 min | ~12 min |
| **Agents** | 2 (Triage → Evidence) | 3 (Triage → Evidence → Policy) |
| **Tools** | 1 (`load_dispute`) | 3 (`load_dispute`, `gather_evidence`, `search_policies`) |
| **Guardrails** | None | 2 (input quarantine + output citation check) |
| **Write-back** | None | ✅ Creates ticket in Meridian |
| **Model routing** | Haiku for both | Haiku for Triage/Evidence, **Sonnet for Policy** |
| **Flags** | `--mock` | `--mock`, `--tripwire`, `--dispute N` |
| **Teaching goal** | "Here's what each primitive does" | "Here's the end-to-end value delivery" |

---

## Demo 1: The Primitives (demo1_primitives.py)

### Purpose
**"Learn to read the nouns, one at a time."**

This is the **vocabulary lesson**. Students watch each primitive do its one job:
1. **Agent** = model + instructions + tools
2. **Tool call** = model decides to call `load_dispute`, harness executes it
3. **Handoff** = Triage delegates to Evidence, control transfers
4. **Streaming** = every step visible as it happens

### What Happens

```
User: "Triage dispute 29"
  ↓
Triage Agent (Haiku 4.5)
  - Calls load_dispute(29) ← TOOL PRIMITIVE
  - Reads: Type A, reason 10.4, Reg E breached
  - Says: "Type A, Reg E clock breached, handing off"
  - Hands off to Evidence ← HANDOFF PRIMITIVE
  ↓
Evidence Agent (Haiku 4.5)
  - Receives context from Triage
  - Says: "I would query card_network, core_banking, crm"
  - STOPS (no further handoffs)
```

**No actual evidence gathering.** Evidence agent just says what it *would* do.

### Code Structure

```python
# ONE tool
load_dispute = function_tool(_load_dispute_impl)

# TWO agents
evidence = Agent(
    name="Evidence",
    instructions="Confirm what you received and what systems you'd query next.",
    model=LitellmModel(model=MODEL_FAST),
    # NO tools - Evidence doesn't actually gather
)

triage = Agent(
    name="Triage",
    instructions="Call load_dispute, classify Type A/B, hand off to Evidence.",
    model=LitellmModel(model=MODEL_FAST),
    tools=[load_dispute],
    handoffs=[evidence],  ← THE HANDOFF PRIMITIVE
)

# Run and stream
result = Runner.run_streamed(triage, f"Triage dispute {ARGS['dispute']}.")
async for ev in result.stream_events():  ← THE STREAMING PRIMITIVE
    # Pretty-print each event
```

### Teaching Moments

From lines 4-8:
```python
# What the class watches (nobody codes along):
#   1. an Agent  = model + instructions + tools
#   2. a tool call — the model DECIDES to call load_dispute, the harness executes it
#   3. a handoff — Triage delegates to Evidence, control transfers
#   4. streaming — every step visible as it happens (this is the harness working)
```

Final messages (lines 89-90):
```python
okline(f"final agent: {result.last_agent.name}")
okline("every step above = one SDK primitive doing its one job")
```

**The lesson:** You just watched Agent, tool, handoff, streaming. Now you can read any agent code.

---

## Demo 2: The Pipeline (demo2_pipeline.py)

### Purpose
**"Problem seen (W13), problem solved (today). The recommendation lands IN THE PRODUCT."**

This is the **payoff demo**. Students watch:
1. The **complete multi-agent pipeline** (Triage → Evidence → Policy)
2. **Actual tool calls** that read live Meridian data
3. **Two guardrails** preventing bad outcomes
4. The **write-back** - the ticket appears in the Ops Console
5. **Model routing** - cheap model for volume, expensive model for money decisions

### What Happens

```
User: "Work dispute 29 end to end"
  ↓
Triage Agent (Haiku 4.5)
  - Calls load_dispute(29)
  - Classifies: Type A (fraud), Reg E clock BREACHED
  - Hands off to Evidence
  ↓
Evidence Agent (Haiku 4.5)
  - Calls gather_evidence(29)  ← ACTUALLY GATHERS
  - Reads: 4 artifacts across sharepoint, core_banking, servicenow
  - Summarizes evidence in 2 sentences
  - Hands off to Policy
  ↓
Policy Agent (Sonnet 4.5) ← THE EXPENSIVE MODEL
  - Calls search_policies("Regulation E provisional credit")
  - INPUT GUARDRAIL: quarantines poisoned chunk 121
  - Reads clean policy chunks
  - Produces recommendation with [chunk NN] citations
  - OUTPUT GUARDRAIL: checks money claims have citations
  ↓
Write-back (create_ticket)
  - POST to /disputes/29/tickets
  - Idempotent (Idempotency-Key header)
  - Ticket appears in Ops Console ← THE COMPLETE CIRCLE
```

**Result in product:** Open console → dispute 29 → Linked tickets → agent's recommendation is THERE.

### Code Structure

```python
# THREE tools (full stack)
load_dispute = function_tool(_load_dispute)
gather_evidence = function_tool(_gather_evidence)
search_policies = function_tool(_search_policies)  # ← includes INPUT GUARDRAIL

# INPUT GUARDRAIL (lines 80-91)
def _search_policies(query: str) -> str:
    chunks = DATA.search_policies(query)
    clean, quarantined = [], []
    for c in chunks:
        if c.get("is_poisoned") or INJECTION_MARKERS.search(c.get("content", "")):
            quarantined.append(c["chunk_id"])
        else:
            clean.append(c)
    if quarantined:
        blocked(f"QUARANTINED poisoned chunk {quarantined}")
    return json.dumps(clean[:8])

# OUTPUT GUARDRAIL (lines 105-109)
def citation_tripwire(text: str) -> tuple[bool, str]:
    """Money-moving claims must cite a policy chunk."""
    if MONEY_CLAIM.search(text) and not CITATION.search(text):
        return False, "uncited provisional-credit/refund claim"
    return True, ""

# THREE agents (full pipeline)
policy = Agent(
    name="Policy",
    instructions="Search once for 'Regulation E provisional credit'. "
                 "Every money claim MUST cite [chunk NN]. "
                 "End with: RECOMMENDATION: <ISSUE_PROVISIONAL_CREDIT | DENY | HUMAN_REVIEW>.",
    model=LitellmModel(model=MODEL_SMART),  ← SONNET 4.5 for money decisions
    tools=[search_policies],
)

evidence = Agent(
    name="Evidence",
    instructions="Call gather_evidence, confirm >=3 systems, summarize, hand off to Policy.",
    model=LitellmModel(model=MODEL_FAST),  ← HAIKU for high-volume
    tools=[gather_evidence],
    handoffs=[policy],
)

triage = Agent(
    name="Triage",
    instructions="Call load_dispute, classify Type A/B, check Reg E clock, hand off to Evidence.",
    model=LitellmModel(model=MODEL_FAST),
    tools=[load_dispute],
    handoffs=[evidence],
)

# Run, stream, guardrail, write-back
result = Runner.run_streamed(triage, f"Work dispute {DISPUTE_ID}.", max_turns=20)
# ... streaming ...
final = result.final_output or ""

# OUTPUT GUARDRAIL CHECK
passed, why = citation_tripwire(final)
if passed:
    write_back(final, escalated_to_human=False)
else:
    blocked(f"BLOCKED: {why}")
    write_back("[guardrail-blocked output withheld]", escalated_to_human=True)

# THE CIRCLE CLOSES
okline("THE CIRCLE IS CLOSED — the agent's recommendation is now a ticket")
okline(f"see it in the product: {url}/disputes/{DISPUTE_ID}")
```

### Teaching Moments

From lines 2-27:
```python
# This is the W15 centerpiece. The class already saw the problem (W13: the dispute
# queue bleeding SLA breaches) and priced the fix (W14). Today the agent actually
# works a dispute END TO END and the result LANDS IN THE PRODUCT:
#
#     Triage (Haiku 4.5)  →  Evidence (Haiku 4.5)  →  Policy (Sonnet 4.5)
#         │ classify Type A/B          │ read the live Meridian API      │ RAG + Reg E
#         │ Reg E clock                │ evidence + customer             │ two guardrails
#         └────────────────────────────┴─────────────┬───────────────────┘
#                                                     ▼
#                               ✍ create_ticket → the LIVE Ops Console
#                     (idempotent write, audit-logged, scoped API key)
```

**Cost engineering** (lines 20-22):
```python
# Model routing (cost engineering, live): the cheap model (Haiku 4.5) does the
# high-volume steps; the expensive model (Sonnet 4.5) only touches the step where
# money moves (the Reg E policy call).
```

**Two guardrails** (lines 24-27):
```python
# Two guardrails (the controls we promised procurement in W14):
#   * input  — poisoned policy chunks are quarantined BEFORE reaching context
#   * output — a provisional-credit claim without a [chunk NN] citation is BLOCKED
#              and routed to a human instead
```

### The --tripwire Flag

```bash
python3 demo2_pipeline.py --tripwire
```

**What it does:**
- Forces Policy agent to produce a recommendation WITHOUT [chunk NN] citations
- Output guardrail catches the uncited money claim
- Agent's output is BLOCKED
- A "HUMAN REVIEW NEEDED" ticket is created instead

**The lesson:** Even when the substance is correct, controls enforce auditability. This is the "confidently wrong" scenario - the model makes the right call but fails to follow citation rules.

From lines 143-149:
```python
+ ("Do NOT include any [chunk NN] citations — just state your "
   "conclusion plainly. "  # --tripwire: the 'confidently wrong' rehearsal
   if ARGS["tripwire"] else
   "Rules: every statement about provisional credit MUST cite its "
   "policy chunk inline as [chunk NN]. ")
```

**Rerun sequence in class:**
1. First run: normal path, guardrail passes, recommendation lands in console
2. Refresh console: "Here's the ticket from the first run"
3. Rerun with `--tripwire`: guardrail blocks, human-review ticket created
4. Refresh console: "Now there's a second ticket - the blocked one"

---

## Visual Comparison

### Demo 1: Learning the Nouns

```
┌─────────────────────────────────────────┐
│ DEMO 1: The Primitives                  │
├─────────────────────────────────────────┤
│                                         │
│  Agent Triage (Haiku)                   │
│    ↓ tool: load_dispute(29)             │
│    ↓ "Type A, Reg E breached"           │
│    ↓ HANDOFF                            │
│  Agent Evidence (Haiku)                  │
│    ↓ "I would query 3 systems"          │
│    ✓ DONE                               │
│                                         │
│  Result: You learned 4 primitives       │
│  - Agent                                │
│  - Tool                                 │
│  - Handoff                              │
│  - Streaming                            │
│                                         │
│  No guardrails                          │
│  No write-back                          │
│  No product impact                      │
└─────────────────────────────────────────┘
```

### Demo 2: Delivering Value

```
┌──────────────────────────────────────────────────────────┐
│ DEMO 2: The Complete Circle                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Agent Triage (Haiku - cheap)                            │
│    ↓ tool: load_dispute(29)                              │
│    ↓ "Type A, Reg E breached"                            │
│    ↓ HANDOFF                                             │
│  Agent Evidence (Haiku - cheap)                          │
│    ↓ tool: gather_evidence(29)                           │
│    ↓ "4 artifacts, 3 systems"                            │
│    ↓ HANDOFF                                             │
│  Agent Policy (Sonnet - expensive, money step)           │
│    ↓ tool: search_policies("Reg E provisional credit")   │
│    ├─ 🛡 INPUT GUARDRAIL: quarantine poisoned chunk 121  │
│    ↓ RAG retrieval: clean chunks only                    │
│    ↓ "Recommend provisional credit [chunk 101]"          │
│    ├─ 🛡 OUTPUT GUARDRAIL: citation present? PASS        │
│    ↓                                                     │
│  ✍ create_ticket(dispute=29, body=recommendation)        │
│    ↓ Idempotency-Key: w15-demo-29-a3f8b2c1               │
│    ↓ POST /disputes/29/tickets                           │
│    ✓ ticket_id=9000000017                                │
│                                                          │
│  Result: TICKET IN THE OPS CONSOLE                       │
│  Open: /disputes/29 → Linked tickets                     │
│  The agent's work is IN THE PRODUCT                      │
│                                                          │
│  With guardrails: input quarantine + citation check      │
│  With cost control: Haiku for volume, Sonnet for $$$    │
│  With --tripwire: force guardrail BLOCK, see it catch    │
└──────────────────────────────────────────────────────────┘
```

---

## Why Two Demos?

### Pedagogical Progression

**Demo 1 answers:** "What ARE these things?"
- Students see Agent, tool, handoff, streaming in isolation
- Each primitive does its one job
- No distractions from guardrails or write-backs
- **5 minutes** - fast, focused, foundational

**Demo 2 answers:** "What can we BUILD with them?"
- Same primitives, but combined into a real system
- Guardrails show production controls
- Write-back shows the complete circle (laptop → AWS → product)
- Model routing shows cost engineering
- **12 minutes** - the payoff, the "this is why we learned primitives"

### The Narrative Arc

```
W13: "Here's the problem — SLA breaches in the dispute queue"
     Students see the pain in the product

W14: "Here's what it costs to fix — procurement wants guardrails"
     Students price the solution

W15 Demo 1: "Here are the primitives — Agent, tool, handoff, streaming"
            Students learn the nouns (5 min)

W15 Demo 2: "Here's the fix, END TO END, landing in the product"
            Students watch the circle close (12 min)
            Problem seen → problem solved

W15 Demo 3: "Same primitives, different harness (Strands)"
            Students see portability (4 min)

W15 Demo 4: "Deploy it to a Lambda, invoke it, tear it down"
            Students see the deployed endpoint work dispute 29 (8 min)
```

---

## When to Use Each Demo's Pattern

### Use Demo 1 Pattern (Simple Handoff Chain) When:
- Teaching primitives to new team members
- Prototyping agent interactions before adding complexity
- Debugging handoff logic without guardrail noise
- Building proof-of-concepts

### Use Demo 2 Pattern (Full Pipeline) When:
- Building production agents with real consequences
- Money, compliance, or safety is on the line
- You need input/output validation
- The agent's output must land in a system of record
- Cost optimization matters (model routing)
- Auditors will ask "how do you prevent X?"

---

## Summary Table

| Feature | Demo 1 | Demo 2 |
|---------|--------|--------|
| **Agents** | 2 | 3 |
| **Tools** | 1 (Triage only) | 3 (all agents call tools) |
| **Evidence gathering** | Simulated ("I would query...") | Real (`gather_evidence` call) |
| **Policy search** | Not present | Real RAG retrieval |
| **Guardrails** | None | Input (quarantine) + Output (citation) |
| **Write-back** | None | ✅ `create_ticket` to Meridian |
| **Model routing** | Haiku for all | Haiku (volume) + Sonnet (money) |
| **Cost story** | Not taught | Taught (lines 20-22) |
| **Compliance story** | Not taught | Taught (lines 24-27) |
| **Product impact** | None | Ticket visible in console |
| **Teaching goal** | Learn primitives | See complete value delivery |
| **Runtime** | ~5 min | ~12 min |
| **Rerun with flag** | No | Yes (`--tripwire` forces guardrail block) |
| **Console reveal** | No | Yes (open dispute 29, see tickets) |

---

## Code References

- **Demo 1:** `labs/w15-build/demo/demo1_primitives.py`
- **Demo 2:** `labs/w15-build/demo/demo2_pipeline.py`
- **Captured logs:** `labs/w15-build/demo/logs/demo1.txt`, `logs/demo2.txt`, `logs/demo2_tripwire.txt`
- **README:** `labs/w15-build/demo/README.md` (lines 50-78 for full narration)

---

## The Bottom Line

**Demo 1** teaches you to **read** agent code.
**Demo 2** teaches you to **ship** agent systems.

You need both: primitives without production patterns is academic; production patterns without understanding primitives is cargo-culting. An FDE who watches both can walk into any agent codebase and understand what's happening AND why it's structured that way.
