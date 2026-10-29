const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');
const {supervise, editorIdentity} = require('./run.cjs');
const {readProbeResult, assertComplete, processes, processAlive} = require('./contract.cjs');

function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cubrid-desktop-control-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  return root;
}

test('stable selection accepts historical release labels and rejects an invalid selected version', async t => {
  const root = temporary(t);
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const response = body => ({ok:true, status:200, text:async () => JSON.stringify(body)});
  global.fetch = async () => response(['1.144.0', '0.10.6-release', '0.10.1-preview']);
  await assert.rejects(editorIdentity('stable', root), /download exited with 1/);
  assert.match(fs.readFileSync(path.join(root, 'download.stderr.log'), 'utf8'), /desktop execution requires GitHub-hosted CI/);
  const input = JSON.parse(fs.readFileSync(path.join(root, 'download-input.json')));
  assert.equal(input.version, '1.144.0');
  for (const body of [[], {}, ['invalid', '1.144.0'], ['1.144.0-preview', '1.143.0'], [null, '1.144.0']]) {
    const badRoot = fs.mkdtempSync(path.join(root, 'invalid-'));
    global.fetch = async () => response(body);
    await assert.rejects(editorIdentity('stable', badRoot));
    assert.equal(fs.existsSync(path.join(badRoot, 'download-input.json')), false);
  }
  const malformedRoot = fs.mkdtempSync(path.join(root, 'malformed-'));
  global.fetch = async () => ({ok:true, text:async () => '{'});
  await assert.rejects(editorIdentity('stable', malformedRoot), SyntaxError);
  assert.equal(fs.existsSync(path.join(malformedRoot, 'download-input.json')), false);
  const badRoot = fs.mkdtempSync(path.join(root, 'http-'));
  global.fetch = async () => ({ok:false, status:503});
  await assert.rejects(editorIdentity('stable', badRoot), /stable release lookup failed/);
  assert.equal(fs.existsSync(path.join(badRoot, 'download-input.json')), false);
});

test('a missing or failed terminal probe receipt cannot pass', t => {
  const root = temporary(t);
  const file = path.join(root, 'result.json');
  assert.throws(() => readProbeResult(file, {name:'portable'}), /receipt/);
  fs.writeFileSync(file, JSON.stringify({status:'failed', error:'assertion failed'}));
  assert.throws(() => readProbeResult(file, {name:'portable'}), /assertion failed/);
  fs.writeFileSync(file, JSON.stringify({status:'passed', name:'portable'}));
  assert.throws(() => readProbeResult(file, {name:'portable'}), /identity|observations/);
});

test('a subprocess nonzero exit cannot pass', async t => {
  const root = temporary(t);
  await assert.rejects(supervise(process.execPath, ['-e', 'process.exit(7)'], {root, name:'nonzero', timeout:2000}), /7/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'nonzero.process.json'))).status, 'failed');
});

test('a timeout fails and terminates its owned process group', async t => {
  const root = temporary(t);
  const code = "const {spawn}=require('node:child_process'); const fs=require('node:fs'); process.on('SIGTERM',()=>{}); const child=spawn(process.execPath,['-e', \"process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)\"],{stdio:'ignore'}); fs.writeFileSync(process.argv[1],String(child.pid)); setInterval(()=>{},1000);";
  await assert.rejects(supervise(process.execPath, ['-e', code, path.join(root, 'child.pid')], {root, name:'timeout', timeout:600}), /timed out/);
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'timeout.process.json')));
  assert.equal(receipt.status, 'timed-out');
  assert.equal(receipt.intervened, true);
  assert.deepEqual(receipt.terminationSignals, ['SIGTERM', 'SIGKILL']);
  const pid = Number(fs.readFileSync(path.join(root, 'child.pid'), 'utf8'));
  let stat;
  const deadline = Date.now() + 1000;
  do {
    stat = fs.existsSync(`/proc/${pid}/stat`) ? fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[0] : 'gone';
    if (['gone', 'Z'].includes(stat)) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  assert.ok(['gone', 'Z'].includes(stat), `owned child ${pid} survived timeout`);
});

test('package verification rejects missing provenance and mismatched VSIX bytes', t => {
  const root = temporary(t);
  const vsix = path.join(root, 'product.vsix');
  fs.writeFileSync(vsix, 'changed bytes');
  const verify = () => spawnSync('python3', [path.join(__dirname, 'package.py'), 'verify', '--vsix', vsix, '--source-sha', 'a'.repeat(40)], {encoding:'utf8', timeout:5000});
  let result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /provenance/);
  fs.writeFileSync(`${vsix}.provenance.json`, JSON.stringify({vsixSha256:'0'.repeat(64)}));
  result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VSIX hash/);
});

test('a controller cannot pass with a missing mandatory case', () => {
  assert.throws(() => assertComplete({cases:[]}), /incomplete desktop case set/);
});

test('the executable-only recorder preserves stdio and process identity across exec', t => {
  const root = temporary(t);
  const directory = path.join(root, 'processes');
  fs.mkdirSync(directory);
  const fixture = path.join(root, 'echo.py');
  fs.writeFileSync(fixture, '#!/usr/bin/env python3\nimport os, sys\nassert len(sys.argv) == 1\nos.write(1, os.read(0, 4096))\n', {mode:0o755});
  const launcher = path.join(root, 'record-real');
  fs.symlinkSync(path.join(__dirname, 'record-server.py'), launcher);
  const input = path.join(root, 'input.json');
  fs.writeFileSync(input, JSON.stringify({realServer:fixture, processes:directory}));
  const bytes = 'Content-Length: 2\r\n\r\n{}';
  const result = spawnSync(launcher, [], {env:{...process.env, CUBRID_DESKTOP_INPUT:input}, input:bytes, encoding:'utf8', timeout:5000});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, bytes);
  const recorded = processes(directory);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].pid, result.pid);
  assert.equal(recorded[0].executable, fixture);
  assert.equal(processAlive(recorded[0]), false);
});

test('installed inventory authenticates the VSIX manifest and rejects tampering', t => {
  const root = temporary(t);
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  const files = {
    'package.json':JSON.stringify({publisher:'cubrid-local', name:'cubrid-language', version:'0.1.0'}),
    'out/extension.js':'exports.activate = () => {};', 'out/settings.js':'module.exports = {};',
    'language-configuration.json':'{}', 'syntaxes/cubrid.tmLanguage.json':'{}',
    'node_modules/vscode-languageclient/package.json':'{"version":"9.0.1"}',
  };
  for (const [name, data] of Object.entries({...files, '.gitignore':'node_modules/\n', 'package-lock.json':'{}', 'node_modules/@vscode/vsce/package.json':'{"version":"3.7.1"}', 'node_modules/typescript/package.json':'{"version":"5.9.3"}'})) {
    const file = path.join(source, name);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, data);
  }
  const execute = (command, args, env = process.env) => spawnSync(command, args, {cwd:source, encoding:'utf8', timeout:10000, env});
  for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Package fixture']]) {
    const result = execute('git', args);
    assert.equal(result.status, 0, result.stderr);
  }
  const sha = execute('git', ['rev-parse', 'HEAD']).stdout.trim();
  const vsix = path.join(root, 'fixture.vsix');
  const vsixManifest = '<PackageManifest>fixture metadata</PackageManifest>';
  const archive = execute('python3', ['-c', 'import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1], "w") as z:\n for name,data in json.loads(sys.argv[2]).items(): z.writestr("extension/"+name,data)\n z.writestr("extension.vsixmanifest",sys.argv[3])', vsix, JSON.stringify(files), vsixManifest]);
  assert.equal(archive.status, 0, archive.stderr);
  const script = path.join(__dirname, 'package.py');
  const created = execute('python3', [script, 'create', '--vsix', vsix], {...process.env, GITHUB_SHA:sha});
  assert.equal(created.status, 0, created.stderr);
  const installed = path.join(root, 'installed');
  for (const [name, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(installed, name)), {recursive:true});
    fs.writeFileSync(path.join(installed, name), data);
  }
  fs.writeFileSync(path.join(installed, '.vsixmanifest'), vsixManifest);
  const manifest = {...JSON.parse(files['package.json']), __metadata:{installedTimestamp:1}};
  fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify(manifest, null, '\t'));
  const verify = () => execute('python3', [script, 'installed', '--vsix', vsix, '--source-sha', sha, '--installed', installed]);
  let result = verify();
  assert.equal(result.status, 0, result.stderr);
  fs.rmSync(path.join(installed, '.vsixmanifest'));
  result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /installed inventory differs/);
  fs.writeFileSync(path.join(installed, '.vsixmanifest'), 'changed');
  result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /installed file mismatch/);
  fs.writeFileSync(path.join(installed, '.vsixmanifest'), vsixManifest);
  fs.writeFileSync(path.join(installed, 'unknown'), 'unexpected');
  result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /installed inventory differs/);
  fs.rmSync(path.join(installed, 'unknown'));
  fs.symlinkSync('out/extension.js', path.join(installed, 'link'));
  result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symlink/);
  fs.rmSync(path.join(installed, 'link'));
  fs.writeFileSync(path.join(installed, 'out/extension.js'), 'changed');
  result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /installed file mismatch/);
  fs.writeFileSync(path.join(installed, 'out/extension.js'), files['out/extension.js']);
  fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({...manifest, version:'wrong'}));
  result = verify();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /manifest fields changed/);
});
