# VS Code editor alpha

Build a locally installable VSIX that uses the existing CUBRID stdio server.
Engine baseline is `3bb70e492efe7bcb7de58a801281f7a088a9c39e` in `/home/vimkim/gh/cubrid-language-tools`.
The canonical task acceptance is `/home/vimkim/gh/cubrid-language-tools-editor-alpha/docs/tickets/editor-alpha-contract.md`.
The coordinator supplies a selected design and exact dispatch commit before implementation.

The extension owns language registration, `.csql` association, opt-in `.sql`, TextMate highlighting, indentation, trusted editor settings, client lifecycle, schema reload UI, packaging and editor tests.
The engine owns every completion and diagnostic decision.
Pass complete effective settings replacements and preserve original UTF-16 edit positions.
Do not assume an empty diagnostics list certifies SQL outside qualified native coverage.

Prove behavior through a real remote Node extension host and headless browser.
The reusable host prerequisite lives at `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/headless-host/RECEIPT.md`.
OpenVSCode Server 1.109.5 and Node v22.21.1 were exercised; the Microsoft-branded desktop application has not been exercised.
Keep the extension's minimum version declaration honest about tested versions.

Test the installed VSIX in a fresh profile, including workspace trust, attempted workspace executable overrides, missing server/runtime, complete settings updates, schema reload failure/recovery, Unicode/CRLF edits, native diagnostics, close clearing, multiple documents/roots, restart and owned process cleanup.
Record reusable commands, screenshots, exact versions, package inventory, checks, baseline and remaining limitations in `docs/acceptance.md`.
Keep product profiles and all native source/build/runtime inputs unchanged.
Local source and artifact creation is authorized. Integration and publication retain their approval gates.
