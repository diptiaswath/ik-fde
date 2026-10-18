# OpenAI SDK vs OpenAI Agents SDK

## TL;DR

- **OpenAI SDK** (`openai`) = Low-level API client. You manually handle tool loops, state, streaming.
- **OpenAI Agents SDK** (`openai-agents`) = High-level framework built on top. Gives you Agent, handoffs, guardrails, sessions out of the box.

**W15 uses Agents SDK for primitives + LiteLLM for Bedrock portability.**

---

## OpenAI SDK (Base Library)

**Package:** `openai` (v2.54.0+)
**Purpose:** Direct API access to OpenAI models

### What You Write

```python
from openai import OpenAI

client = OpenAI(api_key="...")
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "search_policies",
            "description": "Search policy knowledge base",
            "parameters": {...}  # JSON schema
        }
    }]
)

# YOU handle:
# - Tool call parsing
# - Tool execution dispatch
# - Conversation state tracking
# - Agentic loop (model → tool → model → ...)
# - Handoffs between agents (no built-in primitive)
# - Streaming event parsing
# - Session persistence
```

### What You Get

- Direct model access (chat, embeddings, fine-tuning)
- Tool calling API (you parse and dispatch)
- Streaming responses (you handle events)

### What You DON'T Get

- Agent orchestration
- Automatic tool loop
- Handoffs
- Guardrails
- Session persistence
- Higher-level abstractions

**You write ~100-200 lines of orchestration code per agent.**

---

## OpenAI Agents SDK (Framework)

**Package:** `openai-agents` (v0.20.0+, depends on `openai`)
**Purpose:** Production-grade agentic primitives

### What You Write

```python
from agents import Agent, Runner, function_tool
from agents.extensions.models.litellm_model import LitellmModel

@function_tool
def search_policies(query: str) -> str:
    """Search policy knowledge base."""
    # implementation
    return json.dumps(results)

policy = Agent(
    name="Policy",
    instructions="You apply Reg E. Any money claim MUST cite [chunk NN].",
    model=LitellmModel(model="bedrock/converse/us.anthropic.claude-sonnet-4-5"),
    tools=[search_policies],
)

evidence = Agent(
    name="Evidence",
    instructions="Gather evidence from >=3 systems, then hand off.",
    model=LitellmModel(model="bedrock/converse/us.anthropic.claude-haiku-4-5"),
    handoffs=[policy],  # Built-in handoff primitive
)

# Runner handles the entire agentic loop
result = await Runner.run_streamed(evidence, "Work dispute 29")
```

### What You Get

**Core Primitives:**
- `Agent` - Model + instructions + tools + guardrails + handoffs
- `Runner` - Orchestrates the agentic loop automatically
- `function_tool` - Decorator turns Python functions into tools
- `Handoff` - Transfer control between agents
- `input_guardrail` / `output_guardrail` - Validation hooks
- `Session` - Persist conversation state (SQLite, Redis, etc.)
- `StreamEvent` - Structured streaming events

**Built-in Features:**
- Automatic tool calling loop (model → tool → model → ...)
- Agent-to-agent handoffs with context transfer
- Guardrail execution (input filtering, output validation)
- Session persistence and resume
- Streaming with structured events
- MCP server integration
- Tool approval flows

**You write ~20 lines of agent definitions, SDK handles orchestration.**

---

## Key Primitives from the Agents SDK

From `agent/src/meridian_agent/agents/sdk_runtime.py:22-71`:

```python
from agents import (
    Agent,                    # AI agent: model + instructions + tools + handoffs
    Runner,                   # Executes agents with automatic tool loop
    function_tool,            # Decorator: Python function → agent tool
    input_guardrail,          # Validate/filter inputs before reaching model
    output_guardrail,         # Validate outputs before returning
    SQLiteSession,            # Persist conversation state to SQLite
    GuardrailFunctionOutput,  # Return type for guardrails
)
```

---

## Real W15 Example: Demo 2 Pipeline

### With Agents SDK (Actual Code)

From `demo2_pipeline.py:136-177`:

```python
from agents import Agent, Runner, function_tool, set_tracing_disabled
from agents.extensions.models.litellm_model import LitellmModel

# Tools are just decorated Python functions
@function_tool
def _search_policies(query: str) -> str:
    chunks = DATA.search_policies(query)
    # INPUT GUARDRAIL - quarantine poisoned chunks
    clean = [c for c in chunks if not c.get("is_poisoned")]
    return json.dumps(clean[:8])

# Define the agent hierarchy
policy = Agent(
    name="Policy",
    instructions=(
        "You are the Policy agent. Search for 'Regulation E provisional credit'. "
        "Rules: every money claim MUST cite [chunk NN]. "
        "End with: RECOMMENDATION: <ISSUE_PROVISIONAL_CREDIT | DENY | HUMAN_REVIEW>."
    ),
    model=LitellmModel(model=MODEL_SMART),   # Sonnet 4.5 for money decisions
    tools=[search_policies],
)

evidence = Agent(
    name="Evidence",
    instructions="Gather evidence from >=3 systems, summarize in 2 sentences, hand off.",
    model=LitellmModel(model=MODEL_FAST),    # Haiku 4.5 for high-volume
    tools=[gather_evidence],
    handoffs=[policy],                       # Built-in handoff
)

triage = Agent(
    name="Triage",
    instructions="Classify Type A/B, check Reg E clock, hand off to Evidence.",
    model=LitellmModel(model=MODEL_FAST),
    tools=[load_dispute],
    handoffs=[evidence],
)

# Run the multi-agent pipeline - SDK handles everything
result = Runner.run_streamed(triage, f"Work dispute {DISPUTE_ID}.", max_turns=20)
async for ev in result.stream_events():
    # Handle streaming events as they arrive
    if ev.type == "agent_updated_stream_event":
        print(f"Handoff: {current} → {ev.new_agent.name}")
```

**Lines of code:** ~40 for 3 agents with handoffs, guardrails, streaming

### What You'd Write with Base OpenAI SDK

```python
from openai import OpenAI

client = OpenAI()
messages = [{"role": "user", "content": "Work dispute 29"}]
current_agent = "Triage"
tools_map = {
    "load_dispute": load_dispute_impl,
    "gather_evidence": gather_evidence_impl,
    "search_policies": search_policies_impl,
}

while True:
    # Manual model call
    response = client.chat.completions.create(
        model="gpt-4" if current_agent == "Policy" else "gpt-4o-mini",
        messages=messages,
        tools=[...],  # Manually construct JSON schema for each agent
    )

    message = response.choices[0].message

    # Manual tool call parsing and dispatch
    if message.tool_calls:
        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            func_args = json.loads(tool_call.function.arguments)

            # Execute tool
            result = tools_map[func_name](**func_args)

            # Manually append to conversation
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result
            })
        continue  # Loop back to model

    # Manual handoff detection (parse model output)
    if "hand off to Evidence" in message.content:
        current_agent = "Evidence"
        messages.append({"role": "assistant", "content": message.content})
        continue
    elif "hand off to Policy" in message.content:
        current_agent = "Policy"
        messages.append({"role": "assistant", "content": message.content})
        continue

    # Manual output guardrail
    if current_agent == "Policy":
        if "provisional credit" in message.content and "[chunk" not in message.content:
            # Guardrail blocked - manually route to human
            create_ticket(DISPUTE_ID, "HUMAN REVIEW NEEDED", message.content)
            break

    # Done
    break

# Manual write-back
create_ticket(DISPUTE_ID, "Agent recommendation", message.content)
```

**Lines of code:** ~150+ (and missing: streaming, session persistence, input guardrails, structured guardrail returns, proper error handling)

---

## The W15 Enterprise Stack

```
Your Agent Code (demo2_pipeline.py)
    ↓
OpenAI Agents SDK (openai-agents==0.20.0)  ← Agent, Runner, handoffs, guardrails
    ↓
LitellmModel Extension                      ← Bridge to non-OpenAI providers
    ↓
LiteLLM                                     ← API translation (OpenAI format → Bedrock)
    ↓
OpenAI SDK (openai==2.54.0)                ← Low-level HTTP client
    ↓
AWS Bedrock Converse API                    ← Models inside VPC
```

### Why This Stack?

1. **Compliance:** Bedrock = models in the bank's VPC, data never leaves compliance boundary
2. **Productivity:** Agents SDK = production primitives (Agent, handoffs, guardrails) instead of 200 lines of orchestration
3. **Portability:** LiteLLM = one-line switch between Bedrock, OpenAI direct, Vertex AI
4. **Cost:** Model routing (Haiku for high-volume, Sonnet for money decisions) baked into agent definitions

### The One-Line Portability

`.env` configuration:

```bash
# Bedrock (compliance approved - models in VPC)
MODEL_SMART=bedrock/converse/us.anthropic.claude-sonnet-4-5-20250929-v1:0
MODEL_FAST=bedrock/converse/us.anthropic.claude-haiku-4-5-20251001-v1:0

# OpenAI direct (dev/prototyping - leaves VPC)
MODEL_SMART=openai/gpt-4o
MODEL_FAST=openai/gpt-4o-mini

# Vertex AI (GCP equivalent)
MODEL_SMART=vertex_ai/claude-sonnet-4-5
MODEL_FAST=vertex_ai/claude-haiku-4-5
```

Agent code **never changes** - just the `.env` line.

---

## When to Use Which

### Use Base OpenAI SDK When:
- You need low-level control (custom streaming, unusual API patterns)
- You're building your own agent framework
- You want minimal dependencies
- You're doing simple one-shot completions

### Use OpenAI Agents SDK When:
- Building multi-agent systems with handoffs
- Need guardrails (input/output validation)
- Want session persistence
- Need production-grade orchestration
- Working with tools and agentic loops
- **Building enterprise agents (W15 use case)**

---

## Portability Lesson: Demo 3

`demo3_strands.py` shows the same triage agent in **Strands Agents** (AWS's native SDK):

```python
from strands import Agent, tool
from strands.models import BedrockModel  # Native Bedrock, no LiteLLM

@tool
def load_dispute(dispute_id: int) -> str:
    """Load dispute from Meridian."""
    return _load_dispute_impl(dispute_id)  # Same implementation

agent = Agent(
    model=BedrockModel(model_id=BEDROCK_MODEL_ID, streaming=True),
    system_prompt="You are the Triage agent. Classify Type A/B...",  # Same instructions
    tools=[load_dispute],  # Same tool
)

result = agent(f"Triage dispute {DISPUTE_ID}.")
```

**What changed:** Import paths, class names
**What didn't change:** Tool function, instructions, mental model

**The lesson:** Learn the primitives (Agent, tool, handoff), not the brand names. An FDE who understands the nouns can read any framework cold.

---

## Further Reading

- OpenAI Agents SDK docs: https://openai.github.io/openai-agents-python/
- LiteLLM docs: https://docs.litellm.ai/
- Bedrock Converse API: AWS docs
- `agent/src/meridian_agent/agents/sdk_runtime.py:21-72` - Reference wiring for W15 lab

---

## Summary

| Feature | OpenAI SDK | OpenAI Agents SDK |
|---------|-----------|-------------------|
| **Model access** | ✅ Direct API | ✅ Via Agent abstraction |
| **Tool calling** | ⚠️ Manual parsing/dispatch | ✅ Automatic with `@function_tool` |
| **Agentic loop** | ❌ You write it | ✅ Built-in via Runner |
| **Handoffs** | ❌ No primitive | ✅ `handoffs=[agent]` |
| **Guardrails** | ❌ No primitive | ✅ `input_guardrails`, `output_guardrails` |
| **Sessions** | ❌ You build it | ✅ SQLiteSession, RedisSession |
| **Streaming** | ⚠️ Raw events | ✅ Structured StreamEvent types |
| **MCP servers** | ❌ No integration | ✅ Built-in via `mcp_servers=` |
| **Lines of code** | ~150+ per agent | ~20 per agent |
| **Use case** | Simple completions | **Enterprise multi-agent systems** |

**Bottom line:** OpenAI SDK is the foundation. OpenAI Agents SDK is the enterprise-ready framework built on top. W15 uses Agents SDK because banks need Agent primitives, not API wrappers.
