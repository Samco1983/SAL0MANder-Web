#!/bin/bash
# SAL0MANder desktop automation control.
#
# This is the local Mac control surface for Mission Control. It does not edit
# Make scenarios and it does not read secrets. Install/uninstall actions are
# explicit commands so a human or approved agent can see exactly what changed.

set -uo pipefail

REPO="/Users/samuel_saldivar/Desktop/SAL0MANder-Web"
RUNTIME_REPO="$HOME/.sal0mander/runtime/SAL0MANder-Web"
LABEL="com.sal0mander.work-loop"
PLIST_SOURCE="$REPO/docs/coordination/launchd/$LABEL.plist"
PLIST_TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
PAUSE_DIR="$HOME/.sal0mander"
PAUSE_FILE="$PAUSE_DIR/PAUSE"
LOG_DIR="$HOME/.sal0mander/logs"
WRAPPER_DIR="$HOME/.sal0mander/bin"
WRAPPER="$WRAPPER_DIR/sal0-work-loop-launchd.sh"
CLAUDE_TOKEN_FILE="$HOME/.sal0mander/secrets/claude_oauth_token"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

launchd_service="gui/$(id -u)/$LABEL"

usage() {
  cat <<'EOF'
SAL0MANder desktop automation

Usage:
  bash scripts/sal0-desktop-automation.sh status
  bash scripts/sal0-desktop-automation.sh install
  bash scripts/sal0-desktop-automation.sh uninstall
  bash scripts/sal0-desktop-automation.sh run-once
  bash scripts/sal0-desktop-automation.sh pause "reason"
  bash scripts/sal0-desktop-automation.sh resume
  bash scripts/sal0-desktop-automation.sh logs

Notes:
  status    Read-only. Shows launchd, pause switch, tools, and latest logs.
  install   Copies the committed plist into ~/Library/LaunchAgents and loads it.
  uninstall Unloads and removes only the SAL0MANder work-loop plist.
  run-once  Runs the same work-loop script once from the foreground.
  pause     Stops future loop work by writing ~/.sal0mander/PAUSE.
  resume    Removes the pause file.
EOF
}

require_repo() {
  cd "$REPO" || { echo "repo not found: $REPO"; exit 1; }
}

print_status() {
  require_repo
  echo
  echo "SAL0MANder desktop automation status"
  echo "repo: $REPO"
  echo "branch: $(git branch --show-current 2>/dev/null || echo unknown)"
  echo "head: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  if [ -d "$RUNTIME_REPO/.git" ]; then
    echo "runtime repo: $RUNTIME_REPO"
    echo "runtime branch: $(git -C "$RUNTIME_REPO" branch --show-current 2>/dev/null || echo unknown)"
    echo "runtime head: $(git -C "$RUNTIME_REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  else
    echo "runtime repo: not prepared"
  fi
  echo

  if [ -f "$PLIST_TARGET" ]; then
    echo "launchd plist: installed at $PLIST_TARGET"
  else
    echo "launchd plist: not installed"
  fi

  if [ -x "$WRAPPER" ]; then
    echo "launchd wrapper: installed at $WRAPPER"
  else
    echo "launchd wrapper: missing or not executable"
  fi

  if launchctl print "$launchd_service" >/dev/null 2>&1; then
    echo "launchd job: loaded"
    launchctl print "$launchd_service" 2>/dev/null |
      grep -E 'state =|runs =|last exit code =|path =|active count =' |
      sed 's/^/  /'
  else
    echo "launchd job: not loaded"
  fi

  if [ -f "$PAUSE_FILE" ]; then
    echo "pause: ON - $(cat "$PAUSE_FILE" 2>/dev/null)"
  else
    echo "pause: off"
  fi

  if [ -f "$CLAUDE_TOKEN_FILE" ]; then
    token_mode="$(stat -f %Lp "$CLAUDE_TOKEN_FILE" 2>/dev/null || echo unknown)"
    echo "claude token file: present, mode $token_mode"
  else
    echo "claude token file: absent"
  fi

  echo
  echo "tools:"
  for tool in git gh node npm python3 claude gemini; do
    if command -v "$tool" >/dev/null 2>&1; then
      printf "  %-8s %s\n" "$tool" "$(command -v "$tool")"
    else
      printf "  %-8s MISSING\n" "$tool"
    fi
  done

  echo
  if [ -f "$LOG_DIR/work-loop.err.log" ] &&
    tail -20 "$LOG_DIR/work-loop.err.log" | grep -q "Operation not permitted"; then
    echo "latest launchd diagnosis: macOS denied the scheduled job access to the Desktop repo"
    echo
  fi

  if [ -d "$LOG_DIR" ] && ls "$LOG_DIR"/work-loop-*.log >/dev/null 2>&1; then
    latest="$(ls -t "$LOG_DIR"/work-loop-*.log | head -1)"
    echo "latest work-loop log: $latest"
    tail -8 "$latest" | sed 's/^/  /'
  else
    echo "latest work-loop log: none"
  fi
  echo
}

prepare_runtime_repo() {
  mkdir -p "$(dirname "$RUNTIME_REPO")" "$LOG_DIR"
  clone_source="$(git -C "$REPO" remote get-url origin 2>/dev/null || echo "$REPO")"
  if [ -d "$RUNTIME_REPO/.git" ]; then
    current_origin="$(git -C "$RUNTIME_REPO" remote get-url origin 2>/dev/null || echo '')"
    if [ "$current_origin" != "$clone_source" ]; then
      git -C "$RUNTIME_REPO" remote set-url origin "$clone_source"
    fi
    git -C "$RUNTIME_REPO" fetch origin
    git -C "$RUNTIME_REPO" checkout council/2026-08-18
    git -C "$RUNTIME_REPO" pull --ff-only origin council/2026-08-18
  else
    git clone "$clone_source" "$RUNTIME_REPO"
    git -C "$RUNTIME_REPO" checkout council/2026-08-18
  fi
}

install_job() {
  require_repo
  [ -f "$PLIST_SOURCE" ] || { echo "missing plist: $PLIST_SOURCE"; exit 1; }
  prepare_runtime_repo
  mkdir -p "$WRAPPER_DIR"
  cat > "$WRAPPER" <<EOF
#!/bin/bash
cd /tmp || exit 1
export SAL0_REPO="$RUNTIME_REPO"
export SAL0_LOG_DIR="$LOG_DIR"
export SAL0_LOCK="$HOME/.sal0mander/work-loop.lock"
export SAL0_CLAUDE_TOKEN_FILE="$HOME/.sal0mander/secrets/claude_oauth_token"
/bin/bash "$RUNTIME_REPO/scripts/sal0-next-task.sh" || exit \$?
exec /bin/bash "$RUNTIME_REPO/scripts/sal0-work-loop.sh" "$RUNTIME_REPO/docs/coordination/ops/CURRENT-TASK.md"
EOF
  chmod 755 "$WRAPPER"
  mkdir -p "$HOME/Library/LaunchAgents"
  cp "$PLIST_SOURCE" "$PLIST_TARGET"
  launchctl unload "$PLIST_TARGET" >/dev/null 2>&1 || true
  launchctl load "$PLIST_TARGET"
  echo "installed and loaded $LABEL"
  print_status
}

uninstall_job() {
  launchctl unload "$PLIST_TARGET" >/dev/null 2>&1 || true
  if [ -f "$PLIST_TARGET" ]; then
    rm "$PLIST_TARGET"
  fi
  if [ -f "$WRAPPER" ]; then
    rm "$WRAPPER"
  fi
  echo "uninstalled $LABEL"
  print_status
}

run_once() {
  require_repo
  export SAL0_REPO="$REPO"
  bash "$REPO/scripts/sal0-next-task.sh" || exit $?
  bash "$REPO/scripts/sal0-work-loop.sh" "$REPO/docs/coordination/ops/CURRENT-TASK.md"
}

pause_loop() {
  mkdir -p "$PAUSE_DIR"
  reason="${1:-manual pause}"
  printf '%s\n' "$reason" > "$PAUSE_FILE"
  echo "paused: $reason"
}

resume_loop() {
  if [ -f "$PAUSE_FILE" ]; then
    rm "$PAUSE_FILE"
    echo "resumed"
  else
    echo "already resumed"
  fi
}

show_logs() {
  if [ -d "$LOG_DIR" ] && ls "$LOG_DIR"/*.log >/dev/null 2>&1; then
    ls -t "$LOG_DIR"/*.log | head -8
  else
    echo "no logs"
  fi
}

case "${1:-}" in
  status) print_status ;;
  install) install_job ;;
  uninstall) uninstall_job ;;
  run-once) run_once ;;
  pause) shift; pause_loop "$*" ;;
  resume) resume_loop ;;
  logs) show_logs ;;
  ""|-h|--help|help) usage ;;
  *) echo "unknown command: $1"; usage; exit 2 ;;
esac
