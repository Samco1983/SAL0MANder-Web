#!/usr/bin/env python3
"""Detect agents working over the top of each other.

Two agents on one repository fail in ways neither can see alone. Each has a
consistent view of its own work and no view of the other's, so a collision
looks like success from both sides — right up until the scoreboard is wrong.

This is a scan, not a lock. It answers one question before a possession starts:
*is someone else already on this?* Each detector is separate and named, because
a single "conflict" verdict tells an agent nothing about what to do differently.

    python3 scripts/lib/sal0_collision.py            # scan
    python3 scripts/lib/sal0_collision.py --json
    python3 scripts/lib/sal0_collision.py --window 90

Exit 0 clean, 1 collisions found, 2 the scan itself could not run.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Whose commits are 'mine'. Set from --mine or SAL0_AGENT. Empty means every
# agent is a stranger, which is the safe default for a report and the wrong
# one for a gate — so the gate always passes it.
MINE = ""

# A burst this long by one signature, while others are active, is a sweep.
BURST_RUN = 5
# Files this many agents touch inside the window are a duplicated shot.
DUPLICATE_AT = 2
# Re-editing your own file this fast, this often, is a shot that is not landing.
REWORK_SECONDS = 2 * 3600
REWORK_AT = 3
# Commits that touch only doctrine. Measured conversion of docs: 1.0%.
DOCTRINE_AT = 3
DOCTRINE = re.compile(r'^docs/', re.I)
# Local commits nobody else can see. The precondition for every sweep.
UNPUSHED_AT = 3
# Words that assert a verified result. Free to write, expensive to trust.
CLAIM = re.compile(r'verif(y|ied)|tests? pass|green|all pass|confirmed|proven|clean run', re.I)
# What makes a claim checkable: a command, an exit code, a hash, a count.
EVIDENCE = re.compile(r'exit[ =:]|npm run|\\b[0-9a-f]{7,40}\\b|\\b\\d+ (tests?|files?|commits?)\\b', re.I)


def sh(cmd: list[str], timeout: int = 40) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=REPO)
        return r.returncode, r.stdout.rstrip("\n")
    except Exception as e:
        return 1, str(e)


def recent(window_min: int) -> list[dict]:
    """Commits inside the window, with signature, body, and touched files.

    Parsing note, learned the expensive way: %b is MULTI-LINE. A first
    version split the block's first line into fields, which meant the body
    terminator was never reached and 59 of 62 commits ended up with prose in
    their file lists — every file-based detector silently reading sentences as
    filenames while still reporting findings.

    So: \x03 terminates the header, and the split happens on THAT, never on a
    newline. Field order after \x02: sha, timestamp, subject, signature, body.
    """
    code, out = sh([
        "git", "log", f"--since={window_min} minutes ago",
        "--format=%x01%h%x02%at%x02%s%x02%(trailers:key=Sal0-From,valueonly)%x02%b%x03",
        "--name-only",
    ])
    if code != 0:
        return []

    commits = []
    for block in out.split("\x01"):
        if not block.strip():
            continue
        header, _, filetext = block.partition("\x03")
        parts = header.split("\x02")
        if len(parts) < 4:
            continue
        sha, ts, subject, sign = parts[0], parts[1], parts[2], parts[3].strip()
        body = parts[4] if len(parts) > 4 else ""
        files = [f for f in filetext.split("\n") if f.strip()]
        commits.append({
            "sha": sha, "ts": int(ts or 0), "subject": subject,
            "agent": sign or "UNSIGNED", "files": files, "body": body,
        })
    return commits


# --- detectors ------------------------------------------------------------
# Each returns a list of findings. Each finding names what to DO, because a
# warning without an action gets read once and then filtered out.

def d_unsigned(commits, _dirty, _w):
    """Unattributable work. Every other detector depends on the signature."""
    bad = [c for c in commits if c["agent"] == "UNSIGNED"]
    if not bad:
        return []
    return [{
        "detector": "UNSIGNED",
        "severity": "high",
        "what": f"{len(bad)} commit(s) carry no Sal0-From trailer",
        "detail": [f"{c['sha']} {c['subject'][:56]}" for c in bad[:6]],
        "do": "the commit-msg hook should have refused these — check core.hooksPath",
    }]


def d_duplicate_file(commits, _dirty, w):
    """The same file committed by two agents: two possessions, one shot."""
    by_file = collections.defaultdict(set)
    for c in commits:
        for f in c["files"]:
            by_file[f].add(c["agent"])

    hits = {f: a for f, a in by_file.items() if len(a) >= DUPLICATE_AT}
    if not hits:
        return []
    return [{
        "detector": "DUPLICATE_SHOT",
        "severity": "high",
        "what": f"{len(hits)} file(s) touched by more than one agent in {w}m",
        "detail": [f"{f} — {', '.join(sorted(a))}" for f, a in list(hits.items())[:6]],
        "do": "claim the issue before starting, or take the shot in a worktree",
    }]


def d_dirty_overlap(commits, dirty, w):
    """You are editing a file that was just committed.

    This is the one that fires BEFORE the damage. Either another agent already
    did your shot, or you are revisiting recently-landed code and should know
    that before committing.
    """
    if not dirty:
        return []
    # Newest commit per file, split by who made it. Both halves are needed:
    # a collision is only live while THEIR commit is newer than MY last word on
    # the file.
    theirs, mine_ts = {}, {}
    for c in commits:  # newest first
        for f in c["files"]:
            if MINE and c["agent"] == MINE:
                # Your own recent commit is iteration, not collision. Without
                # this the gate blocks every second commit an agent makes.
                mine_ts.setdefault(f, c["ts"])
            else:
                theirs.setdefault(f, c)

    committed = {}
    for f, c in theirs.items():
        # Already resolved. If I committed this file AFTER they did, I have
        # demonstrably seen their work — the merge is behind me. Continuing to
        # warn for the rest of the window is how a guard becomes noise, and a
        # noisy guard gets bypassed on the commit that actually mattered.
        if f in mine_ts and mine_ts[f] >= c["ts"]:
            continue
        committed[f] = c

    hits = [(f, committed[f]) for f in dirty if f in committed]
    if not hits:
        return []
    return [{
        "detector": "DIRTY_OVERLAP",
        "severity": "critical",
        "what": f"{len(hits)} uncommitted file(s) were also committed in the last {w}m",
        "detail": [f"{f} — already in {c['sha']} by {c['agent']}" for f, c in hits[:6]],
        "do": "read the recent commit before committing yours; confirm this is a refinement, not a duplicate shot",
    }]


def d_sweep(commits, _dirty, w):
    """One signature on a long unbroken run while others are active.

    A sweep is `git add -A` in a shared tree: it commits whatever is lying
    around, including another agent's in-flight work, under one name. The
    result is not just misattribution — sal0_fit.py reads this trailer to
    decide lanes, so a sweep steers rotation with fabricated data.
    """
    if len(commits) < BURST_RUN:
        return []
    agents = {c["agent"] for c in commits}
    if len(agents) < 2:
        return []

    ordered = list(reversed(commits))  # oldest first
    best_agent, best_run, run, prev = None, 0, 0, None
    for c in ordered:
        run = run + 1 if c["agent"] == prev else 1
        prev = c["agent"]
        if run > best_run:
            best_run, best_agent = run, c["agent"]

    if best_run < BURST_RUN:
        return []
    return [{
        "detector": "SWEEP",
        "severity": "high",
        "what": f"{best_agent} signed {best_run} consecutive commits in {w}m while {len(agents)} agents were active",
        "detail": [f"consecutive run: {best_run}", f"other signatures seen: {', '.join(sorted(agents - {best_agent}))}"],
        "do": "check whether those commits contain another agent's work; stage explicit paths, never -A",
    }]


def d_duplicate_issue(commits, _dirty, w):
    """Two agents citing the same issue number: both took the same shot."""
    pat = re.compile(r"#(\d+)")
    by_issue = collections.defaultdict(set)
    for c in commits:
        for n in pat.findall(c["subject"]):
            by_issue[n].add(c["agent"])
    hits = {n: a for n, a in by_issue.items() if len(a) >= 2}
    if not hits:
        return []
    return [{
        "detector": "DUPLICATE_ISSUE",
        "severity": "medium",
        "what": f"{len(hits)} issue(s) worked by more than one agent in {w}m",
        "detail": [f"#{n} — {', '.join(sorted(a))}" for n, a in hits.items()],
        "do": "assign the issue on GitHub before the first commit; the picker reads assignment",
    }]


def d_self_rework(commits, _dirty, w):
    """One agent re-editing its own file, fast, repeatedly.

    Not a collision between agents — a collision with yourself. Measured over
    232 commits, 61% re-touched a file the same agent had edited under two
    hours earlier. That is not iteration, it is a shot taken over and over
    from the same spot, and it is invisible from inside the run that is doing
    it: each individual edit looks like an improvement.
    """
    last, hits = {}, collections.Counter()
    for c in reversed(commits):  # oldest first
        for f in c["files"]:
            k = (c["agent"], f)
            if k in last and c["ts"] - last[k] <= REWORK_SECONDS:
                hits[f] += 1
            last[k] = c["ts"]

    heavy = [(f, n) for f, n in hits.most_common() if n >= REWORK_AT]
    if not heavy:
        return []
    return [{
        "detector": "SELF_REWORK",
        "severity": "medium",
        "what": f"{len(heavy)} file(s) re-edited by their own author {REWORK_AT}+ times inside {w}m",
        "detail": [f"{n}x  {f}" for f, n in heavy[:6]],
        "do": "the shot is not landing — change the play, or leave the file and go score",
    }]


def d_doctrine_churn(commits, _dirty, w):
    """Editing the rulebook instead of playing.

    The most-edited file on this branch is the playbook: 37 commits, against
    one verified point for the whole docs category. Rewriting how to score is
    the most convincing way to spend a possession without scoring, because it
    produces a diff, a commit, and a feeling of progress every time.
    """
    doc_commits = [c for c in commits
                   if c["files"] and all(DOCTRINE.search(f) for f in c["files"])]
    if len(doc_commits) < DOCTRINE_AT:
        return []
    return [{
        "detector": "DOCTRINE_CHURN",
        "severity": "medium",
        "what": f"{len(doc_commits)} of {len(commits)} commits in {w}m changed only doctrine",
        "detail": [f"{c['sha']} {c['subject'][:56]}" for c in doc_commits[:5]],
        "do": "docs convert at 1.0%; product at 9.5%. Take a src/ shot before the next edit here",
    }]


def d_unpushed(commits, _dirty, _w):
    """Commits sitting locally, invisible to every other agent.

    This is the precondition for every sweep we have had. Work that is not
    pushed cannot be seen, so a second agent cannot know it exists — it either
    redoes it or stages it under its own name. Both of today's collisions began
    here.

    Costs one `rev-list`; no network. The check that would have prevented the
    damage is cheaper than the check that found it.
    """
    code, out = sh(["git", "rev-list", "--count", "@{upstream}..HEAD"])
    if code != 0:
        return []
    try:
        n = int(out.strip() or 0)
    except ValueError:
        return []
    if n < UNPUSHED_AT:
        return []
    return [{
        "detector": "UNPUSHED",
        "severity": "high",
        "what": f"{n} commit(s) exist only on this machine",
        "detail": ["no other agent can see this work, so it cannot be coordinated around"],
        "do": "push now — invisible work is what a sweep picks up",
    }]


def d_claim_without_evidence(commits, _dirty, w):
    """A commit that asserts verification while changing nothing verifiable.

    Our most expensive failure class, by a distance: 'verify passed' printed
    while lint failed, a merge reported clean that had not merged, a bench
    reported applied that never applied. The words are free; the check is not.

    Flags a commit whose subject or body claims a green result while its diff
    touches no source and no test — nothing that any verifier could have run.
    """
    hits = []
    for c in commits:
        if not CLAIM.search(c["subject"]):
            continue
        if any(f.startswith("src/") or ".test." in f or ".spec." in f for f in c["files"]):
            continue
        # A commit whose whole purpose is to RECORD evidence is the behaviour
        # we want, not the failure. The first version of this flagged exactly
        # that — a docs commit reading "B-8 chain verified" whose diff was the
        # evidence itself — and a detector that punishes writing evidence down
        # teaches agents to stop writing it down.
        #
        # Fire only when the claim cites nothing checkable: no command, no exit
        # code, no commit hash, no count.
        if EVIDENCE.search(c.get("body", "") + " " + c["subject"]):
            continue
        hits.append(c)
    if not hits:
        return []
    return [{
        "detector": "CLAIM_WITHOUT_EVIDENCE",
        "severity": "high",
        "what": f"{len(hits)} commit(s) in {w}m claim a verified result but changed nothing a verifier runs",
        "detail": [f"{c['sha']} {c['subject'][:56]}" for c in hits[:5]],
        "do": "name the command and its exit code, or drop the claim from the message",
    }]


DETECTORS = [d_dirty_overlap, d_unpushed, d_duplicate_file, d_sweep,
             d_claim_without_evidence, d_self_rework, d_doctrine_churn,
             d_duplicate_issue, d_unsigned]
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan for agents colliding on one repo.")
    ap.add_argument("--window", type=int, default=120, help="minutes of history to scan")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--mine", default=os.environ.get("SAL0_AGENT", ""),
                    help="your signature (e.g. SAL0-04); your own commits stop counting as collisions")
    args = ap.parse_args()

    global MINE
    MINE = args.mine.strip()

    code, _ = sh(["git", "rev-parse", "--git-dir"])
    if code != 0:
        print("not a git repository — cannot scan", file=sys.stderr)
        return 2

    commits = recent(args.window)
    _, porcelain = sh(["git", "status", "--porcelain"])
    dirty = [ln[3:].strip() for ln in porcelain.split("\n") if ln.strip()]

    findings = []
    for d in DETECTORS:
        try:
            findings.extend(d(commits, dirty, args.window))
        except Exception as e:
            # A detector that crashes must not silently reduce the scan to
            # "clean" — that is the exact failure this file exists to catch.
            findings.append({
                "detector": d.__name__, "severity": "high",
                "what": f"detector crashed: {e}", "detail": [],
                "do": "fix the detector; a scan that cannot run is not a clean scan",
            })

    findings.sort(key=lambda f: SEV_ORDER.get(f["severity"], 9))
    report = {
        "window_minutes": args.window,
        "commits_scanned": len(commits),
        "agents_seen": sorted({c["agent"] for c in commits}),
        "uncommitted_files": len(dirty),
        "findings": findings,
    }

    if args.json:
        print(json.dumps(report, indent=2))
        return 1 if findings else 0

    print()
    print("  COLLISION SCAN — are we working over each other?")
    print(f"  {'-' * 62}")
    print(f"    window:   {args.window}m   commits: {len(commits)}   dirty files: {len(dirty)}")
    print(f"    agents:   {', '.join(report['agents_seen']) or 'none'}")
    print()

    if not findings:
        print("  No collision signal. Distinct files, distinct signatures.")
        print()
        return 0

    for f in findings:
        print(f"  [{f['severity'].upper()}] {f['detector']}")
        print(f"    {f['what']}")
        for line in f["detail"]:
            print(f"      · {line}")
        print(f"    DO: {f['do']}")
        print()
    return 1


if __name__ == "__main__":
    sys.exit(main())
