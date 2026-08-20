#!/usr/bin/env python3
"""Keep the machine awake and keep the agents shooting.

Two jobs, both boring on purpose:

  1. Hold a power assertion so the laptop does not sleep mid-possession. A
     scheduled run that fires while the disk is asleep looks exactly like an
     agent that did nothing.
  2. On an interval, hand the existing work loop a possession — and record
     evidence either way, so a quiet night is distinguishable from a dead one.

WHAT IT DOES NOT DO. It is not a second loop. All the real machinery —
locking, token, dirty-tree refusal, verify gate, commit, push — already lives in
scripts/sal0-work-loop.sh, and reimplementing any of it here would put two
programs in charge of one court. This only decides WHEN, and refuses when the
answer is "not now".

ASYMMETRY, STATED PLAINLY. `claude` is a CLI with a token file, so it can be
nudged for real. `codex` is not on PATH — it runs in an interactive session
nobody here can type into. For Codex this writes a durable note to
docs/coordination/ops/NUDGES.jsonl and nothing more. That is a message left on
the bench, not a substitution: it lands only if Codex reads it.

    python3 scripts/sal0_nudge.py                 # 30-minute possessions
    python3 scripts/sal0_nudge.py --interval 900
    python3 scripts/sal0_nudge.py --dry-run --max-cycles 1   # prove the wiring

Stop it with Ctrl-C, or `touch ~/.sal0mander/PAUSE` to make it stand down
without killing it. The power assertion is released on every exit path.
"""

from __future__ import annotations

import argparse
import atexit
import datetime as dt
import json
import os
import signal
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.expanduser("~")
LOG_DIR = os.path.join(REPO, "docs", "coordination", "runs", "logs")

WORK_LOOP = os.path.join(REPO, "scripts", "sal0-work-loop.sh")
LOOP_LOCK = os.path.join(REPO, "docs", "coordination", ".work-loop.lock")
OWN_LOCK = os.path.join(REPO, "docs", "coordination", ".nudge.lock")
PAUSE = os.path.join(HOME, ".sal0mander", "PAUSE")
NUDGES = os.path.join(REPO, "docs", "coordination", "ops", "NUDGES.jsonl")

# A possession is bounded. Past this the loop is not working, it is hanging,
# and the useful move is to end it and let the next cycle start clean.
POSSESSION_CAP_SECONDS = 2400

_caffeinate: subprocess.Popen | None = None


def now() -> str:
    return dt.datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")


def say(msg: str) -> None:
    print(f"  [{dt.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def record(event: str, **fields) -> None:
    """Append evidence. A quiet night and a dead one must not look alike."""
    os.makedirs(os.path.dirname(NUDGES), exist_ok=True)
    with open(NUDGES, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"at": now(), "event": event, **fields}) + "\n")


def keep_awake() -> bool:
    """Hold a power assertion for as long as this process lives.

    `caffeinate` as a CHILD process, never `pmset`. pmset changes a system
    setting that outlives the script and has to be undone; a child assertion
    dies with us, including on kill -9. Nothing to clean up on a machine the
    owner is asleep next to.
    """
    global _caffeinate
    try:
        # -i idle sleep, -m disk idle, -s system sleep while on AC.
        #
        # Deliberately NOT -d or -u. Those keep the DISPLAY lit, and the point
        # is a machine that keeps working next to someone who is asleep — a
        # screen burning all night is a cost with no possession attached to it.
        _caffeinate = subprocess.Popen(
            ["/usr/bin/caffeinate", "-ims"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return True
    except Exception as exc:
        say(f"could not hold the machine awake: {exc}")
        return False


def release() -> None:
    global _caffeinate
    if _caffeinate and _caffeinate.poll() is None:
        _caffeinate.terminate()
        try:
            _caffeinate.wait(timeout=5)
        except Exception:
            _caffeinate.kill()
    _caffeinate = None
    try:
        if os.path.exists(OWN_LOCK) and open(OWN_LOCK).read().strip() == str(os.getpid()):
            os.remove(OWN_LOCK)
    except Exception:
        pass


def claim_lock() -> bool:
    """One nudger. Two would double every possession."""
    try:
        if os.path.exists(OWN_LOCK):
            pid = open(OWN_LOCK).read().strip()
            if pid.isdigit():
                try:
                    os.kill(int(pid), 0)
                    say(f"another nudger is already running (pid {pid})")
                    return False
                except ProcessLookupError:
                    say(f"clearing a stale lock from dead pid {pid}")
        os.makedirs(os.path.dirname(OWN_LOCK), exist_ok=True)
        with open(OWN_LOCK, "w") as fh:
            fh.write(str(os.getpid()))
        return True
    except Exception as exc:
        say(f"could not take the lock: {exc}")
        return False


def blocked() -> str | None:
    """Reasons not to start a possession right now."""
    if os.path.exists(PAUSE):
        return "PAUSE flag is set"
    if os.path.exists(LOOP_LOCK):
        return "the work loop is already running"
    if not os.path.exists(WORK_LOOP):
        return f"work loop not found at {WORK_LOOP}"
    return None


def refusal_reason() -> str | None:
    """Why the last run refused, if it did.

    A refusal is not a miss. The loop refusing a dirty court is the guard
    working — but sixteen identical refusals overnight is not sixteen data
    points, it is one blocker nobody was told about. Reading it lets the nudger
    say the same thing once, loudly, instead of quietly failing all night.
    """
    try:
        logs = sorted(
            (f for f in os.listdir(LOG_DIR) if f.startswith("work-loop-")),
            reverse=True,
        )
        if not logs:
            return None
        text = open(os.path.join(LOG_DIR, logs[0]), encoding="utf-8", errors="replace").read()
        if "BLOCKED - NEED OWNER" not in text:
            return None
        for line in text.split("\n"):
            if "working tree was already dirty" in line:
                files = [l.strip() for l in text.split("\n")
                         if l.strip().startswith("??") or l.strip().startswith("M ")]
                return "dirty tree: " + ", ".join(files[:4]) if files else "dirty tree"
        return "blocked, owner needed"
    except Exception:
        return None


def nudge_claude(dry: bool) -> tuple[str, int]:
    if dry:
        say("DRY RUN — would run the work loop")
        return "dry-run", 0
    started = time.monotonic()
    try:
        r = subprocess.run(["/bin/sh", WORK_LOOP], cwd=REPO,
                           capture_output=True, text=True,
                           timeout=POSSESSION_CAP_SECONDS)
        took = int(time.monotonic() - started)
        # Exit code, never the output text. Every false-green in this project
        # came from reading a log and believing a sentence in it.
        return ("scored" if r.returncode == 0 else "missed"), r.returncode
    except subprocess.TimeoutExpired:
        say(f"possession hit the {POSSESSION_CAP_SECONDS}s cap and was ended")
        return "hung", 124


def note_for_codex(cycle: int) -> None:
    """A message on the bench. Not a nudge — Codex is not a CLI here."""
    record("codex-note", cycle=cycle,
           note="Claude took a possession. Codex is interactive-only on this "
                "machine, so this is a durable note rather than an invocation.")


def check_owner_needed() -> None:
    """Speak to the owner only when the set of things only he can clear changes.

    This is the piece that ends the asking. Everything else here reports when
    someone runs it; this reaches out — and only on a change, because a notifier
    that fires on an unchanged state gets muted, taking the one that mattered
    with it.

    Never fatal. A notifier that can break a possession is worse than one that
    occasionally stays quiet.
    """
    try:
        subprocess.run(
            [sys.executable,
             os.path.join(REPO, "scripts", "lib", "sal0_owner_needed.py")],
            capture_output=True, text=True, timeout=900, cwd=REPO,
        )
    except Exception:
        pass


def main() -> int:
    ap = argparse.ArgumentParser(description="Keep the Mac awake and keep possessions running.")
    ap.add_argument("--interval", type=int, default=600,
                    help="minimum seconds between possession STARTS, not a delay after each")
    ap.add_argument("--max-cycles", type=int, default=0, help="0 = until stopped")
    ap.add_argument("--dry-run", action="store_true", help="prove the wiring without running an agent")
    args = ap.parse_args()

    if not claim_lock():
        return 1
    atexit.register(release)
    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))

    awake = keep_awake()
    say(f"machine held awake: {'yes' if awake else 'NO — it may sleep'}")
    say(f"floor {args.interval}s between starts, cap {POSSESSION_CAP_SECONDS}s per possession")
    say(f"stand down with: touch {PAUSE}")
    record("start", interval=args.interval, awake=awake, dry_run=args.dry_run, pid=os.getpid())

    cycle = 0
    repeats: dict[str, int] = {}
    try:
        while True:
            cycle += 1
            started_at = time.monotonic()
            reason = blocked()
            if reason:
                say(f"cycle {cycle}: standing down — {reason}")
                record("stand-down", cycle=cycle, reason=reason)
            else:
                say(f"cycle {cycle}: handing the work loop a possession")
                outcome, code = nudge_claude(args.dry_run)
                reason = refusal_reason() if outcome == "missed" else None
                say(f"cycle {cycle}: {outcome} (exit {code})" + (f" — {reason}" if reason else ""))
                record("possession", cycle=cycle, outcome=outcome, exit_code=code,
                       **({"refusal": reason} if reason else {}))

                # Same cause twice is a blocker, not a trend. Say it once,
                # loudly, rather than logging the same miss until morning.
                if reason:
                    repeats[reason] = repeats.get(reason, 0) + 1
                    if repeats[reason] == 2:
                        say("")
                        say("  ** SAME REFUSAL TWICE — this will not clear on its own **")
                        say(f"  ** {reason}")
                        say("  ** every remaining cycle tonight will refuse for this reason")
                        say("")
                        record("blocker", cycle=cycle, reason=reason, repeats=2)
                else:
                    repeats.clear()
                note_for_codex(cycle)
                check_owner_needed()

            if args.max_cycles and cycle >= args.max_cycles:
                say(f"reached --max-cycles {args.max_cycles}")
                break

            # A FLOOR between possession starts, not a nap after each one.
            #
            # This used to sleep the full interval after the work finished, so
            # a 240s possession on a 1800s interval left the player standing
            # still for 26 minutes out of every 30. The clock does not stop
            # because the shot went in.
            #
            # A floor rather than zero delay: back-to-back invocations with no
            # gap would stack against the loop's own lock and spend quota
            # discovering that a run is already in flight.
            elapsed = time.monotonic() - started_at
            wait = max(0.0, args.interval - elapsed)
            if wait > 0:
                say(f"next possession in {int(wait)}s (took {int(elapsed)}s)")
                time.sleep(wait)
            else:
                say(f"possession took {int(elapsed)}s — starting the next immediately")
    except KeyboardInterrupt:
        say("stopped")
        record("stop", cycles=cycle)
    finally:
        release()
        say("power assertion released")
    return 0


if __name__ == "__main__":
    sys.exit(main())
