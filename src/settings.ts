import * as path from 'node:path';

type Native = {kind: 'absent'} | {kind: 'configured'; worker: string; runtime: string; manifest?: string; timeout: number};
type Schema = {kind: 'inherit'} | {kind: 'disabled'} | {kind: 'path'; path: string};
export interface Settings {
  server: string;
  native: Native;
  schema: Schema;
  profile?: string;
  scriptMode?: 'sql' | 'csql';
  configPath?: string;
}

function stringValue(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}
function absolute(value: string, key: string): string {
  if (!path.isAbsolute(value) || /\0|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw new Error(`${key} must be a valid absolute path`);
  return value;
}
export function parseSettings(raw: Record<string, unknown>): Settings {
  const server = stringValue(raw, 'serverPath');
  if (server !== 'cubrid-language-server') absolute(server, 'serverPath');
  const worker = stringValue(raw, 'parserWorker');
  const runtime = stringValue(raw, 'runtimePrefix');
  const manifest = stringValue(raw, 'workerManifest');
  const timeout = raw.workerTimeout;
  if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0 || timeout > 300) throw new Error('workerTimeout must be greater than 0 and at most 300');
  if (Boolean(worker) !== Boolean(runtime) || (!worker && manifest)) throw new Error('parserWorker and runtimePrefix must be configured together');
  const native: Native = worker ? {kind:'configured', worker:absolute(worker, 'parserWorker'), runtime:absolute(runtime, 'runtimePrefix'), ...(manifest ? {manifest:absolute(manifest, 'workerManifest')} : {}), timeout} : {kind:'absent'};
  const mode = stringValue(raw, 'schemaMode');
  const schemaPath = stringValue(raw, 'schemaPath');
  let schema: Schema;
  switch (mode) {
    case 'inherit': schema = {kind:'inherit'}; break;
    case 'disabled': schema = {kind:'disabled'}; break;
    case 'path': schema = {kind:'path', path:absolute(schemaPath, 'schemaPath')}; break;
    default: throw new Error('schemaMode must be inherit, disabled, or path');
  }
  const script = stringValue(raw, 'scriptMode');
  if (script !== 'inherit' && script !== 'sql' && script !== 'csql') throw new Error('scriptMode must be inherit, sql, or csql');
  const profile = stringValue(raw, 'profile');
  const config = stringValue(raw, 'configPath');
  return {server, native, schema, ...(profile ? {profile} : {}), ...(script === 'inherit' ? {} : {scriptMode:script}), ...(config ? {configPath:absolute(config, 'configPath')} : {})};
}
export function wireSettings(settings: Settings): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  if (settings.native.kind === 'configured') {
    result.parserWorker = settings.native.worker;
    result.runtimePrefix = settings.native.runtime;
    result.workerTimeout = settings.native.timeout;
    if (settings.native.manifest) result.workerManifest = settings.native.manifest;
  }
  if (settings.schema.kind === 'disabled') result.schemaSnapshot = null;
  if (settings.schema.kind === 'path') result.schemaSnapshot = settings.schema.path;
  if (settings.profile) result.profile = settings.profile;
  if (settings.scriptMode) result.scriptMode = settings.scriptMode;
  if (settings.configPath) result.configPath = settings.configPath;
  return result;
}
