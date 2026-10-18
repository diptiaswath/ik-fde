# Meridian Dispute Agent — the "whole-game" demo

The finished agent system the instructor runs **end-to-end in Week 13, hour 1**
of the IK FDE course: *"in 5 weeks, you build this."* It triages a payment
dispute, gathers evidence from multiple source systems, applies Reg E policy
under two guardrails, routes to a human when needed, and prints an eval
scorecard — all on screen, with tracing, in about 50 ms.

It is built to **always run**: no API key and no database are required. The
default brain is a deterministic, rule-based stand-in for the LLM, and the data
layer falls back to a bundled JSON fixture if the Meridian Postgres isn't
reachable. That is what makes it safe for a live demo and for CI.

```
triage → handoff → evidence → policy(+guardrails) → human-handoff → eval scorecard
```

## Quick start (zero setup, zero key)

Using [`uv`](https://docs.astral.sh/uv/):

```bash
cd platform/agent
uv run python -m meridian_agent run --dispute 29 --mock
```

Or with plain Python (stdlib only — no install needed):

```bash
cd platform/agent
PYTHONPATH=src python3 -m meridian_agent run --dispute 29 --mock
```

The three bundled disputes, each chosen to show a different path:

| `--dispute` | Type | Story it tells on stage |
|---|---|---|
| **29** | A — fraud | **SLA-breached**, Reg E clock red → grounded provisional-credit citation, then **human handoff**. The headline demo. |
| **1** | B — merchant | Clean low-amount dispute, in-window → auto-resolved, no human needed. |
| **7** | B — merchant | Provisional credit already issued **with a `provisional_credit_error` flag** + watch-listed merchant → human handoff. |

List what's available in the active backend:

```bash
uv run python -m meridian_agent disputes
```

## The two guardrails (the part the demo is really about)

1. **Poisoned-chunk quarantine (input guardrail).** The policy KB contains one
   prompt-injection chunk (`policy_chunks.chunk_id = 121`, `is_poisoned = true`)
   that tries to exfiltrate account `999999` to an external address. The agent
   **never ingests it** — it is dropped before reaching model context, and the
   quarantine is logged, not silent.

2. **Reg E provisional-credit citation tripwire (output guardrail).** ANY
   statement involving provisional credit MUST cite a policy chunk id. An
   uncited claim **trips the wire and the output is BLOCKED** — never returned
   to a human or written to the system of record.

See the guardrail fire live:

```bash
uv run python -m meridian_agent run --dispute 29 --mock --demo-tripwire
```

This forces an uncited provisional-credit claim; the output guardrail blocks it
and the scorecard shows `guardrail enforced … BLOCKED uncited claim`.

## Where the real agents go (W15)

The pipeline is structured so the W15 lab swaps in the **OpenAI Agents SDK +
Responses API** at the same call sites, reusing `db.py`, `guardrail.py`,
`trace.py`, and the scorecard unchanged. The reference wiring (Agents, Handoffs,
`@input_guardrail` / `@output_guardrail`, `SQLiteSession`) is in
`agents/sdk_runtime.py`:

```bash
uv run python -m meridian_agent run --dispute 29 --show-sdk
```

The brain is selected automatically:

* `--mock` (or no key) → deterministic stand-ins (the demo/CI path).
* `OPENAI_API_KEY` → OpenAI Responses API.
* `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` → Microsoft Foundry / Azure.

The live LLM runtime is intentionally a documented shim that raises
`NotImplementedError` — it is the **student deliverable**, so the demo's mock
path stays the source of truth.

## Live Postgres (optional)

By default the agent tries the Meridian Postgres at
`MERIDIAN_DB_URL` (default `postgresql://meridian:meridian@localhost:5432/meridian`)
and falls back to the fixture on any failure. To use the live DB:

```bash
uv pip install -e '.[db]'          # installs psycopg
# bring up the bank (from platform/db): docker compose up -d && ./load.sh
uv run python -m meridian_agent run --dispute 29 --mock   # now reads Postgres
```

Force the offline fixture even when a DB is up:

```bash
uv run python -m meridian_agent run --dispute 29 --mock --fixture
```

## Tests (the W15 lab checkpoints)

```bash
uv run --extra dev pytest -q
# or, no install:
PYTHONPATH=src python3 -m pytest -q
```

The suite verifies end-to-end completion, the poisoned-chunk quarantine, the
provisional-credit tripwire (both blocking an uncited claim and passing a
grounded one), and the breached-clock human handoff.

## File tree

```
codebase/agent/
├── pyproject.toml
├── README.md
├── tests/
│   └── test_pipeline.py
└── src/meridian_agent/
    ├── __init__.py
    ├── __main__.py            # python -m meridian_agent
    ├── cli.py                 # run / disputes commands
    ├── pipeline.py            # orchestration + on-screen tracing + scorecard
    ├── brain.py              # mock-vs-LLM selection seam
    ├── db.py                  # Postgres (psycopg) with JSON-fixture fallback
    ├── guardrail.py           # quarantine + Reg E citation tripwire
    ├── trace.py               # zero-dep span/console rendering (→ OTel in W15)
    ├── data/fixture.json      # 3 real disputes + policy chunks (incl. poisoned)
    └── agents/
        ├── triage.py          # 1. classify Type A/B + Reg E urgency
        ├── evidence.py        # 2. gather from >=3 source systems
        ├── policy.py          # 3. retrieve Reg E + apply rule + guardrails
        ├── handoff.py         # 4. route to human-approval queue
        └── sdk_runtime.py     # 5. real Agents SDK seam (W15 deliverable)
```

## Cost

**$0.** The whole-game demo runs on the mock brain with no cloud resources —
exactly the W13 cost line in the lesson plan.
