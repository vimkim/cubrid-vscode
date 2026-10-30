import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'node:child_process';
import { CloseAction, ErrorAction, LanguageClient, LanguageClientOptions, ServerOptions, State as ClientState } from 'vscode-languageclient/node';
import { parseSettings, Settings, wireSettings } from './settings';
import { missingServerWarning, nativePrerequisiteWarning, unavailableExecutable } from './prerequisites';

const keys = ['serverPath', 'parserWorker', 'runtimePrefix', 'workerManifest', 'workerTimeout', 'profile', 'scriptMode', 'configPath', 'schemaMode', 'schemaPath'];
function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration('cubrid');
  const raw: Record<string, unknown> = {};
  for (const key of keys) {
    const inspected = config.inspect<unknown>(key);
    raw[key] = inspected?.globalValue ?? inspected?.defaultValue;
  }
  return parseSettings(raw);
}

const startupDeadline = 10000;
const stopDeadline = 2000;
const terminationDeadline = 1000;
type Child = {kind:'unspawned'} | {kind:'spawned'; process:ChildProcess; exited:Promise<void>} | {kind:'exited'; process:ChildProcess};
type Attempt = {client:LanguageClient; settings:Settings; child:Child; started:Promise<void>; deadline:ReturnType<typeof setTimeout>};
type State = {kind:'idle'} | {kind:'starting'; attempt:Attempt} | {kind:'running'; attempt:Attempt} | {kind:'stopping'; attempt:Attempt; next:'idle'|'failed'|'disposed'; done:Promise<void>} | {kind:'failed'; server:string} | {kind:'blocked'; attempt:Attempt} | {kind:'disposed'};

async function bounded<T>(promise:Promise<T>, milliseconds:number, label:string): Promise<T> {
  let timer:ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds); })]);
  } finally { if (timer) clearTimeout(timer); }
}
class Session {
  private state:State = {kind:'idle'};
  private desired:Settings | undefined;
  private changed: (() => void)[] = [];
  private readonly warnings = new Map<'server' | 'native', string>();
  private readonly output = vscode.window.createOutputChannel('CUBRID');
  private fallback = this.registerReloadFallback();
  private registerReloadFallback(): vscode.Disposable {
    return vscode.commands.registerCommand('cubrid.reloadSchema', () => this.report(new Error('Language server is not running. Open a CUBRID document and restart the server.')));
  }
  private report(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.output.appendLine(message);
    void vscode.window.showErrorMessage(`CUBRID: ${message}`);
  }
  private warn(kind: 'server' | 'native', message: string | undefined): void {
    if (!message) { this.warnings.delete(kind); return; }
    if (this.warnings.get(kind) === message) return;
    this.warnings.set(kind, message);
    this.output.appendLine(`WARN: ${message}`);
    void vscode.window.showWarningMessage(`CUBRID: ${message}`);
  }
  private signal(): void { for (const resolve of this.changed.splice(0)) resolve(); }
  private setState(state:State): void { this.state = state; this.signal(); }
  private async settled(): Promise<void> {
    while (this.state.kind === 'starting' || this.state.kind === 'stopping') {
      await new Promise<void>(resolve => this.changed.push(resolve));
    }
  }
  configure(): Promise<void> {
    if (this.state.kind === 'disposed' || this.state.kind === 'blocked' || (this.state.kind === 'stopping' && this.state.next === 'disposed') || !vscode.workspace.isTrusted) return Promise.resolve();
    let settings:Settings;
    try { settings = readSettings(); } catch (error) { this.report(error); return Promise.resolve(); }
    this.desired = settings;
    const state = this.state;
    if ((state.kind === 'starting' || state.kind === 'running') && state.attempt.settings.server !== settings.server) {
      this.retire(state.attempt, 'idle');
    } else if (state.kind === 'running') {
      void this.update(state.attempt);
    } else if (state.kind === 'stopping' && state.next === 'failed' && state.attempt.settings.server !== settings.server) {
      state.next = 'idle';
    } else if (state.kind === 'failed' && state.server !== settings.server) {
      this.setState({kind:'idle'});
    }
    this.reconcile();
    return Promise.resolve();
  }
  restart(): Promise<void> {
    if (this.state.kind === 'disposed' || this.state.kind === 'blocked' || (this.state.kind === 'stopping' && this.state.next === 'disposed') || !vscode.workspace.isTrusted) return Promise.resolve();
    try { this.desired = readSettings(); } catch (error) { this.report(error); }
    const state = this.state;
    if (state.kind === 'starting' || state.kind === 'running') this.retire(state.attempt, 'idle');
    else if (state.kind === 'failed') this.setState({kind:'idle'});
    else if (state.kind === 'stopping' && state.next === 'failed') state.next = 'idle';
    this.reconcile();
    return this.settled();
  }
  private reconcile(): void {
    if (this.state.kind !== 'idle' || !this.desired || !vscode.workspace.isTrusted || !vscode.workspace.textDocuments.some(doc => doc.languageId === 'cubrid')) return;
    this.launch(this.desired);
  }
  private launch(settings:Settings): void {
    let attempt:Attempt;
    const server:ServerOptions = async () => {
      if (this.state.kind !== 'starting' || this.state.attempt !== attempt) throw new Error('Startup was cancelled');
      if (attempt.child.kind !== 'spawned') throw new Error('Language server exited before initialization');
      return attempt.child.process;
    };
    const options:LanguageClientOptions = {
      documentSelector: [{language:'cubrid', scheme:'file'}, {language:'cubrid', scheme:'untitled'}],
      initializationOptions: {cubrid:wireSettings(settings)}, outputChannel:this.output,
      middleware: {executeCommand: async (command, args, next) => {
        const result:unknown = await next(command, args);
        if (command === 'cubrid.reloadSchema') this.showReload(result);
        return result;
      }},
      errorHandler: {error: () => ({action:ErrorAction.Shutdown}), closed: () => ({action:CloseAction.DoNotRestart})}
    };
    this.fallback.dispose();
    const client = new LanguageClient('cubrid', 'CUBRID Language Server', server, options);
    attempt = {client, settings, child:{kind:'unspawned'}, started:Promise.resolve(), deadline:setTimeout(() => {
      if (this.state.kind === 'starting' && this.state.attempt === attempt) {
        this.report(new Error(`Cannot start language server ${settings.server}: initialization timed out. Check the server path and run CUBRID: Restart Language Server.`));
        this.retire(attempt, 'failed');
      }
    }, startupDeadline)};
    this.setState({kind:'starting', attempt});
    client.onDidChangeState(event => {
      if (event.newState === ClientState.Stopped && this.state.kind === 'running' && this.state.attempt === attempt) {
        this.report(new Error('Language server stopped. Run CUBRID: Restart Language Server to retry.'));
        this.retire(attempt, 'failed');
      }
    });
    attempt.started = (async () => {
      const child = spawn(settings.server, [], {stdio:'pipe'});
      const exited = new Promise<void>(resolve => {
        child.once('exit', () => { attempt.child = {kind:'exited', process:child}; resolve(); });
        child.once('error', () => { if (!child.pid) { attempt.child = {kind:'exited', process:child}; resolve(); } });
      });
      attempt.child = {kind:'spawned', process:child, exited};
      await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      if (this.state.kind !== 'starting' || this.state.attempt !== attempt) return;
      this.warn('server', undefined);
      await client.start();
      if (this.state.kind !== 'starting' || this.state.attempt !== attempt) return;
      if (client.state !== ClientState.Running) throw new Error('Language server stopped during initialization');
      clearTimeout(attempt.deadline);
      this.setState({kind:'running', attempt});
      await this.update(attempt);
    })().catch(error => {
      if (this.state.kind !== 'starting' || this.state.attempt !== attempt) return;
      if (unavailableExecutable(error)) this.warn('server', missingServerWarning(settings.server));
      else this.report(new Error(`Cannot start language server ${settings.server}: ${error instanceof Error ? error.message : String(error)}`));
      this.retire(attempt, 'failed');
    });
  }
  private async update(attempt:Attempt): Promise<void> {
    const settings = this.desired;
    if (!settings || this.state.kind !== 'running' || this.state.attempt !== attempt) return;
    void nativePrerequisiteWarning(settings.native).then(message => {
      if (this.desired === settings && vscode.workspace.isTrusted && this.state.kind === 'running' && this.state.attempt === attempt) this.warn('native', message);
    });
    try { await attempt.client.sendNotification('workspace/didChangeConfiguration', {settings:{cubrid:wireSettings(settings)}}); }
    catch (error) { if (this.state.kind === 'running' && this.state.attempt === attempt) this.report(error); }
  }
  private retire(attempt:Attempt, next:'idle'|'failed'|'disposed'): void {
    clearTimeout(attempt.deadline);
    const wasRunning = this.state.kind === 'running';
    const state:Extract<State, {kind:'stopping'}> = {kind:'stopping', attempt, next, done:Promise.resolve()};
    this.setState(state);
    state.done = this.cleanup(attempt, wasRunning).then(() => {
      if (this.state !== state) return;
      if (state.next === 'disposed') { this.setState({kind:'disposed'}); this.output.dispose(); return; }
      this.fallback = this.registerReloadFallback();
      this.setState(state.next === 'failed' ? {kind:'failed',server:attempt.settings.server} : {kind:'idle'});
      this.reconcile();
    }).catch(error => { this.report(new Error(`Cannot retire language server: ${error instanceof Error ? error.message : String(error)}`)); this.setState({kind:'blocked', attempt}); });
  }
  private async cleanup(attempt:Attempt, wasRunning:boolean): Promise<void> {
    let stopError:unknown;
    if (wasRunning) {
      try { await bounded(attempt.client.stop(stopDeadline), stopDeadline + 500, 'Graceful shutdown'); }
      catch (error) { stopError = error; }
    }
    let child = attempt.child;
    if (wasRunning && child.kind === 'spawned') {
      try { await bounded(child.exited, terminationDeadline, 'Graceful server exit'); } catch {}
      child = attempt.child;
    }
    if (child.kind === 'spawned') {
      child.process.kill('SIGTERM');
      try { await bounded(child.exited, terminationDeadline, 'Server termination'); }
      catch { child.process.kill('SIGKILL'); await bounded(child.exited, terminationDeadline, 'Server exit'); }
    }
    child = attempt.child;
    if (child.kind !== 'unspawned') {
      const streams = [child.process.stdin, child.process.stdout, child.process.stderr].filter(stream => stream !== null);
      const closed = streams.map(stream => stream.closed ? Promise.resolve() : new Promise<void>(resolve => stream.once('close', resolve)));
      for (const stream of streams) stream.destroy();
      await bounded(Promise.all(closed), stopDeadline, 'Server stream closure');
    }
    await bounded(attempt.started, stopDeadline, 'Client start settlement');
    child = attempt.child;
    if (child.kind === 'spawned') throw new Error('Server exit was not observed');
    if (child.kind === 'exited' && [child.process.stdin, child.process.stdout, child.process.stderr].some(stream => stream && !stream.destroyed)) throw new Error('Server streams remain open');
    let disposalError:unknown;
    try { await bounded(attempt.client.dispose(), stopDeadline, 'Client disposal'); } catch (error) { disposalError = error; }
    const features = [attempt.client.getFeature('textDocument/completion'), attempt.client.getFeature('workspace/executeCommand'), attempt.client.getFeature('textDocument/didOpen'), attempt.client.getFeature('textDocument/didChange'), attempt.client.getFeature('textDocument/didClose')];
    const until = Date.now() + stopDeadline;
    while (features.some(feature => { const state = feature.getState(); return state.kind !== 'static' && state.registrations; }) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    if (features.some(feature => { const state = feature.getState(); return state.kind !== 'static' && state.registrations; })) throw new Error('Client registrations remain active');
    if (stopError) {
      const message = stopError instanceof Error ? stopError.message : String(stopError);
      if (message !== 'Stopping the server timed out' && message !== 'Graceful shutdown timed out') throw stopError;
      this.output.appendLine(`Graceful shutdown: ${message}`);
    }
    if (disposalError) {
      const message = disposalError instanceof Error ? disposalError.message : String(disposalError);
      if (message !== "Client is not running and can't be stopped. It's current state is: startFailed" && message !== 'Cannot call write after a stream was destroyed') throw disposalError;
      this.output.appendLine(`Retired client disposal: ${message}`);
    }
  }
  private showReload(result: unknown): void {
    if (!Array.isArray(result)) throw new Error('Schema reload returned an invalid result');
    const lines = result.map((item: unknown) => {
      if (typeof item !== 'object' || item === null || !('uri' in item) || !('stale' in item) || !('availability' in item) || !('schemaAvailable' in item) || typeof item.uri !== 'string' || typeof item.stale !== 'boolean' || typeof item.schemaAvailable !== 'boolean' || (item.availability !== null && typeof item.availability !== 'string')) throw new Error('Schema reload returned an invalid document result');
      return `${item.uri}: ${item.availability ?? (item.schemaAvailable ? 'available' : 'not configured')}${item.stale ? ' (stale)' : ''}`;
    });
    const message = lines.length ? lines.join('\n') : 'No CUBRID documents are open.';
    this.output.appendLine(`Schema reload:\n${message}`);
    void vscode.window.showInformationMessage(`CUBRID schema reload: ${message}`);
  }
  async dispose(): Promise<void> {
    const state = this.state;
    if (state.kind === 'disposed' || state.kind === 'blocked') return;
    if (state.kind === 'starting' || state.kind === 'running') this.retire(state.attempt, 'disposed');
    else if (state.kind === 'stopping') state.next = 'disposed';
    else { this.setState({kind:'disposed'}); this.fallback.dispose(); this.output.dispose(); return; }
    const stopping = this.state;
    if (stopping.kind === 'stopping') await stopping.done;
    this.fallback.dispose();
  }

}
let session: Session | undefined;
export function activate(context: vscode.ExtensionContext): void {
  const owner = new Session();
  session = owner;
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => { if (doc.languageId === 'cubrid') void owner.configure(); }),
    vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('cubrid')) void owner.configure(); }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => { void owner.configure(); }),
    vscode.commands.registerCommand('cubrid.restart', () => owner.restart())
  );
  void owner.configure();
}
export async function deactivate(): Promise<void> { await session?.dispose(); }
