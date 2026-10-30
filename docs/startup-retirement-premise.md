# Verify retirement by its postconditions

> Historical startup-recovery work. The [acceptance record](acceptance.md#startup-retirement-repair) records the completed repair. See [current status](acceptance.md#current-status-2026-10-30) for later source and host evidence.

Work item 582, continuation of `docs/startup-recovery-ticket.md`.
Previous checkpoint `9b69573271b52ac08adadf922f66fdcf39515edb` contains the real installed-host red regression and no product lifecycle repair.

## Premise tested

The previous gate assumed a resolved public `LanguageClient.dispose()` promise was required to establish that the old client had retired.
The pinned SDK 9.0.1 contradicts that proxy. Three real-host probes under `/home/vimkim/temp/cubrid-editor-alpha-aiYISe/vscode-startup/sdk1`, `sdk2` and `sdk3` showed:

- Owned child exit and stream destruction settle the old start.
- A command registered by the old client disappears, including in the late-initialize race.
- Public disposal can still reject in `startFailed`, or because a shutdown write reaches an already destroyed stream.

Primary source confirms the mechanism. `lib/common/client.js` `handleConnectionClosed()` calls `cleanUp('stop')` before entering `StartFailed`/`Stopped`. `cleanUp` disposes listeners, clears features, and disposes diagnostics. Public `dispose()` marks the client disposed but calls `stop()`, whose shutdown rejects when the state is not Running. A rejection is therefore not by itself evidence of retained features. Never invoke private SDK cleanup or mutate private state.

## Correct gate

Keep the selected public child factory and single Session owner. No successor may start merely because the direct child died.
Require observed child exit, closed owned transport streams, settled old start, and observable retirement of old editor registrations/providers. Use public SDK feature state or real editor command/provider observations, plus the pinned connection-close path, to establish cleanup.
Call public disposal once; classify a known rejection only after those postconditions are established, record it accurately, and do not swallow arbitrary cleanup failures. If retirement cannot be established within bounds, fail closed.

The first experiment must extend the existing SDK probe to check old command/completion/document feature registration state and successfully admit a healthy successor with no duplicated or late features. Include the late-buffered-initialize and inherited-pipe cases. A provider/result from the old generation must never survive replacement.
This corrects the gate without weakening the user requirement: corrected settings, Restart and disposal must recover from a nonresponsive initializer, with one owned process and no stale editor behavior.

Then implement the already-selected design, preserve all normal editor/trust/schema/wire behavior, and rerun the installed regression and full suites. Keep startup/stop deadlines bounded, invalid intent retained, explicit retry semantics and no automatic loop. No SDK upgrade or new protocol layer is selected.
Commit the passing source and honest receipts. Local commits are authorized; integration and publication are not.
