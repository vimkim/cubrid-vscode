# CUBRID VS Code consumer

Read `/home/vimkim/my-cubrid/CUBRID.md` before CUBRID work.
The shared engine is `/home/vimkim/gh/cubrid-language-tools`; its language contracts and native inputs are read-only dependencies.
Read `docs/spec.md` and the coordinator's exact dispatch before implementation.

This project owns VS Code activation, lexical highlighting, indentation, editor settings, LSP client lifecycle, packaging, and editor tests.
Use the shared stdio server for completion and diagnostics. Never execute submitted SQL or duplicate its completion/parser implementation.
Keep `.sql` associations opt-in. Use `cubrid` as the language identity and `.csql` as the default extension.
Executable and native runtime settings come from trusted user/editor configuration. Workspace files cannot select commands.

Use one fresh-context implementer and isolated worktree per bounded ticket. Use TDD at public interfaces and verify the real editor.
This is a remote Linux host. Never launch desktop GUI programs or forwarded X11. Use headless browser/server automation.
Keep dependency/build/test outputs narrowly ignored. Preserve unrelated changes.
Commit meaningful task changes before review. Write exact acceptance evidence and limitations in `docs/acceptance.md`.
Local commits are authorized. Request approval before rebasing and integrating into `main`.
The local repository has no configured remote. Remote creation, pushes, marketplace publication, and deployment require separate authorization.
