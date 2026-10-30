#!/usr/bin/env python3
"""Check warning guidance and deduplication in the real CUBRID output log."""
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
logs = list((root / "user-data/logs").rglob("*-CUBRID.log"))
assert len(logs) == 1, f"expected one CUBRID output log, got {logs}"
warnings = [line for line in logs[0].read_text().splitlines() if line.startswith("WARN:")]
for needle in ("absent-server", "are not configured", "absent-worker", "absent-manifest.json", "absent-runtime"):
    assert sum(needle in line for line in warnings) == 1, f"missing or repeated warning: {needle}"
assert sum("non-executable" in line for line in warnings) == 2
for line in warnings:
    assert "Install" in line
    assert "https://github.com/vimkim/cubrid-language-tools" in line
    assert "https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md" in line
    assert "Restart Language Server" in line
    if "Strict diagnostics are unavailable" in line:
        assert "Keyword completion can continue" in line
receipt = {"output": str(logs[0]), "warningCount": len(warnings), "warnings": warnings}
(root / "warning-output.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({"warningCount": len(warnings), "ok": True}))
