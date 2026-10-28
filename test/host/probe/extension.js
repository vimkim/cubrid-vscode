const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;
const {execFileSync} = require('child_process');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = process.env.CUBRID_PROBE_DIR;
const workspace = path.join(root, 'workspace');
const result = {version:vscode.version, node:process.version, trusted:vscode.workspace.isTrusted, folders:(vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath), checks:{}};
async function waitFor(fn, label) {
  for (let n = 0; n < 100; n++) { const value = await fn(); if (value) return value; await sleep(250); }
  throw new Error(`Timed out: ${label}`);
}
function processes() {
  return execFileSync('ps', ['-eo', 'pid=,ppid=,args='], {encoding:'utf8'}).trim().split('\n').map(line => { const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/); return match ? {pid:Number(match[1]), parent:Number(match[2]), command:match[3]} : null; }).filter(Boolean);
}
function children() { return processes().filter(entry => entry.parent === process.pid && entry.command.includes(process.env.CUBRID_SERVER)); }
function descendants(pid) {
  const remaining = processes();
  const found = [];
  const parents = [pid];
  while (parents.length) {
    const parent = parents.pop();
    for (const entry of remaining) if (entry.parent === parent) { found.push(entry); parents.push(entry.pid); }
  }
  return found;
}
async function set(key, value) { await vscode.workspace.getConfiguration('cubrid').update(key, value, vscode.ConfigurationTarget.Global); }
async function document(name, text) {
  const file = path.join(workspace, name);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, text);
  const uri = vscode.Uri.file(file);
  await vscode.commands.executeCommand('vscode.open', uri, {preview:false});
  return waitFor(() => vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString()), `open ${name}`);
}
async function diagnostics(doc, codes) {
  return waitFor(() => {
    const values = vscode.languages.getDiagnostics(doc.uri);
    return codes.every(code => values.some(value => value.code === code)) ? values.map(value => ({code:value.code, message:value.message, range:value.range, severity:value.severity})) : undefined;
  }, `diagnostics ${codes.join(', ')}`);
}
async function completions(doc, line, character, wanted) {
  return waitFor(async () => {
    const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, new vscode.Position(line, character));
    if (!list) return undefined;
    return list.items.find(item => (typeof item.label === 'string' ? item.label : item.label.label) === wanted && typeof item.detail === 'string') || undefined;
  }, `completion ${wanted}`);
}
async function run() {
  if (process.env.CUBRID_CASE === 'roots2') {
    await waitFor(() => vscode.workspace.workspaceFile && vscode.workspace.isTrusted, 'trusted saved workspace');
    result.trusted = true;
    result.folders = vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
  }
  if (process.env.CUBRID_BASELINE !== '1') await set('serverPath', process.env.CUBRID_CASE === 'missing' ? path.join(root, 'absent-server') : process.env.CUBRID_SERVER);
  const csql = await document('test.csql', '-- 가😀\r\nSELsuffix\r\nSELECT 1;\r\n');
  const sql = await document('test.sql', 'select 1;\n');
  result.checks.language = {csql:csql.languageId, sql:sql.languageId};
  await vscode.window.showTextDocument(csql);
  if (process.env.CUBRID_BASELINE === '1') { assert.equal(csql.languageId, 'plaintext'); assert.equal(sql.languageId, 'sql'); return; }
  assert.equal(csql.languageId, 'cubrid'); assert.equal(sql.languageId, 'sql');
  if ((process.env.CUBRID_CASE || '').startsWith('startup')) {
    const mode = process.env.CUBRID_CASE;
    const marker = path.join(root, 'unresponsive-started');
    await waitFor(() => fs.existsSync(marker), 'unresponsive server startup');
    const oldPid = Number(fs.readFileSync(marker, 'utf8'));
    const started = Date.now();
    const recovery = process.env.CUBRID_RECOVERY_SERVER || process.env.CUBRID_REAL_SERVER;
    if (mode === 'startup-timeout-race') {
      await waitFor(() => fs.existsSync(path.join(root, 'termination-requested')), 'termination requested');
      assert.equal(fs.existsSync(`/proc/${oldPid}`), true, 'old server should still be in TERM grace period');
      await set('serverPath', recovery);
    } else if (mode === 'startup-timeout') {
      await waitFor(() => !fs.existsSync(`/proc/${oldPid}`), 'startup deadline');
      await sleep(1500);
      assert.equal(children().length, 0, 'startup failure retried automatically');
      result.checks.timeoutMs = Date.now() - started;
      await set('serverPath', recovery);
    } else if (mode === 'startup-dispose') {
      const installed = fs.readdirSync(path.join(root, 'extensions')).find(name => name.startsWith('cubrid-local.cubrid-language-'));
      await require(path.join(root, 'extensions', installed, 'out/extension.js')).deactivate();
      result.checks.oldProcessGone = !fs.existsSync(`/proc/${oldPid}`);
      assert.equal(result.checks.oldProcessGone, true);
      return;
    } else if (mode === 'startup-rapid') {
      await set('parserWorker', 'relative-worker');
      await sleep(300);
      assert.equal(fs.existsSync(`/proc/${oldPid}`), true, 'invalid update retired valid intent');
      await set('parserWorker', process.env.CUBRID_WORKER);
      await set('runtimePrefix', process.env.CUBRID_RUNTIME);
      await set('profile', 'unknown-profile');
      await set('serverPath', '/bin/false');
      await set('serverPath', recovery);
      await Promise.all([vscode.commands.executeCommand('cubrid.restart'), vscode.commands.executeCommand('cubrid.restart')]);
    } else {
      await set('serverPath', recovery);
      if (mode === 'startup') {
        let settled = false;
        const restart = vscode.commands.executeCommand('cubrid.restart').then(() => { settled = true; });
        await Promise.race([restart, sleep(10000)]);
        result.checks.restartSettled = settled;
        assert.equal(settled, true, 'restart did not settle within 10 seconds');
      }
    }
    await waitFor(() => !fs.existsSync(`/proc/${oldPid}`), 'old process exit');
    result.checks.elapsedMs = Date.now() - started;
    result.checks.oldProcessGone = true;
    const item = await completions(csql, 1, 3, 'SELECT');
    result.checks.completion = {label:item.label, detail:item.detail};
    if (mode === 'startup-rapid') {
      result.checks.latestSettings = await diagnostics(csql, ['CUBRID-U1001']);
      await set('profile', '');
      const native = await document('recovery-native.csql', 'CREATE SERIAL s START WITH ;\n');
      result.checks.native = await diagnostics(native, ['CUBRID-S1001']);
    } else {
      result.checks.diagnostics = await diagnostics(csql, ['CUBRID-T1001']);
    }
    if (process.env.CUBRID_RECOVERY_SERVER) {
      const launches = fs.readFileSync(path.join(root, 'recovery-launches.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(launches.length, 1, 'expected a single successor');
      assert.equal(launches[0].oldAlive, false, 'successor launched before old child exited');
      result.checks.launches = launches;
    }
    const live = processes().filter(entry => entry.parent === process.pid && (entry.command.includes(process.env.CUBRID_SERVER) || entry.command.includes(process.env.CUBRID_REAL_SERVER)));
    result.checks.children = live;
    assert.equal(live.length, 1, 'expected one server process');
    return;
  }
  if (process.env.CUBRID_CASE === 'untrusted') {
    assert.equal(vscode.workspace.isTrusted, false);
    await sleep(2000);
    result.checks.untrustedChildren = children();
    assert.equal(result.checks.untrustedChildren.length, 0);
    return;
  }
  if (process.env.CUBRID_CASE === 'missing') {
    await sleep(2500);
    await set('serverPath', process.env.CUBRID_SERVER);
    await vscode.commands.executeCommand('cubrid.restart');
    result.checks.recovery = await diagnostics(csql, ['CUBRID-T1001']);
    const item = await completions(csql, 1, 3, 'SELECT');
    result.checks.completionAfterRecovery = {label:item.label, detail:item.detail};
    return;
  }
  result.checks.missingRuntime = await diagnostics(csql, ['CUBRID-T1001']);
  fs.writeFileSync(path.join(root, 'syntax-ready'), 'ready');
  await waitFor(() => fs.existsSync(path.join(root, 'syntax-captured')), 'highlight screenshot');
  const item = await completions(csql, 1, 3, 'SELECT');
  result.checks.completion = {label:item.label, detail:item.detail, range:item.range};
  const editor = await vscode.window.showTextDocument(csql);
  editor.selection = new vscode.Selection(1, 3, 1, 3);
  await vscode.commands.executeCommand('editor.action.triggerSuggest');
  await sleep(1000);
  await vscode.commands.executeCommand('acceptSelectedSuggestion');
  assert.equal(csql.lineAt(1).text, 'SELECT');
  await csql.save();
  const bytes = fs.readFileSync(csql.uri.fsPath, 'utf8');
  assert.equal(bytes, '-- 가😀\r\nSELECT\r\nSELECT 1;\r\n');
  result.checks.acceptedCompletion = {text:bytes, eol:csql.eol};
  const indentation = await document('indent.csql', 'SELECT (');
  const indentEditor = await vscode.window.showTextDocument(indentation);
  indentEditor.selection = new vscode.Selection(0, 8, 0, 8);
  await vscode.commands.executeCommand('type', {text:'\n'});
  assert.ok(/^\s+$/.test(indentation.lineAt(1).text));
  result.checks.indentation = {line:indentation.lineAt(1).text, options:indentEditor.options};
  await indentation.save();
  await set('parserWorker', process.env.CUBRID_WORKER);
  await set('runtimePrefix', process.env.CUBRID_RUNTIME);
  const native = await document('native.csql', "SELECT '가😀';\r\nCREATE SERIAL s START WITH ;\r\nCREATE PROCEDURE p;\r\n");
  await vscode.window.showTextDocument(native);
  result.checks.native = await diagnostics(native, ['CUBRID-S1001', 'CUBRID-U1002']);
  if (process.env.CUBRID_CASE === 'invalid') {
    await set('parserWorker', 'relative-worker');
    await sleep(1000);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(native.uri, new vscode.Position(0, 0), ' ');
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    result.checks.afterInvalidUpdate = await waitFor(() => {
      const values = vscode.languages.getDiagnostics(native.uri);
      const syntax = values.find(value => value.code === 'CUBRID-S1001');
      const unsupported = values.find(value => value.code === 'CUBRID-U1002');
      return syntax && unsupported && syntax.range.start.character === 14 ? values.map(value => ({code:value.code, range:value.range})) : undefined;
    }, 'validation after invalid update');
    await set('parserWorker', process.env.CUBRID_WORKER);
    return;
  }
  if (process.env.CUBRID_CASE === 'crash') {
    const server = children()[0];
    assert.ok(server);
    process.kill(server.pid, 'SIGKILL');
    await waitFor(() => !fs.existsSync(`/proc/${server.pid}`), 'server termination');
    await sleep(1500);
    result.checks.childrenAfterCrash = children();
    assert.equal(result.checks.childrenAfterCrash.length, 0);
    await vscode.commands.executeCommand('cubrid.restart');
    const edit = new vscode.WorkspaceEdit();
    edit.insert(native.uri, new vscode.Position(0, 0), ' ');
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    result.checks.recoveredDiagnostics = await diagnostics(native, ['CUBRID-S1001', 'CUBRID-U1002']);
    result.checks.childrenAfterRestart = children();
    assert.equal(result.checks.childrenAfterRestart.length, 1);
    return;
  }
  if (process.env.CUBRID_CASE === 'workers') {
    const server = children()[0];
    assert.ok(server);
    await document('many.csql', 'SELECT 1;\n'.repeat(3000));
    let worker;
    for (let n = 0; n < 500 && !worker; n++) {
      worker = descendants(server.pid).find(entry => entry.command.includes(process.env.CUBRID_WORKER));
      if (!worker) await sleep(10);
    }
    assert.ok(worker, 'qualified native worker was not observed');
    assert.equal(fs.existsSync(`/proc/${worker.pid}`), true);
    const restart = vscode.commands.executeCommand('cubrid.restart');
    result.checks.workerBeforeRestart = worker;
    result.checks.workerAliveWhenRestartRequested = fs.existsSync(`/proc/${worker.pid}`);
    await restart;
    await waitFor(() => !fs.existsSync(`/proc/${worker.pid}`), 'owned worker exit');
    result.checks.workerGoneAfterRestart = true;
    result.checks.oldServerGoneAfterRestart = !fs.existsSync(`/proc/${server.pid}`);
    assert.equal(result.checks.oldServerGoneAfterRestart, true);
    return;
  }
  const pendingRestart = vscode.commands.executeCommand('cubrid.restart');
  await set('profile', 'unknown-profile');
  await pendingRestart;
  result.checks.configDuringStart = await diagnostics(native, ['CUBRID-U1001']);
  await set('profile', '');
  await diagnostics(native, ['CUBRID-S1001', 'CUBRID-U1002']);
  const snapshot = path.join(root, 'schema.json');
  const writeSnapshot = name => fs.writeFileSync(snapshot, JSON.stringify({schemaVersion:1,user:'dba',relations:[{owner:'dba',name,kind:'CLASS',columns:['가😀']}]}));
  writeSnapshot('FirstTable');
  await set('schemaPath', snapshot);
  await set('schemaMode', 'path');
  const schemaDoc = await document('schema.csql', 'SELECT * FROM ');
  await vscode.window.showTextDocument(schemaDoc);
  await completions(schemaDoc, 0, 14, 'FirstTable');
  writeSnapshot('SecondTable');
  const reloaded = await vscode.commands.executeCommand('cubrid.reloadSchema');
  assert.ok(Array.isArray(reloaded) && reloaded.some(x => x.uri === schemaDoc.uri.toString() && x.schemaAvailable && !x.stale));
  await completions(schemaDoc, 0, 14, 'SecondTable');
  fs.writeFileSync(snapshot, 'invalid');
  const stale = await vscode.commands.executeCommand('cubrid.reloadSchema');
  assert.ok(Array.isArray(stale) && stale.some(x => x.uri === schemaDoc.uri.toString() && x.stale));
  await completions(schemaDoc, 0, 14, 'SecondTable');
  writeSnapshot('ThirdTable');
  const recovered = await vscode.commands.executeCommand('cubrid.reloadSchema');
  assert.ok(Array.isArray(recovered) && recovered.some(x => x.uri === schemaDoc.uri.toString() && !x.stale && x.schemaAvailable));
  await completions(schemaDoc, 0, 14, 'ThirdTable');
  await set('schemaMode', 'disabled');
  const disabled = await waitFor(async () => { const state = await vscode.commands.executeCommand('cubrid.reloadSchema'); return Array.isArray(state) && state.some(x => x.uri === schemaDoc.uri.toString() && !x.schemaAvailable) ? state : undefined; }, 'disabled schema');
  result.checks.schema = {reloaded, stale, recovered, disabled};
  result.checks.nativeAfterSchemaUpdate = await diagnostics(native, ['CUBRID-S1001', 'CUBRID-U1002']);
  await vscode.workspace.getConfiguration('files').update('associations', {'*.sql':'cubrid'}, vscode.ConfigurationTarget.Global);
  result.checks.sqlOptIn = await waitFor(() => { const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === sql.uri.toString()); return doc && doc.languageId === 'cubrid' ? doc.languageId : undefined; }, 'sql opt-in');
  await set('schemaMode', 'inherit');
  const nested = path.join(workspace, 'nested');
  fs.mkdirSync(nested, {recursive:true});
  const writeProject = (dir, name) => {
    fs.writeFileSync(path.join(dir, '.cubrid-language.json'), JSON.stringify({schemaSnapshot:'catalog.json'}));
    fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify({schemaVersion:1,user:'dba',relations:[{owner:'dba',name,kind:'CLASS',columns:[]}]}));
  };
  writeProject(workspace, 'RootTable');
  writeProject(nested, 'NestedTable');
  if (process.env.CUBRID_CASE === 'roots2') {
    assert.equal(vscode.workspace.updateWorkspaceFolders(1, 1), true);
    await waitFor(() => vscode.workspace.workspaceFolders.length === 1, 'remove nested root');
    await sleep(1000);
  }
  if (process.env.CUBRID_CASE === 'roots' || process.env.CUBRID_CASE === 'roots2') {
    assert.equal(vscode.workspace.updateWorkspaceFolders(1, 0, {uri:vscode.Uri.file(nested)}), true);
    await waitFor(() => vscode.workspace.workspaceFolders.length === 2, 'add nested root');
  }
  const rootDoc = await document('root.csql', 'SELECT * FROM ');
  const nestedDoc = await document('nested/nested.csql', 'SELECT * FROM ');
  await completions(rootDoc, 0, 14, 'RootTable');
  await completions(nestedDoc, 0, 14, 'NestedTable');
  result.checks.multiroot = {folders:vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath), serverChildren:children(), root:'RootTable', nested:'NestedTable'};
  assert.equal(result.checks.multiroot.serverChildren.length, 1);
  if (process.env.CUBRID_CASE === 'roots' || process.env.CUBRID_CASE === 'roots2') return;
  if (process.env.CUBRID_CASE === 'untitled') {
    const untitled = await vscode.workspace.openTextDocument({language:'cubrid', content:'SELECT * FROM '});
    await vscode.window.showTextDocument(untitled);
    const keyword = await completions(untitled, 0, 14, 'RootTable');
    const state = await vscode.commands.executeCommand('cubrid.reloadSchema');
    const entry = state.find(value => value.uri === untitled.uri.toString());
    assert.ok(entry && entry.schemaAvailable && entry.scriptMode === 'sql');
    result.checks.untitled = {uri:untitled.uri.toString(), completion:keyword.label, state:entry};
    return;
  }
  const oldPid = result.checks.multiroot.serverChildren[0].pid;
  result.checks.descendantsBeforeRestart = descendants(oldPid);
  await vscode.commands.executeCommand('cubrid.restart');
  await vscode.commands.executeCommand('cubrid.restart');
  await sleep(2500);
  result.checks.oldProcessGone = !fs.existsSync(`/proc/${oldPid}`);
  assert.equal(result.checks.oldProcessGone, true);
  result.checks.descendantsGone = result.checks.descendantsBeforeRestart.every(entry => !fs.existsSync(`/proc/${entry.pid}`));
  assert.equal(result.checks.descendantsGone, true);
  await completions(csql, 1, 3, 'SELECT');
  result.checks.restart = await diagnostics(native, ['CUBRID-S1001', 'CUBRID-U1002']);
  const closed = [];
  const closeListener = vscode.workspace.onDidCloseTextDocument(doc => closed.push(doc.uri.toString()));
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await sleep(3000);
  closeListener.dispose();
  result.checks.closedDocuments = closed;
  result.checks.nativeIsClosed = native.isClosed;
  result.checks.closedDiagnostics = vscode.languages.getDiagnostics(native.uri).length;
  assert.equal(result.checks.closedDiagnostics, 0);
}
exports.activate = () => {
  run().then(() => { result.ok = true; }).catch(error => { result.ok = false; result.error = error.stack || String(error); }).finally(() => fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2)));
};
