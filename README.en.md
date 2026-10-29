# CUBRID Language for VS Code

This extension provides lexical highlighting, indentation, completion, and syntax diagnostics for `.csql`. The separately installed CUBRID language server owns completion and diagnostics. The extension never executes SQL or connects to a database.

## Install the alpha

1. Download [cubrid-language-0.1.0.vsix](https://github.com/vimkim/cubrid-vscode/releases/download/v0.1.0-alpha.1/cubrid-language-0.1.0.vsix) from the [v0.1.0-alpha.1 release](https://github.com/vimkim/cubrid-vscode/releases/tag/v0.1.0-alpha.1).
2. In the editor, run **Extensions: Install from VSIX** and select the downloaded file.
3. Install Python 3.10 or later and the shared language server with its optional `lsp` dependencies. Follow the [shared engine installation guide](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md).

The extension requires VS Code 1.109.0 or later. OpenVSCode Server 1.109.5 on Linux has been tested. Microsoft VS Code desktop has not yet been verified. The server and native runtime are installed separately; the extension does not bundle them.

The default server command is `cubrid-language-server` on the editor host's PATH. If it is not on PATH, set `cubrid.serverPath` to its absolute path in user or remote machine settings. For strict syntax diagnostics, also set both `cubrid.parserWorker` and `cubrid.runtimePrefix` to the absolute paths of a qualified worker and its matching runtime. Replace the placeholders below with your installation paths. For a server installed in a checkout's `.venv`, use the absolute path to `.venv/bin/cubrid-language-server`.

```json
{
  "cubrid.serverPath": "/absolute/path/to/cubrid-language-server",
  "cubrid.parserWorker": "/absolute/path/to/parser-worker",
  "cubrid.runtimePrefix": "/absolute/path/to/cubrid/runtime"
}
```

The native pair is not needed for keyword completion. Without it, diagnostics report the missing runtime. Use trusted installations for these paths. Workspace settings cannot select executables, and the server starts only in trusted workspaces.

Generic `.sql` files keep their existing language. To opt in, add `"files.associations": {"*.sql": "cubrid"}` to user settings.

## Build for development

To build a VSIX from a source checkout, run:

```sh
npm ci
npm run package
```

## Schema and commands

Set `cubrid.schemaMode` to `inherit`, `disabled`, or `path`. In path mode, set the absolute `cubrid.schemaPath`. **CUBRID: Reload Schema** shows a result for each open document. A failed reload can retain the last valid metadata and mark it stale. **CUBRID: Restart Language Server** retries a failed start. Initialization times out after 10 seconds. Correcting the server path also starts a replacement after the old process exits.

An empty diagnostic list does not certify support for all SQL. When the native runtime is missing, diagnostics report the failure and keyword completion remains available.
