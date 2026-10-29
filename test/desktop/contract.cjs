const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CASES = Object.freeze(['portable', 'hanging-replace', 'hanging-term', 'hanging-timeout']);
const COVERAGE = 'trusted-desktop-missing-native';
const ACCEPTED_TEXT = '-- 가😀\r\nSELECT\r\nSELECT 1;\r\n';

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function processState(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return {state:fields[0], parentPid:Number(fields[1]), startTime:fields[19]};
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return null;
    throw error;
  }
}

function processAlive(identity) {
  const state = processState(identity.pid);
  return state !== null && state.startTime === identity.startTime && state.state !== 'Z';
}

function processes(directory) {
  return fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => {
    const receipt = readJson(path.join(directory, name));
    assert.ok(Number.isSafeInteger(receipt.pid) && receipt.pid > 1, 'invalid process PID');
    assert.match(receipt.startTime, /^\d+$/, 'invalid process start time');
    assert.ok(Number.isSafeInteger(receipt.parentPid), 'invalid process parent');
    assert.ok(['real', 'hanging'].includes(receipt.kind), 'invalid process kind');
    assert.ok(Array.isArray(receipt.predecessors), 'missing predecessor observations');
    return receipt;
  });
}

function readInput(file) {
  const input = readJson(file);
  assert.ok(CASES.includes(input.name), 'unknown desktop case');
  for (const key of ['root', 'workspace', 'extensions', 'userData', 'processes', 'probeReceipt', 'realServer', 'server', 'hangingServer', 'installedPath']) {
    assert.equal(typeof input[key], 'string', `missing case path ${key}`);
    assert.ok(path.isAbsolute(input[key]), `case path ${key} must be absolute`);
  }
  assert.equal(input.coverage, COVERAGE);
  assert.match(input.editorVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(input.extensionId, 'cubrid-local.cubrid-language');
  assert.equal(typeof input.extensionVersion, 'string');
  return input;
}

function readProbeResult(file, input) {
  assert.ok(fs.existsSync(file), `missing probe receipt ${file}`);
  const result = readJson(file);
  assert.equal(result.status, 'passed', `failed probe receipt: ${result.error || result.status}`);
  assert.equal(result.name, input.name, 'probe case mismatch');
  const identity = result.identity;
  assert.ok(identity && result.observations, 'missing identity or observations');
  assert.equal(identity.editorVersion, input.editorVersion);
  assert.equal(identity.appName, 'Visual Studio Code');
  assert.match(identity.hostNode, /^v\d+\.\d+\.\d+$/);
  assert.equal(identity.trusted, true);
  assert.equal(result.coverage, COVERAGE);
  assert.deepEqual(identity.native, {parserWorker:'', runtimePrefix:'', workerManifest:''});
  assert.equal(identity.extensionId, input.extensionId);
  assert.equal(identity.extensionVersion, input.extensionVersion);
  assert.equal(identity.extensionPath, input.installedPath);
  const observed = result.observations;
  assert.ok(observed.missingRuntime.some(item => item.code === 'CUBRID-T1001'), 'missing native-unavailable diagnostic');
  assert.equal(observed.completion.label, 'SELECT');
  assert.equal(typeof observed.completion.detail, 'string');
  assert.equal(observed.serverCount, 1);
  if (input.name === 'portable') {
    assert.deepEqual(observed.language, {csql:'cubrid', sql:'sql', sqlOptIn:'cubrid'});
    assert.equal(observed.acceptedText, ACCEPTED_TEXT);
    assert.deepEqual(observed.schema.map(entry => entry.name), ['SchemaA', 'SchemaB', 'stale', 'SchemaC', 'disabled', 'ProjectTable']);
    for (const entry of observed.schema) {
      const expected = entry.name === 'stale' ? 'SchemaB' : entry.name;
      assert.equal(entry.state.stale, entry.name === 'stale');
      assert.equal(entry.state.schemaAvailable, entry.name !== 'disabled');
      if (entry.name !== 'disabled') assert.ok(entry.labels.includes(expected));
      for (const old of ['SchemaA', 'SchemaB', 'SchemaC', 'ProjectTable']) {
        if (old !== expected) assert.ok(!entry.labels.includes(old), `${old} survived schema replacement`);
      }
    }
    assert.equal(observed.restarts.length, 2);
    for (const restart of observed.restarts) {
      assert.equal(restart.previousExited, true);
      assert.equal(restart.candidateCount, 1);
      assert.notDeepEqual(restart.predecessor, restart.successor);
      assert.ok(restart.diagnostics.some(item => item.code === 'CUBRID-T1001'));
    }
  } else {
    assert.equal(observed.recovery.previousExited, true);
    assert.equal(observed.recovery.successorPredecessorAlive, false);
    assert.equal(observed.recovery.realLaunches, 1);
    if (input.name === 'hanging-term') assert.equal(observed.recovery.termObserved, true);
    if (input.name === 'hanging-timeout') {
      assert.equal(observed.recovery.automaticSuccessors, 0);
      assert.ok(observed.recovery.quietPeriodMs >= 1500);
    }
  }
  return result;
}

function assertComplete(result) {
  assert.deepEqual(result.cases.map(entry => entry.name), CASES, 'incomplete desktop case set');
  for (const entry of result.cases) {
    assert.equal(entry.status, 'passed', `case ${entry.name} failed`);
    assert.equal(entry.sdkExitCode, 0);
    assert.ok(entry.processes.length > 0, 'missing owned process observations');
    assert.ok(entry.processes.every(process => process.alive === false), 'owned process survived editor exit');
    readProbeResult(entry.probeReceipt, readInput(entry.input));
  }
}

module.exports = {CASES, COVERAGE, ACCEPTED_TEXT, writeJson, readJson, readInput, readProbeResult, assertComplete, processState, processAlive, processes};
