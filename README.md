# IK FDE — The Meridian Engagement 
`codebase/` is what you run.

![Complete tree of the repository: curriculum with one folder per week split into pre-class, live-class and post-class, and the codebase modules](codebase/docs/repo-map.svg)


## The codebase

`codebase/README.md` is the map. `make help` lists every command. `codebase/evidence/EVIDENCE_INDEX.md` lists every component with the command that proves it and a quoted line from the real output. The deep-reference notebooks are in `codebase/notebooks/`. Learners work in their own fork of this repo; the post-class documents point at it, and `AGENTS.md` is the context file their AI pair reads first.

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
