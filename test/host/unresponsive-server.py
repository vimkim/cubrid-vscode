#!/usr/bin/env python3
import os
from pathlib import Path
import time

Path(os.environ['CUBRID_PROBE_DIR'], 'unresponsive-started').write_text(str(os.getpid()))
time.sleep(120)
