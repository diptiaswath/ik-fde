# AGENTS.md — agent context for the IK FDE repo

Canonical context for AI coding assistants (Claude Code, Codex, Copilot,
Cursor) working in this repo — and the fastest map for humans. If an
instruction here conflicts with something an assistant infers, this file wins.

## What this repo is

One repo, two halves. `curriculum/` is the taught material: one folder per week
(W13–W17, W22–W23), each split into `pre-class/`, `live-class/` and
`post-class/`. `codebase/` is everything that runs: the Meridian platform, the
reference agent, the labs the demos are built from, and the evidence captures.

The story: **Forgepoint AI** (you) deployed into **Meridian Bank** to fix a
payment-dispute backlog breaching the Regulation E clock. Class demos live here
runnable. A learner's own deliverable (M0–M4) is graded in their separate
capstone repo — it does not live here.

## Hard invariants — never break these

1. **The mock floor is sacred.** Every demo, lab, and eval keeps a `--mock`
   path: zero network, zero keys, $0. `make verify` must stay green after any
   change. A milestone can never require a paid key to pass.
2. **Never commit a credential.** `.env` and `aws.env` are gitignored; only the
   `.env.example` / `aws.env.example` placeholders ship. Meridian keys look like
   `mrdn_…`; anything out of an AWS credentials CSV (access-key id, secret) is
   radioactive — if one appears in a diff, stop and strip it.
3. **Judgment artifacts are human-authored.** `DECISIONS.md`, the M0 charter,
   the SoW, RCAs, and runbook decisions must be written by the learner.
   Assistants scaffold code and explain; they do not author judgment.
4. **Never copy `codebase/agent/` into a capstone build.** It is the reference
   implementation the learner's build is measured against; graders diff for
   copy-paste.
5. **Paths in shipped docs must resolve in this repo.** There is no second
   repo. If a doc names a file, `ls` it before you believe it.

## Repo map

| Path | What it is |
|---|---|
| `curriculum/W##_*/` | Per week: `pre-class/`, `live-class/` (deck + Instructor Guide + videos), `post-class/` |
| `codebase/agent/` | Reference pipeline (`meridian_agent`) + 150-case golden suite + tests |
| `codebase/platform/` | The Meridian Ops Console (Next.js) + Postgres schema, seed and API |
| `codebase/labs/w14-design/` | W14 terminal demos: scored stack matrix, topology selector |
| `codebase/labs/w15-build/` | W15 demos 1–3, the Lambda + AgentCore deploy ladders |
| `codebase/labs/w16-integrate/` | The governed MCP door, the Slack MCP server, AgentCore Gateway |
| `codebase/labs/w17-prove/` | Eval suites, the incident drill, the observability card |
| `codebase/labs/w22-pairing/` | The pair-programming exercise (`flag_reg_e.py`) |
| `codebase/notebooks/` | The per-week companion notebooks (W13–W17) |
| `codebase/docs/` | Walkthroughs, API reference, supplementary reads |
| `codebase/evidence/` | Dated captures proving each component actually ran |
| `.github/workflows/eval-gate.yml` | CI gate: smoke eval + tests + golden gate on every PR |

## Locked stack (do not substitute)

OpenAI **Agents SDK** for orchestration; models on **AWS Bedrock**
(Claude Haiku 4.5 fast / Sonnet 4.5 smart) through the **LiteLLM** bridge
(`bedrock/converse/…` ids, streaming on). Deploy paths: **AWS Lambda**
(`codebase/labs/w15-build/demo/deploy/`) and **Amazon Bedrock AgentCore
Runtime** (`codebase/labs/w15-build/demo/deploy/agentcore/`). Platform API:
`MERIDIAN_BASE_URL` (`/api/v1`, Bearer `mrdn_…` key, Idempotency-Key on writes).

## Command reference

All `make` targets run from `codebase/`.

```bash
make verify                # $0 smoke gate: prerequisites + smoke eval + unit tests
make golden                # the full 150-case golden gate (incl. adversarial), mock
make test                  # agent unit tests
make up && make web        # Postgres + the Ops Console on :3100
make agent                 # the triage pipeline on dispute 29 (mock brain)
make mcp                   # W16 governed door: two-analyst RBAC, idempotency, audit
make help                  # every target
```

Direct invocations, from `codebase/agent/`:

```bash
PYTHONPATH=src python3 -m meridian_agent run --dispute 29 --mock
PYTHONPATH=src python3 -m meridian_agent eval --suite smoke --disputes 1-20 --min-pass 0.9 --mock
```

## Milestones → graded checklist → gate

| Milestone | Week | Graded checklist | Gate |
|---|---|---|---|
| M0 charter | 13 | `curriculum/W13_Customer_Discovery_Scoping/post-class/` | human review |
| M1 SoW + architecture | 14 | `curriculum/W14_SoW_Pricing_Architecture/post-class/` (+ the two .docx templates) | human review |
| M2 agent in CI | 15 | `curriculum/W15_Building_Production_Agents/post-class/` | smoke eval ≥0.9, PR gate green |
| M3 integrated + RBAC | 16 | `curriculum/W16_Integration_MCP_RBAC/post-class/` | two-analyst test PASS |
| M4 prove + handover | 17 | `curriculum/W17_Evals_Observability_Handover/post-class/` | golden ≥0.95, zero ADV-* fails |

## How work lands — one PR per milestone

Milestone work happens in the learner's own capstone repo, not here. This repo
is the reference they build against and the gate they must keep green:

```bash
cd codebase && make verify          # green BEFORE pushing, always
make golden                         # the release exam, before M4
```

## Working with an AI pair — the contract

- Assistants may scaffold, refactor, debug, and explain anything in the code
  and lab extensions. They must respect the invariants above.
- The learner reviews **every** diff; make the assistant cite the file it
  changed. Un-reviewed AI code that breaks the gate is the learner's failure.
- The CI eval gate is the arbiter: no green gate, no merge, no milestone.
- When an assistant is unsure whether something is judgment or plumbing:
  if it ends up in `DECISIONS.md`, a charter, an RCA, or a runbook, it is
  judgment — draft questions for the human, not text for the file.

## Before claiming any task done

Run `make verify` from `codebase/` (and `make golden` if the agent or the eval
suite changed). For milestone work, run that milestone's gate from the table
above. Green output is the claim; paste it.
