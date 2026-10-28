import * as vscode from 'vscode';
import { CloseAction, ErrorAction, LanguageClient, LanguageClientOptions, ServerOptions, State as ClientState } from 'vscode-languageclient/node';
import { parseSettings, Settings, wireSettings } from './settings';

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

type State = {kind:'idle'} | {kind:'running'; client:LanguageClient; settings:Settings} | {kind:'failed'} | {kind:'disposed'};
class Session {
  private state: State = {kind:'idle'};
  private queue: Promise<void> = Promise.resolve();
  private readonly output = vscode.window.createOutputChannel('CUBRID');
  private fallback = this.registerReloadFallback();
  private registerReloadFallback(): vscode.Disposable {
    return vscode.commands.registerCommand('cubrid.reloadSchema', () => this.report(new Error('Language server is not running. Open a CUBRID document and restart the server.')));
  }
  private run(action: () => Promise<void>): Promise<void> {
    const next = this.queue.then(action);
    this.queue = next.catch(error => { this.report(error); });
    return this.queue;
  }
  private report(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.output.appendLine(message);
    void vscode.window.showErrorMessage(`CUBRID: ${message}`);
  }
  configure(): Promise<void> {
    return this.run(async () => {
      if (this.state.kind === 'disposed' || !vscode.workspace.isTrusted) return;
      const settings = readSettings();
      if (this.state.kind === 'running') {
        if (this.state.settings.server !== settings.server) {
          await this.stop();
        } else {
          await this.state.client.sendNotification('workspace/didChangeConfiguration', {settings:{cubrid:wireSettings(settings)}});
          this.state = {kind:'running', client:this.state.client, settings};
          return;
        }
      }
      if (this.state.kind === 'failed') return;
      if (!vscode.workspace.textDocuments.some(doc => doc.languageId === 'cubrid')) return;
      const server: ServerOptions = {command:settings.server, args:[]};
      const options: LanguageClientOptions = {
        documentSelector: [{language:'cubrid', scheme:'file'}, {language:'cubrid', scheme:'untitled'}],
        initializationOptions: {cubrid:wireSettings(settings)},
        outputChannel:this.output,
        middleware: {executeCommand: async (command, args, next) => {
          const result: unknown = await next(command, args);
          if (command === 'cubrid.reloadSchema') this.showReload(result);
          return result;
        }},
        errorHandler: {error: () => ({action:ErrorAction.Shutdown}), closed: () => ({action:CloseAction.DoNotRestart})}
      };
      this.fallback.dispose();
      const client = new LanguageClient('cubrid', 'CUBRID Language Server', server, options);
      client.onDidChangeState(event => {
        if (event.newState === ClientState.Stopped && this.state.kind === 'running' && this.state.client === client) {
          this.state = {kind:'failed'};
          this.fallback = this.registerReloadFallback();
          this.report(new Error('Language server stopped. Run CUBRID: Restart Language Server to retry.'));
        }
      });
      try {
        await client.start();
        this.state = {kind:'running', client, settings};
      } catch (error) {
        this.state = {kind:'failed'};
        await client.stop().catch(() => undefined);
        this.fallback = this.registerReloadFallback();
        throw new Error(`Cannot start language server ${settings.server}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }
  restart(): Promise<void> {
    return this.run(async () => {
      if (this.state.kind === 'disposed') return;
      await this.stop();
    }).then(() => this.configure());
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
  private async stop(): Promise<void> {
    const previous = this.state;
    this.state = {kind:'idle'};
    if (previous.kind === 'running') {
      await previous.client.stop();
      this.fallback = this.registerReloadFallback();
    }
  }
  dispose(): Promise<void> {
    return this.run(async () => { await this.stop(); this.state = {kind:'disposed'}; this.fallback.dispose(); this.output.dispose(); });
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
