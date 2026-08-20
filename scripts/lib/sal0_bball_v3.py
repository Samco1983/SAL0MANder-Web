#!/usr/bin/env python3
"""SAL0MANder BBall V3: stimulate the offense when the board is empty.

V2 tells the truth: the court is clean, the score is real, and the board is
empty. V3 turns that evidence into a ready pass.

This script is intentionally narrow. It does not edit product code and it does
not call a model. It builds a ranked list of small WEB/PRODUCT shots from the
repo surfaces, penalizes files touched recently, and can create exactly one
GitHub issue when asked.

    python3 scripts/lib/sal0_bball_v3.py
    python3 scripts/lib/sal0_bball_v3.py --json
    python3 scripts/lib/sal0_bball_v3.py --create
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
REPO = "Samco1983/SAL0MANder-Web"


@dataclass(frozen=True)
class ProductCandidate:
    title: str
    files: tuple[str, ...]
    success_check: str
    body: str
    value: int
    risk: int
    reason: str


@dataclass(frozen=True)
class RankedShot:
    title: str
    category: str
    files: tuple[str, ...]
    success_check: str
    body: str
    value: int
    risk: int
    collision_risk: int
    score: int
    reason: str


def run(cmd: list[str], timeout: int = 30) -> tuple[int, str, str]:
    try:
        result = subprocess.run(
            cmd,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except Exception as exc:
        return 1, "", str(exc)


def product_candidates() -> list[ProductCandidate]:
    """Known small product shots that move visible surfaces without Unity."""
    return [
        ProductCandidate(
            title="[WEB][PRODUCT] Extract class code when a student pastes a full share link",
            files=(
                "src/routes/guest-play/GuestPlayPage.tsx",
                "src/routes/guest-play/truncatedLink.test.tsx",
            ),
            success_check=(
                "/play accepts a pasted full share URL, extracts the code, and navigates to "
                "/play/<code> without asking for an account"
            ),
            body=(
                "Students often paste a whole Classroom/TPT link into a code field. Treat that as "
                "recoverable input: parse the path, take the final /play segment, and keep the no-account invariant."
            ),
            value=92,
            risk=45,
            reason="high student value, but touches the hot Guest Play route",
        ),
        ProductCandidate(
            title="[WEB][PRODUCT] Add a teacher preview path from Home",
            files=(
                "src/routes/home/HomePage.tsx",
                "src/routes/home/HomePage.test.tsx",
            ),
            success_check=(
                "Home exposes a teacher-oriented preview action that points to an existing route "
                "and npm run verify exits 0"
            ),
            body=(
                "Home already serves students through Guest Play. Add a small teacher preview action/copy path "
                "so a teacher can understand how the demo activity will be shared without creating an account."
            ),
            value=78,
            risk=28,
            reason="visible product surface with lower collision risk than Guest Play",
        ),
        ProductCandidate(
            title="[WEB][PRODUCT] Give the Unity host a non-gameplay return path",
            files=(
                "src/routes/unity/UnityHostPage.tsx",
                "src/app/routing.test.tsx",
            ),
            success_check=(
                "The Unity host page offers a visible return-to-play or return-home action, "
                "without changing Unity gameplay"
            ),
            body=(
                "The bare WebGL host is a smoke-test surface. Add a web-only recovery action so a visitor "
                "does not dead-end there. Do not modify Unity gameplay or bridge behavior."
            ),
            value=62,
            risk=24,
            reason="web-only recovery on a less-contended route",
        ),
        ProductCandidate(
            title="[WEB][PRODUCT] Add visible next-step copy to the profile placeholder",
            files=(
                "src/routes/profile/ProfilePage.tsx",
                "src/routes/profile/ProfilePage.test.tsx",
            ),
            success_check=(
                "Profile tells students what guest progress can do next and keeps the no account prompt invariant"
            ),
            body=(
                "Make the Profile placeholder more actionable without implementing accounts: explain the next "
                "student-safe step and keep account/name/email/password prompts absent."
            ),
            value=55,
            risk=20,
            reason="small route copy shot; useful if other surfaces are too hot",
        ),
        ProductCandidate(
            title="[WEB][PRODUCT] Add a teacher WebGL preview path from Profile",
            files=(
                "src/routes/profile/ProfilePage.tsx",
                "src/routes/profile/ProfilePage.test.tsx",
            ),
            success_check=(
                "Profile gives a teacher or tester a direct WebGL-host preview path without changing Unity gameplay"
            ),
            body=(
                "Profile is the guest-progress surface, but it can also hand a teacher/tester back to the "
                "web-only WebGL host preview. Add the path without introducing any account, email, name, "
                "or Unity gameplay change."
            ),
            value=54,
            risk=20,
            reason="small visible product shot after the existing Profile student path",
        ),
        ProductCandidate(
            title="[WEB][PRODUCT] Add a sample activity return path from Unity host",
            files=(
                "src/routes/unity/UnityHostPage.tsx",
                "src/app/routing.test.tsx",
            ),
            success_check=(
                "The WebGL host page offers a direct sample-activity path without changing Unity gameplay"
            ),
            body=(
                "The WebGL host is a smoke-test surface. Add a web-only return path into the sample activity "
                "so a teacher/tester can recover from the host into playable content without touching Unity gameplay."
            ),
            value=52,
            risk=22,
            reason="web-only recovery from a host surface",
        ),
        ProductCandidate(
            title="[WEB][PRODUCT] Clarify 404 recovery for teacher-shared activity links",
            files=(
                "src/routes/not-found/NotFoundPage.tsx",
                "src/app/RouteError.test.tsx",
                "src/app/deployedRouting.test.tsx",
            ),
            success_check=(
                "Unknown routes clearly route students toward class-code recovery and deployed routing tests pass"
            ),
            body=(
                "Improve unknown-route recovery for teacher-shared links. This is a small copy/action shot; "
                "do not change route shape or backend contracts."
            ),
            value=50,
            risk=22,
            reason="useful recovery shot, but recently touched by SAL0-01",
        ),
    ]


def file_contains(path: str, pattern: str) -> bool:
    try:
        return bool((REPO_ROOT / path).read_text(encoding="utf-8").find(pattern) >= 0)
    except OSError:
        return False


def candidate_complete(candidate: ProductCandidate) -> bool:
    title = candidate.title
    if "teacher preview path from Home" in title:
        return file_contains("src/routes/home/HomePage.tsx", "Preview WebGL host")
    if "Unity host a non-gameplay return path" in title:
        return file_contains("src/routes/unity/UnityHostPage.tsx", "Back to home")
    if "visible next-step copy to the profile" in title:
        return file_contains("src/routes/profile/ProfilePage.tsx", "Next step:")
    if "teacher WebGL preview path from Profile" in title:
        return file_contains("src/routes/profile/ProfilePage.tsx", "Preview WebGL host")
    if "sample activity return path from Unity host" in title:
        return file_contains("src/routes/unity/UnityHostPage.tsx", "MOCK_DEMO_ACTIVITY_ID")
    if "404 recovery" in title:
        return file_contains("src/app/RouteError.tsx", "Enter a class code")
    if "Extract class code" in title:
        return file_contains("src/routes/guest-play/GuestPlayPage.tsx", "paste the missing end of the link")
    return False


def recent_files(limit: int = 80) -> set[str]:
    code, out, _ = run(["git", "log", f"-{limit}", "--name-only", "--format="])
    if code != 0:
        return set()
    return {line.strip() for line in out.splitlines() if line.strip()}


def open_issue_titles() -> set[str]:
    code, out, _ = run(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            REPO,
            "--state",
            "open",
            "--limit",
            "100",
            "--json",
            "title",
        ],
        timeout=40,
    )
    if code != 0 or not out:
        return set()
    try:
        return {issue.get("title", "") for issue in json.loads(out)}
    except ValueError:
        return set()


def mission_next() -> dict:
    code, out, _ = run([sys.executable, str(HERE / "sal0_force_shot.py"), "--json"], timeout=90)
    if code != 0 and not out:
        return {"action": "UNKNOWN", "reason": "mission:next unavailable"}
    try:
        return json.loads(out)
    except ValueError:
        return {"action": "UNKNOWN", "reason": "mission:next returned unreadable output"}


def rank_candidates(
    candidates: list[ProductCandidate],
    touched: set[str],
    existing_titles: set[str],
) -> list[RankedShot]:
    ranked: list[RankedShot] = []
    for candidate in candidates:
        if candidate.title in existing_titles:
            continue
        collision = sum(1 for path in candidate.files if path in touched) * 24
        score = candidate.value - candidate.risk - collision
        ranked.append(
            RankedShot(
                title=candidate.title,
                category="PRODUCT",
                files=candidate.files,
                success_check=candidate.success_check,
                body=candidate.body,
                value=candidate.value,
                risk=candidate.risk,
                collision_risk=collision,
                score=score,
                reason=candidate.reason,
            )
        )
    return sorted(ranked, key=lambda shot: (-shot.score, -shot.value, shot.title))


def build_packet() -> dict:
    next_state = mission_next()
    candidates = [candidate for candidate in product_candidates() if not candidate_complete(candidate)]
    ranked = rank_candidates(candidates, recent_files(), open_issue_titles())
    top = ranked[0] if ranked else None
    action = "CREATE_PRODUCT_ISSUE" if next_state.get("action") == "CREATE_SHOT" else "HOLD"
    if top is None and action == "CREATE_PRODUCT_ISSUE":
        top = RankedShot(
            title="[WEB][PRODUCT] Split the next smallest user-visible web shot",
            category="PRODUCT",
            files=(),
            success_check=(
                "a new WEB product issue exists with one lane, one clock, and one falsifiable success check"
            ),
            body=(
                "The known local product shot bank is exhausted. Split the next smallest user-visible "
                "web improvement from the current product surface instead of replaying a completed shot."
            ),
            value=45,
            risk=12,
            collision_risk=0,
            score=33,
            reason="shot bank exhausted; create the next bounded product possession",
        )
    return {
        "schemaVersion": "sal0-bball-v3",
        "action": action,
        "reason": (
            "board is empty; stimulate the offense with a ranked product shot"
            if action == "CREATE_PRODUCT_ISSUE"
            else "a concrete shot already exists or the board is unreadable"
        ),
        "missionNext": next_state,
        "recommended": asdict(top) if top else None,
        "bench": [asdict(shot) for shot in ranked[1:5]],
    }


def issue_body(shot: RankedShot) -> str:
    files = "\n".join(f"- `{path}`" for path in shot.files)
    return f"""## Shot
{shot.body}

## Lane
WEB / PRODUCT

## Clock
30 minutes

## Suggested files
{files}

## Success check
{shot.success_check}.

## Why this shot
{shot.reason}. V3 score: {shot.score} = value {shot.value} - risk {shot.risk} - collision {shot.collision_risk}.

## Boundaries
No Unity gameplay changes. No secrets/auth files. No backend contract rewrite unless the issue is explicitly rewritten.
"""


def create_issue(shot: RankedShot) -> str:
    code, out, err = run(
        ["gh", "issue", "create", "--repo", REPO, "--title", shot.title, "--body", issue_body(shot)],
        timeout=40,
    )
    if code != 0:
        raise RuntimeError(err or out or "gh issue create failed")
    return out.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Stimulate SAL0 BBall with ranked product shots.")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--create", action="store_true", help="create the top recommended issue")
    args = parser.parse_args()

    packet = build_packet()
    if args.create:
        if packet["action"] != "CREATE_PRODUCT_ISSUE" or not packet["recommended"]:
            print("no issue created - no V3 product shot is currently recommended", file=sys.stderr)
            return 1
        shot = RankedShot(**packet["recommended"])
        packet["created"] = create_issue(shot)

    if args.json:
        print(json.dumps(packet, indent=2))
        return 0

    print()
    print("  SAL0 BBALL V3 STIMULUS")
    print("  --------------------------------------------------------------")
    print(f"    action: {packet['action']}")
    print(f"    reason: {packet['reason']}")
    if packet.get("recommended"):
        shot = packet["recommended"]
        print()
        print(f"    recommended: {shot['title']}")
        print(f"    score:       {shot['score']} (value {shot['value']} / risk {shot['risk']} / collision {shot['collision_risk']})")
        print(f"    files:       {', '.join(shot['files'])}")
        print(f"    scores when: {shot['success_check']}")
    if packet.get("created"):
        print()
        print(f"    created: {packet['created']}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
