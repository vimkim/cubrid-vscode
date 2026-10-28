const test = require('node:test');
const assert = require('node:assert/strict');
const {parseSettings, wireSettings} = require('../out/settings');
const defaults = {serverPath:'cubrid-language-server', parserWorker:'', runtimePrefix:'', workerManifest:'', workerTimeout:5, profile:'', scriptMode:'inherit', configPath:'', schemaMode:'inherit', schemaPath:''};
test('native pair remains in a complete schema-only replacement', () => {
  const settings = parseSettings({...defaults, parserWorker:'/worker', runtimePrefix:'/runtime', schemaMode:'disabled'});
  assert.deepEqual(wireSettings(settings), {parserWorker:'/worker', runtimePrefix:'/runtime', workerTimeout:5, schemaSnapshot:null});
});
test('rejects partial native pair and relative explicit paths', () => {
  assert.throws(() => parseSettings({...defaults, parserWorker:'/worker'}));
  assert.throws(() => parseSettings({...defaults, serverPath:'./server'}));
  assert.throws(() => parseSettings({...defaults, schemaMode:'path', schemaPath:'relative'}));
  assert.throws(() => parseSettings({...defaults, serverPath:'/bad\0path'}));
  assert.throws(() => parseSettings({...defaults, parserWorker:'/bad\ud800path', runtimePrefix:'/runtime'}));
});
test('inherit omits schema, disabled clears it, path selects it', () => {
  assert.deepEqual(wireSettings(parseSettings(defaults)), {});
  assert.deepEqual(wireSettings(parseSettings({...defaults, schemaMode:'disabled'})), {schemaSnapshot:null});
  assert.deepEqual(wireSettings(parseSettings({...defaults, schemaMode:'path', schemaPath:'/snapshot'})), {schemaSnapshot:'/snapshot'});
});
