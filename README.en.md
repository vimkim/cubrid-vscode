# CUBRID Language for VS Code

[한국어](https://github.com/vimkim/cubrid-vscode/blob/main/README.md) | **English**

This extension provides lexical highlighting, indentation, completion, and syntax diagnostics for `.csql`. The separately installed CUBRID language server owns completion and diagnostics. The extension never executes SQL or connects to a database.

## Install the alpha

1. Download [cubrid-language-0.1.0.vsix](https://github.com/vimkim/cubrid-vscode/releases/download/v0.1.0-alpha.1/cubrid-language-0.1.0.vsix) from the [v0.1.0-alpha.1 release](https://github.com/vimkim/cubrid-vscode/releases/tag/v0.1.0-alpha.1).
2. In the editor, run **Extensions: Install from VSIX** and select the downloaded file.
3. Install Python 3.10 or later and the shared language server with its optional `lsp` dependencies. Follow the [shared engine installation guide](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md).

The extension requires VS Code 1.109.0 or later. The downloadable alpha VSIX was tested on OpenVSCode Server 1.109.5 on Linux.

The downloadable alpha asset remains unchanged. A build from current `main` is a separate artifact. See [current source and acceptance evidence](https://github.com/vimkim/cubrid-vscode/blob/main/docs/acceptance.md#current-status-2026-10-30) for the tested extension and server commits.

The [2026-10-30 hosted run](https://github.com/vimkim/cubrid-vscode/actions/runs/41010604044) passed package and Microsoft VS Code desktop 1.109.0 and stable jobs on Linux. The [workflow](https://github.com/vimkim/cubrid-vscode/blob/main/.github/workflows/ci.yml) pins the older core `2a8842c`, with a trusted workspace and no native runtime. This run does not qualify v4 native coverage or SHOW and hint authoring on Microsoft desktop. The combined current-core SHOW and hint evidence uses OpenVSCode Server 1.109.5.

The server, native worker, manifest, and runtime are installed separately. Neither the extension nor the Python wheel bundles the native assets.

To use current v4 native coverage, install the current core with its `lsp` extra and a matching v4 worker and manifest. Follow the [core installation guide](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md). Updating the extension alone does not upgrade the server or native inputs. `cubrid-language-server --version` reports `0.1.0.dev0`, which does not identify a source commit or coverage revision.

The default server command is `cubrid-language-server` on the editor host's PATH. If it is not on PATH, set `cubrid.serverPath` to its absolute path in user or remote machine settings. For strict syntax diagnostics, also set both `cubrid.parserWorker` and `cubrid.runtimePrefix` to the absolute paths of a qualified worker and its matching runtime. Replace the placeholders below with your installation paths. For a server installed in a checkout's `.venv`, use the absolute path to `.venv/bin/cubrid-language-server`.

```json
{
  "cubrid.serverPath": "/absolute/path/to/cubrid-language-server",
  "cubrid.parserWorker": "/absolute/path/to/parser-worker",
  "cubrid.runtimePrefix": "/absolute/path/to/cubrid/runtime"
}
```

If the manifest is not beside the worker as `manifest.json`, set `cubrid.workerManifest` to its absolute path in trusted user or remote machine settings.

The native pair is not needed for keyword completion. Without it, diagnostics report the missing runtime. Use trusted installations for these paths. Workspace settings cannot select executables, and the server starts only in trusted workspaces.

Generic `.sql` files keep their existing language. To opt in, add `"files.associations": {"*.sql": "cubrid"}` to user settings.

## Completion and syntax coverage

The current shared core supplies SHOW and hint completion and conservative authoring warnings. A suggestion or the absence of an authoring warning does not establish native syntax support. Native SHOW coverage is exactly `SHOW TRACE`. The v4 hint addition accepts one argument-free block `ORDERED` immediately after a top-level literal `SELECT`, within the bounded literal grammar. It does not admit FROM, joins, or other hints in that form. See the authoritative [qualified coverage](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/coverage.en.md) for the exact profile and limits.

Formatting and semantic or style linting remain future work.

## Build for development

To build a VSIX from a source checkout, run:

```sh
npm ci
npm run package
```

## Schema and commands

Set `cubrid.schemaMode` to `inherit`, `disabled`, or `path`. In path mode, set the absolute `cubrid.schemaPath`. **CUBRID: Reload Schema** shows a result for each open document. A failed reload can retain the last valid metadata and mark it stale. **CUBRID: Restart Language Server** retries a failed start. Initialization times out after 10 seconds. Correcting the server path also starts a replacement after the old process exits.

An empty diagnostic list does not certify support for all SQL. When the native runtime is missing, diagnostics report the failure and keyword completion remains available.
