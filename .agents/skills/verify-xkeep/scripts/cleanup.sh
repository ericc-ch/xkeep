#!/usr/bin/env bash
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(git -C "$skill_dir" rev-parse --show-toplevel)"
current_file="$repo_dir/.audit/verify-xkeep/current.env"

if [[ ! -f "$current_file" ]]; then
  echo "no verification instance to stop"
  exit 0
fi

set -a
source "$current_file"
set +a

if [[ ! "${XKEEP_VERIFY_LISTENER_PGID:-}" =~ ^[0-9]+$ ]] ||
  [[ ! "${XKEEP_VERIFY_WRAPPER_PGID:-}" =~ ^[0-9]+$ ]]; then
  echo "saved verification process groups are invalid" >&2
  exit 1
fi

validate_pid() {
  local pid="$1"
  local label="$2"
  local expected_group="$3"
  if [[ ! "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi
  local command_line
  local process_group
  command_line="$(tr '\0' ' ' <"/proc/$pid/cmdline")"
  process_group="$(ps -o pgid= -p "$pid" | tr -d ' ')"
  if [[ "$command_line" != *"verify-xkeep/scripts/serve.ts"* ]] ||
    [[ "$process_group" != "$expected_group" ]]; then
    echo "refusing to stop PID $pid because it is not the saved verification $label" >&2
    exit 1
  fi
  return 0
}

listener_running=false
wrapper_running=false
if validate_pid "$XKEEP_VERIFY_PID" "server" "$XKEEP_VERIFY_LISTENER_PGID"; then
  listener_running=true
fi
if validate_pid "$XKEEP_VERIFY_WRAPPER_PID" "wrapper" "$XKEEP_VERIFY_WRAPPER_PGID"; then
  wrapper_running=true
fi

if [[ "$listener_running" == false && "$wrapper_running" == false ]]; then
  if [[ -n "$(ss -H -ltn "sport = :$XKEEP_VERIFY_PORT")" ]]; then
    echo "saved processes stopped, but port $XKEEP_VERIFY_PORT is still in use" >&2
    exit 1
  fi
  touch "$XKEEP_VERIFY_RUN_DIR/stopped"
  echo "verification instance is already stopped"
  echo "evidence kept at $XKEEP_VERIFY_EVIDENCE"
  exit 0
fi

if [[ "$listener_running" == true ]]; then
  kill -TERM -- "-$XKEEP_VERIFY_LISTENER_PGID" 2>/dev/null || true
fi
if [[ "$wrapper_running" == true ]]; then
  kill -TERM -- "-$XKEEP_VERIFY_WRAPPER_PGID" 2>/dev/null || true
fi
for _ in $(seq 1 50); do
  if ! kill -0 -- "-$XKEEP_VERIFY_LISTENER_PGID" 2>/dev/null &&
    ! kill -0 -- "-$XKEEP_VERIFY_WRAPPER_PGID" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

if kill -0 -- "-$XKEEP_VERIFY_LISTENER_PGID" 2>/dev/null ||
  kill -0 -- "-$XKEEP_VERIFY_WRAPPER_PGID" 2>/dev/null; then
  kill -KILL -- "-$XKEEP_VERIFY_LISTENER_PGID" 2>/dev/null || true
  kill -KILL -- "-$XKEEP_VERIFY_WRAPPER_PGID" 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! kill -0 -- "-$XKEEP_VERIFY_LISTENER_PGID" 2>/dev/null &&
      ! kill -0 -- "-$XKEEP_VERIFY_WRAPPER_PGID" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done
fi

if kill -0 -- "-$XKEEP_VERIFY_LISTENER_PGID" 2>/dev/null ||
  kill -0 -- "-$XKEEP_VERIFY_WRAPPER_PGID" 2>/dev/null; then
  echo "verification process groups did not stop" >&2
  exit 1
fi
if [[ -n "$(ss -H -ltn "sport = :$XKEEP_VERIFY_PORT")" ]]; then
  echo "verification port $XKEEP_VERIFY_PORT is still in use" >&2
  exit 1
fi

touch "$XKEEP_VERIFY_RUN_DIR/stopped"
echo "stopped verification process groups"
echo "evidence kept at $XKEEP_VERIFY_EVIDENCE"
