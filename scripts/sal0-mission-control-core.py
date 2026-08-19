#!/usr/bin/env python3
"""SAL0MANder Mission Control Core preflight.

This is the local coordinator/orchestrator layer, not an agent.
It checks whether the local mission-control surfaces are reachable and writes
evidence without invoking external models or touching credentials.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COORDINATION_DIR = ROOT / "docs" / "coordination"
ROLES_FILE = COORDINATION_DIR / "AGENT_ROLES.json"
OPS_DIR = COORDINATION_DIR / "ops"
LOCK_FILE = COORDINATION_DIR / ".mission-control.lock"
PAUSE_FILE = COORDINATION_DIR / "MISSION_CONTROL_PAUSE"
UNITY_REPO = Path("/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype")
WEB_REPO = Path("/Users/samuel_saldivar/Desktop/SAL0MANder-Web")
SERVICE_PORTS = {
    "vite-dev": 5173,
    "vite-preview": 4173,
}
EXTRA_TOOL_DIRS = [
    Path.home() / ".local" / "bin",
    Path("/opt/homebrew/bin"),
    Path("/usr/local/bin"),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run(command: list[str], cwd: Path | None = None) -> dict[str, object]:
    try:
        completed = subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        return {
            "ok": completed.returncode == 0,
            "exitCode": completed.returncode,
            "stdout": completed.stdout.strip(),
            "stderr": completed.stderr.strip(),
        }
    except FileNotFoundError:
        return {"ok": False, "exitCode": 127, "stdout": "", "stderr": "not found"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "exitCode": 124, "stdout": "", "stderr": "timeout"}


def safe_lines(value: object) -> str:
    text = str(value)
    kept = []
    for line in text.splitlines():
        lowered = line.lower()
        if "token:" in lowered or "oauth" in lowered or "credential" in lowered:
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def pid_is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False


def git_state(repo: Path) -> dict[str, object]:
    if not repo.exists():
        return {"exists": False, "status": "UNKNOWN/UNREACHABLE"}

    branch = run(["git", "branch", "--show-current"], repo)
    head = run(["git", "rev-parse", "--short", "HEAD"], repo)
    status = run(["git", "status", "--short"], repo)
    remote = run(["git", "remote", "-v"], repo)

    return {
        "exists": True,
        "branch": branch["stdout"] if branch["ok"] else "",
        "head": head["stdout"] if head["ok"] else "",
        "dirty": bool(status["stdout"]),
        "statusShort": status["stdout"],
        "hasOrigin": "origin" in str(remote["stdout"]),
    }


def tool_state(name: str) -> dict[str, object]:
    path = shutil.which(name)
    if not path:
        for directory in EXTRA_TOOL_DIRS:
            candidate = directory / name
            if candidate.exists() and candidate.is_file():
                path = str(candidate)
                break
    state: dict[str, object] = {
        "name": name,
        "available": bool(path),
        "path": path or "",
    }
    if not path:
        return state

    version_commands = {
        "git": [path, "--version"],
        "node": [path, "--version"],
        "npm": [path, "--version"],
        "gh": [path, "--version"],
        "codex": [path, "--version"],
        "claude": [path, "--version"],
        "gemini": [path, "--version"],
        "python3": [path, "--version"],
    }
    version = run(version_commands[name]) if name in version_commands else None
    if version:
        state["versionOk"] = version["ok"]
        state["version"] = safe_lines(version["stdout"] or version["stderr"]).splitlines()[0:1]

    if name == "gh":
        auth = run([path, "auth", "status", "--hostname", "github.com"])
        state["authOk"] = auth["ok"]
        state["authStatus"] = safe_lines((auth["stdout"] or "") + "\n" + (auth["stderr"] or ""))

    return state


def lock_state() -> dict[str, object]:
    if not LOCK_FILE.exists():
        return {"locked": False, "stale": False, "path": str(LOCK_FILE)}
    try:
        contents = safe_lines(LOCK_FILE.read_text(encoding="utf-8"))
        parsed = json.loads(contents) if contents else {}
        pid = parsed.get("pid")
        stale = isinstance(pid, int) and not pid_is_running(pid)
        return {
            "locked": True,
            "stale": stale,
            "path": str(LOCK_FILE),
            "contents": contents,
        }
    except (OSError, json.JSONDecodeError) as error:
        return {
            "locked": True,
            "stale": False,
            "path": str(LOCK_FILE),
            "contents": f"unreadable: {error}",
        }


def pause_state() -> dict[str, object]:
    return {
        "paused": PAUSE_FILE.exists(),
        "path": str(PAUSE_FILE),
    }


def port_state(name: str, port: int) -> dict[str, object]:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        open_state = sock.connect_ex(("127.0.0.1", port)) == 0
    return {"name": name, "port": port, "open": open_state}


def network_state() -> dict[str, object]:
    checks = {
        "github": ("github.com", 443),
        "google": ("google.com", 443),
    }
    results = {}
    for name, target in checks.items():
        host, port = target
        try:
            with socket.create_connection((host, port), timeout=3):
                results[name] = "reachable"
        except OSError as error:
            results[name] = f"unreachable: {error.__class__.__name__}"
    return results


def disk_state(path: Path) -> dict[str, object]:
    usage = shutil.disk_usage(path)
    free_gb = round(usage.free / (1024**3), 2)
    return {
        "path": str(path),
        "freeGb": free_gb,
        "ok": free_gb >= 5,
    }


def load_roles() -> dict[str, object]:
    return json.loads(ROLES_FILE.read_text(encoding="utf-8"))


def classify_agent(agent: dict[str, object], tools: dict[str, dict[str, object]]) -> str:
    agent_id = str(agent["id"])
    if agent_id == "codex":
        return "WORKING"
    if agent_id == "codex-cli":
        return "WORKING" if tools["codex"]["available"] else "UNKNOWN/UNREACHABLE"
    if agent_id == "claude":
        return "WORKING" if tools["claude"]["available"] else "UNKNOWN/UNREACHABLE"
    if agent_id == "gemini-api-cli":
        return "WORKING" if tools["gemini"]["available"] else "UNKNOWN/UNREACHABLE"
    if agent_id == "github":
        return "WORKING" if tools["gh"]["available"] else "UNKNOWN/UNREACHABLE"
    if agent_id == "make":
        return "BLOCKED - NEED OWNER"
    if agent_id in {"claude-chat", "gemini"}:
        return "DONE - NEED NEW TASK"
    if agent_id == "unity-ai":
        return "UNKNOWN/UNREACHABLE"
    return "UNKNOWN/UNREACHABLE"


def main() -> int:
    print_urls_only = "--print-open-urls" in sys.argv
    roles = load_roles()
    tools = {name: tool_state(name) for name in ["git", "node", "npm", "gh", "codex", "claude", "gemini", "python3"]}
    repos = {
        "web": git_state(WEB_REPO),
        "unity": git_state(UNITY_REPO),
    }

    agents = []
    for agent in roles["agents"]:
        state = classify_agent(agent, tools)
        agents.append(
            {
                "id": agent["id"],
                "number": agent["number"],
                "displayName": agent["displayName"],
                "role": agent["clearRole"],
                "lane": agent["primaryLane"],
                "state": state,
            }
        )

    urls = {
        "webBranch": "https://github.com/Samco1983/SAL0MANder-Web/tree/council/2026-08-18",
        "webPullRequest": "https://github.com/Samco1983/SAL0MANder-Web/pull/new/council/2026-08-18",
        "unityIssueHub": "https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1",
    }
    if print_urls_only:
        for label, url in urls.items():
            print(f"{label}: {url}")
        return 0

    packet = {
        "schemaVersion": "sal0-mission-control-preflight-v0",
        "createdAt": utc_now(),
        "controlLayer": roles["controlLayer"],
        "tools": tools,
        "repos": repos,
        "lock": lock_state(),
        "pause": pause_state(),
        "network": network_state(),
        "services": {name: port_state(name, port) for name, port in SERVICE_PORTS.items()},
        "disk": disk_state(ROOT),
        "agents": agents,
        "openUrls": urls,
        "nextAction": "Use this preflight before waking agents, opening browser rooms, or changing Make scenarios.",
    }
    packet_json = json.dumps(packet, indent=2, sort_keys=True)
    digest = hashlib.sha256(packet_json.encode("utf-8")).hexdigest()
    packet["hash"] = digest

    OPS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_file = OPS_DIR / f"PREFLIGHT-{stamp}-{digest[:8]}.json"
    latest_file = OPS_DIR / "PREFLIGHT-LATEST.md"
    report_file.write_text(json.dumps(packet, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    lines = [
        "# SAL0MANder Mission Control Preflight",
        "",
        f"Created: {packet['createdAt']}",
        f"Hash: `{digest}`",
        "",
        "## Control Layer",
        "",
        f"- {roles['controlLayer']['displayName']}",
        "- Coordinates; does not act as a SAL0 agent.",
        "",
        "## Local Tools",
        "",
    ]
    for name, state in tools.items():
        mark = "OK" if state["available"] else "MISSING"
        version = ""
        if state.get("version"):
            version = f" ({state['version'][0]})"
        lines.append(f"- {mark}: `{name}`{version}")
        if name == "gh" and state.get("available"):
            auth_mark = "OK" if state.get("authOk") else "NEEDS LOGIN"
            lines.append(f"  - GitHub auth: {auth_mark}")

    lines.extend(["", "## Repos", ""])
    for name, state in repos.items():
        if not state["exists"]:
            lines.append(f"- MISSING: {name}")
            continue
        clean = "clean" if not state["dirty"] else "dirty"
        lines.append(f"- {name}: `{state['branch']}` at `{state['head']}` ({clean})")

    lines.extend(["", "## Run Lock", ""])
    current_lock = packet["lock"]
    if current_lock["locked"]:
        stale = " stale" if current_lock["stale"] else ""
        lines.append(f"- LOCKED{stale}: `{current_lock['path']}`")
    else:
        lines.append(f"- OK: no active Mission Control lock at `{current_lock['path']}`")

    lines.extend(["", "## Pause Switch", ""])
    current_pause = packet["pause"]
    if current_pause["paused"]:
        lines.append(f"- PAUSED: `{current_pause['path']}` exists")
    else:
        lines.append(f"- OK: no pause file at `{current_pause['path']}`")

    lines.extend(["", "## Network", ""])
    for name, state in packet["network"].items():
        lines.append(f"- {name}: {state}")

    lines.extend(["", "## Local Services", ""])
    for service in packet["services"].values():
        mark = "OPEN" if service["open"] else "closed"
        lines.append(f"- {service['name']}: {mark} on 127.0.0.1:{service['port']}")

    lines.extend(["", "## Disk", ""])
    disk = packet["disk"]
    mark = "OK" if disk["ok"] else "LOW"
    lines.append(f"- {mark}: {disk['freeGb']} GB free at `{disk['path']}`")

    lines.extend(["", "## Agent States", ""])
    for agent in agents:
        lines.append(f"- {agent['displayName']}: {agent['state']}")

    lines.extend(["", "## Browser Links", ""])
    for label, url in urls.items():
        lines.append(f"- {label}: {url}")

    latest_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"preflight written: {report_file}")
    print(f"latest summary: {latest_file}")
    print(f"hash: {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
