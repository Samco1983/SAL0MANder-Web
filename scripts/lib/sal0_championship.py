#!/usr/bin/env python3
"""What winning actually is, checked against reality.

Points are possession quality. They are not the championship, and a team can
run up a points total for a week without the product existing. The owner's
definition, 2026-08-20:

    Champion = the website is done, the game is done, everything is operational.

So this checks those three things directly, and nothing else. Every condition is
verified against the world — a build that exits 0, a URL that answers, a probe
that runs in a scheduler's environment — never against a claim in a log.

    python3 scripts/lib/sal0_championship.py
    python3 scripts/lib/sal0_championship.py --json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SLUG = "Samco1983/SAL0MANder-Web"
# A driver that has not moved in this long is not driving.
DRIVER_STALE_MINUTES = 25
SITE = "https://samco1983.github.io/SAL0MANder-Web/"


def sh(cmd: list[str], timeout: int = 240, shell_env: dict | None = None) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                           cwd=REPO, env=shell_env)
        return r.returncode, (r.stdout or "").strip()
    except Exception as e:
        return 1, f"{type(e).__name__}: {e}"


def reachable(url: str, timeout: int = 15) -> tuple[bool, str]:
    try:
        req = urllib.request.Request(url, method="GET",
                                     headers={"User-Agent": "sal0-championship"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 400, f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:
        # Some scheduled macOS/Python environments have an incomplete CA store
        # while curl can still verify the same public endpoint. The scorer should
        # not call a live site dead because Python's local certificate bundle is
        # stale.
        code, raw = sh([
            "curl", "-L", "-sS", "-o", "/dev/null",
            "-w", "%{http_code}", "--max-time", str(timeout), url
        ], timeout + 5)
        status = int(raw) if code == 0 and raw.isdigit() else 0
        if 200 <= status < 400:
            return True, f"HTTP {status}"

        # Both paths failed. Say WHICH failure this was, because "the site is
        # down" and "this machine cannot verify certificates" are different
        # problems with different owners, and the old message called both of
        # them a dead site.
        #
        # Observed 2026-08-25: this returned URLError for the GitHub Pages URL
        # while the site answered HTTP 200. Python and curl both refused the
        # same valid Let's Encrypt certificate — "unable to get local issuer
        # certificate" — under a session with HTTPS_PROXY set. The site was
        # never down. Reporting it down sends someone to debug a deploy that
        # is working.
        #
        # Verification is deliberately NOT disabled to make this green. A
        # scorer that trusts an unverified endpoint cannot tell a healthy site
        # from an intercepted one, which is a worse failure than an
        # inconclusive line on a board.
        detail = f"{type(e).__name__}"
        if "CERTIFICATE_VERIFY_FAILED" in str(e) or "certificate" in str(e).lower():
            detail = ("certificate could not be verified on THIS machine — the site may be "
                      "up; check with `curl -I " + url + "` from a shell without a proxy")
        return False, f"{detail}{f' / HTTP {status}' if status else ''}"


# --- the three things -------------------------------------------------------

def website() -> list[dict]:
    out = []

    code, _ = sh(["npm", "run", "build"], timeout=600)
    out.append({"name": "the site builds", "ok": code == 0,
                "blocker": "" if code == 0 else "npm run build fails"})

    wf = os.path.join(REPO, ".github", "workflows", "deploy.yml")
    out.append({"name": "a deploy pipeline exists", "ok": os.path.exists(wf),
                "blocker": "" if os.path.exists(wf) else "no deploy workflow"})

    # `gh` failing to answer is not evidence about GitHub Pages.
    #
    # This used to collapse the two: a non-zero exit set lines to empty, which
    # read as "Pages is off". A network blip, a timeout, or a rate limit all
    # became a confident claim about the repository's settings. On 2026-08-25 it
    # reported Pages off while the API said has_pages=true, visibility=public,
    # and the site was serving HTTP 200 — in the same run where the line below
    # correctly reported the site answering.
    #
    # The blocker text was worse than the wrong verdict: it asserted a CAUSE
    # this function never measured — "repo is private, so this needs Pro" —
    # while `.visibility` sat unused in the very query that fetched it. A board
    # that invents a diagnosis can send an owner to buy a plan they already
    # do not need.
    #
    # So: report what was measured, say so when nothing could be measured, and
    # read the field that is already on hand before naming a cause.
    code, raw = sh(["gh", "api", f"repos/{SLUG}", "--jq", ".has_pages,.default_branch,.visibility"], 90)
    lines = [line.strip() for line in raw.split("\n")] if code == 0 else []
    if code != 0 or len(lines) < 3:
        pages_ok = False
        pages_blocker = (f"could not ask GitHub about Pages (gh exited {code}) — "
                         "this says nothing about whether Pages is on")
    else:
        has_pages, _default_branch, visibility = lines[0], lines[1], lines[2]
        pages_ok = has_pages == "true"
        if pages_ok:
            pages_blocker = ""
        elif visibility != "public":
            pages_blocker = (f"GitHub Pages is off and the repo is {visibility} — "
                             "Pages on a non-public repo needs a paid plan")
        else:
            pages_blocker = ("GitHub Pages is off — enable it in Settings -> Pages "
                             "(the repo is public, so no paid plan is required)")
    out.append({"name": "hosting is switched on", "ok": pages_ok, "blocker": pages_blocker})

    code, raw = sh(["gh", "api", f"repos/{SLUG}/contents/.github/workflows/deploy.yml?ref=main",
                    "--jq", ".size"], 90)
    on_main = code == 0
    out.append({"name": "the pipeline is on the default branch", "ok": on_main,
                "blocker": "" if on_main else "deploy.yml is not on main — GitHub only runs workflows from the default branch"})

    live, detail = reachable(SITE)
    out.append({"name": "the site answers at a real URL", "ok": live,
                "blocker": "" if live else f"{SITE} → {detail}"})
    return out


def game() -> list[dict]:
    """
    Ask the deployed site whether a student gets a game — not this laptop.

    Rewritten 2026-08-25 after reporting GAME DONE 0/2 while every byte of the
    build was live: loader, framework, data, and wasm all HTTP 200, about 90 MB,
    served from the same origin as the site. It sent two agents hunting for a
    build URL that had been configured all along, and it was the most expensive
    wrong reading of the night.

    Three separate defects, and together they made this section impossible to
    pass under any configuration:

    1. It read only local .env files. The value ships from CI — deploy.yml sets
       VITE_UNITY_BUILD_BASE_URL at build time — so a correctly deployed site
       always looked unconfigured. The board was asking the wrong machine.
    2. It skipped the fetch unless the value started with "http". The real value
       is "/unity", a same-origin relative path, so the loader was never checked
       even when it was sitting there being served.
    3. It looked for "SAL0MANder.loader.js". Unity emits the file named by
       VITE_UNITY_BUILD_NAME, which is "sal0-unity-webgl.loader.js". Wrong name,
       guaranteed 404, even had 1 and 2 been right.

    Any one of these would have been a bug. All three meant the condition could
    never be met, so its red told you nothing at all.
    """
    out = []

    # deploy.yml is what actually ships, so it is the truth about what a visitor
    # gets. A local .env only ever changes what THIS machine sees at dev time.
    deploy_yml = os.path.join(REPO, ".github", "workflows", "deploy.yml")
    base, name, source = "", "", ""
    if os.path.exists(deploy_yml):
        text = open(deploy_yml, encoding="utf-8", errors="replace").read()
        m = re.search(r"VITE_UNITY_BUILD_BASE_URL:\s*(\S+)", text)
        n = re.search(r"VITE_UNITY_BUILD_NAME:\s*(\S+)", text)
        if m:
            base, source = m.group(1).strip().strip("'\""), "deploy.yml"
        if n:
            name = n.group(1).strip().strip("'\"")

    if not base:
        for filename in (".env", ".env.local", ".env.production"):
            path = os.path.join(REPO, filename)
            if not os.path.exists(path):
                continue
            for line in open(path, encoding="utf-8", errors="replace"):
                if line.startswith("VITE_UNITY_BUILD_BASE_URL="):
                    base, source = line.split("=", 1)[1].strip(), filename
                elif line.startswith("VITE_UNITY_BUILD_NAME="):
                    name = line.split("=", 1)[1].strip()

    name = name or "sal0-unity-webgl"
    out.append({"name": "a Unity build location is configured", "ok": bool(base),
                "blocker": "" if base else
                "VITE_UNITY_BUILD_BASE_URL is set nowhere — not in deploy.yml, not in .env. "
                "The stage will show 'game isn't ready'"})

    # A relative base is the normal case: the build ships inside the site. Resolve
    # it against the live URL, because the question is whether a STUDENT can fetch
    # the loader, not whether a path looks plausible.
    if not base:
        ok, detail = False, "no build location configured"
    else:
        loader = (base.rstrip("/") if base.startswith("http")
                  else SITE.rstrip("/") + "/" + base.strip("/")) + f"/Build/{name}.loader.js"
        ok, detail = reachable(loader)
        detail = f"{detail} — {loader} (from {source})"
    out.append({"name": "the WebGL loader is fetchable", "ok": ok,
                "blocker": "" if ok else f"loader not reachable ({detail})"})
    return out


def operational() -> list[dict]:
    out = []

    code, _ = sh(["npm", "run", "verify"], timeout=900)
    out.append({"name": "the full gate is green", "ok": code == 0,
                "blocker": "" if code == 0 else "npm run verify fails"})

    # Scheduler parity: what a launchd job sees, not what a terminal sees.
    #
    # Presence is not authorization. This check read WON for four days straight
    # while the work loop was locked out of GitHub: the token file existed and
    # had stopped working, and os.path.exists() cannot tell those two apart.
    #
    # The loop itself could. It hit the auth failure, wrote the reason into the
    # PAUSE file, and stopped — on 2026-08-20, while this line kept reporting a
    # win. Trusting an inode over the scheduler's own report of its own
    # credential is how a board stays green straight through an outage, which is
    # the one failure this whole file exists to make impossible.
    #
    # So: read the verdict, not the inode. PAUSE lives outside the repo so no
    # git operation can clear it, which also makes it the same fact for everyone
    # who can read the disk.
    token = os.path.expanduser("~/.sal0mander/secrets/claude_oauth_token")
    has_token = os.path.exists(token)
    pause_reason = ""
    pause_path = os.path.expanduser("~/.sal0mander/PAUSE")
    if os.path.exists(pause_path):
        with open(pause_path, encoding="utf-8", errors="replace") as fh:
            pause_reason = fh.read().strip()
    # Only an auth-flavoured pause invalidates THIS check. An owner calling
    # TIMEOUT is a deliberate stop, not a broken credential, and it is already
    # caught by the possession-heartbeat check further down.
    locked_out = "auth" in pause_reason.lower()
    can_auth = has_token and not locked_out
    if not has_token:
        auth_blocker = "no token file — a scheduled run cannot log in"
    elif locked_out:
        auth_blocker = f"token file present but the loop reported a lockout — {pause_reason}"
    else:
        auth_blocker = ""
    out.append({"name": "the worker can authenticate unattended", "ok": can_auth,
                "blocker": auth_blocker})

    code, raw = sh(["gh", "issue", "list", "--repo", SLUG, "--state", "open",
                    "--json", "number", "--jq", "length"], 90)
    n = int(raw) if code == 0 and raw.isdigit() else 0
    out.append({"name": "the board has work on it", "ok": n > 0,
                "blocker": "" if n > 0 else "empty board — nothing for a worker to take"})

    log = os.path.join(REPO, "docs", "coordination", "ops", "NUDGES.jsonl")
    scored = False
    if os.path.exists(log):
        for line in open(log, encoding="utf-8"):
            try:
                if json.loads(line).get("outcome") == "scored":
                    scored = True
            except Exception:
                pass
    out.append({"name": "an unattended possession has scored", "ok": scored,
                "blocker": "" if scored else "no scheduled run has completed successfully"})

    # Heartbeat, not pgrep.
    #
    # `pgrep` answers "can THIS process see that process", which is a different
    # question in a sandbox. The nudger was running at pid 27264 while another
    # agent's checker reported it dead — the same condition read true and false
    # at the same moment, from two seats. A check whose answer depends on who is
    # asking is not a check.
    #
    # A written heartbeat is the same fact for everyone who can read the repo.
    recent = 0.0
    if os.path.exists(log):
        for line in open(log, encoding="utf-8"):
            try:
                t = dt.datetime.fromisoformat(json.loads(line).get("at", "")).timestamp()
                recent = max(recent, t)
            except Exception:
                pass

    # NUDGES.jsonl is written by scripts/sal0_nudge.py and by nothing else, so
    # reading only that file answers "did the nudger run recently", which is a
    # narrower question than the one this check asks.
    #
    # The work loop is the other thing that drives possessions, and it leaves
    # its own written trace: one docs/coordination/runs/logs/work-loop-*.log per
    # run. On 2026-08-25 three loop possessions claimed issues, passed the gate,
    # committed, and pushed while this check reported 5554 minutes of silence —
    # reporting a live system dead, which is the same defect as reporting a dead
    # one live and costs the same trust.
    #
    # A log file appears whether the run scored or refused, and that is correct
    # here: this check asks whether anything is *driving*, not whether the last
    # possession made its shot. "Refused for a stated reason" is a driver
    # working; the possession checks above are what judge the outcome.
    run_logs = os.path.join(REPO, "docs", "coordination", "runs", "logs")
    if os.path.isdir(run_logs):
        for entry in os.scandir(run_logs):
            if not (entry.name.startswith("work-loop-") and entry.name.endswith(".log")):
                continue
            try:
                recent = max(recent, entry.stat().st_mtime)
            except OSError:
                pass
    age = (dt.datetime.now().astimezone().timestamp() - recent) / 60 if recent else None
    driving = age is not None and age < DRIVER_STALE_MINUTES
    out.append({"name": "something is driving possessions right now", "ok": driving,
                "blocker": "" if driving else
                (f"no possession recorded for {age:.0f} min — nothing is starting the next one"
                 if age is not None else "no possession has ever been recorded")})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Measure the championship, not the points.")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    groups = [("WEBSITE DONE", website()), ("GAME DONE", game()), ("OPERATIONAL", operational())]
    total = sum(len(g[1]) for g in groups)
    won = sum(1 for _, cs in groups for c in cs if c["ok"])

    if args.json:
        print(json.dumps({"won": won, "total": total,
                          "groups": {n: cs for n, cs in groups}}, indent=2))
        return 0 if won == total else 1

    print()
    print(f"  CHAMPIONSHIP — {won} of {total} conditions met")
    print(f"  {'-' * 66}")
    for name, checks in groups:
        got = sum(1 for c in checks if c["ok"])
        print(f"\n  {name}  ({got}/{len(checks)})")
        for c in checks:
            print(f"    {'WON ' if c['ok'] else 'not '} {c['name']}")
            if not c["ok"]:
                print(f"           {c['blocker']}")
    print()
    if won == total:
        print("  Championship. Website, game, and operations all verified.")
    else:
        print("  Points are possession quality. This is the game. A points total")
        print("  that rises while these stay unmet is a team practising.")
    print()
    return 0 if won == total else 1


if __name__ == "__main__":
    sys.exit(main())
