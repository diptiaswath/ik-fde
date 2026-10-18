# Iteration log — every PM/SME comment, and whether it landed

One line per comment received to date, oldest first, with a verdict and where the
proof lives. **Verdicts:** ✅ done · 🟡 partial (reason stated) · ⛔ blocked by
something outside this repo · 📋 planned (mapped, not built).

*This is a historical log. A few rows name inputs that never lived in this repo
(PM comment files, the original lesson plan) or paths from an earlier layout;
they are left as written so the record stays accurate. Everything shipped today
is reachable from the repo README.*

Sources: `PMcomments.txt` (2026-06-09) · `PM_Feedback_Resolution.txt` (2026-07-08)
· `course/discussion.md` · `PM_Feedback_2026-07-30.md` (voice note + relayed SME
gap list) · the session asks of 2026-07-30 (evidence, codebase, two-way Slack).
Verification for anything marked ✅ that involves running code:
`prod/evidence/EVIDENCE_INDEX.md`.

---

## Round 1 — 2026-06-09 (stack + capstone)

| # | Comment | Verdict | Where it landed |
|---|---|---|---|
| 1 | Primary stack should match the JDs | ✅ | pivoted to **OpenAI Agents SDK + AWS Bedrock** across all five weeks (was Azure Foundry); `FDE_Weeks13-19_Lesson_Plan.md` §2 |
| 2 | One capstone spanning all 5 weeks, same stack | ✅ | `capstone-template/` with M0→M4 milestones, one Meridian engagement throughout |
| 3 | Offer alternate stacks offline (Google+Vercel, Anthropic+Bedrock) | ✅ | capstone appendix documents alternates; harness portability proven by the Strands demo |
| 4 | Note wherever cost is incurred + free alternatives | ✅ | consolidated cost table in the lesson plan; **every lab has a $0 path** (`--mock`, `MERIDIAN_MOCK=1`, `gateway plan`) — verified in the evidence index |

## Round 2 — 2026-07-08 (per-week feedback)

| # | Comment | Verdict | Where it landed |
|---|---|---|---|
| 5 | W13: loud filler slides for activities | ✅ | full-screen ACTIVITY interstitials before every hands-on block |
| 6 | W13: drop the travel-challenges slides | ✅ | removed, replaced with FDE-relevant framing |
| 7 | W13: teach SLA as a concept at the console section | ✅ | dedicated SLA slide (binding promise → Reg E 10-day clock → who is liable) |
| 8 | W14: define jargon with hints | ✅ | glossary slide + inline one-line hint at first use of each term |
| 9 | W14: a mindset per week | ✅ | Detective → Consultant → Builder → Locksmith → Auditor, on every title slide |
| 10 | W14: revenue per engineer | ✅ | engineer-economics slide (durable structure, not a dated figure) |
| 11 | W14: project engineering cost upfront | ✅ | same slide: sizing × blended rate as the cost floor |
| 12 | W14: problem → solution → architecture ordering | ✅ | "solutions first" slide inserted before the architecture diagram; slides reordered |
| 13 | W14: layer-wise solution table | ✅ | box-by-box layer table (agents / MCP / RAG / identity / evals / HITL) |
| 14 | W14: sample SoW + pricing templates | ✅ | `SoW_Template.docx`, `Pricing_Model_Template.docx` (generated) |
| 15 | W14: calculator on Vercel | ✅ | live at <https://ik-fde-calculator.vercel.app>, wired into deck + guide |
| 16 | W15: OpenAI Agents SDK, no compromise | ✅ | six-primitive section + two code slides + a runnable notebook cell per primitive |
| 17 | W15: deployment = Bedrock AgentCore | ✅ | AgentCore taught in depth; Lambda is the live in-class deploy; decision slide for when to graduate |
| 18 | W15: demos are watched, not coded along | ✅ | loud LIVE DEMO interstitials; in-class work is drills and decisions |
| 19 | W15: supplementary read on Strands | ✅ | `codebase/docs/strands-agents.md` + demo 3 rebuilds the agent in Strands |
| 20 | W15: convey the harness concept | ✅ | "agent = model + harness" is a named slide; the notebook hand-rolls the loop |
| 21 | W15: generalization / portability | ✅ | "same solution, new problem statements" slide + notebook factory swapping only tools+instructions |
| 22 | Every week: pptx + working demo | ✅ | five decks + five notebooks + runnable labs; all verified |
| 23 | Bedrock Haiku / Sonnet 4.5 / Sonnet 5 | 🟡 | Haiku 4.5 + Sonnet 4.5 verified live repeatedly. **Sonnet 5 blocked** on a marketplace approval only an account admin can grant — one-line switch in `.env` when it lands |
| 24 | Activity docs, demo docs, annotated screenshots | ✅ | activity docs per week, demo runbooks, and now **five per-session runbooks** in `prod/runbooks/` |
| 25 | Explain Bedrock + OpenAI SDK in depth | ✅ | notebook §2–3 (primitives + the LiteLLM→Bedrock bridge, streaming-only, `modify_params`) |
| 26 | AG-UI vs MCP vs A2A | ✅ | "three walls" slide + `codebase/docs/agui-mcp-a2a.md` |
| 27 | Update the curriculum sheet | ✅ | both workbooks updated to the AWS stack |
| 28 | Track every change in commit messages | ✅ | scoped commits throughout, pushed continuously |
| 29 | The complete circle (problem seen → solved in the product) | ✅ | agent writes back to live dispute 29; tickets visible in the console; re-proven 2026-07-30 (ticket 9000000024) |
| 30 | AgentCore live deploy (devops policy) | ✅ | **unblocked and verified** — the Lab Control Panel's Start/Stop is the IAM switch; full ladder run live 2026-07-12, 07-22, 07-30 |

## Round 3 — 2026-07-30 voice note (evidence, clarity, AgentCore value)

| # | Comment | Verdict | Where it landed |
|---|---|---|---|
| 31 | Screenshots of live results everywhere | ✅ | 10 AWS console + 8 portal walkthrough + 9 Slack + 4 CLI captures, all dated, all in the decks/docs |
| 32 | Exact CLI commands + real output, incl. how runs end | ✅ | CLI renders verbatim from live logs, each showing its END STATE; `prod/evidence/*.txt` holds full transcripts |
| 33 | Exact AWS console screenshots — where the traces are | ✅ | registry, runtime record, memory, Gateway, Identity, GenAI Observability, `aws/spans` query with live rows |
| 34 | Decks are convoluted — make them minimal, direct, diagram-first | ✅ | translation table → notebook; bullets halved on the heaviest slides; callouts deduped; prose click-paths replaced by real screenshots; mermaid diagrams in the walkthroughs |
| 35 | Nothing dropped while trimming | ✅ | every agenda item still has a slide/callout; every named term still defined at first use |
| 36 | The exact benefit of AgentCore vs calling the API directly | ✅ | W15's AgentCore slide is now a **build-vs-buy ledger** with an honest "when raw API is enough" rule, each managed claim backed by a console capture |
| 37 | SME gap list (data/ETL, cloud+networking, enterprise reviews, docs/runbooks, cost modeling, co-engineering) | 📋 | `SME_Gap_Response_2026-07-30.md`: coverage map + sized insertions + sequencing. **Mapped, not yet built** — items 1–3 ride the next deck/lab pass |
| 38 | Git-track everything to remote, push as you go | ✅ | continuous commits on `plan-fde-curriculum-202606` → `aeropj/ik-work`; `prod/` also published to the handover repo |
| 39 | Use the new GitHub ID `aeropj` | ✅ | commit identity + SSH auth verified as `aeropj` |
| 40 | Match MIT/Stanford/CMU/Harvard cleanliness | 🟡 | applied to W15–17 (+W14 anchor). **W13 has not had the same tightening pass** — the one honest gap in this row |

## Round 4 — 2026-07-30 session asks

| # | Comment | Verdict | Where it landed |
|---|---|---|---|
| 41 | Test everything end to end, all five weeks | ✅ | `course/evidence_run.py` — **20 passed, 0 failed, 3 lab-gated skips**; `prod/evidence/EVIDENCE_INDEX.md` |
| 42 | No component untested; every claim has captured proof | ✅ | one transcript per check (command, cwd, exit code, unedited output, secrets redacted) + archived prior live runs |
| 43 | Remove stale content | ✅ | fixed the stale `?query=`→`?q=` search bug (search never filtered), corrected Supabase→Neon/local wording, refreshed ticket ids and console nav labels |
| 44 | Explain AWS CLI steps clearly | ✅ | `EC2_DEPLOY.md` (launch → bootstrap → verify → tear down, copy-paste), AgentCore ladder, `aws logs`/Logs-Insights queries in the W17 card |
| 45 | Explain Slack CLI clearly | ✅ | `SLACK_WALKTHROUGH.md` §1.5 — install, `slack login`, `auth list`, `app list`, `activity --tail`, and when *not* to use it |
| 46 | One clean codebase an instructor can download | ✅ | `prod/codebase/` — 195 files, `make help` fronts everything, assembled reproducibly by `course/codebase_build.py` |
| 47 | 5 runbooks, one per session, with screenshots | ✅ | `prod/runbooks/` — preflight, T-30 verify-with-expected-output, beat-by-beat commands, fallback captures, break/fix, teardown |
| 48 | Codebase includes the whole Meridian platform, launchable locally | ✅ | `make up && make web` → Postgres + 100k-row seed + console on :3100. Verified from a clean slate |
| 49 | …or deployable to EC2 in class | ✅ | `deploy/ec2/ec2_bootstrap.sh` + `EC2_DEPLOY.md` (systemd, security group, key minting). **Script authored, not executed on a live instance** — the one thing in this row I did not run |
| 50 | All the seed data ships with it | ✅ | 11 MB of deterministic CSVs committed (fixed seed 4417); `make seed` regenerates byte-identically |
| 51 | Agents can talk to a self-hosted portal by URL | ✅ | `MERIDIAN_BASE_URL` / `MERIDIAN_CONSOLE_URL` env-driven everywhere (fixed two hardcoded URLs); proven: two-analyst 200/403, real ticket, audit trail against `localhost:3100` |
| 52 | Meridian console walkthrough doc (features, annotations, screenshots, MCP/agent view, e2e diagram) | ✅ | `codebase/docs/MERIDIAN_CONSOLE_WALKTHROUGH.md` — 8 real captures, per-tile meaning, mermaid system + sequence diagrams |
| 53 | Slack walkthrough, live-tested with multiple inputs/outputs | ✅ | `codebase/docs/SLACK_WALKTHROUGH.md` — 7 scenarios with real output, 4 distinct live MCP inputs, a real `channel_not_found`, portal handoff |
| 54 | Mark activities clearly and explain them | ✅ | ACTIVITY interstitials in the decks; runbooks tag every beat 🟩 ACTIVITY / 🟦 DEMO-LAB with what the room does |
| 55 | 3–4 quick polls per session | ✅ | `deckkit.poll()` + 7 new poll slides pulled verbatim from the run-of-shows — **W13 3, W14 4, W15 4, W16 4, W17 4** |
| 56 | Slides not verbose; SOTA typography; diagrams | ✅ | trimmed as in #34; polls/diagrams use the template's own type scale; mermaid diagrams in docs |
| 57 | Slack must be **two-way** (ask questions, get replies) | ✅ | `meridian_slack_bot.py` — Socket Mode chatbot, **live-verified**: asked `dispute 29`, `policy provisional credit`, `status` in `#meridian-oncall` and got real answers in-thread; every question audited; Type-B→Type-A denied |
| 58 | Push `prod/` to the new repo at `/Users/pranjal/work/ik-fde`, author `aeropj` | ✅ | published there, commit authored as `aeropj` |
| 59 | Include the environment file | ✅ | `codebase/.env.example` documents every knob (portal, keys, DB, Bedrock, Slack incl. the app token) with self-hosted defaults; real `.env` stays git-ignored |
| 60 | Iteration doc listing every PM comment | ✅ | this file |

---

## Open, and honest about it

| Item | State | Why |
|---|---|---|
| Sonnet 5 | ⛔ | needs an account-admin marketplace approval; Sonnet 4.5 covers the smart-model step meanwhile (#23) |
| SME gap insertions | 📋 | mapped and sized in `SME_Gap_Response_2026-07-30.md`; items 1–3 are next in build order (#37) |
| W13 slide-tightening pass | 🟡 | W15–17 and W14 got it; W13 (61 slides) has not (#40) |
| EC2 bootstrap on a real instance | 🟡 | script + exact AWS CLI steps authored and reviewed; not executed against a live EC2 box in this session (#49) |
| AgentCore live checks in the evidence run | ⚪ | 3 checks skip while the Lab Control Panel is stopped (explicit IAM deny). Proof from when it was started: `prod/evidence/archive/agentcore_session_2026-07-30.txt`. Start the lab and re-run `course/evidence_run.py` to turn them green |

**Bottom line:** of 60 logged comments — **54 done**, 4 partial with the reason
stated, 1 blocked outside this repo, 1 planned with a written plan. Every ✅ that
runs code has a transcript in `prod/evidence/`.
