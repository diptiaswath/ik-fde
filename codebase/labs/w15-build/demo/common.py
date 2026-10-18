"""Shared plumbing for the Week 15 demos — Meridian data layer + console trace.

Two backends behind one interface (the same seam the platform agent uses):
  * live  — the deployed Meridian REST API (scoped key, audit-logged, idempotent writes)
  * mock  — the bundled fixture.json; zero network, zero AWS, zero keys

Every demo runs with --mock so the class never blocks on wifi or quotas.
"""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
from pathlib import Path

HERE = Path(__file__).parent

# ---- .env loading (stdlib only — no python-dotenv dependency) ----
def load_env() -> None:
    env_path = HERE / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


load_env()

BASE_URL = os.environ.get(
    "MERIDIAN_BASE_URL", "https://ik-fde-casestudy-bank.vercel.app/api/v1"
)
API_KEY = os.environ.get("MERIDIAN_API_KEY", "")
MODEL_FAST = os.environ.get(
    "MODEL_FAST", "bedrock/converse/us.anthropic.claude-haiku-4-5-20251001-v1:0"
)
MODEL_SMART = os.environ.get(
    "MODEL_SMART", "bedrock/converse/us.anthropic.claude-sonnet-4-5-20250929-v1:0"
)
os.environ.setdefault("AWS_DEFAULT_REGION", os.environ.get("BEDROCK_REGION", "us-east-1"))


# ---- console trace (what AgentCore Observability gives you for free, by hand) ----
class C:
    BLUE = "\033[94m"; GREEN = "\033[92m"; RED = "\033[91m"; YELLOW = "\033[93m"
    CYAN = "\033[96m"; DIM = "\033[2m"; BOLD = "\033[1m"; END = "\033[0m"


def banner(title: str, sub: str = "") -> None:
    width = 66
    print(f"{C.BOLD}{C.BLUE}╔{'═'*width}╗{C.END}")
    print(f"{C.BOLD}{C.BLUE}║ {title:<{width-1}}║{C.END}")
    if sub:
        print(f"{C.BLUE}║ {C.END}{C.DIM}{sub:<{width-1}}{C.END}{C.BLUE}║{C.END}")
    print(f"{C.BOLD}{C.BLUE}╚{'═'*width}╝{C.END}")


def span(kind: str, name: str, detail: str = "") -> None:
    icon = {"tool": "⛁", "agent": "◆", "handoff": "➜", "guardrail": "🛡", "write": "✍"}.get(kind, "·")
    color = {"tool": C.CYAN, "agent": C.BLUE, "handoff": C.YELLOW,
             "guardrail": C.GREEN, "write": C.GREEN}.get(kind, "")
    sid = uuid.uuid4().hex[:8]
    print(f"{color}{icon} {name}{C.END} {C.DIM}[{kind}] span_{sid}{C.END}")
    if detail:
        for ln in detail.splitlines():
            print(f"    {ln}")


def blocked(msg: str) -> None:
    print(f"{C.RED}{C.BOLD}    ⛔ {msg}{C.END}")


def okline(msg: str) -> None:
    print(f"{C.GREEN}    ✓ {msg}{C.END}")


# ---- the Meridian data layer (live API or bundled fixture) ----
class MeridianData:
    """One seam, two backends. The tools the agents call go through this."""

    def __init__(self, mock: bool):
        self.mock = mock
        self._fixture = None
        if mock:
            self._fixture = json.loads((HERE / "data" / "fixture.json").read_text())

    # -- reads --
    def get_dispute(self, dispute_id: int) -> dict:
        if self.mock:
            bundle = self._fixture["disputes"].get(str(dispute_id))
            if not bundle:
                raise KeyError(f"dispute {dispute_id} not in fixture (have: "
                               f"{list(self._fixture['disputes'])})")
            d = dict(bundle["dispute"])
            d.update({
                "amount_cents": bundle["transaction"]["amount_cents"],
                "channel": bundle["transaction"]["channel"],
                "customer_name": bundle["customer"]["full_name"],
                "customer_segment": bundle["customer"]["segment"],
                "merchant_name": bundle["merchant"]["name"],
                "merchant_risk": bundle["merchant"]["risk_status"],
            })
            return d
        return self._get(f"/disputes/{dispute_id}")["dispute"]

    def get_evidence(self, dispute_id: int) -> list[dict]:
        if self.mock:
            bundle = self._fixture["disputes"].get(str(dispute_id), {})
            return bundle.get("evidence", [])
        return self._get(f"/disputes/{dispute_id}/evidence")["evidence"]

    def search_policies(self, query: str) -> list[dict]:
        if self.mock:
            q = query.lower()
            hits = [c for c in self._fixture.get("policy_chunks", [])
                    if any(w in (c.get("content", "") + c.get("section", "")).lower()
                           for w in q.split())]
            # the planted poisoned chunk rides along in mock, like a real
            # compromised KB would — the input guardrail must catch it
            poisoned = [c for c in self._fixture.get("policy_chunks", [])
                        if c.get("is_poisoned")]
            for p in poisoned:
                if p not in hits:
                    hits.append(p)
            return hits[:10]
        return self._get(f"/policies?q={query.replace(' ', '+')}")["chunks"]

    # -- the write (the complete circle) --
    def create_ticket(self, dispute_id: int, channel: str, subject: str,
                      body: str, idem_key: str) -> dict:
        if self.mock:
            return {"ticket_id": f"MOCK-{uuid.uuid4().hex[:6]}", "dispute_id": str(dispute_id),
                    "subject": subject, "status": "open", "mock": True}
        import requests
        r = requests.post(
            f"{BASE_URL}/disputes/{dispute_id}/tickets",
            headers={"Authorization": f"Bearer {API_KEY}",
                     "Content-Type": "application/json",
                     "Idempotency-Key": idem_key},
            json={"channel": channel, "subject": subject, "body": body},
            timeout=30,
        )
        r.raise_for_status()
        out = r.json()
        return out.get("ticket", out)

    def _get(self, path: str) -> dict:
        import requests
        r = requests.get(f"{BASE_URL}{path}",
                         headers={"Authorization": f"Bearer {API_KEY}"}, timeout=30)
        r.raise_for_status()
        return r.json()


def parse_args(argv: list[str]) -> dict:
    args = {"mock": "--mock" in argv, "dispute": 29}
    if "--dispute" in argv:
        args["dispute"] = int(argv[argv.index("--dispute") + 1])
    return args


def require_aws_or_exit(mock: bool) -> None:
    if mock:
        return
    import boto3
    try:
        boto3.client("sts").get_caller_identity()
    except Exception:
        print(f"{C.RED}No AWS credentials found. Export AWS_ACCESS_KEY_ID / "
              f"AWS_SECRET_ACCESS_KEY (or use --mock).{C.END}")
        sys.exit(1)
