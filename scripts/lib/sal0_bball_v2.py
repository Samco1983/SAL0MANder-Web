#!/usr/bin/env python3
"""SAL0MANder BBall V2 pass.

V1 reads the court. V2 makes the next pass.

This module is deliberately small and deterministic: no model calls, no writes,
no GitHub mutation. It turns the current evidence packet into one bounded
technical action so agents can keep playing without Samuel translating.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
BAD_SEVERITIES = {"critical", "high"}


@dataclass(frozen=True)
class BballV2Decision:
    schemaVersion: str
    court: str
    action: str
    reason: str
    ownerNeeded: bool
    agentCanAct: bool
    timeboxMinutes: int
    stopCondition: str
    nextCommand: str
    evidence: dict


def _as_int(value, default: int = 0) -> int:
    return value if isinstance(value, int) else default


def _dirty_files(packet: dict) -> list[str]:
    files = packet.get("repo", {}).get("dirtyFiles") or []
    return files if isinstance(files, list) else []


def _findings(packet: dict) -> list[dict]:
    findings = packet.get("collisions", {}).get("findings") or []
    if not isinstance(findings, list):
        return []
    return sorted(
        (f for f in findings if isinstance(f, dict)),
        key=lambda f: SEVERITY_RANK.get(f.get("severity"), 99),
    )


def _bad_findings(packet: dict) -> list[dict]:
    return [f for f in _findings(packet) if f.get("severity") in BAD_SEVERITIES]


def _next(packet: dict) -> dict:
    nxt = packet.get("next") or {}
    return nxt if isinstance(nxt, dict) else {}


def _shot(packet: dict) -> dict:
    shot = _next(packet).get("shot") or {}
    return shot if isinstance(shot, dict) else {}


def _next_category(packet: dict) -> str:
    return str(_shot(packet).get("category") or "").upper()


def _next_title(packet: dict) -> str:
    return str(_shot(packet).get("title") or _next(packet).get("title") or "")


def _evidence(packet: dict) -> dict:
    points = packet.get("points") or {}
    collisions = packet.get("collisions") or {}
    repo = packet.get("repo") or {}
    return {
        "branch": repo.get("branch"),
        "head": repo.get("head"),
        "dirtyFiles": len(_dirty_files(packet)),
        "verifiedPoints": _as_int(points.get("verified")),
        "claimedClosed": _as_int(points.get("claimed")),
        "unverifiedClosed": _as_int(points.get("unverified")),
        "collisionFindings": len(collisions.get("findings") or []),
        "badTurnovers": len(_bad_findings(packet)),
        "nextAction": _next(packet).get("action"),
        "nextCategory": _next_category(packet),
        "nextTitle": _next_title(packet),
    }


def decide(packet: dict) -> BballV2Decision:
    """Return the next bounded pass from current evidence.

    Decision order is intentional. Court safety and false score repair happen
    before fresh scoring, because speed without a true scoreboard becomes churn.
    """
    dirty = _dirty_files(packet)
    bad = _bad_findings(packet)
    points = packet.get("points") or {}
    nxt = _next(packet)
    category = _next_category(packet)
    title = _next_title(packet).lower()
    unverified = _as_int(points.get("unverified"))
    evidence = _evidence(packet)

    if dirty:
        return BballV2Decision(
            schemaVersion="sal0-bball-v2",
            court="REBOUNDABLE_MISS" if len(bad) < 3 else "BAD_TURNOVER",
            action="CLEAR_COURT",
            reason="main court has uncommitted work; scheduled play must not start from ambiguous state",
            ownerNeeded=False,
            agentCanAct=True,
            timeboxMinutes=10,
            stopCondition="repo is clean, or dirty files are attributed and preserved in a blocker",
            nextCommand="git status --short && npm run mission:bball",
            evidence=evidence,
        )

    if unverified >= 2:
        return BballV2Decision(
            schemaVersion="sal0-bball-v2",
            court="REBOUNDABLE_MISS",
            action="VERIFY_SCOREBOARD",
            reason="two or more closed threads are not verified points; do not build on a fake score",
            ownerNeeded=False,
            agentCanAct=True,
            timeboxMinutes=15,
            stopCondition="each unverified close is reclassified as point, assist, or discussion",
            nextCommand="npm run mission:points:json --silent",
            evidence=evidence,
        )

    if nxt.get("action") == "FIX_QUEUE_ACCESS":
        return BballV2Decision(
            schemaVersion="sal0-bball-v2",
            court="BLOCKED",
            action="FIX_QUEUE_ACCESS",
            reason="shot picker cannot read the queue, so assigning work would be guesswork",
            ownerNeeded=False,
            agentCanAct=True,
            timeboxMinutes=10,
            stopCondition="mission:next:json returns readable JSON with TAKE_SHOT or CREATE_SHOT",
            nextCommand="npm run mission:next:json --silent",
            evidence=evidence,
        )

    if len(bad) >= 3:
        return BballV2Decision(
            schemaVersion="sal0-bball-v2",
            court="BAD_TURNOVER",
            action="TURNOVER_REVIEW",
            reason="three or more high/critical turnover signals are active",
            ownerNeeded=False,
            agentCanAct=True,
            timeboxMinutes=15,
            stopCondition="top turnover cause is recorded and the next shot is smaller or moved to another player",
            nextCommand="npm run mission:collision:json --silent",
            evidence=evidence,
        )

    if nxt.get("action") == "CREATE_SHOT" or not title:
        return BballV2Decision(
            schemaVersion="sal0-bball-v2",
            court="IDLE",
            action="CREATE_FRESH_PRODUCT_SHOT",
            reason="no bounded shot is ready; create one user-visible issue instead of huddling",
            ownerNeeded=False,
            agentCanAct=True,
            timeboxMinutes=10,
            stopCondition="one PRODUCT or TEST issue exists with a falsifiable success check",
            nextCommand="gh issue create --title '[PRODUCT] Next smallest user-visible web shot'",
            evidence=evidence,
        )

    if category == "DOCS" and ("overnight" in title or "playbook" in title or "audit" in title):
        return BballV2Decision(
            schemaVersion="sal0-bball-v2",
            court="REBOUNDABLE_MISS",
            action="CREATE_FRESH_PRODUCT_SHOT",
            reason="docs backlog can improve the team, but the current speed constraint needs a product/test shot",
            ownerNeeded=False,
            agentCanAct=True,
            timeboxMinutes=10,
            stopCondition="fresh shot is filed or an existing product/test issue is selected",
            nextCommand="npm run mission:shots:json --silent",
            evidence=evidence,
        )

    if category in {"PRODUCT", "TEST", "AUTOMATION", "CLEANUP", "DOCS"}:
        return BballV2Decision(
            schemaVersion="sal0-bball-v2",
            court="SCORING",
            action="TAKE_SHOT",
            reason=f"{category.lower()} shot is bounded and the court has no higher-priority evidence blocker",
            ownerNeeded=False,
            agentCanAct=True,
            timeboxMinutes=30 if category != "DOCS" else 20,
            stopCondition="verified commit lands, or miss is recorded with exact failing command and next smaller shot",
            nextCommand="npm run mission:next",
            evidence=evidence,
        )

    return BballV2Decision(
        schemaVersion="sal0-bball-v2",
        court="IDLE",
        action="CREATE_FRESH_PRODUCT_SHOT",
        reason="next shot category is unknown, so create a small explicit issue rather than improvise",
        ownerNeeded=False,
        agentCanAct=True,
        timeboxMinutes=10,
        stopCondition="next action is technically defined and testable",
        nextCommand="npm run mission:shots:json --silent",
        evidence=evidence,
    )


def _load_live_packet() -> dict:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import sal0_data_rebounder

    return sal0_data_rebounder.build_packet()


def _print_markdown(decision: BballV2Decision) -> None:
    print()
    print("  SAL0 BBALL V2 PASS")
    print("  --------------------------------------------------------------")
    print(f"    court:      {decision.court}")
    print(f"    action:     {decision.action}")
    print(f"    reason:     {decision.reason}")
    print(f"    owner:      {'YES' if decision.ownerNeeded else 'no'}")
    print(f"    agent act:  {'YES' if decision.agentCanAct else 'no'}")
    print(f"    clock:      {decision.timeboxMinutes}m")
    print(f"    stop when:  {decision.stopCondition}")
    print(f"    command:    {decision.nextCommand}")
    print()
    print("  EVIDENCE")
    for key, value in decision.evidence.items():
        print(f"    {key}: {value}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Make one bounded BBall V2 pass from evidence.")
    parser.add_argument("--json", action="store_true", help="print machine-readable decision")
    parser.add_argument("--packet", help="read an existing rebounder packet JSON file")
    args = parser.parse_args()

    if args.packet:
        with open(args.packet, errors="replace") as handle:
            packet = json.load(handle)
    else:
        packet = _load_live_packet()

    decision = decide(packet)
    if args.json:
        print(json.dumps(asdict(decision), indent=2))
    else:
        _print_markdown(decision)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
