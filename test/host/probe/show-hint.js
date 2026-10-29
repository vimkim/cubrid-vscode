const vscode = require('vscode');
const fs = require('fs');
const assert = require('assert').strict;

async function run({checks, document, completions, set, waitFor}) {
  const cases = [
    {name:'show-completion.csql', text:'/* 가😀 */ SHOW TAtail;\r\n', line:0, cursor:17, label:'TABLES', start:15, end:21, expected:'/* 가😀 */ SHOW TABLES;\r\n'},
    {name:'hint-completion.csql', text:'/* 가😀 */ SELECT /*+ USE_NLwrong */ 1;\r\n', line:0, cursor:27, label:'USE_NL', start:21, end:32, expected:'/* 가😀 */ SELECT /*+ USE_NL */ 1;\r\n'},
  ];
  for (const example of cases) {
    const doc = await document(example.name, example.text);
    const editor = await vscode.window.showTextDocument(doc);
    const item = await completions(doc, example.line, example.cursor, example.label);
    assert.deepEqual([item.range.start.line, item.range.start.character, item.range.end.line, item.range.end.character], [example.line, example.start, example.line, example.end]);
    editor.selection = new vscode.Selection(example.line, example.cursor, example.line, example.cursor);
    await vscode.commands.executeCommand('editor.action.triggerSuggest');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await vscode.commands.executeCommand('acceptSelectedSuggestion');
    await doc.save();
    const actual = fs.readFileSync(doc.uri.fsPath, 'utf8');
    assert.equal(actual, example.expected);
    checks[example.name] = {label:example.label, range:item.range, text:actual};
  }
  const doc = await document('warning.csql', "/* 가😀 */ SELECT /*+ BOGUS */ 1;\r\nSHOW BOGUS;\r\n");
  const read = () => vscode.languages.getDiagnostics(doc.uri).map(d => ({code:d.code, severity:d.severity, range:d.range}));
  const has = (values, code) => values.some(d => d.code === code);
  const state = (required, absent = []) => waitFor(() => {
    const values = read();
    return required.every(code => has(values, code)) && absent.every(code => !has(values, code)) ? values : undefined;
  }, `diagnostics required ${required} absent ${absent}`);
  let values = await state(['CUBRID-T1001', 'CUBRID-A1001', 'CUBRID-A1003']);
  for (const [code, line, start, end] of [['CUBRID-A1001', 0, 21, 26], ['CUBRID-A1003', 1, 5, 10]]) {
    const diagnostic = values.find(d => d.code === code);
    assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Warning);
    assert.deepEqual([diagnostic.range.start.line, diagnostic.range.start.character, diagnostic.range.end.line, diagnostic.range.end.character], [line, start, line, end]);
  }
  checks.missingRuntime = values;
  await set('parserWorker', process.env.CUBRID_WORKER);
  await set('runtimePrefix', process.env.CUBRID_RUNTIME);
  values = await state(['CUBRID-U1002', 'CUBRID-A1001', 'CUBRID-A1003'], ['CUBRID-T1001']);
  checks.nativeUnsupported = values;
  const otherWarnings = await document('other-warnings.csql', '/* 가😀 */ SELECT /*+ USE_NL((a)) */ 1;\r\n/* 가😀 */ SELECT DISTINCT /*+ ORDERED */ 1;\r\n');
  checks.otherWarnings = await waitFor(() => {
    const found = vscode.languages.getDiagnostics(otherWarnings.uri).map(d => ({code:d.code, severity:d.severity, range:d.range}));
    return ['CUBRID-U1002', 'CUBRID-A1002', 'CUBRID-A1004'].every(code => found.some(d => d.code === code)) ? found : undefined;
  }, 'malformed and misplaced hints');
  for (const [code, line, start, end] of [['CUBRID-A1002', 0, 27, 32], ['CUBRID-A1004', 1, 26, 40]]) {
    const diagnostic = checks.otherWarnings.find(d => d.code === code);
    assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Warning);
    assert.deepEqual([diagnostic.range.start.line, diagnostic.range.start.character, diagnostic.range.end.line, diagnostic.range.end.character], [line, start, line, end]);
  }
  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, new vscode.Range(0, 21, 0, 26), 'ORDERED');
  edit.replace(doc.uri, new vscode.Range(1, 5, 1, 10), 'TABLES');
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  checks.corrected = await state(['CUBRID-U1002'], ['CUBRID-A1001', 'CUBRID-A1003']);
  const invalid = new vscode.WorkspaceEdit();
  invalid.replace(doc.uri, new vscode.Range(0, 21, 0, 28), 'BOGUS');
  assert.equal(await vscode.workspace.applyEdit(invalid), true);
  checks.restored = await state(['CUBRID-U1002', 'CUBRID-A1001']);
  await set('profile', 'unknown-profile');
  checks.profileMismatch = await state(['CUBRID-U1001'], ['CUBRID-A1001', 'CUBRID-A1003']);
  await set('profile', '');
  checks.profileRestored = await state(['CUBRID-U1002', 'CUBRID-A1001']);
  const excluded = await document('excluded.csql', "SELECT '/*+ BOGUS */ SHOW BOGUS';\r\nSELECT /* BOGUS SHOW BOGUS */ 1;\r\nCREATE PROCEDURE p;\r\n");
  checks.excluded = await waitFor(() => {
    const found = vscode.languages.getDiagnostics(excluded.uri).map(d => ({code:d.code, severity:d.severity, range:d.range}));
    return found.some(d => d.code === 'CUBRID-U1002') && !found.some(d => String(d.code).startsWith('CUBRID-A')) ? found : undefined;
  }, 'comment and string exclusions');
  return checks;
}
exports.run = run;
