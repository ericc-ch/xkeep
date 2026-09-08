#!/usr/bin/env bash
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(git -C "$skill_dir" rev-parse --show-toplevel)"
audit_dir="$repo_dir/.audit/verify-xkeep"
current_file="$audit_dir/current.env"
current_json="$audit_dir/current.json"
port="${XKEEP_VERIFY_PORT:-55337}"

if [[ -n "$(ss -H -ltn "sport = :$port")" ]]; then
  echo "port $port is already in use; choose an unused XKEEP_VERIFY_PORT" >&2
  exit 1
fi

if [[ -f "$current_file" ]]; then
  set -a
  source "$current_file"
  set +a
  if [[ "${XKEEP_VERIFY_PID:-}" =~ ^[0-9]+$ ]] && kill -0 "$XKEEP_VERIFY_PID" 2>/dev/null; then
    echo "verification instance already running with PID $XKEEP_VERIFY_PID" >&2
    exit 1
  fi
fi

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
run_dir="$audit_dir/runs/$run_id"
evidence_dir="$run_dir/evidence"
server_log="$run_dir/server.log"
mkdir -p "$run_dir/data" "$evidence_dir"

cd "$repo_dir"
nub run build

setsid env \
  XKEEP_VERIFY_PORT="$port" \
  XKEEP_VERIFY_DATA_DIR="$run_dir/data" \
  nub "$skill_dir/scripts/serve.ts" >"$server_log" 2>&1 </dev/null &
server_pid=$!
server_pgid="$(ps -o pgid= -p "$server_pid" | tr -d ' ')"
listener_pid=""
listener_pgid=""

if [[ ! "$server_pgid" =~ ^[0-9]+$ ]] || [[ "$server_pgid" != "$server_pid" ]]; then
  kill -TERM "$server_pid" 2>/dev/null || true
  echo "verification wrapper did not start in its own process group" >&2
  exit 1
fi

cleanup_failed_launch() {
  local status=$?
  trap - EXIT
  if [[ "$listener_pgid" =~ ^[0-9]+$ ]]; then
    kill -TERM -- "-$listener_pgid" 2>/dev/null || true
  fi
  kill -TERM -- "-$server_pgid" 2>/dev/null || true
  for _ in $(seq 1 30); do
    if ! kill -0 -- "-$server_pgid" 2>/dev/null &&
      { [[ ! "$listener_pgid" =~ ^[0-9]+$ ]] || ! kill -0 -- "-$listener_pgid" 2>/dev/null; }; then
      exit "$status"
    fi
    sleep 0.1
  done
  if [[ "$listener_pgid" =~ ^[0-9]+$ ]]; then
    kill -KILL -- "-$listener_pgid" 2>/dev/null || true
  fi
  kill -KILL -- "-$server_pgid" 2>/dev/null || true
  exit "$status"
}

trap cleanup_failed_launch EXIT

write_current() {
  local listener_pid="$1"
  {
    printf 'export XKEEP_VERIFY_PID=%q\n' "$listener_pid"
    printf 'export XKEEP_VERIFY_LISTENER_PGID=%q\n' "$listener_pgid"
    printf 'export XKEEP_VERIFY_WRAPPER_PID=%q\n' "$server_pid"
    printf 'export XKEEP_VERIFY_WRAPPER_PGID=%q\n' "$server_pgid"
    printf 'export XKEEP_VERIFY_PORT=%q\n' "$port"
    printf 'export XKEEP_VERIFY_URL=%q\n' "http://127.0.0.1:$port"
    printf 'export XKEEP_VERIFY_RUN_DIR=%q\n' "$run_dir"
    printf 'export XKEEP_VERIFY_EVIDENCE=%q\n' "$evidence_dir"
  } >"$current_file"
  jq -n \
    --arg pid "$listener_pid" \
    --arg listenerPgid "$listener_pgid" \
    --arg wrapperPid "$server_pid" \
    --arg wrapperPgid "$server_pgid" \
    --arg port "$port" \
    --arg url "http://127.0.0.1:$port" \
    --arg runDir "$run_dir" \
    --arg evidenceDir "$evidence_dir" \
    '{pid: $pid, listenerPgid: $listenerPgid, wrapperPid: $wrapperPid, wrapperPgid: $wrapperPgid, port: $port, url: $url, runDir: $runDir, evidenceDir: $evidenceDir}' \
    >"$current_json"
}

is_descendant_of_wrapper() {
  local current="$1"
  while [[ "$current" =~ ^[0-9]+$ ]] && [[ "$current" -gt 1 ]]; do
    if [[ "$current" == "$server_pid" ]]; then return 0; fi
    current="$(ps -o ppid= -p "$current" | tr -d ' ')"
  done
  return 1
}

for _ in $(seq 1 80); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    tail -n 80 "$server_log" >&2
    exit 1
  fi
  if curl --silent --fail "http://127.0.0.1:$port/api/health" | jq -e '.status == "ok"' >/dev/null; then
    socket="$(ss -ltnp "sport = :$port")"
    candidate_pid="$(sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' <<<"$socket")"
    if [[ -z "$candidate_pid" ]]; then
      echo "could not resolve the verification server PID" >&2
      exit 1
    fi
    listener_command="$(tr '\0' ' ' <"/proc/$candidate_pid/cmdline")"
    candidate_pgid="$(ps -o pgid= -p "$candidate_pid" | tr -d ' ')"
    if [[ "$listener_command" != *"verify-xkeep/scripts/serve.ts"* ]] ||
      [[ ! "$candidate_pgid" =~ ^[0-9]+$ ]] ||
      ! is_descendant_of_wrapper "$candidate_pid"; then
      echo "port $port is not owned by the launched verification server" >&2
      exit 1
    fi
    listener_pid="$candidate_pid"
    listener_pgid="$candidate_pgid"
    write_current "$listener_pid"
    trap - EXIT
    echo "xkeep verification ready http://127.0.0.1:$port"
    echo "run directory $run_dir"
    exit 0
  fi
  sleep 0.25
done

tail -n 80 "$server_log" >&2
exit 1
