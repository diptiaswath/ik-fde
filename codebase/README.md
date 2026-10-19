# The Meridian Engagement — one codebase

Everything for the five-week FDE course: the **bank's portal**, the **triage
agent**, and the **AWS deploy ladders**. Clone it, run three commands, and you have a working bank on your
laptop.

```bash
make up      # 1. Postgres in Docker + schema + 100k-row deterministic seed + API keys
make web     # 2. the Meridian Ops Console on http://localhost:3100
make agent   # 3. the triage agent works dispute 29 and writes back into the portal
```

Nothing above needs an AWS account, an API key, or the internet.

---

## Which portal am I talking to?

Every lab reads **one** environment variable, so the same code runs against the
class instance or your own box. Copy `.env.example` → `.env` and pick:

| Target | `MERIDIAN_BASE_URL` | When |
|---|---|---|
| **Hosted class instance** (already running, nothing to set up) | `https://ik-fde-casestudy-bank.vercel.app/api/v1` | following along in class |
| **Your laptop** (`make up && make web`) | `http://localhost:3100/api/v1` | offline, $0, full control |
| **Your EC2 box** (`deploy/ec2/`) | `http://<your-ec2-public-dns>:3100/api/v1` | you want a URL teammates can hit |

The console URL used in agent output follows the same pattern via
`MERIDIAN_CONSOLE_URL`. **Hosted console:**
<https://ik-fde-casestudy-bank.vercel.app> — sign in with any seeded analyst
email (e.g. `jason.soto@meridianbank.com`), no password in this training build.

---

## The tree

```
platform/
  web/        the Ops Console — Next.js app + the agent-facing REST API at /api/v1
  db/         schema.sql · api.sql · seed generator (fixed seed 4417) · docker-compose
agent/        meridian_agent — the triage pipeline, guardrails, golden eval suite
labs/
  w14-design/     the two terminal demos: scored stack matrix + integration-topology selector
  w15-build/      demos 1–3, the Lambda + AgentCore deploy ladders, eval-gate.yml
deploy/ec2/   one-shot bootstrap to host the portal on a t3.small
docs/         console walkthrough · API reference · screenshots
```

## Make targets

| Target | What it does |
|---|---|
| `make up` | starts Postgres, applies `schema.sql` + `api.sql`, loads the seed, mints two scoped API keys |
| `make web` | builds and serves the console on `:3100` |
| `make agent` | runs the triage pipeline on dispute 29 (mock brain — no AWS needed) |
| `make eval` | the golden eval gate (the same gate CI runs on every PR) |
| `make test` | the agent's pytest suite |
| `make keys` | mints a fresh pair of scoped analyst keys |
| `make down` | stops Postgres (add `make clean` to delete the volume) |

## Prerequisites

- **Docker** (Postgres) · **Node 20+** (the console) · **Python 3.11+** and
  [`uv`](https://docs.astral.sh/uv/) (the agent)
- Optional: **AWS CLI v2** for the W15 cloud ladders. It has a $0 offline path — nothing is gated on it.

## Host it yourself

Two ways to put the portal on a URL other people (and your agents, from
anywhere) can reach:

- **EC2** — `deploy/ec2/EC2_DEPLOY.md` is the complete copy-paste path: launch a
  `t3.small`, run `ec2_bootstrap.sh` (Docker + Node + seed + systemd), open port
  3100 to your IP, point `MERIDIAN_BASE_URL` at the instance. Terminate it when
  you're done — idle cloud is the W14 lesson.
- **Vercel + hosted Postgres** — `platform/web/README.md` § Deploy: point
  `MERIDIAN_DB_URL` at a hosted Postgres **pooler** connection string and deploy
  `platform/web` to Vercel. The same code serves the local Docker DB and the
  hosted DB — only the env var changes. This is exactly how the class instance
  (<https://ik-fde-casestudy-bank.vercel.app>) runs.

Either way, every knob lives in `.env` (`cp .env.example .env`); AWS keys, if you
keep them in a file rather than `~/.aws`, live in `aws.env` (`cp aws.env.example
aws.env`) — that is the file the W15 technical demo uses on camera; mint analyst
keys with `make keys` and put the base/console URLs in the two `MERIDIAN_*`
variables shown above.

## Where to go next

1. `docs/MERIDIAN_CONSOLE_WALKTHROUGH.md` — every screen of the portal, annotated,
   plus what changes once the agent is wired in.
2. `labs/w15-build/demo/deploy/agentcore/README.md` — laptop → Lambda → AgentCore.
3. `docs/agentcore-deep-dive.md` — what AgentCore manages, and when to skip it.
4. `docs/api-reference.md` — the `/api/v1` contract the agent's tools call.
