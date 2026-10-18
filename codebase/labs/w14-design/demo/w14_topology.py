#!/usr/bin/env python3
"""W14 demo — extracted verbatim from notebook.ipynb (stdlib only). Terminal version."""

# Stdlib only.
from dataclasses import dataclass, field
from typing import Optional

def money(cents_or_dollars, is_cents=False):
    v = cents_or_dollars / 100 if is_cents else cents_or_dollars
    return f"${v:,.0f}"

def rule(title=""):
    line = "=" * 64
    print(line)
    if title:
        print(title)
        print(line)

print("Week 14 notebook ready. Stdlib only, no installs needed.")

@dataclass
class TopologyContext:
    num_systems: int
    realtime_required: bool       # event-driven / push?
    governance_required: bool     # central monitoring, many teams?
    time_to_ship_weeks: int
    expected_growth: str          # "low" | "high"

def select_topology(ctx: TopologyContext):
    scores = {"P2P (point-to-point)": 0, "iPaaS (managed hub)": 0, "Event mesh (pub/sub)": 0}
    reasons = {k: [] for k in scores}

    # Few systems + ship fast -> P2P
    if ctx.num_systems <= 4:
        scores["P2P (point-to-point)"] += 2; reasons["P2P (point-to-point)"].append("few systems (<=4)")
    else:
        scores["iPaaS (managed hub)"] += 2; reasons["iPaaS (managed hub)"].append("many systems -> N^2 wiring")
    if ctx.time_to_ship_weeks <= 12:
        scores["P2P (point-to-point)"] += 2; reasons["P2P (point-to-point)"].append("tight ship deadline")
    # Real-time -> event mesh
    if ctx.realtime_required:
        scores["Event mesh (pub/sub)"] += 3; reasons["Event mesh (pub/sub)"].append("real-time / event-driven flows")
    else:
        scores["P2P (point-to-point)"] += 1; reasons["P2P (point-to-point)"].append("synchronous request/reply")
    # Governance -> iPaaS
    if ctx.governance_required:
        scores["iPaaS (managed hub)"] += 2; reasons["iPaaS (managed hub)"].append("central governance/monitoring needed")
    # Growth -> bias to iPaaS/event mesh
    if ctx.expected_growth == "high":
        scores["iPaaS (managed hub)"] += 1; reasons["iPaaS (managed hub)"].append("high growth ahead")
        scores["Event mesh (pub/sub)"] += 1; reasons["Event mesh (pub/sub)"].append("high growth ahead")

    pick = max(scores, key=scores.get)
    return pick, scores, reasons

# The Meridian pilot.
ctx = TopologyContext(num_systems=3, realtime_required=False, governance_required=False,
                      time_to_ship_weeks=10, expected_growth="high")
pick, sc, reasons = select_topology(ctx)

rule("INTEGRATION-TOPOLOGY SELECTOR — Meridian pilot")
for k in sc:
    why = "; ".join(reasons[k]) or "—"
    print(f"  {k:24} score={sc[k]}   ({why})")
print(f"\nRecommended: {pick}")
print("  Implementation note: P2P, but funneled through the ONE MCP server — so you still get a")
print("  single governed door (RBAC + audit) even inside a point-to-point topology.")
print("  Revisit trigger: when Meridian moves to event-driven dispute intake or many more")
print("  source systems, the event mesh earns its operational complexity.")

# Show the selector flipping for a different future state (the expansion).
future = TopologyContext(num_systems=9, realtime_required=True, governance_required=True,
                         time_to_ship_weeks=26, expected_growth="high")
fpick, fsc, _ = select_topology(future)
print("Future state (9 systems, real-time intake, governance, 26wk):")
for k in fsc: print(f"  {k:24} score={fsc[k]}")
print(f"  -> {fpick}  (the pilot's P2P choice correctly does NOT survive expansion)")
