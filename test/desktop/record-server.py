#!/usr/bin/env python3
import json
import os
from pathlib import Path
import time


def state(pid):
    try:
        fields = Path(f'/proc/{pid}/stat').read_text().rsplit(') ', 1)[1].split()
        return {'state': fields[0], 'parentPid': int(fields[1]), 'startTime': fields[19]}
    except FileNotFoundError:
        return None


input_path = Path(os.environ['CUBRID_DESKTOP_INPUT'])
case = json.loads(input_path.read_text())
kind = {'record-real': 'real', 'record-hanging': 'hanging'}[Path(__file__).name]
directory = Path(case['processes'])
predecessors = []
for file in sorted(directory.glob('*.json')):
    previous = json.loads(file.read_text())
    observed = state(previous['pid'])
    alive = observed is not None and observed['startTime'] == previous['startTime'] and observed['state'] != 'Z'
    predecessors.append({'pid': previous['pid'], 'startTime': previous['startTime'], 'alive': alive})
pid = os.getpid()
identity = state(pid)
target = case['realServer'] if kind == 'real' else str(Path(__file__).resolve().parent.parent / 'host' / 'unresponsive-server.py')
receipt = {**identity, 'pid': pid, 'kind': kind, 'executable': target, 'launchedAt': time.time(), 'predecessors': predecessors}
temporary = directory / f'{pid}-{identity["startTime"]}.tmp'
temporary.write_text(json.dumps(receipt, indent=2) + '\n')
temporary.replace(temporary.with_suffix('.json'))
if kind == 'hanging':
    os.environ['CUBRID_CASE'] = 'startup-timeout-race' if case['name'] == 'hanging-term' else 'startup'
    os.environ['CUBRID_PROBE_DIR'] = case['root']
os.execv(target, [target])
