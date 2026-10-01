// jev-runtime/ is a byte-identical vendored copy (logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md §2): every file under
// demo/, js/ and css/ must match VENDORED.json, and nothing may be added or removed. README.md and VENDORED.json are local.
// To change the demo, change it upstream and run tools/sync-jev-runtime.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEST = resolve(dirname(fileURLToPath(import.meta.url)), '../../jev-runtime');
const manifest = JSON.parse(readFileSync(join(DEST, 'VENDORED.json'), 'utf8'));
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('manifest names a full upstream commit', () => assert.match(manifest.commit, /^[0-9a-f]{40}$/));
test('every vendored file matches its manifest hash, none missing, none added', () => {
  const onDisk = ['demo', 'js', 'css'].flatMap(t => walk(join(DEST, t))).map(f => relative(DEST, f)).sort();
  assert.deepEqual(onDisk, Object.keys(manifest.files).sort());
  for (const [rel, sha] of Object.entries(manifest.files))
    assert.equal(createHash('sha256').update(readFileSync(join(DEST, rel))).digest('hex'), sha, rel);
});
