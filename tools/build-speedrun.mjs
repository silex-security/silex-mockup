#!/usr/bin/env node
/* Builds speedrun/app/ from the in-repo source and rewrites speedrun/VENDORED.json.
 *   node tools/build-speedrun.mjs
 * speedrun/web/upstream/ is the canonical Speedrun source and is edited here. It was forked from
 * wangfe/silex-speedrun at the commit below. speedrun/web/ is the Vite shell that builds it. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORK = { repo: 'https://github.com/wangfe/silex-speedrun', commit: '6e1575864edd3e0517b75504db9afbf2124553fd' };
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'speedrun'), WEB = join(DEST, 'web');

const run = (...a) => execFileSync('npm', a, { cwd: WEB, stdio: 'inherit' });
run('ci');
run('run', 'build');

const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = Object.fromEntries(walk(join(DEST, 'app')).map(f => [relative(DEST, f), sha(f)]).sort());
/* Everything the build reads. The test compares these with the tree, so a source edit without a rebuild fails. */
const sources = Object.fromEntries(['index.html', 'vite.config.js', 'package-lock.json', '../../css/tokens.css', '../../css/trace-waterfall.css', ...['src', 'upstream'].flatMap(d => walk(join(WEB, d))).map(f => relative(WEB, f))].sort().map(r => [r, sha(join(WEB, r))]));
writeFileSync(join(DEST, 'VENDORED.json'), JSON.stringify({ forked_from: FORK, sources, files }, null, 2) + '\n');
console.log(`built ${Object.keys(files).length} files`);
