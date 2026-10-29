# SHOW and hint host acceptance

Base this ticket on VS Code commit `afd459b7eb9a9a42164f0aa9ed191967c56a6e95` and shared engine commit `49479b2d0a6cf39f71498834215346d8381b82c5`. Keep the engine read-only. Build a wheel with its LSP extra and install the VSIX into a fresh headless OpenVSCode Server profile.

Drive suggestion acceptance through editor commands. Check SHOW and hint name replacement with Korean text, a supplementary character, CRLF, and a suffix in the replacement range. Check warning codes, severity, and original UTF-16 positions. Correct and reintroduce a warning and observe diagnostic updates. Check unknown-profile suppression and exclusions inside ordinary comments and strings. Retain native unsupported and missing-tool diagnostics. Record the worker and manifest identities.

The extension consumes server results. It must not implement SQL rules. This ticket does not expand native coverage or qualify desktop VS Code. Record commands, exact inputs, evidence, and limitations in the ticket report and `docs/acceptance.md`.
