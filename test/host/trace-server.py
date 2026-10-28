#!/usr/bin/env python3
import os
import subprocess
import sys
import threading

root = os.environ['CUBRID_PROBE_DIR']
server = subprocess.Popen([os.environ['CUBRID_REAL_SERVER']], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
assert server.stdin is not None and server.stdout is not None
prefix = os.path.join(root, f'wire-{server.pid}')
with open(prefix + '-pid', 'w', encoding='utf-8') as receipt:
    receipt.write(str(server.pid))

def send_input():
    with open(prefix + '-in', 'wb') as log:
        try:
            while data := os.read(sys.stdin.fileno(), 65536):
                log.write(data)
                log.flush()
                server.stdin.write(data)
                server.stdin.flush()
        except (BrokenPipeError, OSError):
            pass
        finally:
            server.stdin.close()

threading.Thread(target=send_input, daemon=True).start()
with open(prefix + '-out', 'wb') as log:
    while data := os.read(server.stdout.fileno(), 65536):
        log.write(data)
        log.flush()
        os.write(sys.stdout.fileno(), data)
server.wait()
