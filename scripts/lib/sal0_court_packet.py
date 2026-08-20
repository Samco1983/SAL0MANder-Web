#!/usr/bin/env python3
"""Build one clean BBall court packet for agents.

Purpose: feed agents clean, current, technical evidence fast enough that they
can take the right shot without Samuel translating the game.

Read-only. No model calls. No secrets. No writes. If a data source is
unavailable, the packet says so instead of pretending the board is empty.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

sys.path.insert(0, str(HERE))

import sal0_bball_assistant as bball  # noqa: E402
import sal0_force_shot as force_shot  # noqa: E402
import sal0_shot_queue as shot_queue  # noqa: E402


def run(cmd: list[str], timeout: int = 15) -> dict[str, object]:
    try:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        return {
            "ok": r.returncode == 0,
            "exitCode": r.returncode,
            "stdout": r.stdout.strip(),
            "stderr": r.stderr.strip(),
        }
    except FileNotFoundError:
        return {"ok": False, "exitCode": 127, "stdout": "", "stderr": "not found"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "exitCode": 124, "stdout": "", "stderr": "timeout"}


def lines(text: object, limit: int = 10) -> list[str]:
    return [line for line in str(text or "").splitlines() if line.strip()][:limit]


def git_state() -> dict[str, object]:
    status = run(["git", "status", "--short"])
    branch = run(["git", "branch", "--show-current"])
    head = run(["git", "rev-parse", "--short", "HEAD"])
    upstream = run(["git", "rev-list", "--left-right", "--count", "HEAD...@{u}"])
    commits = run(["git", "log", "--oneline", "-5"])

    ahead = behind = None
    if upstream["ok"] and upstream["stdout"]:
        parts = str(upstream["stdout"]).split()
        if len(parts) == 2:
            ahead, behind = int(parts[0]), int(parts[1])

    dirty = lines(status["stdout"], 50)
    return {
        "branch": branch["stdout"] if branch["ok"] else "",
        "head": head["stdout"] if head["ok"] else "",
        "dirty": bool(dirty),
        "dirtyFiles": dirty,
        "ahead": ahead,
        "behind": behind,
        "latestCommits": lines(commits["stdout"], 5),
    }


def tool_paths() -> dict[str, dict[str, object]]:
    out = {}
    for name in ("git", "gh", "node", "npm", "python3", "claude", "codex", "gemini"):
        path = shutil.which(name)
        out[name] = {"available": bool(path), "path": path or ""}
    return out


def build_packet() -> dict[str, object]:
    runs = bball.read_runs()
    report = bball.build(runs)
    board = shot_queue.build_board()
    next_shot = force_shot.choose()
    repo = git_state()

    risk_flags: list[str] = []
    if repo["dirty"]:
        risk_flags.append("DIRTY_TREE")
    if board.get("queue_error"):
        risk_flags.append("QUEUE_UNREADABLE")
    if report.repeated_failures:
        risk_flags.append("REPEATED_FAILURE")
    if next_shot.get("action") == "FIX_QUEUE_ACCESS":
        risk_flags.append("FIX_QUEUE_ACCESS")
    if next_shot.get("forced"):
        risk_flags.append("FORCED_NEXT_ACTION")

    return {
        "schemaVersion": "sal0-court-packet-v1",
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "objective": (
            "Feed agents clean, current, technical evidence fast enough that "
            "they can keep taking the right shot without Samuel translating the game."
        ),
        "repo": repo,
        "tools": tool_paths(),
        "court": asdict(report),
        "queue": board,
        "next": next_shot,
        "riskFlags": risk_flags,
        "decisionPriority": [
            "safety",
            "owner hard stops",
            "technical definitions",
            "evidence",
            "speed",
            "metaphor",
        ],
    }


def print_markdown(packet: dict[str, object]) -> None:
    repo = packet["repo"]
    court = packet["court"]
    nxt = packet["next"]
    shot = nxt.get("shot") or {}

    print("# SAL0MANder Court Packet")
    print()
    print(f"- Created: `{packet['createdAt']}`")
    print(f"- Branch: `{repo.get('branch')}` at `{repo.get('head')}`")
    print(f"- Dirty tree: `{repo.get('dirty')}`")
    if repo.get("dirtyFiles"):
        print(f"- Dirty files: `{len(repo['dirtyFiles'])}`")
    print(f"- Court: `{court.get('court')}`")
    print(
        f"- Runs: `{court.get('runs_read')}` read, `{court.get('scored')}` scored, "
        f"`{court.get('blocked')}` blocked, `{court.get('idle')}` idle"
    )
    print(f"- Risk flags: `{', '.join(packet['riskFlags']) or 'none'}`")
    print()
    print("## Next Technical Action")
    print()
    print(f"- Action: `{nxt.get('action')}`")
    print(f"- Forced: `{nxt.get('forced')}`")
    if shot:
        number = f"#{shot.get('number')}" if shot.get("number") is not None else "NEW"
        print(f"- Shot: `{number}` {shot.get('title')}")
        print(f"- Category: `{shot.get('category')}`")
        print(f"- Success check: {shot.get('success_check')}")
    print(f"- Why: {nxt.get('reason')}")
    print()
    print("## Latest Commits")
    print()
    for commit in repo.get("latestCommits", []):
        print(f"- `{commit}`")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the current BBall court packet.")
    parser.add_argument("--json", action="store_true", help="print machine-readable packet")
    args = parser.parse_args()

    packet = build_packet()
    if args.json:
        print(json.dumps(packet, indent=2))
    else:
        print_markdown(packet)

    return 1 if "QUEUE_UNREADABLE" in packet["riskFlags"] else 0


if __name__ == "__main__":
    sys.exit(main())
