# Evidence index — every component, run and captured

**Run:** 2026-07-30 05:21 UTC · **20 passed · 0 failed · 3 skipped**

Each row links to the full transcript: the exact command, the working
directory, the exit code, and the unedited output (secrets redacted).
Regenerate with the evidence runner in the build repo (not part of this handover).

| # | What is proven | Status | Proof (quoted from the real run) | Transcript |
|---|---|---|---|---|
| 01 | Local Postgres is running | ✅ PASS | `/var/run/postgresql:5432 - accepting connections` | [01-db-up.txt](01-db-up.txt) |
| 02 | Seed loaded: 100k txns, breaches, 1 poisoned chunk | ✅ PASS | `100000 \|      365 \|        1` | [02-seed-counts.txt](02-seed-counts.txt) |
| 03 | Console serves the login page (self-hosted) | ✅ PASS | `200` | [03-console-login.txt](03-console-login.txt) |
| 04 | Deep link is auth-gated (redirects, no data leak) | ✅ PASS | `307` | [04-console-authgate.txt](04-console-authgate.txt) |
| 05 | API rejects an unauthenticated call | ✅ PASS | `401` | [05-api-no-key.txt](05-api-no-key.txt) |
| 06 | API returns dispute 29 for a scoped key | ✅ PASS | `{"dispute":{"dispute_id":"29","txn_id":"908","customer_id":"1986","dispute_type":"A","reason_code":"11.2","status":"intake","opened_at":"2026-06-16T02:56:12.000` | [06-api-with-key.txt](06-api-with-key.txt) |
| 07 | RBAC: Type-A key on a Type-A dispute → 200 | ✅ PASS | `200` | [07-rbac-allow.txt](07-rbac-allow.txt) |
| 08 | RBAC: Type-B key on the same dispute → 403 | ✅ PASS | `403` | [08-rbac-deny.txt](08-rbac-deny.txt) |
| 09 | Triage pipeline works dispute 29 (mock brain, live DB) | ✅ PASS | `│ outcome: HUMAN APPROVAL (type_a_approval)   confidence: 0.90` | [09-agent-run.txt](09-agent-run.txt) |
| 10 | Agent unit suite green | ✅ PASS | `15 passed in 0.06s` | [10-agent-tests.txt](10-agent-tests.txt) |
| 11 | Golden eval gate passes (the gate CI runs on every PR) | ✅ PASS | `pass rate: 100% (3/3)  ·  GATE PASSED` | [11-eval-gate.txt](11-eval-gate.txt) |
| 12 | MCP door offline: 4 proofs (RBAC, idempotency, retry, enumeration) | ✅ PASS | `DEMO: PASS ✓ all four proofs hold — scope, idempotent replay, retry/backoff, enumeration-safe denials` | [12-mcp-offline.txt](12-mcp-offline.txt) |
| 13 | MCP door against the SELF-HOSTED portal: RBAC + real write + audit | ✅ PASS | `LIVE RESULT: PASS ✓ — same action as W15, now scoped and audited; the circle closes through the governed door` | [13-mcp-live-selfhosted.txt](13-mcp-live-selfhosted.txt) |
| 14 | Slack escalation: 7 scenarios handled offline | ✅ PASS | `SUMMARY — every failure mode handled deterministically, in the door` | [14-slack-offline.txt](14-slack-offline.txt) |
| 15 | Slack MCP server: initialize → list → call → dedupe → deny | ✅ PASS | `SELFTEST PASS (transport mode: bot)` | [15-slack-mcp-selftest.txt](15-slack-mcp-selftest.txt) |
| 16 | Slack live: a real card posts to #meridian-oncall | ✅ PASS | `result: {"delivered_via": "slack", "channel": "#disputes-oncall", "ok": true}` | [16-slack-live-post.txt](16-slack-live-post.txt) |
| 16b | Two-way Slack bot: routing + scope enforcement (Type-B→Type-A denied) | ✅ PASS | `SELFTEST PASS` | [16b-slack-twoway-bot.txt](16b-slack-twoway-bot.txt) |
| 17 | Slack token identifies the bot + workspace | ✅ PASS | `{"ok":true,"url":"https:\/\/ik-testworkspace.slack.com\/","team":"ik-test","user":"meridianescalations","team_id":"T0BLT66EPD0","user_id":"U0BLLUZENGK","bot_id"` | [17-slack-auth.txt](17-slack-auth.txt) |
| 18 | AWS identity resolves (STS) | ✅ PASS | `"Arn": "arn:aws:iam::073710022953:user/intksrtuser09"` | [18-aws-identity.txt](18-aws-identity.txt) |
| 19 | Bedrock model answers (streaming converse) | ⚪ SKIPPED | `skipped — needs the AWS Lab Control Panel to be STARTED (stopped ⇒ explicit IAM deny on bedrock:* / bedrock-agentcore:*). Proof from a started lab: archive/agen` | [19-bedrock-invoke.txt](19-bedrock-invoke.txt) |
| 20 | AgentCore control plane lists the registered runtime | ⚪ SKIPPED | `skipped — needs the AWS Lab Control Panel to be STARTED (stopped ⇒ explicit IAM deny on bedrock:* / bedrock-agentcore:*). Proof from a started lab: archive/agen` | [20-agentcore-runtimes.txt](20-agentcore-runtimes.txt) |
| 21 | AgentCore traces are queryable in the aws/spans log group | ⚪ SKIPPED | `skipped — needs the AWS Lab Control Panel to be STARTED (stopped ⇒ explicit IAM deny on bedrock:* / bedrock-agentcore:*). Proof from a started lab: archive/agen` | [21-agentcore-spans.txt](21-agentcore-spans.txt) |
| 22 | All five decks: 0 overlap/overflow problems | ✅ PASS | `OK — 0 problem(s), 61 slides` | [22-decks-validate.txt](22-decks-validate.txt) |
