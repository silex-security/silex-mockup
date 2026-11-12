// speedrun/app/ is the build of the sources in speedrun/web/ (the Vite shell and the app source in upstream/), which this
// repo owns. Every built file and every source file must match VENDORED.json, with nothing added or removed. After a change, run tools/build-speedrun.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEST = resolve(dirname(fileURLToPath(import.meta.url)), '../../speedrun');
const manifest = JSON.parse(readFileSync(join(DEST, 'VENDORED.json'), 'utf8'));
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('manifest names the full commit the source was forked from', () => assert.match(manifest.forked_from.commit, /^[0-9a-f]{40}$/));
test('every built file matches its manifest hash, none missing, none added', () => {
  assert.deepEqual(walk(join(DEST, 'app')).map(f => relative(DEST, f)).sort(), Object.keys(manifest.files).sort());
  for (const [rel, sha] of Object.entries(manifest.files))
    assert.equal(createHash('sha256').update(readFileSync(join(DEST, rel))).digest('hex'), sha, rel);
});
test('the app source and the shell are the ones app/ was built from', () => {
  const web = join(DEST, 'web');
  const now = ['index.html', 'vite.config.js', 'package-lock.json', '../../css/tokens.css', '../../css/trace-waterfall.css', ...['src', 'upstream'].flatMap(d => walk(join(web, d))).map(f => relative(web, f))].sort();
  assert.deepEqual(now, Object.keys(manifest.sources).sort());
  for (const [rel, sha] of Object.entries(manifest.sources))
    assert.equal(createHash('sha256').update(readFileSync(join(web, rel))).digest('hex'), sha, rel);
});
test('the built page loads its script and stylesheet by relative path', () => {
  const html = readFileSync(join(DEST, 'app/index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 2);
  for (const r of refs) { assert.match(r, /^\.\/assets\//); assert.ok(manifest.files['app/' + r.slice(2)], r); }
});
