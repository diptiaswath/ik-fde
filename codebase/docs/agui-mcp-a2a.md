# AG-UI, MCP, A2A — the three protocols, and which wall each one opens

**Supplementary read · Week 15 · ~12 min.** Three acronyms keep showing up in
agent architecture reviews, and they are NOT competitors — they standardize
three *different* walls of the same box. An FDE who can draw this diagram from
memory wins the whiteboard round.

```
                         ┌───────────────────────────┐
        AG-UI            │                           │        A2A
   (agent ↔ user)        │        YOUR AGENT         │  (agent ↔ agent)
  ◄══════════════════►   │   (any harness: Agents    │  ◄══════════════════►
   the frontend wall     │    SDK, Strands, ...)     │   the peer wall
                         │                           │
                         └────────────┬──────────────┘
                                      ║  MCP (agent ↔ tools/data)
                                      ▼  the backend wall
                         APIs · DBs · files · Meridian /api/v1
```

One sentence each:

- **MCP** connects your agent **downward** to tools and data.
- **A2A** connects your agent **sideways** to other agents (often other vendors').
- **AG-UI** connects your agent **upward** to the human's screen.

> As of mid-2026. All three are young, moving specs — verify at the linked
> sources before an architecture review.

## 1. MCP — Model Context Protocol (the backend wall)

*Anthropic, Nov 2024; now industry-standard with adoption across OpenAI,
Google, AWS.* An MCP **server** exposes tools/resources/prompts; any MCP
**client** (your agent, an IDE, AgentCore Gateway) can consume them without
custom glue. JSON-RPC over stdio or HTTP.

**Meridian:** W16 is MCP week — the Meridian `/api/v1` becomes an MCP server so
*any* harness (demo 1's SDK agent, demo 3's Strands agent, a student's Claude
Code) can call `load_dispute` without us writing three wrappers. One server,
N agent consumers. That's the leverage.

## 2. A2A — Agent2Agent (the peer wall)

*Google, Apr 2025; donated to the Linux Foundation, 100+ backing vendors
including AWS and Microsoft — check current status.* Agents advertise an
**Agent Card** (JSON capability manifest), then exchange **tasks** with
streaming status/artifacts. Crucially, agents stay **opaque** — they
collaborate without exposing internal state, memory, or tools to each other.

**Meridian:** the bank's *other* vendor runs a KYC agent. Your dispute agent
needs a risk opinion on a customer. You don't get their tools or their prompt —
you A2A-task their agent and receive an artifact. Cross-vendor, cross-cloud,
no shared secrets. (Strands ships A2A support today; see demo 3's doc.)

**MCP vs A2A in one line:** MCP calls a *function you trust*; A2A negotiates
with a *peer you don't fully see inside*. Tools are deterministic; peer agents
are not — that's why they're different protocols and not one.

## 3. AG-UI — Agent-User Interaction protocol (the frontend wall)

*CopilotKit community, mid-2025; adopters include LangGraph, CrewAI, and
Mastra integrations — check current list.* Standardizes the **event stream
between an agent backend and the user's frontend**: a small vocabulary
(~16 event types) covering lifecycle (`RUN_STARTED`/`RUN_FINISHED`), streamed
text deltas, **tool-call progress**, **shared state sync** (diff-based), and
generative-UI hooks. Transport-agnostic (SSE, WebSocket, webhooks).

Why it exists: every team that ships an agent into a real product rebuilds the
same things — token streaming, "the agent is calling a tool…" progress,
human-in-the-loop approve/reject, live state panels. AG-UI is that contract,
written once, so the frontend doesn't care which harness runs behind it.

**Meridian:** W17's handover includes an analyst-facing panel in the Ops
Console. With AG-UI, the panel subscribes to one event stream and gets:
streaming rationale as the Policy agent writes it, a visible
`search_policies` tool call with its chunk ids (the audit trail, live), and an
approve/reject affordance on the provisional-credit recommendation — the
human-handoff moment rendered as UI instead of a ticket. Swap the harness
later (Agents SDK → Strands); the panel doesn't change. That is the same
decoupling MCP gave the backend, applied to the front.

## 4. The FDE's cheat table

| | MCP | A2A | AG-UI |
|---|---|---|---|
| Standardizes | agent → tools/data | agent ↔ agent | agent ↔ user/UI |
| Party on the other side | your systems | someone else's agent | your product's frontend |
| Unit of exchange | tool call / resource | task + artifacts | event stream |
| Trust model | you own both ends | opaque peers, negotiated | you own both ends |
| Meridian moment | W16 (`/api/v1` → MCP) | future: peer-vendor KYC agent | W17 analyst panel |
| Steward | Anthropic → industry | Google → Linux Foundation | CopilotKit community |

Interview line worth memorizing: *"MCP gives my agent hands, A2A gives it
colleagues, AG-UI gives it a face. They compose — one agent can speak all
three at once."*

## 5. Sources

- MCP: https://modelcontextprotocol.io
- A2A: https://a2a-protocol.org · Google announcement (Apr 2025)
- AG-UI: https://ag-ui.com · https://github.com/ag-ui-protocol/ag-ui
