#!/usr/bin/env python3
"""Durable local task broker for SAL0MANder CLI agents.

Mission Control coordinates; agents execute; an independent verifier scores.
The broker never promotes an agent's successful exit to DONE by itself.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import shutil
import sqlite3
import stat
import subprocess
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from datetime import timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = Path.home() / ".sal0mander" / "mission-control" / "tasks.sqlite3"
DEFAULT_RUNS = Path.home() / ".sal0mander" / "mission-control" / "runs"
DEFAULT_SHARED_STATE = Path.home() / ".sal0mander" / "SHARED-STATE.md"
CODEX_CANDIDATES = (
    Path("/Applications/ChatGPT.app/Contents/Resources/codex"),
    Path.home() / ".local" / "bin" / "codex",
)
CLAUDE_CANDIDATES = (Path.home() / ".local" / "bin" / "claude",)
DEFAULT_CLAUDE_TOKEN_FILE = Path.home() / ".sal0mander" / "secrets" / "claude_oauth_token"
ROLES = {"codex-cli", "claude"}
LANES = {"Coordination", "Web", "Unity/Game"}
STATUSES = {
    "QUEUED",
    "RUNNING",
    "AWAITING_VERIFICATION",
    "DONE",
    "FAILED",
    "BLOCKED",
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def shared_state_path() -> Path:
    return Path(os.environ.get("SAL0_SHARED_STATE", DEFAULT_SHARED_STATE)).expanduser()


def role_label(role: str) -> str:
    return "Codex" if role == "codex-cli" else "Claude"


def publish_event(role: str, status: str, thing: str, evidence: str) -> None:
    """Append a non-sensitive V4 possession event without overwrite races."""
    path = shared_state_path()
    if not path.exists():
        return
    safe_thing = " ".join(thing.split())[:160]
    safe_evidence = " ".join(evidence.split())[:240]
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    line = f"{stamp}  {role_label(role):<7} {status:<20} {safe_thing} — {safe_evidence}\n"
    with path.open("a", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        handle.write(line)
        handle.flush()
        os.fsync(handle.fileno())
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def resolve_binary(env_name: str, candidates: tuple[Path, ...], fallback: str) -> str:
    configured = os.environ.get(env_name)
    if configured:
        return configured
    found = shutil.which(fallback)
    if found:
        return found
    for candidate in candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return fallback


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          lane TEXT NOT NULL,
          workspace TEXT NOT NULL,
          prompt TEXT NOT NULL,
          success_check TEXT NOT NULL,
          status TEXT NOT NULL,
          timeout_seconds INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          claimed_at TEXT,
          finished_at TEXT,
          agent_session_id TEXT,
          exit_code INTEGER,
          run_dir TEXT,
          evidence TEXT,
          error TEXT
        );
        CREATE INDEX IF NOT EXISTS tasks_status_created
          ON tasks(status, created_at);
        """
    )
    return db


def task_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def validate_task(role: str, lane: str, workspace: Path, timeout: int) -> None:
    if role not in ROLES:
        raise ValueError(f"unsupported role {role!r}; choose one of {sorted(ROLES)}")
    if lane not in LANES:
        raise ValueError(f"unsupported lane {lane!r}; choose one of {sorted(LANES)}")
    if not workspace.is_absolute() or not workspace.is_dir():
        raise ValueError("workspace must be an existing absolute directory")
    if lane == "Web" and workspace.resolve() != ROOT.resolve():
        raise ValueError("Web tasks must use the SAL0MANder-Web workspace")
    if lane == "Unity/Game" and role == "claude":
        raise ValueError("Claude is not allowed to execute Unity/Game tasks")
    if timeout < 30 or timeout > 3600:
        raise ValueError("timeout must be between 30 and 3600 seconds")


def enqueue(db: sqlite3.Connection, args: argparse.Namespace) -> dict[str, Any]:
    workspace = Path(args.workspace).expanduser().resolve()
    validate_task(args.role, args.lane, workspace, args.timeout)
    prompt = Path(args.prompt_file).read_text(encoding="utf-8") if args.prompt_file else args.prompt
    if not prompt or len(prompt.strip()) < 10:
        raise ValueError("prompt must contain at least 10 characters")
    if not args.success_check or len(args.success_check.strip()) < 8:
        raise ValueError("success-check must be falsifiable and at least 8 characters")
    task_id = args.id or str(uuid.uuid4())
    created = now()
    db.execute(
        """INSERT INTO tasks
           (id, role, lane, workspace, prompt, success_check, status,
            timeout_seconds, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?)""",
        (task_id, args.role, args.lane, str(workspace), prompt.strip(),
         args.success_check.strip(), args.timeout, created),
    )
    db.commit()
    publish_event(
        args.role,
        "NEXT-PASS",
        f"task {task_id[:8]} queued in {args.lane}",
        "SQLite broker accepted one bounded task",
    )
    return task_dict(db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())


def claim_next(db: sqlite3.Connection, role: str | None) -> dict[str, Any] | None:
    db.execute("BEGIN IMMEDIATE")
    query = "SELECT * FROM tasks WHERE status = 'QUEUED'"
    params: tuple[Any, ...] = ()
    if role:
        query += " AND role = ?"
        params = (role,)
    query += " ORDER BY created_at, id LIMIT 1"
    row = db.execute(query, params).fetchone()
    if row is None:
        db.commit()
        return None
    claimed = now()
    updated = db.execute(
        """UPDATE tasks SET status = 'RUNNING', claimed_at = ?, attempts = attempts + 1
           WHERE id = ? AND status = 'QUEUED'""",
        (claimed, row["id"]),
    )
    if updated.rowcount != 1:
        db.rollback()
        return None
    db.commit()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).strftime("%Y-%m-%dT%H:%MZ")
    publish_event(
        row["role"],
        f"CLAIMED until {expires}",
        f"task {row['id'][:8]} in {row['lane']}",
        "atomic SQLite claim; agent dispatch starting",
    )
    return task_dict(db.execute("SELECT * FROM tasks WHERE id = ?", (row["id"],)).fetchone())


def agent_prompt(task: dict[str, Any]) -> str:
    return f"""SAL0MANder Mission Control task {task['id']}

Role: {task['role']}
Lane: {task['lane']}
Workspace: {task['workspace']}

Task:
{task['prompt']}

Independent success check (you do not grade this):
{task['success_check']}

Rules:
- Work only in the stated workspace and lane.
- Do not touch secrets, auth files, tokens, or unrelated repositories.
- Do not use destructive git commands.
- Report exact files changed, commands run, exit codes, and blockers.
- Your exit code can only move this task to AWAITING_VERIFICATION, never DONE.
"""


@dataclass
class AgentResult:
    command: list[str]
    exit_code: int
    stdout: str
    stderr: str
    session_id: str | None


def parse_session_id(role: str, stdout: str) -> str | None:
    for line in stdout.splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(value, dict):
            continue
        if role == "claude" and isinstance(value.get("session_id"), str):
            return value["session_id"]
        if role == "codex-cli":
            candidate = value.get("thread_id") or value.get("session_id")
            if isinstance(candidate, str):
                return candidate
            payload = value.get("thread")
            if isinstance(payload, dict) and isinstance(payload.get("id"), str):
                return payload["id"]
    return None


def invoke(task: dict[str, Any], dry_run: bool = False) -> AgentResult:
    workspace = task["workspace"]
    prompt = agent_prompt(task)
    if task["role"] == "codex-cli":
        binary = resolve_binary("SAL0_CODEX_BIN", CODEX_CANDIDATES, "codex")
        command = [binary, "exec", "-C", workspace, "-s", "workspace-write",
                   "--approve-for-me", "--json", prompt]
    else:
        binary = resolve_binary("SAL0_CLAUDE_BIN", CLAUDE_CANDIDATES, "claude")
        command = [binary, "-p", "--output-format", "json", "--permission-mode",
                   "auto", "--no-chrome", "--name", f"sal0-{task['id'][:8]}", prompt]
    if dry_run:
        return AgentResult(command, 0, "", "", None)
    environment = None
    if task["role"] == "claude":
        token_file = Path(os.environ.get("SAL0_CLAUDE_TOKEN_FILE", DEFAULT_CLAUDE_TOKEN_FILE))
        if token_file.is_file():
            if stat.S_IMODE(token_file.stat().st_mode) != 0o600:
                return AgentResult(command, 78, "", "Claude token file must have mode 600", None)
            environment = os.environ.copy()
            environment["CLAUDE_CODE_OAUTH_TOKEN"] = token_file.read_text(encoding="utf-8").strip()
    try:
        completed = subprocess.run(
            command,
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=int(task["timeout_seconds"]),
            check=False,
            env=environment,
        )
        return AgentResult(
            command,
            completed.returncode,
            completed.stdout,
            completed.stderr,
            parse_session_id(task["role"], completed.stdout),
        )
    except FileNotFoundError as error:
        return AgentResult(command, 127, "", str(error), None)
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout.decode() if isinstance(error.stdout, bytes) else (error.stdout or "")
        stderr = error.stderr.decode() if isinstance(error.stderr, bytes) else (error.stderr or "")
        return AgentResult(command, 124, stdout, stderr or "agent timeout", None)


def finish_run(
    db: sqlite3.Connection,
    task: dict[str, Any],
    result: AgentResult,
    runs_dir: Path,
    dry_run: bool,
) -> dict[str, Any]:
    if dry_run:
        db.execute(
            "UPDATE tasks SET status = 'QUEUED', claimed_at = NULL, attempts = attempts - 1 WHERE id = ?",
            (task["id"],),
        )
        db.commit()
        return {"task": task["id"], "status": "DRY_RUN", "command": result.command}

    run_dir = runs_dir / task["id"] / f"attempt-{task['attempts']}"
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "stdout.txt").write_text(result.stdout, encoding="utf-8")
    (run_dir / "stderr.txt").write_text(result.stderr, encoding="utf-8")
    (run_dir / "command.json").write_text(
        json.dumps({"argv": result.command, "recordedAt": now()}, indent=2) + "\n",
        encoding="utf-8",
    )
    status = "AWAITING_VERIFICATION" if result.exit_code == 0 else "FAILED"
    db.execute(
        """UPDATE tasks SET status = ?, finished_at = ?, agent_session_id = ?,
           exit_code = ?, run_dir = ?, error = ? WHERE id = ?""",
        (status, now(), result.session_id, result.exit_code, str(run_dir),
         result.stderr[-2000:] if result.exit_code else None, task["id"]),
    )
    db.commit()
    publish_event(
        task["role"],
        "AWAITING-VERIFICATION" if result.exit_code == 0 else "BLOCKED",
        f"task {task['id'][:8]} agent run finished",
        f"exit {result.exit_code}; run evidence at {run_dir}",
    )
    return task_dict(db.execute("SELECT * FROM tasks WHERE id = ?", (task["id"],)).fetchone())


def verify(db: sqlite3.Connection, args: argparse.Namespace) -> dict[str, Any]:
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (args.id,)).fetchone()
    if row is None:
        raise ValueError(f"unknown task {args.id}")
    if row["status"] != "AWAITING_VERIFICATION":
        raise ValueError(f"task is {row['status']}, not AWAITING_VERIFICATION")
    evidence = Path(args.evidence).expanduser().resolve()
    if not evidence.is_file():
        raise ValueError("evidence must be an existing file")
    status = "DONE" if args.exit_code == 0 else "FAILED"
    db.execute(
        "UPDATE tasks SET status = ?, evidence = ?, finished_at = ?, error = ? WHERE id = ?",
        (status, str(evidence), now(), None if args.exit_code == 0 else "verification failed", args.id),
    )
    db.commit()
    publish_event(
        row["role"],
        "DONE" if args.exit_code == 0 else "BLOCKED",
        f"task {args.id[:8]} independently verified",
        f"verifier exit {args.exit_code}; evidence {evidence}",
    )
    return task_dict(db.execute("SELECT * FROM tasks WHERE id = ?", (args.id,)).fetchone())


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="SAL0MANder durable CLI agent broker")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("enqueue", help="add a bounded task")
    add.add_argument("--id")
    add.add_argument("--role", required=True, choices=sorted(ROLES))
    add.add_argument("--lane", required=True, choices=sorted(LANES))
    add.add_argument("--workspace", required=True)
    prompt = add.add_mutually_exclusive_group(required=True)
    prompt.add_argument("--prompt")
    prompt.add_argument("--prompt-file")
    add.add_argument("--success-check", required=True)
    add.add_argument("--timeout", type=int, default=1200)

    dispatch = sub.add_parser("dispatch", help="run the oldest queued task")
    dispatch.add_argument("--role", choices=sorted(ROLES))
    dispatch.add_argument("--dry-run", action="store_true")
    dispatch.add_argument("--runs-dir", default=str(DEFAULT_RUNS))

    listing = sub.add_parser("list", help="show tasks")
    listing.add_argument("--status", choices=sorted(STATUSES))

    check = sub.add_parser("verify", help="score independent evidence")
    check.add_argument("id")
    check.add_argument("--exit-code", type=int, required=True)
    check.add_argument("--evidence", required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    db = connect(Path(args.db).expanduser())
    try:
        if args.command == "enqueue":
            output: Any = enqueue(db, args)
        elif args.command == "dispatch":
            task = claim_next(db, args.role)
            if task is None:
                output = {"status": "IDLE", "reason": "no queued task"}
            else:
                output = finish_run(
                    db, task, invoke(task, args.dry_run),
                    Path(args.runs_dir).expanduser(), args.dry_run,
                )
        elif args.command == "verify":
            output = verify(db, args)
        else:
            query = "SELECT * FROM tasks"
            params: tuple[Any, ...] = ()
            if args.status:
                query += " WHERE status = ?"
                params = (args.status,)
            query += " ORDER BY created_at, id"
            output = [task_dict(row) for row in db.execute(query, params)]
        print(json.dumps(output, indent=2))
        return 0
    except (OSError, sqlite3.Error, ValueError) as error:
        print(json.dumps({"status": "ERROR", "error": str(error)}), file=sys.stderr)
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
