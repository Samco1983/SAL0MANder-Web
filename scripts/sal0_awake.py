#!/usr/bin/env python3
"""Manage a bounded macOS awake lease for GUI-dependent agent work.

The lease keeps the display and system awake so Unity/Claude desktop control
survives inactivity. It expires automatically and refuses battery operation by
default. This tool changes no persistent macOS power settings.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

STATE_DIR = Path.home() / ".sal0mander"
STATE_FILE = STATE_DIR / "awake-lease.json"
CAFFEINATE = "/usr/bin/caffeinate"
DEFAULT_SECONDS = 12 * 60 * 60


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def on_ac_power() -> bool:
    result = subprocess.run(
        ["/usr/bin/pmset", "-g", "batt"],
        check=False,
        capture_output=True,
        text=True,
    )
    return "AC Power" in result.stdout


def process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        # A sandbox may forbid process inspection even though the process is
        # alive. Only ESRCH/ProcessLookupError proves that it is gone.
        return True
    except ProcessLookupError:
        return False


def read_state() -> dict | None:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def active_state() -> dict | None:
    state = read_state()
    if not state:
        return None
    pid = state.get("pid")
    if isinstance(pid, int) and process_alive(pid):
        return state
    STATE_FILE.unlink(missing_ok=True)
    return None


def start(seconds: int, allow_battery: bool) -> int:
    current = active_state()
    if current:
        print(json.dumps({"status": "already-active", **current}, indent=2))
        return 0
    if not allow_battery and not on_ac_power():
        print("REFUSED: connect the Mac to power, then run start again.", file=sys.stderr)
        return 2
    if seconds < 60:
        print("REFUSED: lease must be at least 60 seconds.", file=sys.stderr)
        return 2

    process = subprocess.Popen(
        [CAFFEINATE, "-dis", "-t", str(seconds)],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    started = dt.datetime.now().astimezone()
    state = {
        "pid": process.pid,
        "started_at": started.isoformat(timespec="seconds"),
        "expires_at": (started + dt.timedelta(seconds=seconds)).isoformat(timespec="seconds"),
        "seconds": seconds,
        "assertions": ["display", "idle-system", "ac-system"],
    }
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "started", **state}, indent=2))
    return 0


def status() -> int:
    state = active_state()
    if not state:
        print(json.dumps({"status": "inactive"}, indent=2))
        return 1
    print(json.dumps({"status": "active", **state}, indent=2))
    return 0


def stop() -> int:
    state = active_state()
    if not state:
        print(json.dumps({"status": "inactive"}, indent=2))
        return 0
    pid = state["pid"]
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    STATE_FILE.unlink(missing_ok=True)
    print(json.dumps({"status": "stopped", "pid": pid, "at": now_iso()}, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    start_command = commands.add_parser("start", help="start a bounded awake lease")
    start_command.add_argument("--seconds", type=int, default=DEFAULT_SECONDS)
    start_command.add_argument(
        "--allow-battery",
        action="store_true",
        help="allow the lease to drain the battery (normally refused)",
    )
    commands.add_parser("status", help="show verified lease state")
    commands.add_parser("stop", help="release the current lease")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.command == "start":
        return start(args.seconds, args.allow_battery)
    if args.command == "status":
        return status()
    return stop()


if __name__ == "__main__":
    raise SystemExit(main())
