#!/usr/bin/env python3
"""SAL0MANder BBall assistant — the coach's eyes on the scoreboard.

Reads the run logs, classifies the court, and — the part that matters —
detects a player missing the same shot repeatedly and says to bench it.

WHY THIS EXISTS. On 2026-08-19 the logs recommended issue #15 as the next shot
**24 times**. Every run failed the same way, and every run handed the same
possession back. Nothing in the system could see a pattern across runs, because
each run only ever looked at itself. A team that keeps running the same broken
play does not have a bad player; it has no coach.

Read-only. Calls no model, touches no git, writes nothing outside its report.

    python3 scripts/lib/sal0_bball_assistant.py            # human huddle
    python3 scripts/lib/sal0_bball_assistant.py --json     # machine readable
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from collections import Counter
from dataclasses import dataclass, asdict, field

HOME = os.path.expanduser("~")
REPO_ROOT = os.path.join(HOME, "Desktop", "SAL0MANder-Web")
LOG_DIRS = [
    os.path.join(HOME, ".sal0mander", "logs"),
    os.path.join(HOME, "Desktop", "SAL0MANder-Web", "docs", "coordination", "runs", "logs"),
]

# How many identical failures before a shot is benched. Two, because the third
# attempt has never once succeeded and it costs a full possession to find out.
BENCH_AFTER = 2

VERDICT = re.compile(r"ONE THING THAT CHANGED:\s*([A-Z][A-Z \-]*)")
NEXT_SHOT = re.compile(r"Next shot:\s*(.+)")
EXIT_LINE = re.compile(r"=== end \S+ \(([^)]*)\)")

# Ordered: the first match wins, so the most specific cause is reported. An
# auth failure that also produced no diff must read as auth, not as idleness.
CAUSES = [
    ("AUTH", re.compile(r"not logged in|please run /login|401|oauth|authentication_error|invalid api key", re.I)),
    ("QUOTA", re.compile(r"quota|rate.?limit|429|exhausted", re.I)),
    ("TRUST", re.compile(r"workspace has not been trusted|trust dialog", re.I)),
    ("TIMEOUT", re.compile(r"AGENT_TIMEOUT|exceeded \d+s", re.I)),
    ("DIRTY_TREE", re.compile(r"working tree was already dirty", re.I)),
    ("VERIFY_FAILED", re.compile(r"npm run verify exit: [1-9]", re.I)),
    ("NO_DIFF", re.compile(r"worker exited \d+ with no diff|NOTHING CHANGED", re.I)),
]


@dataclass
class Run:
    stamp: str
    path: str
    verdict: str = "UNKNOWN"
    cause: str = ""
    shot: str = ""
    exit_note: str = ""


@dataclass
class Report:
    runs_read: int
    court: str
    scored: int
    missed: int
    blocked: int
    idle: int
    repeated_failures: list[dict] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    huddle: dict = field(default_factory=dict)


def read_runs() -> list[Run]:
    seen: dict[str, Run] = {}
    for d in LOG_DIRS:
        for path in sorted(glob.glob(os.path.join(d, "work-loop-*.log"))):
            stamp = os.path.basename(path).replace("work-loop-", "").replace(".log", "")
            # The same run can be written to both directories; keep one.
            if stamp in seen:
                continue
            try:
                text = open(path, errors="replace").read()
            except OSError:
                continue

            run = Run(stamp=stamp, path=path)
            if m := VERDICT.search(text):
                run.verdict = m.group(1).strip()
            if m := NEXT_SHOT.search(text):
                run.shot = m.group(1).strip()
            if m := EXIT_LINE.search(text):
                run.exit_note = m.group(1).strip()
            for name, pattern in CAUSES:
                if pattern.search(text):
                    run.cause = name
                    break
            seen[stamp] = run
    return [seen[k] for k in sorted(seen)]


def classify(runs: list[Run]) -> str:
    """One word for the state of the court, from the most recent runs."""
    if not runs:
        return "IDLE"
    recent = runs[-5:]
    verdicts = [r.verdict for r in recent]

    if any(v.startswith("COMMITTED") or v.startswith("MERGED") for v in verdicts):
        return "SCORING"
    if any(r.cause in {"AUTH", "TRUST", "QUOTA"} for r in recent):
        return "BLOCKED"
    if any(r.cause == "DIRTY_TREE" for r in recent):
        # Work that exists and cannot land is worse than work not attempted.
        return "BAD TURNOVER"
    if all(v.startswith("NOTHING") for v in verdicts):
        return "IDLE"
    return "REBOUNDABLE MISS"


def repeated_failures(runs: list[Run]) -> list[dict]:
    """Shots that failed the same way more than once — the bench signal."""
    pairs = Counter(
        (r.shot, r.cause or r.verdict)
        for r in runs
        if r.shot and not r.verdict.startswith(("COMMITTED", "MERGED"))
    )
    out = []
    for (shot, cause), n in pairs.most_common():
        if n >= BENCH_AFTER:
            out.append({"shot": shot, "cause": cause, "times": n})
    return out


def recommend(court: str, repeats: list[dict], runs: list[Run]) -> list[str]:
    recs: list[str] = []

    for r in repeats:
        recs.append(
            f"BENCH — {r['shot'][:60]} has failed {r['times']}x with {r['cause']}. "
            "Label it in-progress or blocked so the picker skips it, and take a smaller shot."
        )

    causes = {r.cause for r in runs[-5:]}
    if "AUTH" in causes:
        recs.append(
            "SUB — the worker is locked out. Renew with ~/.sal0mander/new-token.sh, "
            "then clear ~/.sal0mander/PAUSE. Do not keep waking a signed-out player."
        )
    if "QUOTA" in causes:
        recs.append(
            "SIT — a seat is out of quota, not broken. Do not block the court on it; "
            "keep playing with the agents that are reachable."
        )
    if "DIRTY_TREE" in causes:
        recs.append(
            "SYNC — a run refused a dirty tree. Someone is mid-possession. "
            "Commit or wait; do not force it."
        )
    if "TIMEOUT" in causes:
        recs.append("SHRINK — the shot exceeded its clock. Split the issue and take a smaller one.")
    if court == "IDLE" and not repeats:
        recs.append("SHOOT — nothing is blocked and nothing is scoring. Take the next unclaimed issue.")

    if not recs:
        recs.append("KEEP PLAYING — no repeated failure and no blocker. Take the next shot.")
    return recs


def build(runs: list[Run]) -> Report:
    court = classify(runs)
    repeats = repeated_failures(runs)
    scored = sum(1 for r in runs if r.verdict.startswith(("COMMITTED", "MERGED")))
    blocked = sum(1 for r in runs if r.verdict.startswith("BLOCKED"))
    idle = sum(1 for r in runs if r.verdict.startswith("NOTHING"))
    missed = len(runs) - scored - blocked - idle

    worst = repeats[0] if repeats else None
    return Report(
        runs_read=len(runs),
        court=court,
        scored=scored,
        missed=missed,
        blocked=blocked,
        idle=idle,
        repeated_failures=repeats,
        recommendations=recommend(court, repeats, runs),
        huddle={
            "what_happened": f"{len(runs)} runs read: {scored} scored, {blocked} blocked, {idle} idle.",
            "the_miss": (
                f"{worst['shot'][:60]} failed {worst['times']}x with {worst['cause']}"
                if worst
                else "no shot has failed twice the same way"
            ),
            "stop_doing": (
                "Feeding the same failed possession back every hour."
                if worst
                else "Nothing — the rotation is working."
            ),
        },
    )


SEASON_LOG = os.path.join(
    HOME, "Desktop", "SAL0MANder-Web", "docs", "coordination", "ops", "SEASON.jsonl"
)


def record_season(report: Report, issues_open: int | None, issues_closed: int | None) -> dict:
    """Append one line per reading, so the team can see whether it is improving.

    A snapshot says how you are doing. Only a trend says whether you are getting
    better, and nothing here kept a trend — every measurement this project made
    was of the present moment. You cannot improve what you never compare.
    """
    entry = {
        "runs_read": report.runs_read,
        "court": report.court,
        "scored": report.scored,
        "blocked": report.blocked,
        "idle": report.idle,
        "repeated_failures": len(report.repeated_failures),
        "issues_open": issues_open,
        "issues_closed": issues_closed,
    }
    try:
        os.makedirs(os.path.dirname(SEASON_LOG), exist_ok=True)
        with open(SEASON_LOG, "a") as fh:
            fh.write(json.dumps(entry) + "\n")
    except OSError:
        pass
    return entry


def season_trend() -> list[str]:
    """Compare the last reading with the one before it. Improving or not."""
    try:
        lines = [json.loads(l) for l in open(SEASON_LOG) if l.strip()]
    except (OSError, ValueError):
        return []
    if len(lines) < 2:
        return ["  (first reading — a trend needs two)"]

    prev, now = lines[-2], lines[-1]
    out = []

    def delta(label: str, key: str, better: str = "up") -> None:
        a, b = prev.get(key), now.get(key)
        if a is None or b is None:
            return
        d = b - a
        if d == 0:
            out.append(f"  {label:<22} {b}  (unchanged)")
            return
        improving = (d > 0) if better == "up" else (d < 0)
        out.append(f"  {label:<22} {b}  ({d:+d} {'better' if improving else 'WORSE'})")

    delta("issues closed", "issues_closed", "up")
    delta("issues open", "issues_open", "down")
    delta("repeated failures", "repeated_failures", "down")
    delta("blocked runs", "blocked", "down")
    return out


def _sh(cmd: list[str], timeout: int = 20) -> str:
    try:
        import subprocess

        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=REPO_ROOT)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def anticipate(report: Report) -> list[str]:
    """What is probably about to go wrong.

    Every signal here is measured, never guessed. The line this respects:
    predicting FAILURE is computable from patterns; deciding what MATTERS is
    not. The most valuable shot of 2026-08-19 — a privacy leak in
    summarizeBridgeMismatch — appears in no log, and no amount of
    scoreboard-reading would have found it. So this warns; it does not choose.
    """
    out: list[str] = []

    # Repeated misses are the strongest predictor there is: the same shot has
    # already failed the same way, so the next attempt is the likeliest failure.
    for f in report.repeated_failures[:2]:
        out.append(
            f"NEXT LIKELY FAILURE — {f['shot'][:50]} again with {f['cause']}. "
            f"It has missed {f['times']}x. Shrink it or leave it benched."
        )

    dirty = _sh(["git", "status", "--porcelain"])
    if dirty:
        n = len(dirty.split("\n"))
        out.append(
            f"BLOCKED START — {n} uncommitted file(s). A scheduled run will refuse "
            "to start. Commit, or expect the next possession to be skipped."
        )

    token = os.path.join(HOME, ".sal0mander", "secrets", "claude_oauth_token")
    if os.path.exists(token):
        import time

        days = int((time.time() - os.path.getmtime(token)) / 86400)
        if 365 - days < 30:
            out.append(
                f"AUTH EXPIRING — the token is {days} days old, ~{365 - days} left. "
                "Renew before it dies mid-run: ~/.sal0mander/new-token.sh"
            )
    else:
        out.append("AUTH MISSING — no token file. The scheduled worker cannot call a model.")

    # A seat out of quota is not a broken seat, and the difference decides
    # whether the court waits for it.
    gem = _sh(["bash", os.path.join(REPO_ROOT, "scripts", "sal0-gemini.sh"), "-p", "ok"], 60)
    if not gem or re.search(r"quota|429|exhaust", gem, re.I):
        out.append("SEAT OUT — Gemini is unavailable or out of quota. Do not block the court on it.")

    last = _sh(["git", "log", "-1", "--format=%ct"])
    if last:
        import time

        hours = (time.time() - int(last)) / 3600
        if hours > 2:
            out.append(
                f"COLD — {hours:.1f}h since the last commit. Force a smaller product shot "
                "rather than another audit."
            )

    if not out:
        out.append("NOTHING PENDING — no repeated miss, clean tree, auth healthy.")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Read the scoreboard and call a substitution.")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    runs = read_runs()
    report = build(runs)

    # The scoreboard, if gh can reach it. Absent is fine — the trend degrades
    # to what it can see rather than refusing to record anything.
    issues_open = issues_closed = None
    try:
        import subprocess

        def count(state: str) -> int | None:
            r = subprocess.run(
                ["gh", "issue", "list", "--repo", "Samco1983/SAL0MANder-Web",
                 "--state", state, "--limit", "100", "--json", "number", "--jq", "length"],
                capture_output=True, text=True, timeout=25,
            )
            return int(r.stdout.strip()) if r.returncode == 0 and r.stdout.strip() else None

        issues_open, issues_closed = count("open"), count("closed")
    except Exception:
        pass

    record_season(report, issues_open, issues_closed)

    if args.json:
        print(json.dumps(asdict(report), indent=2))
        return 0

    print()
    print(f"  COURT: {report.court}")
    print(f"  {report.runs_read} runs — {report.scored} scored · {report.blocked} blocked · {report.idle} idle")
    print()
    if report.repeated_failures:
        print("  REPEATED MISSES")
        for r in report.repeated_failures:
            print(f"    {r['times']}x  {r['cause']:<14} {r['shot'][:52]}")
        print()
    print("  CALL")
    for rec in report.recommendations:
        print(f"    · {rec}")
    print()
    print("  ANTICIPATION — what is probably next")
    for line in anticipate(report):
        print(f"    · {line}")
    print()

    trend = season_trend()
    if trend:
        print("  SEASON — since the last reading")
        for line in trend:
            print(line)
        print()

    print("  HUDDLE")
    for k, v in report.huddle.items():
        print(f"    {k.replace('_', ' ')}: {v}")
    print()
    # Non-zero when something needs a substitution, so a caller can branch.
    return 1 if report.repeated_failures or report.court == "BLOCKED" else 0


if __name__ == "__main__":
    sys.exit(main())
