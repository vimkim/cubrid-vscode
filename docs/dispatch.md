# VS Code editor alpha dispatch

> Historical editor-alpha dispatch. The baselines, paths, and acceptance statements below describe the original task. For current installation, use the [README](../README.en.md). For later core integration, hosted desktop results, and combined-core evidence, read [current status](acceptance.md#current-status-2026-10-30).

Read AGENTS.md, docs/spec.md, docs/design.md, /home/vimkim/my-cubrid/CUBRID.md, and the central engine contracts before edits.
This design snapshot comes from central coordinator commit 9464411dca58562519bd47b37e8d91b86db4df3f.
The canonical acceptance contract is /home/vimkim/gh/cubrid-language-tools-editor-alpha/docs/tickets/editor-alpha-contract.md.

- Scope baseline before this dispatch is c23ff02dd15424f37d055fb1464fae49cc2dd7df.
- The coordinator supplies the full exact dispatch commit in the task prompt and central state; verify HEAD and ancestry first.
- Worktree is /home/vimkim/gh/cubrid-vscode-alpha, branch alpha/editor.
- Integration destination is local main in the sibling primary checkout. Approval is required after review.
- Own this consumer repository and /home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode/ only. Do not write central docs, the other consumer, shared host profiles or core code.
- Read-only shared engine/server is /home/vimkim/gh/cubrid-language-tools at 3bb70e492efe7bcb7de58a801281f7a088a9c39e.
- Read-only native executable is /home/vimkim/gh/cubrid-language-tools/native/parser-worker/build/parser-worker, runtime /home/vimkim/.cub/install/develop/debug.
- Reusable host tools are documented in /home/vimkim/temp/cubrid-editor-alpha-aiYISe/headless-host/RECEIPT.md. Use separate profiles and evidence directories.

Use public-interface TDD, then build/install the artifact into a fresh isolated editor profile and verify real behavior. Record acceptance criterion evidence and limitations in docs/acceptance.md. Include Korean-first README with an English companion and practical local installation steps.
Use one fresh implementer for this bounded ticket, no additional agents. Local task commits are authorized. Do not integrate, push, publish, deploy, edit real user settings or alter native build/runtime inputs.
Return the committed tip, exact commands/checks, artifact paths, process cleanup evidence and remaining limitations.
