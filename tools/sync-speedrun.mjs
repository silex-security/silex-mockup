#!/usr/bin/env node
/* Vendors the upstream SILEX Speedrun app (wangfe/silex-speedrun, a Next.js repo) at one commit and builds speedrun/app/.
 *   node tools/sync-speedrun.mjs <silex-speedrun checkout> <commit>
 * The upstream src/ is read with `git archive <commit>`, never from a working tree, into speedrun/web/upstream/,
 * byte for byte. speedrun/web/ is a Vite shell that runs that source unmodified. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'speedrun'), WEB = join(DEST, 'web'), UP = join(WEB, 'upstream');
const [src, ref] = process.argv.slice(2);
if (!src || !ref) { console.error('usage: node tools/sync-speedrun.mjs <silex-speedrun checkout> <commit>'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', src, ...a], { maxBuffer: 256 << 20 });
const commit = git('rev-parse', '--verify', `${ref}^{commit}`).toString().trim();

rmSync(UP, { recursive: true, force: true });
mkdirSync(UP, { recursive: true });
execFileSync('tar', ['-x', '-C', UP], { input: git('archive', commit, 'src') });

const run = (...a) => execFileSync('npm', a, { cwd: WEB, stdio: 'inherit' });
run('ci');
run('run', 'build');

const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = Object.fromEntries(walk(join(DEST, 'app')).map(f => [relative(DEST, f), sha(f)]).sort());
/* Everything the build reads: the vendored upstream source and the shell. The test compares these with the tree,
   so a hand edit to upstream/ or a shell change without a rebuild fails. */
const sources = Object.fromEntries(['index.html', 'vite.config.js', 'package-lock.json', ...['src', 'upstream'].flatMap(d => walk(join(WEB, d))).map(f => relative(WEB, f))].sort().map(r => [r, sha(join(WEB, r))]));
const manifest = { source: 'https://github.com/wangfe/silex-speedrun', commit, synced_at: new Date().toLocaleDateString('sv'), sources, files };
writeFileSync(join(DEST, 'VENDORED.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`built ${Object.keys(files).length} files from ${commit.slice(0, 7)}`);
