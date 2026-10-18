#!/usr/bin/env python3
"""Leaderboard standings — the instructor-side tooling for the leaderboard rules (Week 15 post-class document, Part 4).

Two modes:

1. CSV mode (always works — collect results however you graded):
       python3 leaderboard_run.py --from-csv results.csv
   CSV columns: learner_id,passed,total,spent_usd,division
   (division: live | mock — mock ranks in its own $0 division)

2. Repo mode (best-effort automation): given a file of submission repos
   (one git URL or local path per line), clone/refresh each and run the
   golden-gate command inside it, capturing the pass line:
       python3 leaderboard_run.py --run repos.txt --cases 30
   Expects each submission to follow the learner-repo layout
   (agent/src importable, `--suite golden` supported). Repos that error are
   listed as UNGRADED, never silently dropped.

Ranking: pass rate desc → spend asc (the $5 budget is attested per
the leaderboard rules; spend is read from the CSV or a SPEND.txt in the repo root).
Output: a rendered table + standings.csv next to this script.
"""
from __future__ import annotations

import argparse
import csv
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PASS_RE = re.compile(r"pass rate:\s*(\d+)%\s*\((\d+)/(\d+)\)")


def load_csv(path: str) -> list[dict]:
    rows = []
    with open(path, newline="") as fh:
        for r in csv.DictReader(fh):
            rows.append({
                "learner_id": r["learner_id"].strip(),
                "passed": int(r["passed"]),
                "total": int(r["total"]),
                "spent_usd": float(r.get("spent_usd", 0) or 0),
                "division": (r.get("division") or "live").strip().lower(),
                "note": "",
            })
    return rows


def run_repo(line: str, cases: int, workdir: Path) -> dict:
    src = line.strip()
    learner = re.sub(r"\.git$", "", src.rstrip("/")).split("/")[-1]
    row = {"learner_id": learner, "passed": 0, "total": 0,
           "spent_usd": 0.0, "division": "mock", "note": ""}
    try:
        repo = Path(src)
        if not repo.exists():
            repo = workdir / learner
            if repo.exists():
                subprocess.run(["git", "-C", str(repo), "pull", "-q"],
                               check=True, timeout=120)
            else:
                subprocess.run(["git", "clone", "-q", "--depth", "1", src, str(repo)],
                               check=True, timeout=300)
        cmd = [sys.executable, "-m", "meridian_agent", "eval",
               "--suite", "golden", "--cases", str(cases), "--mock"]
        out = subprocess.run(cmd, cwd=repo, capture_output=True, text=True,
                             timeout=600,
                             env={"PYTHONPATH": str(repo / "agent" / "src"),
                                  "PATH": "/usr/bin:/bin:/usr/local/bin"})
        m = PASS_RE.search(out.stdout)
        if not m:
            row["note"] = "UNGRADED: no pass line (" + (out.stderr or out.stdout)[-80:].strip() + ")"
            return row
        row["passed"], row["total"] = int(m.group(2)), int(m.group(3))
        spend = repo / "SPEND.txt"
        if spend.exists():
            try:
                row["spent_usd"] = float(spend.read_text().strip().lstrip("$"))
                row["division"] = "live"
            except ValueError:
                row["note"] = "SPEND.txt unreadable — ranked in $0 division"
    except Exception as exc:  # noqa: BLE001 — never drop a submission silently
        row["note"] = f"UNGRADED: {str(exc)[:90]}"
    return row


def render(rows: list[dict]) -> None:
    def rate(r):
        return r["passed"] / r["total"] if r["total"] else 0.0

    out_rows = []
    for division in ("live", "mock"):
        block = sorted([r for r in rows if r["division"] == division],
                       key=lambda r: (-rate(r), r["spent_usd"], r["learner_id"]))
        if not block:
            continue
        print(f"\n=== {division.upper()} division "
              f"({'$5 budget' if division == 'live' else '$0 — mock brain'}) ===")
        print(f"{'#':>3}  {'learner':<24} {'pass':>9} {'rate':>6} {'spend':>7}  note")
        for i, r in enumerate(block, 1):
            print(f"{i:>3}  {r['learner_id']:<24} {r['passed']:>4}/{r['total']:<4} "
                  f"{rate(r):>5.0%} {r['spent_usd']:>6.2f}  {r['note']}")
            out_rows.append({"rank": i, "division": division, **{k: r[k] for k in
                             ("learner_id", "passed", "total", "spent_usd", "note")}})
    out = HERE / "standings.csv"
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out_rows[0].keys()) if out_rows else
                           ["rank", "division", "learner_id", "passed", "total",
                            "spent_usd", "note"])
        w.writeheader()
        w.writerows(out_rows)
    print(f"\nwrote {out}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--from-csv", help="results CSV (learner_id,passed,total,spent_usd,division)")
    g.add_argument("--run", help="file listing submission repos (git URL or local path per line)")
    ap.add_argument("--cases", type=int, default=30, help="repo mode: golden cases to run")
    ap.add_argument("--workdir", default=str(HERE / ".leaderboard-work"))
    args = ap.parse_args()

    if args.from_csv:
        rows = load_csv(args.from_csv)
    else:
        workdir = Path(args.workdir)
        workdir.mkdir(parents=True, exist_ok=True)
        lines = [ln for ln in Path(args.run).read_text().splitlines()
                 if ln.strip() and not ln.startswith("#")]
        rows = []
        for i, ln in enumerate(lines, 1):
            print(f"[{i}/{len(lines)}] {ln.strip()}")
            rows.append(run_repo(ln, args.cases, workdir))
    render(rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
