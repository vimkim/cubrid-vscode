#!/usr/bin/env python3
import json
import os
from pathlib import Path
import signal
import sys
import time

mode = os.environ.get('CUBRID_CASE', '')
if mode in ('startup-term', 'startup-late'):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
if mode == 'startup-timeout-race':
    def record_term(_signal, _frame):
        Path(os.environ['CUBRID_PROBE_DIR'], 'termination-requested').write_text('TERM')
    signal.signal(signal.SIGTERM, record_term)
Path(os.environ['CUBRID_PROBE_DIR'], 'unresponsive-started').write_text(str(os.getpid()))
if mode == 'startup-late':
    size = 0
    while True:
        line = sys.stdin.buffer.readline()
        if line in (b'\r\n', b'\n', b''):
            break
        if line.lower().startswith(b'content-length:'):
            size = int(line.split(b':')[1])
    request = json.loads(sys.stdin.buffer.read(size))
    time.sleep(.2)
    response = json.dumps({'jsonrpc': '2.0', 'id': request['id'], 'result': {'capabilities': {'textDocumentSync': 1, 'completionProvider': {}, 'executeCommandProvider': {'commands': ['cubrid.reloadSchema']}}}}).encode()
    try:
        sys.stdout.buffer.write(b'Content-Length: ' + str(len(response)).encode() + b'\r\n\r\n' + response)
        sys.stdout.buffer.flush()
    except BrokenPipeError:
        pass
time.sleep(120)
