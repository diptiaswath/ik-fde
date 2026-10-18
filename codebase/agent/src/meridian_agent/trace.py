"""Tiny zero-dependency tracing + console rendering.

This is deliberately hand-rolled (no `rich`) so the demo runs on a clean
machine with only the stdlib. In the W15 real build this is replaced by
OpenTelemetry → Application Insights; the *shape* (spans with a trace id,
nested events, attributes) is intentionally the same so the swap is obvious.
"""
from __future__ import annotations

import os
import sys
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Iterator

# --- ANSI styling (auto-disabled when not a TTY or NO_COLOR is set) ----------
_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(code: str) -> str:
    return code if _USE_COLOR else ""


DIM = _c("\033[2m")
BOLD = _c("\033[1m")
RESET = _c("\033[0m")
BLUE = _c("\033[34m")
CYAN = _c("\033[36m")
GREEN = _c("\033[32m")
YELLOW = _c("\033[33m")
RED = _c("\033[31m")
MAGENTA = _c("\033[35m")
GREY = _c("\033[90m")


@dataclass
class Tracer:
    """Single-run tracer. One trace id per pipeline run; spans nest under it."""

    trace_id: str = field(default_factory=lambda: "trace_" + uuid.uuid4().hex[:16])
    _depth: int = 0
    _t0: float = field(default_factory=time.perf_counter)

    # ---- pretty banner ------------------------------------------------------
    def banner(self, title: str, subtitle: str = "") -> None:
        bar = "═" * 64
        print(f"\n{BOLD}{BLUE}╔{bar}╗{RESET}")
        print(f"{BOLD}{BLUE}║{RESET} {BOLD}{title:<62}{RESET} {BOLD}{BLUE}║{RESET}")
        if subtitle:
            print(f"{BOLD}{BLUE}║{RESET} {DIM}{subtitle:<62}{RESET} {BOLD}{BLUE}║{RESET}")
        print(f"{BOLD}{BLUE}╚{bar}╝{RESET}")
        print(f"{GREY}trace_id={self.trace_id}{RESET}")

    # ---- spans --------------------------------------------------------------
    @contextmanager
    def span(self, name: str, kind: str = "agent") -> Iterator["Tracer"]:
        span_id = "span_" + uuid.uuid4().hex[:8]
        icon = {
            "agent": f"{CYAN}◆{RESET}",
            "tool": f"{MAGENTA}⛁{RESET}",
            "guardrail": f"{YELLOW}🛡{RESET}",
            "handoff": f"{BLUE}➜{RESET}",
        }.get(kind, "•")
        indent = "  " * self._depth
        print(f"\n{indent}{icon} {BOLD}{name}{RESET} {GREY}[{kind}] {span_id}{RESET}")
        self._depth += 1
        start = time.perf_counter()
        try:
            yield self
        finally:
            self._depth -= 1
            dur = (time.perf_counter() - start) * 1000
            print(f"{indent}  {GREY}└ {dur:6.1f} ms{RESET}")

    # ---- events inside a span ----------------------------------------------
    def event(self, msg: str, *, level: str = "info") -> None:
        indent = "  " * self._depth
        tag = {
            "info": f"{GREY}·{RESET}",
            "tool": f"{MAGENTA}⛁{RESET}",
            "ok": f"{GREEN}✓{RESET}",
            "warn": f"{YELLOW}!{RESET}",
            "block": f"{RED}⛔{RESET}",
            "cite": f"{GREEN}§{RESET}",
        }.get(level, "·")
        print(f"{indent}  {tag} {msg}")

    def kv(self, key: str, value: object) -> None:
        indent = "  " * self._depth
        print(f"{indent}    {DIM}{key:<22}{RESET}{value}")

    def total_ms(self) -> float:
        return (time.perf_counter() - self._t0) * 1000
