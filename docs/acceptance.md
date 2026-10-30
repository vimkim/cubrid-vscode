# Editor alpha acceptance

## Binary prerequisite warnings, V631, 2026-10-30

Ticket V631 starts from `053d42b806abcf8244fc34796757daed39e33590` in the isolated `fix/missing-binary-warnings` worktree. Its read-only core input is `ad9d9434f6f8d74b8c44d9cadba0faf2362e6606`, installed with the optional LSP dependencies into a disposable virtual environment. No user editor profile or native input was changed.

Missing or non-executable language servers now produce a warning that starts with "Install cubrid-language-server". The warning includes the configured path, the GitHub installation guide, `cubrid.serverPath`, and Restart guidance. Missing native configuration, worker executables, runtime directories, and manifests produce advisory warnings in the notification UI and `CUBRID` output. These warnings state that strict diagnostics are unavailable and keyword completion can continue. Repeated document opens, schema changes, and Restart do not repeat an unchanged warning. Corrected settings recover without an automatic retry loop. Other startup, protocol, runtime, and malformed-setting failures retain their existing error handling.

The evidence directory is `/home/vimkim/temp/cubrid-vscode-warnings-8311jC`. `failing-before/result.json` records the installed baseline failing the new public UI check because a missing server produced an error notification without installation guidance. `notifications-missing-server.json` and its screenshot record the actual notification. The final installed VSIX passed these cases:

| Receipt directory | Observed behavior |
| --- | --- |
| `accepted-warnings` | Warning severity and installation URL for missing server, absent native configuration, missing worker, non-executable worker, missing manifest, missing runtime, and non-executable server. Completion continues through native failures. Document, schema, and Restart changes suppress duplicates. Corrected native inputs produce a real `CUBRID-S1001` syntax diagnostic. Server recovery leaves exactly one server. |
| `startup-rapid-wide` | Rapid settings and Restart changes retain the latest native pair and profile, return completion and native diagnostics, retire the old child before one successor launches, and leave one owned server. |
| `startup-timeout-race-wide` | Correcting the path during termination of a timed-out initializer starts one successor after the old child exits. Completion and missing-native diagnostics recover. |
| `startup-dispose` | Disposal during initialization observes the owned child exit. |
| `untrusted` | An invalid trusted server setting and explicit Restart launch no child and show no CUBRID notification before workspace trust. |

The real host is OpenVSCode Server 1.109.5 with Node v22.21.1 and headless Chromium 151.0.7922.34 on Linux. The warning test uses browser notification DOM severity and text, screenshots, real editor completion and diagnostic APIs, and the real CUBRID output log. It does not replace the editor's warning API. `warning-output.json` authenticates seven warning lines with installation and Restart guidance. The startup process receipts include parent PIDs and full commands. Earlier startup probes exposed command truncation in `ps`; `ps -ww` preserves the existing one-child assertion. `process-check.json` records observed owned PIDs absent after host shutdown.

`npm test` passes all 15 checks. `npm audit --omit=dev` reports zero vulnerabilities. `npm run package` produces a 326-file VSIX. `vsix-inventory.json` verifies compiled extension/settings/prerequisite code and bilingual README bytes against the package, and excludes source, tests, and evidence. The copied artifact is `cubrid-language-0.1.0.vsix`, SHA-256 `d7b0b915b2bb3cd8e625cfd42e3704061f7d3fde3f5e27441d83d52589d9676c`. The build uses Node v25.8.0 and TypeScript 5.9.3. Packaging retains the existing missing-repository and unbundled-file warnings.

To rerun the warning case from this checkout, use a new disposable output path:

```sh
source /home/vimkim/temp/cubrid-vscode-warnings-8311jC/env.sh
export CUBRID_CASE=binary-warnings
export CUBRID_PROBE_DIR=/absolute/new/disposable-output
test/host/run.sh
```

For the startup cases, set `CUBRID_REAL_SERVER` to the disposable installed server, `CUBRID_SERVER` to `$PWD/test/host/unresponsive-server.py`, and `CUBRID_RECOVERY_SERVER` to `$PWD/test/host/recovery-server.py`. Set `CUBRID_CASE` to `startup-rapid`, `startup-timeout-race`, or `startup-dispose`. Each run requires a fresh output directory. The worker input is `/home/vimkim/temp/cubrid-followup-execution-6_7fcyif/native/qualified-build/parser-worker`, with its adjacent v4 manifest and runtime `/home/vimkim/.cub/install/develop/debug`.

This ticket does not rerun Microsoft desktop, Windows, macOS, minimum-version, or full alpha qualification. Native filesystem checks establish availability only; the core still owns manifest identity, runtime integrity, and syntax qualification. Partial native pairs remain invalid settings and retain the last valid configuration. No downloads, automatic installation, database tools, browser launch, profile installation, integration, push, or publication occurred. The historical downloadable alpha is unchanged.

## Current status, 2026-10-30

The current source baseline is extension commit `521fde16e511419322e380d26707eb360a257506`, paired locally with core commit `057e41b0c02d85d09905301f6bfccbb7ed0b8965`. The core includes the initialize conversion fix discussed in the historical record below. Install the core and its optional LSP dependencies separately using the [installation guide](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md).

The downloadable `v0.1.0-alpha.1` VSIX is unchanged. Its receipt does not qualify a new build from `main`. The evidence below distinguishes two source-build checks:

| Check | Inputs and result | Limits |
| --- | --- | --- |
| Hosted Microsoft desktop | [Run 41010604044](https://github.com/vimkim/cubrid-vscode/actions/runs/41010604044) passed package, desktop 1.109.0, and stable jobs for extension `521fde1`. The workflow pins core `2a8842c45c4fb219e322afd731c27937a107324f`. | Trusted Linux workspace without native inputs. This does not qualify v4 native syntax or SHOW and hint authoring on Microsoft desktop. |
| Combined-core OpenVSCode | Extension `521fde1`, core `057e41b`, and a copied v4 worker passed the SHOW and hint case on OpenVSCode Server 1.109.5, Node 22.21.1, and Chromium 151.0.7922.34. | Focused completion and warning checks in an isolated trusted Linux workspace. This is not a desktop or full alpha-suite rerun. |

The combined evidence is under `/home/vimkim/temp/cubrid-followup-execution-6_7fcyif/combined`. `host/result.json` records successful SHOW and hint insertion with original UTF-16 ranges and saved CRLF text, warning updates, profile suppression, comment and string exclusions, and retained native unsupported and missing-runtime diagnostics. `installed-checks.json` records 19 source and installed Python file hashes, wheel SHA-256 `2c1168ec868fbf8e383f01b9e700608810dc8b8a0d949e5d6d3de7517661223b`, worker SHA-256 `c2b89a8f7d539934f0b68cf2af66199d3889baa541859d30809cca9c91ccabd3`, and manifest SHA-256 `c93879150d6ecb4a62414876f097b029e2bec06725292bbe6673133c46bb7efc`. The hosted summary is `integration-20261030/vscode-ci.json` beside that directory.

The core's native revision is `bounded-query-dml-schema-engineer-ordered-v4` for profile `cubrid-11.5.0.2704-cc94778` on Linux x86-64. Current core and native inputs must match. Existing installations are not upgraded by these tests or by installing a new extension. The package version `0.1.0.dev0` alone does not establish the core commit or native revision.

SHOW and hint completion and conservative authoring warnings cover more forms than native validity. Native SHOW remains exactly `SHOW TRACE`. The v4 addition admits one argument-free block `ORDERED` immediately after a top-level literal `SELECT`, with no FROM, joins, or other hints in that form. The core [coverage reference](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/coverage.en.md) owns the exact grammar and qualification limits. The older eight-environment distribution matrix was not rerun for v4.

## Historical alpha baseline

The remaining sections retain their original receipts and reproduction inputs. Statements about untested desktop versions, provisional core integration, and local publication scope apply at their recorded stage. Use the dated status above for the later evidence.

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

## Startup retirement repair

The repair is based on `805416ea248e495ab5fd04e0adf0d139e9280fa3`. The source file `src/extension.ts` has SHA-256 `70fb19847925673ef0657b91ceae4d03640001292ed9113ae308c1cb8b8c4045`. The installed VSIX is `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-retirement/cubrid-language-0.1.0.vsix` and has SHA-256 `621a757ddce1c33b7e9c624d312e66e4faddf21cbca11969720154f358b5f39b`. The artifact was built after the README and source changes. The fixed server, native worker, and runtime were the read-only inputs named above.

The pre-fix real-host result is `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-startup/red2/result.json`. Restart did not settle in 10 seconds and the original child remained alive. The passing receipt is `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-retirement/accepted-startup/result.json`. Restart settled, the original child had exited before the successor launched, and the successor supplied `SELECT` completion and `CUBRID-T1001` diagnostics.

The SDK probe is `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-retirement/sdk4/result.json`. Its source is in the adjacent `sdk-scratch` directory. It exercised the pinned `vscode-languageclient` 9.0.1 in the real extension host with a hanging initializer, an inherited-open-pipe response, and an initializer that registered features before retirement. After child exit, closed streams, and start settlement, completion, execute-command, did-open, did-change, and did-close feature states had no registrations. The old command was absent. Each healthy successor registered those features, returned its own completion and command result, and received document synchronization. In the late case the old command and all five feature registrations were active before retirement.

Public `dispose()` rejected with `startFailed` in the hanging and inherited-pipe cases. It rejected with a destroyed-stream write in the late case. These are classified only after the retirement postconditions. The pinned SDK's connection-close path clears features, listeners, and diagnostics before entering its failed or stopped state. Other disposal errors fail closed. The probe does not establish forced descendant cleanup.

The final artifact passed these isolated installed-host cases under `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-retirement`:

- `accepted-startup` and `accepted-startup-auto` cover corrected path with and without Restart. `accepted-startup-rapid` covers invalid-setting retention, rapid valid changes, repeated Restart, the latest native pair and profile, and native diagnostics.
- `accepted-startup-timeout` covers the 10-second startup deadline, actionable output, and no retry loop. `accepted-startup-timeout-race` corrects the path while a TERM-resistant child is still being retired. `deterministic-startup-timeout-race` repeats it after observing the TERM signal. `accepted-startup-term`, `accepted-startup-late`, and `accepted-startup-dispose` cover escalation, a late initialize response, and disposal during startup.
- The recovery launcher records the old PID's absence at successor launch and exactly one successor. `process-check.json` records the observed startup PIDs absent after the tests. This does not prove cleanup of arbitrary descendants after forced termination.
- `accepted-full`, `accepted-trace`, `accepted-roots2`, `accepted-untrusted`, `accepted-missing`, `accepted-invalid`, `accepted-crash`, `accepted-workers`, and `accepted-untitled` cover the existing installed alpha, wire, roots, trust, error, crash, worker cleanup, and document cases. The `wire-summary.json` files record the passing wire checks. The live-worker case observed the worker alive before normal Restart and absent afterwards.

Run `npm ci`, `npm test`, `npm audit --omit=dev`, and `npm run package` for the build and checks. The unit suite passed four tests and the production audit reported zero vulnerabilities. For the installed recovery cases, use the host, Playwright, Chromium, worker, and runtime exports in the reproduction section above, then run each case in a new output directory:

```sh
export CUBRID_REAL_SERVER=/home/vimkim/temp/cubrid-lsp-enums-venv/bin/cubrid-language-server
export CUBRID_SERVER="$PWD/test/host/unresponsive-server.py"
export CUBRID_RECOVERY_SERVER="$PWD/test/host/recovery-server.py"
export CUBRID_PROBE_DIR=/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-retirement/new-startup
export CUBRID_CASE=startup
test/host/run.sh
```

Use `startup-auto`, `startup-rapid`, `startup-timeout`, `startup-timeout-race`, `startup-term`, `startup-late`, or `startup-dispose` for the other cases. Each needs a fresh `CUBRID_PROBE_DIR`. For the full alpha cases use the fixed server directly, or `test/host/trace-server.py` with `CUBRID_REAL_SERVER` for wire capture. Run `python3 test/host/check-wire.py "$CUBRID_PROBE_DIR"` for the full trace and add `--roots` for the two-root trace. The tests used OpenVSCode Server 1.109.5, Node v22.21.1 in its extension host, and headless Chromium 151.0.7922.34. Microsoft VS Code desktop and version 1.109.0 remain untested.

## Desktop CI preparation, 2026-10-29

The desktop workflow builds one VSIX and transfers it with a required provenance file to independent Microsoft desktop `1.109.0` and `stable` jobs. This implementation is pending hosted qualification. No Electron or desktop process ran on the development host. The historical alpha package remains unchanged.

The package job uses Node 22, the committed npm lockfile, and the existing build. The controller pins `@vscode/test-electron` to 3.1.0. The product retains `vscode-languageclient` 9.0.1. Each consumer builds core commit `2a8842c45c4fb219e322afd731c27937a107324f` with Python 3.10. `test/desktop/build-requirements.txt` pins pip, setuptools, and wheel. `pip wheel --no-build-isolation` uses those installed build tools.

The provenance file records the clean source and workflow commit, lockfile hash, build tools, VSIX hash, source file hashes, and every packaged runtime file. `vsce` renames `README.md` to `readme.md` and `LICENSE` to `LICENSE.txt`. The checker verifies their bytes against the original files. Installation must preserve the complete runtime file inventory and every runtime hash. The hosted boundary repair below records the additional installed `.vsixmanifest`. For `package.json`, only the installation-added `__metadata` field and JSON formatting can differ. Microsoft's [1.109.0 manifest scanner](https://github.com/microsoft/vscode/blob/1.109.0/src/vs/platform/extensionManagement/common/extensionsScannerService.ts#L283) performs that transformation.

The controller installs the VSIX into a fresh profile for each case. A separate probe calls public editor APIs and commands through the official SDK test entry point. The probe rejects on failure. Missing receipts, missing observations, package mismatches, nonzero SDK exits, surviving recorded server processes, and timeouts fail the run. Download, installation, and desktop calls have supervised subprocess deadlines. Timeout receipts record failure before TERM and KILL cleanup.

Both desktop versions must complete all four cases:

- `portable` checks CSQL registration, opt-in SQL association, real `CUBRID-T1001`, actual suggestion acceptance with Korean text, emoji, and CRLF, schema replacement and recovery, inherited project metadata, and two public restarts.
- `hanging-replace` replaces a hanging initializer through global settings and public Restart, then checks real completion and missing-runtime diagnostics.
- `hanging-term` checks the same recovery after the initializer resists TERM.
- `hanging-timeout` observes startup expiry without an automatic successor, then checks recovery.

The process launcher records PID, Linux process start time, parent PID, executable, and predecessor liveness before `exec`. It takes inputs from the inherited case environment because the product accepts only an executable path. The controller observes process exit after the editor closes. Test cleanup cannot turn a leak into a pass. This evidence covers recorded direct server processes, not arbitrary descendants.

The SDK disables workspace trust for its test launch. The probe requires a trusted workspace, empty native settings, and a real `CUBRID-T1001` diagnostic. These jobs do not qualify untrusted desktop behavior, native syntax success, TextMate screenshots, or other platforms. `stable` requires a fresh Microsoft release-list response and an exact-version download. The CLI and probe must agree on the observed editor version and Microsoft product identity.

Local preparation evidence is under `/home/vimkim/temp/cubrid-editor-hardening-c57_w98j/evidence/vscode-ci`. The initial four control tests failed before implementation. `npm test` now passes 11 tests, including package tamper rejection, missing and failed receipts, a TERM-resistant process group, and executable-only launch recording. Node syntax checks, Python compilation, workflow validation, and the VSIX source comparison are local checks. They are not desktop qualification.

To reproduce package verification from a clean checkout, use an output directory outside the repository:

```sh
npm ci
npm test
npm audit --omit=dev
npm run package -- --out /absolute/output/cubrid-language.vsix
python3 test/desktop/package.py create --vsix /absolute/output/cubrid-language.vsix
python3 test/desktop/package.py verify --vsix /absolute/output/cubrid-language.vsix --source-sha "$(git rev-parse HEAD)"
```

Run `.github/workflows/ci.yml` only after approved integration. Its desktop command requires a GitHub-hosted Linux runner. Package and desktop artifacts upload on success and failure. They retain workflow identity, package provenance, server build evidence, installation output, editor logs, probe and controller receipts, saved completion bytes, and process observations. The workflow does not publish a Marketplace package or replace a release asset.

## Hosted desktop boundary repair, 2026-10-29

Hosted run `40834804424` failed before either desktop probe ran. The stable release list selected `1.144.0`, but older entries contained release and preview suffixes. The controller now validates the first selected version and keeps the full response and lookup receipt. Empty lists, invalid selected versions, malformed responses, and unsuccessful HTTP responses still fail.

The 1.109.0 installer placed the archive-root `extension.vsixmanifest` into the installed directory as `.vsixmanifest`. Its SHA-256 was `5d112690ec0df565d08bed015ba3054284ebd48915c4b3f0390b737fc14e4c49` and its bytes matched the VSIX entry. The installed inventory now requires that exact file and checks its hash against the authenticated VSIX. It continues to reject missing files, unexpected files, symlinks, changed runtime bytes, and changed manifest fields. Microsoft's [1.109.0 extractor](https://github.com/microsoft/vscode/blob/1.109.0/src/vs/base/node/zip.ts#L202) and [1.144.0 extractor](https://github.com/microsoft/vscode/blob/1.144.0/src/vs/base/node/zip.ts#L367) both use the extension path as a prefix match.

The saved response and installed artifact were replayed against the controller and package checker. Both boundaries failed before the repair and passed afterward. The stable replay stops at the local hosted-only guard after recording the selected version. Local fixture tests cover invalid selected releases, HTTP failure, malformed JSON, missing and mismatched `.vsixmanifest`, unknown files, symlinks, runtime changes, and manifest changes. These checks do not establish desktop qualification. Run the hosted workflow to exercise both desktop versions and their probes.

## Hosted desktop qualification, 2026-10-29

[Run 40836324028](https://github.com/vimkim/cubrid-vscode/actions/runs/40836324028) passed the package job and both desktop jobs at source commit `eb4cc3266a801b431be9bd21f417cd4e2fec2c1b`. The CI-built VSIX has SHA-256 `4113089fce0aed92a9c77f3674bf81f597afbb35a0bd7531f97c5deccca992f4`. This run qualifies that source build. The downloadable `v0.1.0-alpha.1` asset remains unchanged and retains its OpenVSCode evidence above.

Both Linux x64 desktop jobs passed `portable`, `hanging-replace`, `hanging-term`, and `hanging-timeout`. The CLI and probe identify Microsoft Visual Studio Code 1.109.0 and 1.144.0. The latter was the stable version selected for this run. All eight probe receipts record a trusted workspace, empty native settings, `SELECT` completion, and real `CUBRID-T1001` diagnostics.

The evidence is under `/home/vimkim/temp/cubrid-editor-hardening-c57_w98j/integration-vscode/run-40836324028`. It includes the package provenance, both `desktop/controller.json` files, editor identities, and each case's `probe.json`. The [workflow](https://github.com/vimkim/cubrid-vscode/blob/main/.github/workflows/ci.yml) records the current matrix. This desktop evidence does not qualify native syntax success, untrusted workspaces, or other platforms. No desktop process ran on the development host.

## SHOW and hint host acceptance, 2026-10-29

The focused case uses extension baseline `afd459b7eb9a9a42164f0aa9ed191967c56a6e95` and clean engine commit `49479b2d0a6cf39f71498834215346d8381b82c5`. It runs the packaged extension against an isolated installed wheel in OpenVSCode Server 1.109.5. The [ticket report](tickets/reports/show-hint-host.md) records hashes, original UTF-16 ranges, results, and limitations. The output is `/home/vimkim/temp/cubrid-followup-execution-6_7fcyif/vscode/final/result.json`.

To rebuild the engine in an isolated directory from the specified commit, use a new absolute directory and the clean engine checkout:

```sh
export EVIDENCE=/absolute/new/evidence-directory
export ENGINE=/home/vimkim/gh/cubrid-language-tools
mkdir -p "$EVIDENCE/engine-source"
git -C "$ENGINE" archive 49479b2d0a6cf39f71498834215346d8381b82c5 | tar -x -C "$EVIDENCE/engine-source"
python3 -m venv "$EVIDENCE/venv"
"$EVIDENCE/venv/bin/python" -m pip wheel --wheel-dir "$EVIDENCE/wheels" "$EVIDENCE/engine-source[lsp]"
"$EVIDENCE/venv/bin/pip" install --no-index --find-links "$EVIDENCE/wheels" 'cubrid-language-tools[lsp]'
```

Build the VSIX with `npm ci`, `npm test`, and `npm run package`. Set `CUBRID_HOST`, `CUBRID_PLAYWRIGHT`, `CUBRID_CHROMIUM`, `CUBRID_WORKER`, and `CUBRID_RUNTIME` to the prerequisites in the reproduction section above. Point the server at the isolated wheel and select a fresh output path:

```sh
export CUBRID_SERVER="$EVIDENCE/venv/bin/cubrid-language-server"
export CUBRID_CASE=show-hint
export CUBRID_PROBE_DIR="$EVIDENCE/host-run"
test/host/run.sh
```

The probe drives the editor's suggestion commands and waits for diagnostic updates. It checks both insertion ranges and saved CRLF text, the four authoring warning codes and positions, warning removal and reappearance, profile suppression, ordinary comment and string exclusions, and native tool and unsupported results. The probe does not certify native syntax coverage. It does not launch desktop Electron or use a personal editor profile.
