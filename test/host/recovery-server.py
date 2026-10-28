#!/usr/bin/env python3
import json
import os
from pathlib import Path

root = Path(os.environ['CUBRID_PROBE_DIR'])
old_pid = int((root / 'unresponsive-started').read_text())
try:
    os.kill(old_pid, 0)
    old_alive = True
except ProcessLookupError:
    old_alive = False
with (root / 'recovery-launches.jsonl').open('a') as output:
    output.write(json.dumps({'pid': os.getpid(), 'oldAlive': old_alive}) + '\n')
os.execv(os.environ['CUBRID_REAL_SERVER'], [os.environ['CUBRID_REAL_SERVER']])
