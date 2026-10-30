# Recover from an unresponsive language-server initialize

> Historical startup-recovery work. The [acceptance record](acceptance.md#startup-retirement-repair) records the completed repair. See [current status](acceptance.md#current-status-2026-10-30) for later source and host evidence.

Work item 582 follow-up. Consumer baseline is `fcf74ec38c62be865876b6e9c8fa9febffda1abb`.
Independent installed-VSIX review proved one P2 defect in the otherwise passing alpha.
Evidence and runnable repro are `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-independent/report.md` and `run-hang.sh`.
The `hang3/result.json` receipt records a launched process that never answers initialize. A corrected trusted server path and explicit Restart stay queued behind `client.start()` for over ten seconds with no path to completion.

The session must own and be able to interrupt initialization. Correcting configuration, explicit restart and disposal must not wait forever for the failed start. Startup itself needs a bounded failure path.
Keep exactly one owned server, preserve the latest validated settings, and prevent obsolete start/stop callbacks from replacing the current session.
Keep invalid-update retention, trust, complete settings replacement, graceful normal shutdown, explicit crash retry and all passing editor behavior.

The coordinator provides a bounded sketch after comparing supported native client cancellation and explicit child ownership. Use public vscode-languageclient APIs; no private-field mutation, new protocol implementation, or global process killing.
Do not add a user control unless a real product decision requires it. Treat owned startup/stop deadlines as lifecycle policy.

## Acceptance

1. Capture a real installed-host failing regression before the fix. Keep the existing healthy/missing/crash distinctions intact.
2. Launch a disposable server that does not answer initialize, then correct the trusted path and request Restart. Observe the old process gone and the healthy server providing its own completion/diagnostics within a stated bounded test deadline.
3. Check repeated restart, multiple rapid valid setting changes, invalid settings while starting, late responses, and disposal during the hung start. Prevent duplicate server children and stale callbacks.
4. Check the standalone startup deadline and visible actionable failure without an automatic retry loop.
5. Rerun unit/build checks and the actual installed-VSIX alpha/wire/trust/roots/normal-worker-cleanup suite. Rebuild the artifact and record its exact source/hash.
6. Update README/acceptance with the new lifecycle policy and honest remaining limits.

Read AGENTS.md, docs/spec.md, docs/design.md, this ticket and exact dispatch before edits.
Own this isolated worktree and `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-startup/` only.
Use the existing fixed core server at `/home/vimkim/temp/cubrid-lsp-enums-venv/bin/cubrid-language-server`, source fix `d5a571eb03d543af1438b85933fcad3aed60f9f0`.
Root owns coordinator state and other worktrees. Local commits are authorized; integration, publication, remote creation and deployment remain gated.
