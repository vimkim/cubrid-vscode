const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn, execFileSync} = require('node:child_process');
const {parseArgs} = require('node:util');
const {createHash} = require('node:crypto');
const {CASES, COVERAGE, writeJson, readJson, readInput, readProbeResult, assertComplete, processState, processAlive, processes} = require('./contract.cjs');

async function supervise(command, args, {root, name, timeout, env = process.env}) {
  const receiptPath = path.join(root, `${name}.process.json`);
  const receipt = {status:'starting', command, args, timeout, startedAt:new Date().toISOString(), intervened:false, terminationSignals:[]};
  writeJson(receiptPath, receipt);
  const output = fs.openSync(path.join(root, `${name}.stdout.log`), 'w');
  const errors = fs.openSync(path.join(root, `${name}.stderr.log`), 'w');
  let child;
  try {
    child = spawn(command, args, {detached:true, env, stdio:['ignore', output, errors]});
  } finally {
    fs.closeSync(output);
    fs.closeSync(errors);
  }
  receipt.pid = child.pid;
  receipt.process = child.pid ? processState(child.pid) : null;
  receipt.status = 'running';
  writeJson(receiptPath, receipt);
  let deadline;
  let escalation;
  const killGroup = signal => {
    try { process.kill(-child.pid, signal); receipt.terminationSignals.push(signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        receipt.exitCode = code;
        receipt.signal = signal;
        if (receipt.status === 'timed-out') return;
        if (code === 0) resolve();
        else reject(new Error(`${name} exited with ${code ?? signal}`));
      });
      deadline = setTimeout(() => {
        receipt.status = 'timed-out';
        receipt.intervened = true;
        receipt.failureObservedAt = new Date().toISOString();
        writeJson(receiptPath, receipt);
        killGroup('SIGTERM');
        escalation = setTimeout(() => {
          killGroup('SIGKILL');
          reject(new Error(`${name} timed out after ${timeout} ms`));
        }, 1000);
      }, timeout);
    });
    receipt.status = 'passed';
    return receipt;
  } catch (error) {
    if (receipt.status !== 'timed-out') {
      receipt.status = 'failed';
      if (child.pid) {
        receipt.intervened = true;
        writeJson(receiptPath, receipt);
        killGroup('SIGKILL');
      }
    }
    receipt.error = error.stack || String(error);
    throw error;
  } finally {
    clearTimeout(deadline);
    clearTimeout(escalation);
    receipt.finishedAt = new Date().toISOString();
    writeJson(receiptPath, receipt);
  }
}

function profiles(input) {
  return [`--user-data-dir=${input.userData}`, `--extensions-dir=${input.extensions}`];
}

function hostedOnly() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'desktop execution requires GitHub-hosted CI');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'desktop execution requires a hosted runner');
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.equal(process.versions.node.split('.')[0], '22', 'controller requires Node 22');
}

async function sdkChild(operation, inputFile) {
  hostedOnly();
  const sdk = require('@vscode/test-electron');
  if (operation === '__download') {
    const input = readJson(inputFile);
    const executable = await sdk.downloadAndUnzipVSCode({version:input.version, platform:'linux-x64', cachePath:input.cache, timeout:30000});
    writeJson(input.receipt, {executable});
  } else {
    const input = readInput(inputFile);
    const exitCode = await sdk.runTests({
      vscodeExecutablePath:input.executable,
      extensionDevelopmentPath:path.join(__dirname, 'probe'),
      extensionTestsPath:path.join(__dirname, 'probe', 'index.cjs'),
      launchArgs:[input.workspace, ...profiles(input), '--disable-gpu', '--password-store=basic'],
      extensionTestsEnv:{CUBRID_DESKTOP_INPUT:inputFile},
    });
    assert.equal(exitCode, 0, 'SDK returned a nonzero exit');
    writeJson(path.join(input.root, 'sdk.json'), {exitCode});
  }
}

async function editorIdentity(requested, root) {
  let version = requested;
  if (requested === 'stable') {
    const url = 'https://update.code.visualstudio.com/api/releases/stable?released=true';
    const response = await fetch(url, {signal:AbortSignal.timeout(30000), cache:'no-store'});
    assert.equal(response.ok, true, `stable release lookup failed with ${response.status}`);
    const body = await response.text();
    fs.writeFileSync(path.join(root, 'stable-releases.json'), body);
    const releases = JSON.parse(body);
    assert.ok(Array.isArray(releases) && releases.length > 0, 'empty stable release list');
    assert.ok(releases.every(value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value)), 'invalid stable release list');
    version = releases[0];
    writeJson(path.join(root, 'stable-lookup.json'), {url, retrievedAt:new Date().toISOString(), resolvedVersion:version, sha256:createHash('sha256').update(body).digest('hex')});
  }
  const inputFile = path.join(root, 'download-input.json');
  writeJson(inputFile, {version, cache:path.join(root, 'editor-cache'), receipt:path.join(root, 'download.json')});
  await supervise(process.execPath, [__filename, '__download', inputFile], {root, name:'download', timeout:180000});
  const {executable} = readJson(path.join(root, 'download.json'));
  const product = readJson(path.join(path.dirname(executable), 'resources', 'app', 'product.json'));
  assert.equal(product.nameLong, 'Visual Studio Code');
  assert.equal(product.applicationName, 'code');
  assert.equal(product.quality, 'stable');
  const identityProfile = {userData:path.join(root, 'identity-user-data'), extensions:path.join(root, 'identity-extensions')};
  const cli = require('@vscode/test-electron').resolveCliArgsFromVSCodeExecutablePath(executable, {reuseMachineInstall:true, platform:'linux-x64'});
  assert.equal(cli.length, 1, 'SDK inserted shared profile arguments');
  await supervise(cli[0], [...profiles(identityProfile), '--version'], {root, name:'editor-version', timeout:30000});
  const output = fs.readFileSync(path.join(root, 'editor-version.stdout.log'), 'utf8').trim();
  const [observedVersion, commit, architecture] = output.split(/\r?\n/);
  assert.equal(observedVersion, version, 'downloaded editor differs from requested release');
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.equal(architecture, 'x64');
  const identity = {requested, resolvedVersion:version, cliVersion:output, cliCommit:commit, cliArchitecture:architecture, microsoftProductName:product.nameLong, executable, cli:cli[0]};
  writeJson(path.join(root, 'editor.json'), identity);
  return identity;
}

async function packageCommand(operation, vsix, sourceSha, root, installed) {
  const args = [path.join(__dirname, 'package.py'), operation, '--vsix', vsix, '--source-sha', sourceSha];
  if (installed) args.push('--installed', installed);
  await supervise('python3', args, {root, name:`package-${operation}`, timeout:30000});
  return readJson(path.join(root, `package-${operation}.stdout.log`));
}

async function desktopCase(name, options, editor, provenance, sourceSha) {
  const root = path.join(options.out, name);
  fs.mkdirSync(root);
  const input = {name, root, coverage:COVERAGE, realServer:options.server, editorVersion:editor.resolvedVersion, executable:editor.executable, extensionId:provenance.extensionId, extensionVersion:provenance.extensionVersion};
  for (const key of ['workspace', 'userData', 'extensions', 'processes']) {
    input[key] = path.join(root, key);
    fs.mkdirSync(input[key]);
  }
  input.probeReceipt = path.join(root, 'probe.json');
  input.server = path.join(root, 'record-real');
  input.hangingServer = path.join(root, 'record-hanging');
  for (const file of [input.server, input.hangingServer]) fs.symlinkSync(path.join(__dirname, 'record-server.py'), file);
  fs.mkdirSync(path.join(input.userData, 'User'));
  writeJson(path.join(input.userData, 'User', 'settings.json'), {
    'cubrid.serverPath':name === 'portable' ? input.server : input.hangingServer,
    'cubrid.parserWorker':'', 'cubrid.runtimePrefix':'', 'cubrid.workerManifest':'',
    'telemetry.telemetryLevel':'off', 'update.mode':'none', 'extensions.autoCheckUpdates':false,
    'extensions.autoUpdate':false, 'workbench.startupEditor':'none', 'window.restoreWindows':'none',
    'editor.quickSuggestions':false, 'editor.suggest.snippetsPreventQuickSuggestions':false,
    'editor.snippetSuggestions':'none', 'editor.wordBasedSuggestions':'off', 'editor.suggestSelection':'first',
  });
  const caseResult = {name, status:'failed', probeReceipt:input.probeReceipt, input:path.join(root, 'input.json'), processes:[]};
  try {
    await supervise(editor.cli, [...profiles(input), '--install-extension', options.vsix, '--force'], {root, name:'install', timeout:60000});
    await supervise(editor.cli, [...profiles(input), '--list-extensions', '--show-versions'], {root, name:'extension-list', timeout:30000});
    const listing = fs.readFileSync(path.join(root, 'extension-list.stdout.log'), 'utf8').trim().split(/\r?\n/);
    assert.ok(listing.includes(`${provenance.extensionId}@${provenance.extensionVersion}`), 'installed extension not listed');
    const installed = fs.readdirSync(input.extensions).filter(entry => entry.startsWith(`${provenance.extensionId}-`) && fs.statSync(path.join(input.extensions, entry)).isDirectory());
    assert.equal(installed.length, 1, 'expected exactly one installed product');
    input.installedPath = fs.realpathSync(path.join(input.extensions, installed[0]));
    const verified = await packageCommand('installed', options.vsix, sourceSha, root, input.installedPath);
    writeJson(path.join(root, 'installed.json'), verified);
    writeJson(caseResult.input, input);
    await supervise(process.execPath, [__filename, '__case', caseResult.input], {root, name:'desktop', timeout:180000});
    caseResult.sdkExitCode = readJson(path.join(root, 'sdk.json')).exitCode;
    assert.equal(caseResult.sdkExitCode, 0);
    readProbeResult(input.probeReceipt, input);
    const deadline = Date.now() + 5000;
    while (processes(input.processes).some(processAlive) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    caseResult.processes = processes(input.processes).map(identity => ({...identity, alive:processAlive(identity), observedAt:new Date().toISOString()}));
    assert.ok(caseResult.processes.length > 0, 'no server launches recorded');
    assert.ok(caseResult.processes.every(identity => !identity.alive), 'owned server survived desktop exit');
    caseResult.status = 'passed';
  } catch (error) {
    caseResult.error = error.stack || String(error);
  } finally {
    caseResult.processes = processes(input.processes).map(identity => ({...identity, alive:processAlive(identity), observedAt:new Date().toISOString()}));
    writeJson(path.join(root, 'controller.json'), caseResult);
    const survivors = caseResult.processes.filter(identity => identity.alive);
    if (survivors.length) {
      caseResult.status = 'failed';
      caseResult.cleanupIntervention = survivors;
      writeJson(path.join(root, 'controller.json'), caseResult);
      for (const identity of survivors) {
        if (!processAlive(identity)) continue;
        try { process.kill(identity.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
  }
  return caseResult;
}

async function main(argv) {
  const {values:options} = parseArgs({args:argv, options:{editor:{type:'string'}, vsix:{type:'string'}, server:{type:'string'}, out:{type:'string'}, 'core-receipt':{type:'string'}}});
  assert.ok(options.out && path.isAbsolute(options.out), '--out must be a fresh absolute directory');
  fs.mkdirSync(options.out);
  const result = {status:'running', coverage:COVERAGE, cases:[], startedAt:new Date().toISOString()};
  const receipt = path.join(options.out, 'controller.json');
  writeJson(receipt, result);
  try {
    hostedOnly();
    assert.ok(options.editor === 'stable' || options.editor === '1.109.0', '--editor must be 1.109.0 or stable');
    for (const key of ['vsix', 'server', 'core-receipt']) assert.ok(options[key] && path.isAbsolute(options[key]), `--${key} must be absolute`);
    fs.accessSync(options.server, fs.constants.X_OK);
    const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8', timeout:5000}).trim();
    assert.equal(sourceSha, process.env.GITHUB_SHA, 'workflow and checkout SHA differ');
    result.package = await packageCommand('verify', options.vsix, sourceSha, options.out);
    assert.equal(result.package.lockfileSha256, createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../../package-lock.json'))).digest('hex'), 'consumer lockfile differs from packaged source');
    result.core = readJson(options['core-receipt']);
    assert.equal(result.core.sourceCommit, '2a8842c45c4fb219e322afd731c27937a107324f');
    assert.equal(result.core.serverPath, options.server);
    assert.match(result.core.python, /^3\.10\./);
    assert.deepEqual(result.core.buildTools, {pip:'25.1.1', setuptools:'77.0.3', wheel:'0.45.1'});
    assert.match(result.core.wheelSha256, /^[a-f0-9]{64}$/);
    result.editor = await editorIdentity(options.editor, options.out);
    for (const name of CASES) {
      result.cases.push(await desktopCase(name, options, result.editor, result.package, sourceSha));
      writeJson(receipt, result);
    }
    assertComplete(result);
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed';
    result.error = error.stack || String(error);
    throw error;
  } finally {
    result.finishedAt = new Date().toISOString();
    writeJson(receipt, result);
  }
}

if (require.main === module) {
  const operation = process.argv[2];
  const run = ['__download', '__case'].includes(operation) ? sdkChild(operation, process.argv[3]) : main(process.argv.slice(2));
  run.catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}

module.exports = {supervise, editorIdentity};
