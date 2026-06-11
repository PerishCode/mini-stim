#!/usr/bin/env bash
set -u

print() {
  printf '%s\n' "$1"
}

error() {
  printf '%s\n' "$1" >&2
}

fail() {
  error "$1"
  exit 1
}

usage() {
  print "Usage: runseal :browser <check|reset|recover> [options]"
  print ""
  print "Browser working-surface helpers for Playwright + sidecar."
  print ""
  print "Subcommands:"
  print "  check      inspect sidecar/web/session state and recommend next action"
  print "  reset      converge Playwright sessions and browser processes back to empty"
  print "  recover    restore the routine browser working surface after runtime drift"
  print ""
  print "Shared options:"
  print "  --session <name>      session name (default: mini-stim)"
  print "  --browser <name>      browser for open/recover (default: chromium)"
  print "  --url <url>           explicit target url"
  print ""
  print "Recover options:"
  print "  --restart-sidecar     force a sidecar restart before browser recovery"
  print "  --force-open          always open a fresh session instead of reload/goto recovery"
}

require_tool() {
  if command -v "$1" >/dev/null 2>&1; then
    :
  else
    fail "browser: missing required tool: $1"
  fi
}

sidecar_status_output() {
  sidecar status --config sidecar.toml
}

current_namespace() {
  sidecar_status_output | sed -n 's/^namespace: //p' | head -n 1
}

current_port() {
  local namespace
  namespace=$(current_namespace)
  if [ -z "$namespace" ]; then
    return 1
  fi
  local port_file
  port_file="$root/.tmp/sidecar/$namespace/client/web.port"
  if [ -f "$port_file" ]; then
    cat "$port_file"
  else
    return 1
  fi
}

current_url() {
  if [ -n "$explicit_url" ]; then
    print "$explicit_url"
    return 0
  fi
  local port
  port=$(current_port) || return 1
  print "http://127.0.0.1:$port"
}

web_ready() {
  local url
  url=$(current_url) || return 1
  curl -sf --output /dev/null "$url/"
}

wait_web_ready() {
  local attempt=0
  while [ "$attempt" -lt 30 ]; do
    if web_ready; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  return 1
}

session_list_json() {
  playwright-cli --json list
}

session_exists() {
  session_list_json | rg "\"name\": \"$session_name\"" -q
}

session_browser_type() {
  session_list_json | sed -n "/\"name\": \"$session_name\"/,/}/ s/.*\"browserType\": \"\\([^\"]*\\)\".*/\\1/p" | head -n 1
}

playwright_process_lines() {
  pgrep -af '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config|Google Chrome for Testing --disable-field-trial-config' || true
}

playwright_process_count() {
  local lines
  lines=$(playwright_process_lines)
  if [ -z "$lines" ]; then
    print "0"
  else
    printf '%s\n' "$lines" | wc -l | tr -d ' '
  fi
}

wait_sessions_empty() {
  local attempt=0
  while [ "$attempt" -lt 10 ]; do
    if session_list_json | rg '"browsers": \[\]' -q; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  return 1
}

wait_processes_empty() {
  local attempt=0
  while [ "$attempt" -lt 10 ]; do
    if [ "$(playwright_process_count)" = "0" ]; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  return 1
}

run_check() {
  local status_output namespace runtime_state server_state client_state port url
  local web_state session_state browser_type playwright_state recommended_action eval_output

  status_output=$(sidecar_status_output)
  namespace=$(printf '%s\n' "$status_output" | sed -n 's/^namespace: //p' | head -n 1)
  runtime_state=$(printf '%s\n' "$status_output" | sed -n 's/^runtime: \([^ ]*\).*/\1/p' | head -n 1)
  server_state=$(printf '%s\n' "$status_output" | sed -n 's/^- server: \([^ ]*\).*/\1/p' | head -n 1)
  client_state=$(printf '%s\n' "$status_output" | sed -n 's/^- client: \([^ ]*\).*/\1/p' | head -n 1)
  port=$(current_port || true)
  url=$(current_url || true)

  if web_ready; then
    web_state=ready
  else
    web_state=not-ready
  fi

  if session_exists; then
    session_state=open
    browser_type=$(session_browser_type)
    if eval_output=$(playwright-cli -s="$session_name" eval 'location.href'); then
      playwright_state=usable
    else
      playwright_state=stale
    fi
  else
    session_state=missing
    browser_type=
    playwright_state=missing
  fi

  recommended_action=none
  if [ "$web_state" != ready ] || [ "$playwright_state" = stale ] || [ "$session_state" = missing ]; then
    recommended_action=recover
  fi

  print "sidecar.namespace=${namespace:-unknown}"
  print "sidecar.runtime=${runtime_state:-unknown}"
  print "sidecar.server=${server_state:-unknown}"
  print "sidecar.client=${client_state:-unknown}"
  print "web.port=${port:-unknown}"
  print "web.url=${url:-unknown}"
  print "web.state=$web_state"
  print "playwright.session=$session_name"
  print "playwright.state=$playwright_state"
  print "playwright.browser=${browser_type:-unknown}"
  print "playwright.process_count=$(playwright_process_count)"
  print "recommended_action=$recommended_action"
}

run_reset() {
  local sessions_ok=false
  local procs_ok=false
  local remaining_sessions remaining_processes

  playwright-cli close-all >/dev/null 2>&1 || true
  if wait_sessions_empty && wait_processes_empty; then
    print "result=clean"
    print "remaining_sessions=0"
    print "remaining_processes=0"
    return 0
  fi

  playwright-cli kill-all >/dev/null 2>&1 || true

  if wait_sessions_empty; then
    sessions_ok=true
  fi
  if wait_processes_empty; then
    procs_ok=true
  fi

  remaining_sessions=$(session_list_json | sed -n 's/.*"name": "\([^"]*\)".*/\1/p' | wc -l | tr -d ' ')
  remaining_processes=$(playwright_process_count)

  if [ "$sessions_ok" = true ] && [ "$procs_ok" = true ]; then
    print "result=clean"
    print "remaining_sessions=0"
    print "remaining_processes=0"
    return 0
  fi

  print "result=partial"
  print "remaining_sessions=$remaining_sessions"
  print "remaining_processes=$remaining_processes"
  return 1
}

run_recover() {
  local url mode actual_browser
  url=$(current_url) || fail "browser: unable to resolve target url"

  if [ "$restart_sidecar" = true ]; then
    sidecar stop --config sidecar.toml >/dev/null 2>&1 || true
    sidecar start --config sidecar.toml >/dev/null 2>&1 || fail "browser: failed to start sidecar"
  fi

  wait_web_ready || fail "browser: web surface did not become ready"

  if [ "$force_open" = true ]; then
    playwright-cli -s="$session_name" open "$url" --browser="$browser_name" --headed >/dev/null 2>&1 || fail "browser: open failed"
    mode=opened
  else
    if session_exists; then
      if playwright-cli -s="$session_name" reload >/dev/null 2>&1; then
        mode=reloaded
      elif playwright-cli -s="$session_name" goto "$url" >/dev/null 2>&1; then
        mode=goto
      else
        playwright-cli -s="$session_name" open "$url" --browser="$browser_name" --headed >/dev/null 2>&1 || fail "browser: recovery open failed"
        mode=opened
      fi
    else
      playwright-cli -s="$session_name" open "$url" --browser="$browser_name" --headed >/dev/null 2>&1 || fail "browser: open failed"
      mode=opened
    fi
  fi

  playwright-cli -s="$session_name" eval 'document.title' >/dev/null 2>&1 || fail "browser: recovered session is not interactive"

  actual_browser=$(session_browser_type)
  print "result=recovered"
  print "mode=$mode"
  print "session=$session_name"
  print "browser=${actual_browser:-unknown}"
  print "url=$url"
}

root=$(git rev-parse --show-toplevel)
require_tool bash
require_tool sidecar
require_tool playwright-cli
require_tool curl
require_tool sed
require_tool rg
require_tool pgrep

if [ "$#" -lt 1 ]; then
  usage
  exit 1
fi

subcommand=$1
shift

session_name=mini-stim
browser_name=chromium
explicit_url=
restart_sidecar=false
force_open=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --session)
      if [ "$#" -lt 2 ]; then fail "missing value for --session"; fi
      session_name=$2
      shift 2
      ;;
    --session=*)
      session_name=${1#--session=}
      shift
      ;;
    --browser)
      if [ "$#" -lt 2 ]; then fail "missing value for --browser"; fi
      browser_name=$2
      shift 2
      ;;
    --browser=*)
      browser_name=${1#--browser=}
      shift
      ;;
    --url)
      if [ "$#" -lt 2 ]; then fail "missing value for --url"; fi
      explicit_url=$2
      shift 2
      ;;
    --url=*)
      explicit_url=${1#--url=}
      shift
      ;;
    --restart-sidecar)
      restart_sidecar=true
      shift
      ;;
    --force-open)
      force_open=true
      shift
      ;;
    -h|--help|help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

case "$subcommand" in
  help|-h|--help)
    usage
    ;;
  check)
    run_check
    ;;
  reset)
    run_reset
    ;;
  recover)
    run_recover
    ;;
  *)
    fail "unknown subcommand: $subcommand"
    ;;
esac
