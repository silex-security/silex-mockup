#!/usr/bin/env node
/* Vendors the Jev runtime demo into jev-runtime/ (logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md §2).
 *   node tools/sync-jev-runtime.mjs <jev-runtime-observability checkout> <commit>
 * Files are read with `git show <commit>:<path>`, never from a working tree. Runtime files only (no .d.ts).
 * Vendored paths that no longer exist upstream are removed. jev-runtime/README.md is local and untouched. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'jev-runtime');
const [src, ref] = process.argv.slice(2);
if (!src || !ref) { console.error('usage: node tools/sync-jev-runtime.mjs <jev checkout> <commit>'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', src, ...a], { maxBuffer: 64 << 20 });
const commit = git('rev-parse', '--verify', `${ref}^{commit}`).toString().trim();

// upstream path (under web/) → vendored path (under jev-runtime/); the web/ layout is kept, so imports need no rewrite.
const listed = git('ls-tree', '-r', '--name-only', commit, 'web/demo').toString().trim().split('\n')
  .filter(p => p && !p.endsWith('.d.ts'));
const files = [...listed, 'web/js/runs.js', 'web/js/verdict.js', 'web/css/runs.css'];
const manifest = { source: 'https://github.com/silex-ai-lab/jev-runtime-observability', commit, synced_at: new Date().toLocaleDateString('sv'), files: {} };
const wanted = new Set();
for (const up of files) {
  const rel = up.replace(/^web\//, '');
  const buf = git('show', `${commit}:${up}`);
  mkdirSync(dirname(join(DEST, rel)), { recursive: true });
  writeFileSync(join(DEST, rel), buf);
  manifest.files[rel] = createHash('sha256').update(buf).digest('hex');
  wanted.add(rel);
}
// Remove stale vendored files under the vendored roots.
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const top of ['demo', 'js', 'css']) {
  const d = join(DEST, top); if (!existsSync(d)) continue;
  for (const f of walk(d)) { const rel = relative(DEST, f); if (!wanted.has(rel)) { rmSync(f); console.log('removed stale', rel); } }
}
writeFileSync(join(DEST, 'VENDORED.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`vendored ${wanted.size} files from ${commit.slice(0, 7)}`);
