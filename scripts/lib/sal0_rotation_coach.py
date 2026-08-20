#!/usr/bin/env python3
"""SAL0MANder rotation coach.

Turns the court packet into exactly one technical call. This is the AI-world
coach: no pep talk, no private chat, no self-report. It reads evidence and
returns the next action the system should take.

Read-only. It does not label, commit, close issues, or call models. When this
earns trust, acting scripts can consume its JSON.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass

import sal0_court_packet as court_packet


@dataclass
class CoachCall:
    action: str
    actor: str
    clockMinutes: int
    reason: str
    command: str
    successCheck: str
    risk: str
    ownerNeeded: bool = False


def _first_repeated_failure(packet: dict) -> dict | None:
    failures = packet.get("court", {}).get("repeated_failures") or []
    return failures[0] if failures else None


def _next_shot(packet: dict) -> dict:
    return packet.get("next", {}) or {}


def _shot_number(shot: dict | None) -> str:
    if not shot:
        return ""
    number = shot.get("number")
    return f"#{number}" if number is not None else "NEW"


def decide(packet: dict) -> CoachCall:
    repo = packet.get("repo", {}) or {}
    risk_flags = set(packet.get("riskFlags", []) or [])
    nxt = _next_shot(packet)
    shot = nxt.get("shot")
    repeated = _first_repeated_failure(packet)

    if repo.get("dirty"):
        dirty = repo.get("dirtyFiles") or []
        return CoachCall(
            action="WAIT_CLEAN_TREE",
            actor="SAL0-01",
            clockMinutes=5,
            reason="Desktop court is dirty; starting work would risk swallowing another player's diff.",
            command="git status --short",
            successCheck=f"dirty file count becomes 0; currently {len(dirty)}",
            risk="BAD_TURNOVER",
        )

    if "QUEUE_UNREADABLE" in risk_flags or nxt.get("action") == "FIX_QUEUE_ACCESS":
        return CoachCall(
            action="FIX_QUEUE_ACCESS",
            actor="SAL0-01",
            clockMinutes=10,
            reason=str(nxt.get("reason") or "GitHub queue could not be read."),
            command="npm run mission:shots:json",
            successCheck="command exits 0 and returns queue_error as an empty string",
            risk="BLOCKED",
        )

    if repeated:
        issue = _shot_number({"number": _extract_issue(repeated.get("shot", ""))})
        return CoachCall(
            action="BENCH_APPLY",
            actor="Python",
            clockMinutes=5,
            reason=(
                f"{repeated.get('shot', '')[:80]} failed {repeated.get('times')}x "
                f"with {repeated.get('cause')}; repeating it is slower than rotating."
            ),
            command="npm run mission:bench:apply",
            successCheck=f"{issue or 'the repeated issue'} has the blocked label or was already benched",
            risk="REPEATED_FAILURE",
        )

    if not shot:
        return CoachCall(
            action="CREATE_SHOT",
            actor="SAL0-01",
            clockMinutes=10,
            reason=str(nxt.get("reason") or "No playable shot is available."),
            command="npm run mission:next",
            successCheck="a new bounded PRODUCT issue exists or queue access failure is explicit",
            risk="IDLE",
        )

    category = str(shot.get("category") or "")
    actor = "SAL0-04" if category == "PRODUCT" else "SAL0-01"
    if category == "TEST":
        actor = "SAL0-07"
    clock = 30
    if "BIG" in str(shot.get("size") or ""):
        clock = 10
        return CoachCall(
            action="SPLIT_SHOT",
            actor="SAL0-01",
            clockMinutes=clock,
            reason=f"{_shot_number(shot)} is too large for the shot clock.",
            command="gh issue comment <issue> --body '<smaller split proposal>'",
            successCheck="one smaller issue/task exists with one lane, one clock, and one verifier",
            risk="SLOWDOWN",
        )

    return CoachCall(
        action="TAKE_SHOT",
        actor=actor,
        clockMinutes=clock,
        reason=str(nxt.get("reason") or "Best available shot by current policy."),
        command=f"bash scripts/sal0-work-loop.sh docs/coordination/ops/CURRENT-TASK.md  # {_shot_number(shot)}",
        successCheck=str(shot.get("success_check") or "verifier exits 0 and durable artifact exists"),
        risk="NORMAL",
    )


def _extract_issue(text: str) -> int | None:
    import re

    m = re.search(r"#(\d+)", text or "")
    return int(m.group(1)) if m else None


def print_markdown(call: CoachCall, packet: dict) -> None:
    repo = packet.get("repo", {}) or {}
    print("# SAL0MANder Rotation Call")
    print()
    print(f"- Head: `{repo.get('head')}`")
    print(f"- Action: `{call.action}`")
    print(f"- Actor: `{call.actor}`")
    print(f"- Clock: `{call.clockMinutes} min`")
    print(f"- Risk: `{call.risk}`")
    print(f"- Owner needed: `{call.ownerNeeded}`")
    print()
    print(f"Reason: {call.reason}")
    print()
    print("```bash")
    print(call.command)
    print("```")
    print()
    print(f"Success check: {call.successCheck}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Return one evidence-based rotation call.")
    parser.add_argument("--json", action="store_true", help="print machine-readable call")
    args = parser.parse_args()

    packet = court_packet.build_packet()
    call = decide(packet)
    if args.json:
        print(json.dumps({"schemaVersion": "sal0-rotation-call-v1", **asdict(call)}, indent=2))
    else:
        print_markdown(call, packet)

    return 1 if call.ownerNeeded else 0


if __name__ == "__main__":
    sys.exit(main())
