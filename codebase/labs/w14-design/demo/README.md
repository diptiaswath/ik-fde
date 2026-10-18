# W14 Live Demos — Runbook

Two terminal demos, watched (not coded along). They are the terminal half of the
Week 14 demo; the estimation and pricing half runs in the browser on the hosted
calculator (https://ik-fde-calculator.vercel.app).

| # | Script | What the class sees | Time |
|---|---|---|---|
| 1 | `w14_stack_matrix.py` | weighted dimensions × scored stacks — the winner flips per client | ~3 min |
| 2 | `w14_topology.py` | scored rules pick P2P for the pilot, iPaaS for the future state | ~2 min |

**Stdlib only. No Docker, no keys, no Jupyter, no installs.** Both are extracted
verbatim from the course notebook's §4/§5 code cells
(`codebase/notebooks/W14_notebook.ipynb`), so the numbers on screen and the numbers
in the learners' companion notebook are the same numbers.

---

## 0. Pre-class checklist (T-5 min)

Run both once, off tape, and eyeball the tables:

```bash
cd "$(git rev-parse --show-toplevel)"/codebase/labs/w14-design/demo
python3 w14_stack_matrix.py
python3 w14_topology.py
```

Load the calculator in a tab and click through both steps:
https://ik-fde-calculator.vercel.app

---

## 1. Stack-choice matrix — ~3 min

Open the file for ~20 seconds first ("a page of plain Python: weights, scores,
normalize — no magic"), then run it:

```bash
cd "$(git rev-parse --show-toplevel)"/codebase/labs/w14-design/demo
python3 w14_stack_matrix.py
```

Walk the table weights → scores → **"Winner for Meridian: OpenAI Agents SDK + AWS
Bedrock, 4.70."** Then the punchline the script prints itself: same candidates,
three clients — Azure wins for the M365/Entra shop, Google for the GCP-native
cost-sensitive one.

The point: **stack follows the client.** The matrix is not there to find THE
answer; it makes the client-fit logic explicit and auditable.

## 2. Integration-topology selector — ~2 min

```bash
cd "$(git rev-parse --show-toplevel)"/codebase/labs/w14-design/demo
python3 w14_topology.py
```

For a 10-week pilot the selector picks **point-to-point — but funneled through the
one MCP server**, so there is still a single governed door (RBAC + audit) inside a
P2P topology. Then the future-state flip the script prints: at 9 systems with
real-time intake, P2P scores zero and iPaaS wins.

The point: **choose for the pilot, and name the revisit trigger.** Decisions age;
the selector tells you when this one does.

---

## If it wobbles

Nothing here touches the network or a key, so the usual failure is a wrong working
directory. The `cd` above resolves from the repo root, so it works from anywhere
inside a clone. Last resort: the same math runs as §4 and §5 of
`codebase/notebooks/W14_notebook.ipynb`.
