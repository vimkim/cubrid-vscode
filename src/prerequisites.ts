import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { Settings } from './settings';

const guide = 'Installation guide: https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md';
const restart = 'Run CUBRID: Restart Language Server after correcting the trusted user or remote-machine settings.';

export function unavailableExecutable(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'EISDIR'].includes(String(error.code));
}

export function missingServerWarning(server: string): string {
  return `Install cubrid-language-server: the required binary is missing or not executable. Configured server: ${server}. ${guide} Set cubrid.serverPath to the installed executable's absolute path, or make cubrid-language-server available on the editor host PATH. ${restart}`;
}

async function available(file: string, kind: 'file' | 'directory', mode: number): Promise<boolean> {
  try {
    const info = await stat(file);
    if (kind === 'file' ? !info.isFile() : !info.isDirectory()) return false;
    await access(file, mode);
    return true;
  } catch { return false; }
}

export async function nativePrerequisiteWarning(native: Settings['native']): Promise<string | undefined> {
  let reason: string;
  if (native.kind === 'absent') {
    reason = 'parser-worker and its matching CUBRID runtime and qualification manifest are not configured';
  } else {
    const manifest = native.manifest ?? path.join(path.dirname(native.worker), 'manifest.json');
    if (!await available(native.worker, 'file', constants.X_OK)) reason = `parser-worker ${native.worker} is missing or not executable`;
    else if (!await available(native.runtime, 'directory', constants.R_OK | constants.X_OK)) reason = `CUBRID runtime ${native.runtime} is missing or inaccessible`;
    else if (!await available(manifest, 'file', constants.R_OK)) reason = `qualification manifest ${manifest} is missing or unreadable`;
    else return undefined;
  }
  return `Strict diagnostics are unavailable. Install the native parser-worker and matching runtime. ${reason}. Keyword completion can continue. ${guide} Configure cubrid.parserWorker and cubrid.runtimePrefix together; cubrid.workerManifest defaults to manifest.json beside parser-worker. ${restart}`;
}
