# Strands Agents — the second harness (and why it costs you nothing to learn)

**Supplementary read · Week 15 · ~15 min.** Demo 3 rebuilt our triage agent in
Strands in ~20 lines. This doc is the fuller tour: what Strands is, how its
model-driven loop differs from graph-style frameworks, its multi-agent
primitives, and how the concepts you already own map onto it. The point is not
"learn a second framework" — it's *proving to yourself that you learned
primitives, not brand names*.

> As of mid-2026. Strands moves fast (it hit 1.0 in 2025); check
> https://strandsagents.com before quoting API specifics.

## 1. What it is

**Strands Agents** is AWS's open-source agent SDK (Apache-2.0, launched May
2025). It's what several AWS teams use internally — Amazon Q Developer and AWS
Glue among them — which matters to an FDE for one reason: when your client is
an AWS shop, Strands is the harness their own vendor dogfoods.

Core design bet: **the model drives the loop.** You give an agent a model,
a system prompt, and tools. There is no graph to draw; the LLM plans, picks
tools, and decides when it's done. Strands calls this the *agentic loop* —
the framework's job is just to execute tool calls, manage context, and stream
events.

```python
from strands import Agent, tool
from strands.models import BedrockModel

@tool
def load_dispute(dispute_id: int) -> str:
    """Load a payment dispute by id from the Meridian platform."""
    ...

agent = Agent(
    model=BedrockModel(model_id="us.anthropic.claude-haiku-4-5-20251001-v1:0",
                       streaming=True),
    system_prompt="You are the Triage agent at Meridian Bank. ...",
    tools=[load_dispute],
)
agent("Triage dispute 29.")          # sync
# await agent.invoke_async(...)      # async / streaming events
```

Bedrock is the default model provider (it *natively* speaks the Converse API —
no bridge layer like our LiteLLM shim), but Strands is model-agnostic:
Anthropic direct, OpenAI, Ollama, LiteLLM providers all exist.

## 2. The translation table (three harnesses, one mental model)

| Concept (the noun) | OpenAI Agents SDK | Strands Agents | LangGraph |
|---|---|---|---|
| The worker | `Agent(instructions=…)` | `Agent(system_prompt=…)` | node |
| A capability | `@function_tool` | `@tool` | `@tool` |
| Delegation | `handoffs=[…]` | agents-as-tools / Swarm / Graph | edges |
| Validation that can trip | `@input_guardrail` / `@output_guardrail` | hooks + structured output | conditional edges |
| State across turns | `Sessions` | conversation manager + session persistence | checkpointer |
| Seeing every step | Tracing (built-in) | OTel tracing (built-in) | LangSmith |
| Who routes | the LLM, constrained by handoffs | the LLM, fully | your graph, explicitly |

Read the row, not the column. Every harness has a word for the same six nouns —
that's the week's generalization lesson in one table.

## 3. Multi-agent in Strands: pick your topology

Where the Agents SDK gives you one delegation primitive (handoffs), Strands
ships several — worth knowing because clients ask "what if one agent isn't
enough?":

- **Agents-as-tools** — wrap a specialist agent so an orchestrator calls it
  like a function. (Meridian: Policy-as-a-tool under a supervisor.)
- **Swarm** — a team with shared context and autonomous handoffs; agents
  decide among themselves who works next.
- **Graph** — deterministic, edges-you-draw orchestration when compliance
  wants the flowchart (closest to LangGraph).
- **Workflow** — sequential/parallel task pipelines with dependencies.
- **A2A** — Strands speaks the Agent2Agent protocol for cross-vendor
  agent-to-agent calls (see `agui-mcp-a2a.md`).

MCP is first-class throughout: an `MCPClient` turns any MCP server into a
toolset, which is exactly how W16's integration story generalizes beyond our
hand-rolled REST wrappers.

## 4. Production posture (why AWS pitches it for FDE-shaped work)

- **Deploys anywhere** — AgentCore Runtime (first-class target), Lambda,
  Fargate, EKS; reference deploy guides ship with the SDK.
- **Observability** — OpenTelemetry traces out of the box; pairs with
  AgentCore Observability / CloudWatch GenAI dashboards.
- **Guardrail surface** — hooks around model/tool calls, structured output
  (Pydantic), and Bedrock Guardrails integration when you want the managed
  content filter in front of a banking workflow.
- **Safety-tool pedigree** — used inside AWS products; 1.x API is stable.

## 5. How an FDE chooses (the honest answer)

- Client is **standardizing on OpenAI models/platform** → Agents SDK. Fewest
  layers where the models live.
- Client is an **AWS shop, Bedrock-first, wants their vendor's own tooling**
  → Strands. Native Converse, native AgentCore, A2A/MCP built in.
- Client demands **auditable, drawn-out control flow** (some banks do) →
  Graph-style orchestration (Strands Graph or LangGraph).
- In every case: the primitives transfer. Budget a *day*, not a sprint, for
  the switch — and say exactly that in the interview when asked "what if we
  don't use your framework?"

## 6. Sources

- Docs: https://strandsagents.com · GitHub: https://github.com/strands-agents/sdk-python
- AWS launch post: "Introducing Strands Agents" (AWS open-source blog, May 2025)
- Strands + AgentCore deploy guide: AgentCore samples repo
