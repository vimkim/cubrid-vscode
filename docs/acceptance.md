# Editor alpha acceptance

The consumer dispatch started at `6c7c6edefe66d1cc9f03af838b5e7f738abfc451`. The original shared server baseline is `3bb70e492efe7bcb7de58a801281f7a088a9c39e`. That baseline rejected the editor's standard initialize request because its strict converter rejected LSP enum values. The failing installed-host run is `vscode/second/result.json` and the request is `vscode/wire-in` under `/home/vimkim/temp/cubrid-editor-alpha-aiYISe`.

The passing runs use the provisional shared-core fix at `d5a571eb03d543af1438b85933fcad3aed60f9f0`, from `/home/vimkim/temp/cubrid-lsp-enums-venv/bin/cubrid-language-server`. The candidate checkout later advanced to `3efe03b49a037041fe6e667acb990fc8403c3ab0` with a report-only change. The editor requires this core fix. The original baseline does not work with this extension. Integration of the core fix remains separate.

The host was OpenVSCode Server 1.109.5. Its extension host ran Node v22.21.1. Headless Chromium was 151.0.7922.34. The build ran on Node v25.8.0 with TypeScript 5.9.3, `vscode-languageclient` 9.0.1, and `@vscode/vsce` 3.7.1. Microsoft VS Code desktop has not been tested. The declared minimum is 1.109.0, but only 1.109.5 has been exercised.

The inspected VSIX is `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode/cubrid-language-0.1.0.vsix`. Its SHA-256 is `412c19687b215ebe74af243113575f1cf05c7f46551dd15c28f4c26eef9f333a`.

## Evidence

Paths below are relative to `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode`. Each run installed the VSIX into its own profile, except the baseline run. The probe uses real VS Code commands and APIs. It does not mock the editor or server.

- `baseline/result.json` records the pre-install result. `.csql` was `plaintext` and `.sql` was `sql`. The settings tests also failed before the parser existed and pass after implementation.
- `untrusted2/result.json` records `.csql` as `cubrid`, `.sql` as `sql`, and no server child in an untrusted workspace.
- `full5/result.json` records a server completion item with the `keyword` detail and replacement range. The editor accepted it over the suffix. The saved file contains Korean, emoji, and CRLF. The same result records four-space indentation, native `CUBRID-S1001` and `CUBRID-U1002` ranges, `CUBRID-T1001` without a native runtime, schema reload, stale retention, recovery, disable, SQL opt-in, repeated restart, document close events, and cleared diagnostics. `full5/syntax.png` and `full5/syntax-tokens.json` show comment, keyword, and number coloring.
- `trace3/result.json` and `trace3/wire-summary.json` record the running editor's wire traffic. The server received the workspace directory as `rootUri` and received the original CRLF text in `didOpen`. Schema-only replacements retained the worker and runtime fields. The trace contains three shutdown-then-exit pairs and seven document close notifications. A setting changed during restart produced the expected unknown-profile diagnostic before the profile was restored.
- `roots4/result.json` records a saved two-folder workspace, removal and re-addition of its nested root, separate project snapshots, and one server child. `roots4/wire-summary.json` records both folder-change events. The wire checker found no duplicate `didOpen` without a close in either session.
- `untitled/result.json` records an untitled document using `sql` mode and receiving root-project metadata. The initialize request captured beside it identifies the actual root. Untitled documents do not have file paths, but their effective base can still supply metadata.
- `invalid/result.json` records a rejected relative worker path and a fresh native validation that retained the last valid configuration. The CUBRID output log records the settings error.
- `missing-final/result.json` and its CUBRID output log record a missing executable error followed by successful recovery. `crash/result.json` and its output log record a killed server, no automatic restart loop, and successful explicit restart. The crash test does not establish descendant cleanup.
- `workers/result.json` records the qualified parser worker alive when restart was requested. The probe then observed both the worker PID and the old server PID disappear. The input was parsed offline and was never executed. The normal restart trace separately shows shutdown and exit. No claim is made that force-killing a direct server alone cleans up descendants.

The workspace settings file attempted to override the server, parser worker, and runtime with hostile paths. The trusted user settings still selected the working server and qualified native pair in the passing runs. `trace3` observed one server process at a time and complete settings payloads. The recorded process IDs in `full5`, `trace3`, `workers`, `crash`, `roots4`, and `missing-final` were absent from `/proc` after their runs.

## Reproduce

Run `npm ci`, `npm test`, and `npm run package`. The VSIX appears at `cubrid-language-0.1.0.vsix`. `test/host/run.sh` requires Node, Python 3, `rg`, `ps`, `setsid`, a new disposable output directory, a language server, the qualified worker and runtime, OpenVSCode Server, Playwright, and headless Chromium. It checks its prerequisites and fails when the probe fails. It binds loopback, clears display variables, and uses a separate profile. It does not open a desktop browser or use the real user profile.

The local paths used for the traced run were:

```sh
export CUBRID_HOST=/home/vimkim/temp/cubrid-editor-alpha-aiYISe/headless-host/openvscode-server-v1.109.5-linux-x64/bin/openvscode-server
export CUBRID_PLAYWRIGHT=/home/vimkim/temp/cubrid-editor-alpha-aiYISe/headless-host/node_modules/playwright
export CUBRID_CHROMIUM=/home/vimkim/temp/cubrid-editor-alpha-aiYISe/headless-host/browser/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
export CUBRID_SERVER="$PWD/test/host/trace-server.py"
export CUBRID_REAL_SERVER=/home/vimkim/temp/cubrid-lsp-enums-venv/bin/cubrid-language-server
export CUBRID_WORKER=/home/vimkim/gh/cubrid-language-tools/native/parser-worker/build/parser-worker
export CUBRID_RUNTIME=/home/vimkim/.cub/install/develop/debug
export CUBRID_PROBE_DIR=/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode/new-trace
test/host/run.sh
python3 test/host/check-wire.py "$CUBRID_PROBE_DIR"
```

For the direct server, set `CUBRID_SERVER` to the fixed server executable. Set `CUBRID_CASE` to `untrusted`, `missing`, `invalid`, `crash`, `workers`, `untitled`, or `roots2` for a focused case. Omit it for the full case. Set `CUBRID_BASELINE=1` to run without installing the VSIX. Every run needs a new output directory. The browser uses headless Chromium with `--no-sandbox` for these disposable trusted test inputs.

## Package inventory and audit

The VSIX contains the language configuration, TextMate grammar, compiled extension, English and Korean instructions, Apache-2.0 license, and the production dependencies `vscode-languageclient`, `vscode-jsonrpc`, `vscode-languageserver-protocol`, `vscode-languageserver-types`, `semver`, and `balanced-match`. Run `npx vsce ls --tree` to inspect the inventory. `npm audit --omit=dev` reports no vulnerabilities. The build-only `@vscode/vsce` dependency pulls Azure authentication and `uuid` 8.3.2. The remaining moderate advisory concerns a buffer argument to UUID generation. The local VSIX build does not use Azure login, and those packages do not ship in the VSIX.
