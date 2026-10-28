#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
: "${CUBRID_HOST:?Set CUBRID_HOST to the openvscode-server executable}"
: "${CUBRID_PLAYWRIGHT:?Set CUBRID_PLAYWRIGHT to the playwright module}"
: "${CUBRID_CHROMIUM:?Set CUBRID_CHROMIUM to the headless Chromium executable}"
: "${CUBRID_PROBE_DIR:?Set CUBRID_PROBE_DIR to a new disposable directory}"
: "${CUBRID_SERVER:?Set CUBRID_SERVER to the language server executable}"
: "${CUBRID_WORKER:?Set CUBRID_WORKER to the qualified parser worker}"
: "${CUBRID_RUNTIME:?Set CUBRID_RUNTIME to the qualified runtime prefix}"
for command in node python3 rg ps setsid; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
for executable in "$CUBRID_HOST" "$CUBRID_CHROMIUM" "$CUBRID_SERVER" "$CUBRID_WORKER"; do
  [[ -x "$executable" ]] || { echo "Not executable: $executable" >&2; exit 1; }
done
[[ -d "$CUBRID_RUNTIME" && -d "$CUBRID_PLAYWRIGHT" ]] || { echo 'Runtime or Playwright directory is missing' >&2; exit 1; }
[[ -f "$repo/cubrid-language-0.1.0.vsix" ]] || { echo 'Build the VSIX first with npm run package' >&2; exit 1; }
case "${CUBRID_CASE:-full}" in full|missing|untrusted|roots|roots2|workers|crash|untitled|invalid|startup) ;; *) echo 'Unknown CUBRID_CASE' >&2; exit 1 ;; esac
if [[ -e "$CUBRID_PROBE_DIR" ]]; then echo 'Probe directory already exists' >&2; exit 1; fi
mkdir -p "$CUBRID_PROBE_DIR"/{workspace,extensions,user-data,server-data,home,tmp}
root=$CUBRID_PROBE_DIR
cp -r "$repo/test/host/probe" "$root/extensions/local-test.acceptance-probe-0.0.1"
printf '%s\r\n%s\r\n%s\r\n' '-- 가😀' 'SELsuffix' 'SELECT 1;' > "$root/workspace/test.csql"
printf 'select 1;\n' > "$root/workspace/test.sql"
mkdir -p "$root/user-data/User" "$root/workspace/.vscode" "$root/workspace/nested"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({folders:[{path:"workspace"},{path:"workspace/nested"}]}))' "$root/project.code-workspace"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({"cubrid.serverPath":"/bin/false","cubrid.parserWorker":"/bin/false","cubrid.runtimePrefix":"/hostile"}))' "$root/workspace/.vscode/settings.json"
node -e 'const fs=require("fs"); fs.writeFileSync(process.argv[1],JSON.stringify({"cubrid.serverPath":process.env.CUBRID_SERVER,"security.workspace.trust.enabled":true,"telemetry.telemetryLevel":"off"}))' "$root/user-data/User/settings.json"
export HOME="$root/home" XDG_CONFIG_HOME="$root/home/config" XDG_DATA_HOME="$root/home/data" XDG_CACHE_HOME="$root/home/cache" TMPDIR="$root/tmp"
unset DISPLAY WAYLAND_DISPLAY
if [[ "${CUBRID_BASELINE:-0}" != 1 ]]; then
  "$CUBRID_HOST" --install-extension "$repo/cubrid-language-0.1.0.vsix" --extensions-dir "$root/extensions" --server-data-dir "$root/server-data" --user-data-dir "$root/user-data" --accept-server-license-terms >"$root/install.log" 2>&1
fi
: > "$root/server.log"
setsid "$CUBRID_HOST" --host 127.0.0.1 --port 0 --without-connection-token --accept-server-license-terms --telemetry-level off --server-data-dir "$root/server-data" --user-data-dir "$root/user-data" --extensions-dir "$root/extensions" --default-folder "$root/workspace" >"$root/server.log" 2>&1 &
pid=$!
cleanup() { kill -- -"$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 60); do
  port=$(sed -n 's/^Server bound to 127\.0\.0\.1:\([0-9]*\).*/\1/p' "$root/server.log" | head -1)
  if [[ -n "$port" ]]; then break; fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$root/server.log"; exit 1; fi
  sleep 1
done
if [[ -z "${port:-}" ]]; then cat "$root/server.log"; exit 1; fi
if [[ "${CUBRID_CASE:-}" == roots2 ]]; then
  location="workspace=$root/project.code-workspace"
else
  location="folder=$root/workspace"
fi
node "$repo/test/host/browser.cjs" "http://127.0.0.1:$port/?$location"
if [[ "${CUBRID_CASE:-}" == invalid ]]; then
  rg -q 'parserWorker must be a valid absolute path' "$root/user-data/logs" || { echo 'Invalid-setting error was not logged' >&2; exit 1; }
fi
if [[ "${CUBRID_CASE:-}" == crash ]]; then
  rg -q 'Language server stopped' "$root/user-data/logs" || { echo 'Crash error was not logged' >&2; exit 1; }
fi
if [[ "${CUBRID_CASE:-}" == missing ]]; then
  rg -q 'Cannot start language server.*absent-server' "$root/user-data/logs" || { echo 'Missing-server error was not logged' >&2; exit 1; }
fi
