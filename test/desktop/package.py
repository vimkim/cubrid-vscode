import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import zipfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def command(*args):
    return subprocess.check_output(args, text=True).strip()


def inventory(vsix):
    with zipfile.ZipFile(vsix) as archive:
        names = [item.filename for item in archive.infolist() if not item.is_dir()]
        if len(names) != len(set(names)):
            raise ValueError('duplicate VSIX entries')
        for name in names:
            member = PurePosixPath(name)
            if member.is_absolute() or '..' in member.parts or '\\' in name:
                raise ValueError(f'unsafe VSIX entry {name}')
        files = {name.removeprefix('extension/'): archive.read(name) for name in names if name.startswith('extension/')}
        required = {'package.json', 'out/extension.js', 'out/settings.js', 'language-configuration.json', 'syntaxes/cubrid.tmLanguage.json', 'node_modules/vscode-languageclient/package.json'}
        if not required.issubset(files):
            raise ValueError(f'missing runtime files {required - files.keys()}')
        if any(name.startswith(('test/', 'src/', '.github/')) for name in files):
            raise ValueError('test, source or CI files shipped in VSIX')
        manifest = json.loads(files['package.json'])
        if '__metadata' in manifest:
            raise ValueError('unexpected metadata in packaged manifest')
        if json.loads(files['node_modules/vscode-languageclient/package.json'])['version'] != '9.0.1':
            raise ValueError('packaged languageclient must be 9.0.1')
        renamed = {'readme.md': 'README.md', 'LICENSE.txt': 'LICENSE'}
        members = [{'path': name, 'sha256': digest(data), 'sourceOrBuildPath': renamed.get(name, name)} for name, data in sorted(files.items())]
        return manifest, members, files


def verify(vsix, source_sha):
    sidecar = Path(str(vsix) + '.provenance.json')
    if not sidecar.is_file():
        raise ValueError(f'missing provenance {sidecar}')
    provenance = json.loads(sidecar.read_text())
    if digest(vsix.read_bytes()) != provenance['vsixSha256']:
        raise ValueError('VSIX hash does not match provenance')
    if provenance['sourceCommit'] != source_sha or provenance['workflowSha'] != source_sha:
        raise ValueError('source or workflow SHA does not match checkout')
    if provenance['initialGitStatus'] != '':
        raise ValueError('package was not built from a clean checkout')
    manifest, members, _ = inventory(vsix)
    if members != provenance['members'] or manifest != provenance['manifest']:
        raise ValueError('VSIX inventory does not match provenance')
    if provenance['extensionId'] != 'cubrid-local.cubrid-language' or provenance['extensionVersion'] != manifest['version']:
        raise ValueError('unexpected extension identity')
    if provenance['extensionId'] != f"{manifest['publisher']}.{manifest['name']}":
        raise ValueError('manifest identity mismatch')
    return provenance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['create', 'verify', 'installed'])
    parser.add_argument('--vsix', required=True, type=Path)
    parser.add_argument('--source-sha')
    parser.add_argument('--installed', type=Path)
    args = parser.parse_args()
    if args.operation == 'create':
        status = command('git', 'status', '--porcelain', '--untracked-files=all')
        if status:
            raise ValueError('package provenance requires a clean checkout')
        source_sha = command('git', 'rev-parse', 'HEAD')
        workflow_sha = os.environ.get('GITHUB_SHA', source_sha)
        if workflow_sha != source_sha:
            raise ValueError('workflow and source SHA differ')
        manifest, members, files = inventory(args.vsix)
        for member in members:
            if Path(member['sourceOrBuildPath']).read_bytes() != files[member['path']]:
                raise ValueError(f'package/source mismatch {member["path"]}')
        provenance = {
            'sourceCommit': source_sha, 'workflowSha': workflow_sha, 'initialGitStatus': status,
            'workflowUrl': f"{os.environ.get('GITHUB_SERVER_URL', '')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}",
            'lockfileSha256': digest(Path('package-lock.json').read_bytes()),
            'vsixSha256': digest(args.vsix.read_bytes()), 'manifest': manifest, 'members': members,
            'sourceFiles': [{'path': name, 'sha256': digest(Path(name).read_bytes())} for name in command('git', 'ls-files').splitlines()],
            'extensionId': f"{manifest['publisher']}.{manifest['name']}", 'extensionVersion': manifest['version'],
            'tools': {'node': command('node', '--version'), 'npm': command('npm', '--version'),
                      'vsce': json.loads(Path('node_modules/@vscode/vsce/package.json').read_text())['version'],
                      'typescript': json.loads(Path('node_modules/typescript/package.json').read_text())['version']},
            'runner': {'os': os.environ.get('RUNNER_OS'), 'image': os.environ.get('ImageOS'), 'version': os.environ.get('ImageVersion')},
        }
        Path(str(args.vsix) + '.provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    else:
        if not args.source_sha:
            raise ValueError('--source-sha is required')
        provenance = verify(args.vsix, args.source_sha)
        if args.operation == 'installed':
            if args.installed is None:
                raise ValueError('--installed is required')
            installed = args.installed.resolve(strict=True)
            expected = {member['path']: member for member in provenance['members']}
            if '.vsixmanifest' in expected:
                raise ValueError('unexpected packaged .vsixmanifest')
            with zipfile.ZipFile(args.vsix) as archive:
                expected['.vsixmanifest'] = {'sha256': digest(archive.read('extension.vsixmanifest'))}
            if any(file.is_symlink() for file in installed.rglob('*')):
                raise ValueError('installed runtime contains a symlink')
            actual = {file.relative_to(installed).as_posix() for file in installed.rglob('*') if file.is_file()}
            if actual != set(expected):
                raise ValueError(f'installed inventory differs: missing {set(expected) - actual}, extra {actual - set(expected)}')
            for name, member in expected.items():
                data = (installed / name).read_bytes()
                if name == 'package.json':
                    manifest = json.loads(data)
                    metadata = manifest.pop('__metadata', None)
                    if metadata is not None:
                        if not isinstance(metadata, dict) or not set(metadata).issubset({'targetPlatform', 'installedTimestamp', 'size'}):
                            raise ValueError('unexpected installation metadata')
                    if manifest != provenance['manifest']:
                        raise ValueError('installed manifest fields changed')
                    provenance['installationMetadata'] = metadata
                elif digest(data) != member['sha256']:
                    raise ValueError(f'installed file mismatch {name}')
            provenance['installedPath'] = str(installed)
    print(json.dumps(provenance))


if __name__ == '__main__':
    main()
