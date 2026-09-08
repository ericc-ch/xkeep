#!/usr/bin/env bash
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(git -C "$skill_dir" rev-parse --show-toplevel)"
current_file="$repo_dir/.audit/verify-xkeep/current.env"

if [[ ! -f "$current_file" ]]; then
  echo "no verification instance has been launched" >&2
  exit 1
fi

set -a
source "$current_file"
set +a

if [[ ! "$XKEEP_VERIFY_PID" =~ ^[0-9]+$ ]] || ! kill -0 "$XKEEP_VERIFY_PID" 2>/dev/null; then
  echo "saved verification PID is not running" >&2
  exit 1
fi

command_line="$(tr '\0' ' ' <"/proc/$XKEEP_VERIFY_PID/cmdline")"
process_group="$(ps -o pgid= -p "$XKEEP_VERIFY_PID" | tr -d ' ')"
if [[ "$command_line" != *"verify-xkeep/scripts/serve.ts"* ]] ||
  [[ "$process_group" != "$XKEEP_VERIFY_LISTENER_PGID" ]]; then
  echo "saved PID does not own the verification server" >&2
  exit 1
fi

if [[ ! "$XKEEP_VERIFY_WRAPPER_PID" =~ ^[0-9]+$ ]] ||
  ! kill -0 "$XKEEP_VERIFY_WRAPPER_PID" 2>/dev/null; then
  echo "saved verification wrapper PID is not running" >&2
  exit 1
fi
wrapper_command="$(tr '\0' ' ' <"/proc/$XKEEP_VERIFY_WRAPPER_PID/cmdline")"
wrapper_group="$(ps -o pgid= -p "$XKEEP_VERIFY_WRAPPER_PID" | tr -d ' ')"
if [[ "$wrapper_command" != *"verify-xkeep/scripts/serve.ts"* ]] ||
  [[ "$wrapper_group" != "$XKEEP_VERIFY_WRAPPER_PGID" ]]; then
  echo "saved PID does not own the verification wrapper" >&2
  exit 1
fi

socket="$(ss -ltnp "sport = :$XKEEP_VERIFY_PORT")"
socket_pid="$(sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' <<<"$socket")"
if [[ -z "$socket_pid" ]]; then
  echo "no process owns port $XKEEP_VERIFY_PORT" >&2
  exit 1
fi
if [[ "$socket_pid" != "$XKEEP_VERIFY_PID" ]]; then
  echo "saved server PID does not own port $XKEEP_VERIFY_PORT" >&2
  exit 1
fi

health="$(curl --silent --fail "$XKEEP_VERIFY_URL/api/health")"
jq -e '.status == "ok"' <<<"$health" >/dev/null

if [[ ! -f "$XKEEP_VERIFY_RUN_DIR/data/xkeep.sqlite" ]]; then
  echo "isolated SQLite file is missing" >&2
  exit 1
fi

jq -n \
  --arg pid "$XKEEP_VERIFY_PID" \
  --arg url "$XKEEP_VERIFY_URL" \
  --arg runDir "$XKEEP_VERIFY_RUN_DIR" \
  --argjson health "$health" \
  '{ready: true, pid: $pid, url: $url, runDir: $runDir, health: $health}'
