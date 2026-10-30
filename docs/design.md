# Editor alpha client design

> Historical editor-alpha design. The baselines, paths, and acceptance statements below describe the original task. For current installation, use the [README](../README.en.md). For later core integration, hosted desktop results, and combined-core evidence, read [current status](acceptance.md#current-status-2026-10-30).

## Problem and usage

Users install a separate editor consumer and supply the existing shared language server. They open `.csql` files, accept completion edits, read syntax diagnostics, and explicitly refresh offline schema metadata. Generic `.sql` remains opt-in through editor file associations. The consumer implements no completion or parser engine.

VS Code settings select `cubrid.serverPath`, optional trusted `parserWorker`/`runtimePrefix` together, and optional metadata overrides. A `schemaMode` value of `inherit`, `disabled`, or `path` makes snapshot intent explicit. The stored path is used only in `path` mode; changing modes does not require clearing an inactive path. Commands are `cubrid.reloadSchema` and `cubrid.restart`.

Neovim uses `require('cubrid').setup(options)` from trusted user Lua. Options include `server_path`, optional native paths as a pair, and optional metadata. Omitted `schema_snapshot` inherits project metadata, `vim.NIL` disables it, and an absolute string selects a snapshot. Commands are `CubridReloadSchema` and `CubridRestart`. Built-in LSP owns synchronization and buffer edits. No nvim-lspconfig dependency is needed.

## Shape

Each editor instance owns one lazy LSP session and process. Eligible documents share it, including documents in different roots. The core resolves project metadata independently for each file. Editor overrides are instance-wide and explicit metadata paths are absolute. Folder changes must not create duplicate clients or duplicate document opens.

The session owns validated settings, client lifetime, complete configuration serialization, reload reporting, restart and disposal. Its public operations are configure, reload, restart and dispose, plus attach where the native editor requires it. Transport types stay private. A thin activation module registers the editor's events and commands. Keep the implementation in one or two deep modules rather than a wrapper per operation.

Represent native configuration as absent or configured with a complete worker/runtime pair. Represent schema intent as inherit, disabled, or path. Represent asynchronous session lifetime as explicit idle, starting, running, failed, stopping and disposed states, or use equivalent native client states without redundant booleans. One owner serializes transitions and reconciles the newest desired settings after startup. Invalid updates report errors and retain the last valid running configuration. A server path change requires restart. Explicit restart retries a failed start without an uncontrolled crash loop.

Start the server through argv with no shell and no arguments. The default executable is `cubrid-language-server` from the editor host's trusted PATH. Explicit executable/native paths must be absolute. VS Code reads trusted user/remote-machine values and proves that hostile workspace/folder values cannot select executables. Honor workspace trust for process activation while lexical language support remains usable. Neovim reads only trusted setup options. Neither consumer reads executable values from project metadata, expands workspace variables into commands, downloads native runtimes, or starts databases.

Send `{cubrid: settings}` at initialization and a complete `{settings: {cubrid: settings}}` replacement after every update. Include native fields even when only snapshot settings changed. Do not let a language-client library send an unrelated automatic configuration payload to this server. Reload sends `cubrid.reloadSchema` and reports per-document availability/stale state and failures. Do not add a validity badge based on an empty diagnostics list.

Closing a document uses the native LSP close lifecycle and clears diagnostics. Disposal uses graceful shutdown then exit through the native client, with bounded escalation only for the owned process. Observe cleanup; do not claim descendant cleanup merely because the direct child stopped.

## Engine correspondence corrections

Untitled documents have no file path. The server discovers metadata from its effective base, set by the actual initialize `rootUri` or process cwd. Capture that base in tests and document it. A home cwd does not imply that no project metadata can be discovered. Do not fabricate URIs or alter the core to enforce a different rule.

Use full synchronization and UTF-16 as advertised. Test Unicode, whole-token suffix replacement, and diagnostic positions in each editor's text model. Open a real CRLF file, capture actual wire text, apply edits, and assert disk CRLF remains on save. Neovim may normalize its buffer and LSP text to LF; report that behavior instead of claiming identical wire bytes or adding a custom transport to force CRLF.

## Synthesis decision

The base is Terra's complete instance-session design. The independent Astra judge selected it at 20/24 against the per-root alternative at 14/24. Both structural organizations were present in the completed package. The original Astra runner produced only partial direction and was stopped without a package, so there is no independent-runner consensus claim.

Grafts from the per-root alternative are acceptance cases for nested roots, root membership changes, one attachment per document, distinct file metadata, and per-document reload results. Its root-to-session coordinator and multiplied server processes are rejected because the alpha does not need independently configured editor settings per root. Apply the judge's untitled, CRLF and tested-host corrections above.

The headless host prerequisite passed on OpenVSCode Server 1.109.5 with Node v22.21.1 and headless Chromium. This is not Microsoft desktop or minimum-version proof. Neovim 0.12.5 is installed. Declare tested versions honestly and exercise any lower claimed minimum.

## Verification and tradeoffs

Package a real local VSIX and a Neovim runtime-path artifact. Install each into a fresh isolated profile and run actual editor acceptance, not a mocked editor module. Use the known shared server and qualified native worker as read-only inputs. The canonical acceptance contract is `docs/tickets/editor-alpha-contract.md`.

We accept instance-wide editor overrides in exchange for one small process owner; projects still provide per-file metadata. We accept lexical highlighting and basic indentation without promising semantic analysis or formatting. Users manage the Python server and qualified native runtime separately. The alpha remains local until publication is authorized.

The next step is a fresh implementation owner per consumer at its exact committed dispatch baseline, followed by independent installed-artifact/editor review. No additional architecture exploration is needed unless real implementation evidence invalidates this shape.
