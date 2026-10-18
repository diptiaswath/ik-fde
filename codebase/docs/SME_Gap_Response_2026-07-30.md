# FDE SME gap list — coverage map & strengthening plan

**Date:** 2026-07-30 · **Source:** FDE SME comment relayed by PM · **Scope:** W13–W19 + W22–23
(the Meridian Engagement arc) · **Format per gap:** where it's already covered → where it's
thin → the concrete strengthening insertion (sized, placed, owner-ready).

The one-line summary for the PM: **three of the six gaps are substantially covered but
under-labeled (2, 3, 4), two are covered in one dimension and genuinely thin in another
(1, 5), and one is taught implicitly and deserves explicit treatment (6).** Every
strengthening item below fits inside existing session shapes (a slide block, an activity,
or a milestone artifact) — no new weeks required.

---

## 1 · Data / Data Integration (messy data, disparate systems, legacy, ETL)

**Already covered.** The Meridian premise IS disparate systems — "facts scattered across
five systems, an hour of copy-paste per dispute" (W13 problem statement; W16 backend wall:
core banking, ticketing, SharePoint). W16 teaches the four integration patterns
(ask-now / they-call-you / nightly-bulk / continuous) and typed tools over three backends.
W19 (Agentic Text-to-SQL) is a full week of reasoning over real data.

**Thin.** The data is *seeded and clean* (fixed seed 4417, deterministic). Learners never
touch a messy CSV, a legacy fixed-width export, an inconsistent enum, or a dedup problem —
the classic FDE "week 1 at the client" experience. ETL as a discipline (extract → conform →
load, idempotent backfills) is named but never exercised.

**Strengthen (concrete).**
- **W16 lab insertion — "the legacy feed" (~30 min + take-home):** add one deliberately
  messy source to the lab: a fixed-width `CORE_EXPORT.TXT` with mixed date formats, dupes,
  and a currency column in cents-as-string. The MCP door gains a `load_legacy_batch` tool
  whose first version fails on real rows; learners write the conform step. This is one new
  fixture file + one lab section in `codebase/labs/w16-integrate/` — the door architecture doesn't change.
- **W19 opener:** start the text-to-SQL week by *profiling* the data (row counts, null
  rates, orphaned keys) before querying it — "never query a table you haven't profiled."
- **Capstone M3 checklist line:** "names the messiest source and shows the conform step."

## 2 · Cloud Systems / Deployments (networking, deployments, segregation of services)

**Already covered — more than the label suggests.** W15 is a full deployment week: the
Lambda ladder (IAM role, function, URL, SCP fallback), AgentCore Runtime (microVM
session isolation — segregation taught as a first-class concept), the deploy issues table
(IAM propagation, SCPs, throttling), and the release pipeline. W16 adds IAM/identity,
scoped keys, and the governed door. Bedrock-in-the-client's-VPC framing is the W15 "why
Bedrock" slide.

**Thin.** *Networking specifically* — VPCs, private subnets, security groups, egress
control, PrivateLink-style private endpoints — is mentioned (VPC gets a parenthetical) but
never drawn. Service segregation beyond microVMs (why the agent, the API, and the DB live
in different trust zones) has no diagram.

**Strengthen (concrete).**
- **W16 slide pair — "the network the CISO sees" (~8 min):** one diagram slide: client VPC,
  private subnet for the runtime, the API behind a gateway, the DB unreachable from the
  agent except through the door; one decision slide: "the agent needs to reach the model —
  public endpoint, NAT, or private endpoint?" with the enterprise answer (private
  endpoint; egress-deny by default). Slots naturally next to the trust-boundaries
  interview corner.
- **W17 handover runbook line:** the network diagram becomes a required M4 artifact —
  auditors ask for it (ties to gap 3).

## 3 · Enterprise reviews (architecture, security, threat modeling, IR, PR/comms)

**Already covered.** This is the course's strongest suit, just not under the SME's labels:
architecture review = W14 (solution architecture + procurement questions); security review
= W16 (CISO conditions, break-the-door with six attacks — that IS threat modeling by
another name, plus the poisoned-KB incident); incident response = W17's live incident
drill + 3 a.m. page RCA activity + W15 rollback call.

**Thin.** The *formal review rituals* aren't named as rituals — learners run threat
modeling without hearing "STRIDE-style walkthrough," and there is no **PR/comms
readiness** beat at all (what do we tell the client's customers/regulator/press when the
agent misfires?).

**Strengthen (concrete).**
- **W16 relabel (~2 min, zero new content):** one line on the break-the-door debrief slide:
  "what you just did has a name in enterprise reviews — a threat-modeling session; the
  attack list is the threat model."
- **W17 activity extension — the comms line (~10 min):** the 3 a.m. page RCA gains a fifth
  blank: "CUSTOMER LINE: one sentence for the client's support team / regulator if asked."
  Model answer distinguishes fact ("recommendations were routed to human review; no money
  moved") from speculation. This is one edit to the "3 a.m. page" activity in `curriculum/W17_Evals_Observability_Handover/live-class/W17_Instructor_Guide.md` + one slide row.
- **Capstone M4:** the RCA template gains the same comms field.

## 4 · Documentation / Handoffs / Runbooks

**Already covered — this is W17's spine.** Handover is a named phase (Scope→Sell→Build→
Integrate→Prove *→ hand over*); W17 ships the runbook artifact (SLO, rollback, RCA,
auditor command card `agentcore_observability.md`); DECISIONS.md is graded in the
capstone; DEPLOY_IT_YOURSELF.md is itself a model runbook, now with the 3-step portal
walkthrough (2026-07-30).

**Thin.** Learners *consume* great runbooks more than they *author* them; the only graded
authored doc is DECISIONS.md + milestone READMEs.

**Strengthen (concrete).**
- **M4 deliverable sharpened:** "write the runbook a stranger operates from" — the M4
  checklist already implies it; make it explicit with a 6-heading template (service map,
  SLO, dashboards/queries, top-3 failure modes with first commands, rollback, contacts).
  Grade it by the auditor test: could the W17 auditor run it cold?
- **W23 mock-interview tie-in:** one interview station uses *their own runbook* as the
  artifact under discussion — documentation quality becomes interview material.

## 5 · Cost modeling — cost containment strategies

**Already covered.** W14 prices the pilot (consolidated cost table, per-case budget
sentence "a CFO can sign"); W15 has a cost-engineering block (routing, caching, batch,
idle-burn hazards) + the $5-budget leaderboard, which *is* cost containment under
pressure; teardown-after-every-session is drilled to muscle memory.

**Thin.** Containment at *production* scale — budgets/alerts as infrastructure (billing
alarms, per-tenant cost attribution, kill switches on runaway spend), cost *forecasting*
(pilot → 10× volume), and the renewal conversation ("the pilot cost $X; year one will
cost $Y because…").

**Strengthen (concrete).**
- **W17 slide — "the cost SLO" (~5 min):** treat spend like reliability: a per-case cost
  SLO, a CloudWatch billing alarm as the tripwire, and the runaway-loop kill switch (cap
  turns — already taught in W15 — now wired to an alert). One slide + one runbook line.
- **W19 retro beat:** the engagement retro computes the real pilot cost from traces
  (usage totals already taught in notebook §4) and forecasts 10× volume with the routing
  mix as the lever — the CFO renewal sentence, produced from evidence.
- **Capstone M4:** cost-per-resolution reported from actual trace data, not estimated.

## 6 · Co-engineering strategies (customer eng teams, identifying catchers, upskilling)

**Already covered — implicitly.** The persona cast exists (CIO sponsor, CISO, pilot user,
on-call engineer); W16's war story is a data-access negotiation; W17 hands over *to* the
client's team (the 3 a.m. activity puts the learner in the client engineer's chair);
"bring customer engineers up to par" is the whole premise of the handover runbook.

**Thin.** The *strategy* is never named: what a "catcher" is (the client engineer who
owns the system after you leave), how to identify one in week 1, how to pair with them
deliberately (they drive, you navigate — by design), and what "up to par" means as an
exit criterion.

**Strengthen (concrete).**
- **W13 insertion (~5 min):** one slide in the stakeholder-mapping block: "find your
  catcher" — the discovery interviews already identify roles; add 'who will own this
  after we leave?' to the question bank and mark that person on the stakeholder map.
- **W17 handover slide (~5 min):** the handover checklist gains "catcher sign-off": the
  named client engineer ran the runbook cold (deployed, invoked, found the ticket in the
  portal, queried the traces) with the FDE watching, not typing. That is the measurable
  form of "up to par."
- **W22 case-round scoring:** the rubric already penalizes "we not I"; add its mirror —
  credit answers that name the client-side owner and the upskilling plan.

---

## Sequencing recommendation

| Priority | Item | Size | Where |
|---|---|---|---|
| 1 | W16 legacy-feed lab section (gap 1) | fixture + lab §, ~half day to build | `codebase/labs/w16-integrate/` |
| 2 | W17 comms-line RCA field (gap 3) + cost SLO slide (gap 5) | 1 activity edit + 1 slide | `curriculum/W17_Evals_Observability_Handover/` |
| 3 | W16 network diagram pair (gap 2) | 2 slides | `curriculum/W16_Integration_MCP_RBAC/` |
| 4 | Catcher thread: W13 slide + W17 sign-off + M4 checklist (gap 6) | 2 slides + 2 checklist lines | cross-week |
| 5 | M4 runbook template + cost-from-traces (gaps 4, 5) | template + checklist | `capstone-template/M4-prove/` |
| 6 | W19 profiling opener + retro cost forecast (gaps 1, 5) | 2 beats | `week-19` planning |

Items 1–3 land inside already-built weeks and should ride the next deck/lab rebuild;
items 4–6 ride the W18–19/capstone build that is on the critical path anyway. Nothing
here changes the stack, the narrative, or any milestone's shape.
