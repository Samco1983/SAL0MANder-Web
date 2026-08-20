#!/usr/bin/env python3
"""SAL0 data rebounder.

This is a data agent, not a builder. It does not call models, edit product
code, touch secrets, or close issues. Its job is to feed builders a current
technical packet fast enough that they can shoot without Samuel translating.

The rebounder answers:
- What is the verified score?
- What hidden turnovers are active?
- What shot should be taken next?
- Should the lane continue, pivot, or pause for turnover review?

Exit 0 when it can produce a packet, even if the packet contains warnings.
Exit 2 only when the rebounder itself cannot run.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run(cmd: list[str], timeout: int) -> dict:
    try:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        return {
            "ok": r.returncode == 0,
            "exitCode": r.returncode,
            "stdout": r.stdout.strip(),
            "stderr": r.stderr.strip(),
            "timeoutSeconds": timeout,
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "exitCode": 124,
            "stdout": "",
            "stderr": "timeout",
            "timeoutSeconds": timeout,
        }
    except Exception as e:
        return {
            "ok": False,
            "exitCode": 2,
            "stdout": "",
            "stderr": str(e),
            "timeoutSeconds": timeout,
        }


def parse_json(result: dict) -> dict:
    try:
        return json.loads(result.get("stdout") or "{}")
    except ValueError:
        return {
            "error": "unreadable json",
            "exitCode": result.get("exitCode"),
            "stderr": result.get("stderr"),
        }


def usable_json(result: dict, parsed: dict) -> bool:
    """Exit 1 can mean "findings exist"; unreadable JSON means unusable."""
    return bool(parsed) and "error" not in parsed


def git_state() -> dict:
    status = run(["git", "status", "--short"], 5)
    branch = run(["git", "branch", "--show-current"], 5)
    head = run(["git", "rev-parse", "--short", "HEAD"], 5)
    log = run(["git", "log", "--oneline", "-5"], 5)
    dirty = [line for line in (status.get("stdout") or "").splitlines() if line.strip()]
    return {
        "branch": branch.get("stdout", ""),
        "head": head.get("stdout", ""),
        "dirty": bool(dirty),
        "dirtyFiles": dirty,
        "latestCommits": [line for line in (log.get("stdout") or "").splitlines() if line.strip()],
    }


def classify(points: dict, collisions: dict, next_shot: dict, repo: dict) -> dict:
    findings = collisions.get("findings") or []
    bad_turnovers = [
        f for f in findings
        if f.get("severity") in {"critical", "high"}
    ]
    unverified = points.get("unverified", 0) if isinstance(points.get("unverified"), int) else 0

    flags = []
    if repo.get("dirty"):
        flags.append("DIRTY_TREE")
    if unverified:
        flags.append("UNVERIFIED_CLOSE")
    if bad_turnovers:
        flags.append("BAD_TURNOVER_SIGNALS")
    if next_shot.get("action") == "FIX_QUEUE_ACCESS":
        flags.append("QUEUE_UNREADABLE")
    if next_shot.get("forced"):
        flags.append("FORCED_SHOT")

    if len(bad_turnovers) >= 3:
        call = "TURNOVER_REVIEW"
        reason = "three or more high/critical turnover signals are active"
    elif repo.get("dirty"):
        call = "COMMIT_OR_STASH_BEFORE_SCHEDULED_RUN"
        reason = "scheduled loop refuses dirty trees"
    elif next_shot.get("action") in {"TAKE_SHOT", "CREATE_SHOT"}:
        call = "KEEP_PLAYING"
        reason = "next bounded shot is available"
    else:
        call = "PIVOT"
        reason = "no clean next shot"

    return {
        "call": call,
        "reason": reason,
        "flags": flags,
        "badTurnovers": len(bad_turnovers),
        "topTurnovers": [
            {
                "detector": f.get("detector"),
                "severity": f.get("severity"),
                "what": f.get("what"),
                "do": f.get("do"),
            }
            for f in bad_turnovers[:5]
        ],
    }


def build_packet() -> dict:
    repo = git_state()
    points_raw = run(["npm", "run", "mission:points:json", "--silent"], 25)
    collisions_raw = run(["npm", "run", "mission:collision:json", "--silent"], 10)
    next_raw = run(["npm", "run", "mission:next:json", "--silent"], 45)
    shots_raw = run(["npm", "run", "mission:shots:json", "--silent"], 45)

    points = parse_json(points_raw)
    collisions = parse_json(collisions_raw)
    next_shot = parse_json(next_raw)
    shots = parse_json(shots_raw)

    return {
        "schemaVersion": "sal0-data-rebounder-v1",
        "role": "SAL0 Data Rebounder",
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "objective": "Feed clean current evidence to builders before the next shot.",
        "repo": repo,
        "points": points,
        "collisions": collisions,
        "next": next_shot,
        "shots": shots,
        "call": classify(points, collisions, next_shot, repo),
        "rawStatus": {
            "points": {
                "ok": points_raw["ok"],
                "usable": usable_json(points_raw, points),
                "exitCode": points_raw["exitCode"],
                "stderr": points_raw["stderr"][:240],
            },
            "collisions": {
                "ok": collisions_raw["ok"],
                "usable": usable_json(collisions_raw, collisions),
                "exitCode": collisions_raw["exitCode"],
                "stderr": collisions_raw["stderr"][:240],
            },
            "next": {
                "ok": next_raw["ok"],
                "usable": usable_json(next_raw, next_shot),
                "exitCode": next_raw["exitCode"],
                "stderr": next_raw["stderr"][:240],
            },
            "shots": {
                "ok": shots_raw["ok"],
                "usable": usable_json(shots_raw, shots),
                "exitCode": shots_raw["exitCode"],
                "stderr": shots_raw["stderr"][:240],
            },
        },
    }


def print_markdown(packet: dict) -> None:
    call = packet["call"]
    points = packet.get("points", {})
    collisions = packet.get("collisions", {})
    nxt = packet.get("next", {})
    shot = nxt.get("shot") or {}

    print()
    print("  SAL0 DATA REBOUNDER")
    print("  --------------------------------------------------------------")
    print(f"    call:     {call['call']}")
    print(f"    reason:   {call['reason']}")
    print(f"    flags:    {', '.join(call['flags']) or 'none'}")
    print(f"    branch:   {packet['repo'].get('branch')} @ {packet['repo'].get('head')}")
    print(f"    dirty:    {packet['repo'].get('dirty')} ({len(packet['repo'].get('dirtyFiles', []))} file(s))")
    print()
    if points.get("error"):
        print(f"    points:   unavailable — {points['error']}")
    else:
        print(
            "    points:   "
            f"{points.get('verified', 0)} verified / "
            f"{points.get('claimed', 0)} claimed / "
            f"{points.get('unverified', 0)} unverified"
        )
    print(
        "    turnover: "
        f"{len(collisions.get('findings') or [])} finding(s), "
        f"{call['badTurnovers']} bad"
    )
    for f in call["topTurnovers"][:3]:
        print(f"      - {f['severity'].upper()} {f['detector']}: {f['what']}")
    print()
    print("  NEXT PASS")
    if shot:
        number = f"#{shot.get('number')}" if shot.get("number") is not None else "NEW"
        print(f"    {number} {shot.get('title')}")
        print(f"    category: {shot.get('category')}")
        print(f"    scores when: {shot.get('success_check')}")
    else:
        print(f"    {nxt.get('reason', 'no shot available')}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Feed builders the current BBall evidence packet.")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    try:
        packet = build_packet()
    except Exception as e:
        print(f"rebounder failed: {e}")
        return 2

    if args.json:
        print(json.dumps(packet, indent=2))
    else:
        print_markdown(packet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
