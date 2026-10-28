# CUBRID Language for VS Code

This extension provides lexical highlighting, indentation, completion, and syntax diagnostics for `.csql`. The separately installed CUBRID language server owns completion and diagnostics. The extension never executes SQL or connects to a database.

## Install

Install Python 3.10 or later and the language server's LSP dependencies. See `docs/lsp.en.md` in the language tools repository. Build a VSIX here:

```sh
npm ci
npm run package
```

Install the resulting VSIX with **Extensions: Install from VSIX**. The tested editor is OpenVSCode Server 1.109.5. Microsoft VS Code desktop has not been tested.

If the server is not on PATH, set `cubrid.serverPath` to an absolute path in user or remote machine settings. For native diagnostics set both `cubrid.parserWorker` and `cubrid.runtimePrefix` to absolute paths from a trusted installation. Workspace settings cannot select executables. The server starts only in trusted workspaces.

Generic `.sql` files keep their existing language. To opt in, add `"files.associations": {"*.sql": "cubrid"}` to user settings.

## Schema and commands

Set `cubrid.schemaMode` to `inherit`, `disabled`, or `path`. In path mode, set the absolute `cubrid.schemaPath`. **CUBRID: Reload Schema** shows a result for each open document. A failed reload can retain the last valid metadata and mark it stale. **CUBRID: Restart Language Server** retries a failed start.

An empty diagnostic list does not certify support for all SQL. When the native runtime is missing, diagnostics report the failure and keyword completion remains available.
