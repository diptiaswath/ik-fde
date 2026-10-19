# IK FDE — The Meridian Engagement · instructor handover

Everything that runs lives in `codebase/`: the Meridian platform, the reference agent, the labs and the evidence captures.

## Getting started

All commands run from `codebase/`. Nothing here needs an AWS account, a paid key or the internet beyond the first install.

### 1. Install the prerequisites

| Tool | Version | Why |
|---|---|---|
| Docker | Desktop or Engine with Compose v2 | runs Postgres for `make up` |
| Node.js | 20+ | the Ops Console and `make keys` |
| Python | 3.11+ | the agent |
| [`uv`](https://docs.astral.sh/uv/) | any | runs the agent and its tests |
| AWS CLI v2 | optional | only for the cloud deploy rungs |

**Install Docker**

- **macOS:** install [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/), or `brew install --cask docker`. Then **open Docker Desktop once** and wait for the whale icon to say "running".
- **Windows:** install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) with the WSL 2 backend, and run the commands below from a WSL terminal.
- **Linux (Ubuntu/Debian):** follow [Install Docker Engine](https://docs.docker.com/engine/install/ubuntu/), then `sudo usermod -aG docker $USER` and log out and back in so you don't need `sudo`.

Check it worked:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

**Install the rest (macOS example)**

```bash
brew install node python@3.12 uv
```

On Linux or Windows, use your package manager or the official installers for Node, Python and uv.

### 2. Check your setup

```bash
cd codebase
make doctor        # prints each tool's version, or MISSING
```

### 3. Bring the bank up

```bash
make up            # Postgres in Docker + schema + deterministic seed + two scoped API keys
make web           # builds and serves the Ops Console on http://localhost:3100
```

Leave `make web` running and open a second terminal for the rest:

```bash
make agent         # triage pipeline on dispute 29 (mock brain)
make verify        # $0 smoke gate: prerequisites + smoke eval + unit tests
make golden        # full 150-case golden gate
make help          # every target
```

Sign in at <http://localhost:3100> with `jason.soto@meridianbank.com` (Type A) or `robert.joyce@meridianbank.com` (Type B). Email only, no password.

### 4. Stop it

```bash
make down          # stop Postgres, keep the data
make clean         # stop Postgres and delete the data volume
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop isn't running. Start it and retry `make up`. |
| `make up` hangs on "waiting for Postgres" | First start can take a minute. If it never finishes, run `cd codebase/platform/db && docker compose logs`. |
| Port 5432 already in use | Another Postgres is running locally. Stop it, or `make down` and retry. |
| Port 3100 already in use | `make web PORT=3101` |
| Console API routes return 500 | Node deps are half-installed: `cd codebase/platform/web && rm -rf node_modules && npm install`. |

## Directory structure

The W15 demos live in `codebase/labs/w15-build/demo/`. Run them from that directory; each takes `--mock` (no network, no keys).

```
codebase/labs/w15-build/
├── demo/
│   ├── README.md                    operator runbook: T-30 checklist, run order, fallbacks
│   ├── .env.example                 copy to .env (MERIDIAN_API_KEY, MERIDIAN_BASE_URL)
│   ├── common.py                    shared plumbing: Meridian data layer + console trace
│   ├── data/fixture.json            offline data for --mock
│   ├── demo1_primitives.py          1. agent, tool call, handoff, streaming on Bedrock
│   ├── demo2_pipeline.py            2. end-to-end pipeline + write-back (--tripwire for the guardrail rerun)
│   ├── demo3_strands.py             3. same agent on a second harness (Strands)
│   ├── deploy/                      4. the deploy ladders
│   │   ├── deploy.sh                package and create the Lambda
│   │   ├── invoke.sh                call the deployed function
│   │   ├── teardown.sh              delete it
│   │   ├── handler.py               Lambda entry point
│   │   ├── test_handler_local.py    run the handler locally, no AWS
│   │   ├── HOW_LAMBDA_DEPLOY_WORKS.md
│   │   ├── LAMBDA_LOCAL_TEST.md
│   │   └── agentcore/               Bedrock AgentCore Runtime path
│   │       ├── app.py
│   │       ├── requirements.txt
│   │       ├── .bedrock_agentcore.yaml
│   │       ├── README.md
│   │       └── AGENTCORE_LOCAL_TEST.md
│   ├── logs/                        captured output from real runs (see logs/README.txt)
│   ├── shots_build.py               regenerates the proof captures
│   ├── DEMO1_VS_DEMO2.md            teaching notes: primitives vs pipeline
│   ├── OPENAI_SDK_VS_AGENTS_SDK.md  teaching notes
│   ├── EVAL_GATE_DEMO.md            how to demo the eval gate
│   ├── TRACING_FLIGHT_RECORDER.md   reading traces
│   ├── GUARDRAIL_DESIGN_ACTIVITY.md activity sheet
│   └── MODEL_ROUTING_ACTIVITY.md    activity sheet
├── eval-gate.yml                    CI gate workflow for learner repos
├── leaderboard_run.py               scores learner repos
├── repos.txt                        repos the leaderboard scores
├── standings.csv                    leaderboard output
└── test_bedrock.py                  checks your Bedrock access
```

The platform the demos talk to is in `codebase/platform/` (Postgres + Ops Console), and the reference agent is in `codebase/agent/`.

## The codebase

`codebase/README.md` is the map. `make help` lists every command. `codebase/evidence/EVIDENCE_INDEX.md` lists every component with the command that proves it and a quoted line from the real output. The deep-reference notebooks are in `codebase/notebooks/`. Learners work in their own fork of this repo, and `AGENTS.md` is the context file their AI pair reads first.

## The portal

| Where | How | URL |
|---|---|---|
| Hosted class instance (always on) | nothing to do | <https://ik-fde-casestudy-bank.vercel.app> |
| Your laptop | `make up && make web` | `http://localhost:3100` |
| Your own EC2 box | `codebase/deploy/ec2/EC2_DEPLOY.md` | `http://<dns>:3100` |

Sign in with a seeded analyst: `jason.soto@meridianbank.com` (Type A) or `robert.joyce@meridianbank.com` (Type B). Email only; no password in this training build.

## Ground rules for delivery

- Every demo has a $0 offline path. If something dies mid-class, switch to `--mock` and say so.
- Never narrate a screenshot as if it were live. The captures are fallbacks.
- Tear down what you deploy: `./teardown.sh`, `agentcore destroy --force`, `make down`.
