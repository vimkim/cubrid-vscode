const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {nativePrerequisiteWarning, missingServerWarning, unavailableExecutable} = require('../out/prerequisites');

test('missing server guidance names the binary, installation URL, settings, and restart', () => {
  const message = missingServerWarning('/missing/server');
  for (const text of ['/missing/server', 'cubrid-language-server', 'Install', 'https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md', 'cubrid.serverPath', 'Restart Language Server']) assert.ok(message.includes(text), text);
  for (const code of ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'EISDIR']) assert.equal(unavailableExecutable(Object.assign(new Error(code), {code})), true);
  assert.equal(unavailableExecutable(new Error('initialization timed out')), false);
  assert.equal(unavailableExecutable(Object.assign(new Error('bad runtime'), {code:'EIO'})), false);
});

test('unconfigured native inputs explain that completion can continue', async () => {
  const warning = await nativePrerequisiteWarning({kind:'absent'});
  assert.match(warning, /Strict diagnostics are unavailable/);
  assert.match(warning, /Keyword completion can continue/);
  assert.match(warning, /Install.*https:\/\/github.com\/vimkim\/cubrid-language-tools/);
  assert.match(warning, /cubrid.parserWorker and cubrid.runtimePrefix/);
});

test('native file checks accept available paths and explain missing worker, runtime, and manifest', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cubrid-prerequisites-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  const worker = path.join(root, 'parser-worker');
  const runtime = path.join(root, 'runtime');
  const manifest = path.join(root, 'manifest.json');
  const native = {kind:'configured', worker, runtime, timeout:5};
  assert.match(await nativePrerequisiteWarning(native), /parser-worker.*missing or not executable/);
  await fs.writeFile(worker, '', {mode:0o600});
  assert.match(await nativePrerequisiteWarning(native), /parser-worker.*missing or not executable/);
  await fs.chmod(worker, 0o700);
  assert.match(await nativePrerequisiteWarning(native), /CUBRID runtime.*missing or inaccessible/);
  await fs.mkdir(runtime);
  assert.match(await nativePrerequisiteWarning(native), /qualification manifest.*missing or unreadable/);
  await fs.writeFile(manifest, '{}');
  assert.equal(await nativePrerequisiteWarning(native), undefined);
  assert.match(await nativePrerequisiteWarning({...native, manifest:path.join(root, 'explicit-missing')}), /explicit-missing/);
  assert.match(await nativePrerequisiteWarning({...native, worker:runtime}), /parser-worker.*missing or not executable/);
  assert.match(await nativePrerequisiteWarning({...native, runtime:manifest}), /CUBRID runtime.*missing or inaccessible/);
  assert.match(await nativePrerequisiteWarning({...native, manifest:runtime}), /qualification manifest.*missing or unreadable/);
});
