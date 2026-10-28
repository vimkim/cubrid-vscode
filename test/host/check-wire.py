#!/usr/bin/env python3
import glob
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
files = sorted(glob.glob(str(root / 'wire-*-in')))
if not files:
    raise SystemExit('No recorded server input')
summary = {'rootUris': [], 'testOpenTexts': [], 'configurations': [], 'gracefulStops': 0, 'closeEvents': 0, 'folderChanges': []}
for filename in files:
    data = Path(filename).read_bytes()
    messages = []
    while data:
        header, separator, rest = data.partition(b'\r\n\r\n')
        if not separator:
            raise ValueError(f'incomplete header in {filename}')
        lengths = [int(line.split(b':', 1)[1]) for line in header.split(b'\r\n') if line.lower().startswith(b'content-length:')]
        if len(lengths) != 1 or len(rest) < lengths[0]:
            raise ValueError(f'incomplete message in {filename}')
        messages.append(json.loads(rest[:lengths[0]]))
        data = rest[lengths[0]:]
    opened = set()
    methods = []
    for message in messages:
        method = message.get('method')
        params = message.get('params') or {}
        methods.append(method)
        if method == 'initialize':
            summary['rootUris'].append(params['rootUri'])
        if method == 'workspace/didChangeConfiguration':
            settings = params['settings']
            if set(settings) != {'cubrid'}:
                raise ValueError(f'unexpected configuration payload: {settings}')
            value = settings['cubrid']
            if 'schemaSnapshot' in value and ('parserWorker' not in value or 'runtimePrefix' not in value):
                raise ValueError('schema update dropped the native pair')
            summary['configurations'].append(value)
        if method == 'workspace/didChangeWorkspaceFolders':
            summary['folderChanges'].append(params['event'])
        if method == 'textDocument/didOpen':
            document = params['textDocument']
            uri = document['uri']
            if uri in opened:
                raise ValueError(f'duplicate open without close: {uri}')
            opened.add(uri)
            if uri.endswith('/test.csql'):
                summary['testOpenTexts'].append(document['text'])
        if method == 'textDocument/didClose':
            summary['closeEvents'] += 1
            opened.discard(params['textDocument']['uri'])
    if 'shutdown' in methods and 'exit' in methods and methods.index('shutdown') < methods.index('exit'):
        summary['gracefulStops'] += 1
if not summary['rootUris'] or not all(uri.endswith('/workspace') for uri in summary['rootUris']):
    raise ValueError('unexpected initialize root URI')
if '-- 가😀\r\nSELsuffix\r\nSELECT 1;\r\n' not in summary['testOpenTexts']:
    raise ValueError('original CRLF didOpen text was not observed')
if not any('schemaSnapshot' in config for config in summary['configurations']):
    raise ValueError('no schema replacement observed')
if '--roots' in sys.argv:
    if not any(event['removed'] for event in summary['folderChanges']) or not any(event['added'] for event in summary['folderChanges']):
        raise ValueError('folder removal and addition were not both observed')
elif not summary['gracefulStops'] or not summary['closeEvents']:
    raise ValueError('shutdown/exit or document close was not observed')
print(json.dumps(summary, ensure_ascii=False, indent=2))
