const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {ACCEPTED_TEXT, COVERAGE, readInput, writeJson, processes, processAlive} = require('../contract.cjs');

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitFor(observe, description, milliseconds = 25000) {
  const deadline = Date.now() + milliseconds;
  do {
    const value = await observe();
    if (value) return value;
    await sleep(100);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${description}`);
}

async function bounded(promise, description) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out waiting for ${description}`)), 25000); })]);
  } finally { clearTimeout(timer); }
}

async function set(key, value) {
  await vscode.workspace.getConfiguration('cubrid').update(key, value, vscode.ConfigurationTarget.Global);
}

async function document(input, name, text) {
  const file = path.join(input.workspace, name);
  fs.writeFileSync(file, text);
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(doc, {preview:false});
  return doc;
}

function label(item) { return typeof item.label === 'string' ? item.label : item.label.label; }

async function completionItems(doc, line, character) {
  const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, new vscode.Position(line, character));
  return list ? list.items.filter(item => typeof item.detail === 'string') : [];
}

async function keyword(doc) {
  const item = await waitFor(async () => (await completionItems(doc, 1, 3)).find(item => label(item) === 'SELECT'), 'server SELECT completion');
  return {label:label(item), detail:item.detail};
}

async function diagnostics(doc) {
  return waitFor(() => {
    const values = vscode.languages.getDiagnostics(doc.uri);
    return values.some(value => value.code === 'CUBRID-T1001') ? values.map(value => ({code:value.code, message:value.message, severity:value.severity, range:value.range})) : undefined;
  }, 'CUBRID-T1001');
}

function liveServers(input) { return processes(input.processes).filter(processAlive); }

async function oneServer(input) {
  const server = await waitFor(() => {
    const live = liveServers(input);
    return live.length === 1 && live[0].kind === 'real' ? live[0] : undefined;
  }, 'one owned real server');
  assert.equal(server.parentPid, process.pid, 'server is not owned by this extension host');
  assert.equal(server.executable, input.realServer);
  assert.ok(server.predecessors.every(identity => !identity.alive), 'successor overlapped an owned predecessor');
  return server;
}

function snapshot(file, name) {
  writeJson(file, {schemaVersion:1, user:'dba', relations:[{owner:'dba', name, kind:'CLASS', columns:['가😀']}]});
}

async function schemaState(doc, name, stale = false) {
  return waitFor(async () => {
    const result = await vscode.commands.executeCommand('cubrid.reloadSchema');
    assert.ok(Array.isArray(result), 'schema reload did not return a document list');
    const state = result.find(item => item.uri === doc.uri.toString());
    if (!state || state.stale !== stale || state.schemaAvailable !== (name !== 'disabled')) return undefined;
    const labels = (await completionItems(doc, 0, 14)).map(label);
    const expected = name === 'stale' ? 'SchemaB' : name;
    if (name !== 'disabled' && !labels.includes(expected)) return undefined;
    if (['SchemaA', 'SchemaB', 'SchemaC', 'ProjectTable'].some(value => value !== expected && labels.includes(value))) return undefined;
    return {name, state, labels};
  }, `schema ${name}`);
}

async function portable(input, observed) {
  const csql = await document(input, 'completion.csql', '-- 가😀\r\nSELsuffix\r\nSELECT 1;\r\n');
  const sql = await document(input, 'default.sql', 'SELECT 1;\n');
  assert.equal(csql.languageId, 'cubrid');
  assert.equal(sql.languageId, 'sql');
  observed.language = {csql:csql.languageId, sql:sql.languageId};
  observed.missingRuntime = await diagnostics(csql);
  observed.completion = await keyword(csql);
  const editor = await vscode.window.showTextDocument(csql);
  editor.selection = new vscode.Selection(1, 3, 1, 3);
  await vscode.commands.executeCommand('editor.action.triggerSuggest');
  await sleep(1000);
  await vscode.commands.executeCommand('acceptSelectedSuggestion');
  assert.equal(csql.lineAt(1).text, 'SELECT', 'suggestion acceptance did not replace the whole token');
  await csql.save();
  observed.acceptedText = fs.readFileSync(csql.uri.fsPath, 'utf8');
  assert.equal(observed.acceptedText, ACCEPTED_TEXT);
  fs.copyFileSync(csql.uri.fsPath, path.join(input.root, 'accepted-completion.csql'));
  const catalog = path.join(input.root, 'schema.json');
  snapshot(catalog, 'SchemaA');
  await set('schemaPath', catalog);
  await set('schemaMode', 'path');
  const schema = await document(input, 'schema.csql', 'SELECT * FROM ');
  observed.schema = [await schemaState(schema, 'SchemaA')];
  snapshot(catalog, 'SchemaB');
  observed.schema.push(await schemaState(schema, 'SchemaB'));
  fs.writeFileSync(catalog, 'invalid JSON');
  observed.schema.push(await schemaState(schema, 'stale', true));
  snapshot(catalog, 'SchemaC');
  observed.schema.push(await schemaState(schema, 'SchemaC'));
  await set('schemaMode', 'disabled');
  observed.schema.push(await schemaState(schema, 'disabled'));
  writeJson(path.join(input.workspace, '.cubrid-language.json'), {schemaSnapshot:'catalog.json'});
  snapshot(path.join(input.workspace, 'catalog.json'), 'ProjectTable');
  await set('schemaMode', 'inherit');
  observed.schema.push(await schemaState(schema, 'ProjectTable'));
  await vscode.workspace.getConfiguration('files').update('associations', {'*.sql':'cubrid'}, vscode.ConfigurationTarget.Global);
  observed.language.sqlOptIn = await waitFor(() => {
    const current = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === sql.uri.toString());
    return current?.languageId === 'cubrid' ? current.languageId : undefined;
  }, 'SQL user association');
  observed.restarts = [];
  for (let index = 0; index < 2; index++) {
    const previous = await oneServer(input);
    await bounded(vscode.commands.executeCommand('cubrid.restart'), 'public restart');
    await waitFor(() => !processAlive(previous), 'previous server exit');
    await keyword(csql);
    const current = await oneServer(input);
    const items = await completionItems(schema, 0, 14);
    const candidateCount = items.filter(item => label(item) === 'ProjectTable').length;
    assert.equal(candidateCount, 1, 'duplicate or missing server schema candidate after restart');
    observed.restarts.push({predecessor:{pid:previous.pid, startTime:previous.startTime}, successor:{pid:current.pid, startTime:current.startTime}, previousExited:true, candidateCount, diagnostics:await diagnostics(csql)});
  }
  observed.serverCount = liveServers(input).length;
  assert.equal(observed.serverCount, 1);
}

async function hangingRecovery(input, observed) {
  const csql = await document(input, 'recovery.csql', '-- 가😀\r\nSELsuffix\r\nSELECT 1;\r\n');
  assert.equal(csql.languageId, 'cubrid');
  const previous = await waitFor(() => processes(input.processes).find(identity => identity.kind === 'hanging' && processAlive(identity)), 'hanging initializer');
  await waitFor(() => fs.existsSync(path.join(input.root, 'unresponsive-started')), 'initializer signal handlers');
  assert.equal(Number(fs.readFileSync(path.join(input.root, 'unresponsive-started'), 'utf8')), previous.pid);
  observed.recovery = {predecessor:{pid:previous.pid, startTime:previous.startTime}};
  if (input.name === 'hanging-timeout') {
    await waitFor(() => !processAlive(previous), 'startup timeout to retire initializer');
    const quietStart = Date.now();
    await sleep(1500);
    observed.recovery.quietPeriodMs = Date.now() - quietStart;
    observed.recovery.automaticSuccessors = processes(input.processes).length - 1;
    assert.equal(observed.recovery.automaticSuccessors, 0, 'startup failure retried automatically');
    assert.equal(liveServers(input).length, 0);
  }
  await set('serverPath', input.server);
  if (input.name !== 'hanging-timeout') await bounded(vscode.commands.executeCommand('cubrid.restart'), 'hanging initializer replacement');
  await waitFor(() => !processAlive(previous), 'initializer exit');
  observed.recovery.previousExited = true;
  observed.completion = await keyword(csql);
  observed.missingRuntime = await diagnostics(csql);
  const current = await oneServer(input);
  const predecessor = current.predecessors.find(identity => identity.pid === previous.pid && identity.startTime === previous.startTime);
  assert.ok(predecessor, 'successor did not observe its predecessor');
  observed.recovery.successorPredecessorAlive = predecessor.alive;
  assert.equal(predecessor.alive, false, 'successor started before predecessor exit');
  observed.recovery.realLaunches = processes(input.processes).filter(identity => identity.kind === 'real').length;
  assert.equal(observed.recovery.realLaunches, 1, 'expected a single real successor');
  if (input.name === 'hanging-term') {
    observed.recovery.termObserved = fs.readFileSync(path.join(input.root, 'termination-requested'), 'utf8') === 'TERM';
    assert.equal(observed.recovery.termObserved, true);
  }
  observed.serverCount = liveServers(input).length;
  assert.equal(observed.serverCount, 1);
}

exports.run = async () => {
  const input = readInput(process.env.CUBRID_DESKTOP_INPUT);
  const result = {name:input.name, status:'running', coverage:COVERAGE, observations:{}};
  try {
    const extension = vscode.extensions.getExtension(input.extensionId);
    assert.ok(extension, 'installed product was not discovered');
    const installedPath = fs.realpathSync(extension.extensionPath);
    const relative = path.relative(fs.realpathSync(input.extensions), installedPath);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'product did not load from isolated extensions directory');
    assert.equal(installedPath, input.installedPath);
    assert.notEqual(installedPath, path.resolve(__dirname, '../../..'));
    const configuration = vscode.workspace.getConfiguration('cubrid');
    result.identity = {
      editorVersion:vscode.version, appName:vscode.env.appName, hostNode:process.version,
      trusted:vscode.workspace.isTrusted, extensionId:extension.id,
      extensionVersion:extension.packageJSON.version, extensionPath:installedPath,
      native:Object.fromEntries(['parserWorker', 'runtimePrefix', 'workerManifest'].map(key => [key, configuration.get(key)])),
    };
    assert.equal(result.identity.editorVersion, input.editorVersion);
    assert.equal(result.identity.appName, 'Visual Studio Code');
    assert.equal(result.identity.trusted, true);
    assert.deepEqual(result.identity.native, {parserWorker:'', runtimePrefix:'', workerManifest:''});
    assert.equal(result.identity.extensionVersion, input.extensionVersion);
    if (input.name === 'portable') await portable(input, result.observations);
    else await hangingRecovery(input, result.observations);
    assert.equal(extension.isActive, true);
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.stack || String(error);
    throw error;
  } finally {
    writeJson(input.probeReceipt, result);
  }
};
