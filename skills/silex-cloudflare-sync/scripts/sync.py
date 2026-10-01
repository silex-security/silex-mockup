#!/usr/bin/env python3
"""Deploy the committed Silex demo branch, never a dirty checkout or main."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import tempfile
import time

REPO = 'https://github.com/silex-security/silex-mockup.git'
BRANCH = 'demo/assurance-vv'
PREFIX = 'demo/assurance-vv'
PROJECT = 'opensilex-demo'
ACCOUNT = '968ee54d6c8f891edbf8a82fabd6a427'
ORIGINS = ['https://opensilex-demo.pages.dev', 'https://demo.opensilex.ai']
WRANGLER = 'wrangler@4.145.0'


def run(args, cwd=None, env=None, capture=False):
    return subprocess.run(args, cwd=cwd, env=env, check=True,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None)


def remote_main():
    return run(['git', 'ls-remote', REPO, 'refs/heads/main'], capture=True).stdout.decode().split()[0]


def extract_archive(data, dest):
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive.getmembers():
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
                raise ValueError('Unsafe archive member: ' + member.name)
            target = dest.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())


def validate_site(root):
    site = root / 'site'
    manifest = json.loads((root / 'site.sha256.json').read_text())
    if not isinstance(manifest, dict) or not manifest:
        raise ValueError('Missing or empty site manifest')
    files = {p.relative_to(site).as_posix(): p for p in site.rglob('*') if p.is_file()}
    if set(files) != set(manifest):
        raise ValueError('Site/manifest file list differs; commit intentional changes and their manifest together')
    for name, path in files.items():
        if path.is_symlink() or path.stat().st_size > 25 * 1024 * 1024:
            raise ValueError('Invalid upload asset: ' + name)
        if any(part.startswith('.env') or part in {'.git', 'node_modules'} for part in path.parts):
            raise ValueError('Private/build artifact in upload: ' + name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != manifest[name]:
            raise ValueError('Manifest hash mismatch: ' + name)
    for required in ['index.html', '404.html', '_headers', 'prototype/index.html', 'prototype/app.js',
                     'baseline/blueprint_studio/app/index.html', 'baseline/jev-runtime/demo/index.html']:
        if required not in files:
            raise ValueError('Missing runtime dependency: ' + required)
    if len(files) > 20000:
        raise ValueError('Pages asset count limit exceeded')
    return manifest


def verify_live(site, manifest, origins=ORIGINS):
    for origin in origins:
        for name in ['index.html', *sorted(n for n in manifest if n.startswith('prototype/'))]:
            url = origin + ('/' if name == 'index.html' else '/' + name)
            for attempt in range(3):
                try:
                    data = run(['curl', '-fsSL', '--max-time', '30', url], capture=True).stdout
                    if hashlib.sha256(data).hexdigest() != manifest[name]:
                        raise ValueError('Live content differs: ' + url)
                    break
                except (subprocess.CalledProcessError, ValueError):
                    if attempt == 2:
                        raise
                    time.sleep(5)
        for name in ['baseline/blueprint_studio/app/index.html', 'baseline/jev-runtime/demo/index.html',
                     'baseline/blueprint_studio/ontology/slice.json']:
            data = run(['curl', '-fsSL', '--max-time', '30', origin + '/' + name], capture=True).stdout
            if hashlib.sha256(data).hexdigest() != manifest[name]:
                raise ValueError('Live dependency differs: ' + name)
        print('HTTPS and content verified:', origin, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fetch and test; do not deploy')
    args = parser.parse_args()
    before = remote_main()
    with tempfile.TemporaryDirectory(prefix='silex-pages-sync-') as tmp:
        temp = Path(tmp)
        gitdir = temp / 'source.git'
        run(['git', 'init', '--bare', str(gitdir)], capture=True)
        run(['git', '--git-dir', str(gitdir), 'fetch', '--depth=1', REPO, 'refs/heads/' + BRANCH])
        commit = run(['git', '--git-dir', str(gitdir), 'rev-parse', 'FETCH_HEAD'], capture=True).stdout.decode().strip()
        archive = run(['git', '--git-dir', str(gitdir), 'archive', commit, PREFIX], capture=True).stdout
        extract_archive(archive, temp / 'checkout')
        root = temp / 'checkout' / PREFIX
        manifest = validate_site(root)
        print('Source:', BRANCH, commit, ';', len(manifest), 'verified assets', flush=True)
        tests = [root / 'tests/prototype.test.mjs',
                 *sorted((root / 'site/baseline/tests/site').glob('*.test.mjs')),
                 root / 'site/baseline/blueprint_studio/tests/templates.test.mjs']
        run(['node', '--test', *map(str, tests)], cwd=root)
        for p in sorted((root / 'site/prototype').glob('*.js')):
            run(['node', '--check', str(p)])
        if args.check:
            print('CHECK PASSED. Nothing deployed.')
            return
        env = os.environ.copy()
        env['CLOUDFLARE_ACCOUNT_ID'] = ACCOUNT
        env['WRANGLER_SEND_METRICS'] = 'false'
        run(['npx', '--yes', WRANGLER, 'pages', 'deploy', str(root / 'site'),
             '--project-name', PROJECT, '--branch', 'review', '--commit-hash', commit,
             '--commit-message', 'Sync GitHub ' + BRANCH + ' ' + commit[:12]], cwd=temp, env=env)
        # Failed verification reports failure; never loop deployments or overwrite with another version.
        verify_live(root / 'site', manifest)
        after = remote_main()
        record = {'repository': REPO, 'branch': BRANCH, 'commit': commit, 'project': PROJECT,
                  'urls': ORIGINS, 'main_before': before, 'main_after': after,
                  'verified_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        cache = Path.home() / '.cache/silex-cloudflare-sync'
        cache.mkdir(parents=True, exist_ok=True)
        (cache / 'last-deployment.json').write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps(record, indent=2))
        if before != after:
            print('NOTICE: Remote main changed during this run; this script never pushes to GitHub.')


if __name__ == '__main__':
    main()
