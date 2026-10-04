// S4 negative control: a temporary page copy serves altered data, preserving SOURCE.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const tmp = await mkdtemp(join(tmpdir(), 'ontology-card-tampered-'));
for (const name of await readdir(ROOT)) {
  if (['.git', 'index.html', 'data'].includes(name)) continue;
  await symlink(join(ROOT, name), join(tmp, name));
}
await writeFile(join(tmp, 'index.html'), await readFile(join(ROOT, 'index.html')));
await mkdir(join(tmp, 'data'));
for (const name of await readdir(join(ROOT, 'data'))) {
  if (name !== 'onto-observability.json') await symlink(join(ROOT, 'data', name), join(tmp, 'data', name));
}
const d = JSON.parse(await readFile(join(ROOT, 'data/onto-observability.json'), 'utf8'));
d.al.verdict = d.al.verdict === 'supported' ? 'not supported' : 'supported';
await writeFile(join(tmp, 'data/onto-observability.json'), JSON.stringify(d) + '\n');
const r = spawnSync(process.execPath, [join(ROOT, 'tests/site/ontology-card.test.mjs')],
  {env: {...process.env, ONTOLOGY_PROBE_ROOT: tmp}, encoding: 'utf8', timeout: 120000});
console.log(r.stdout); console.error(r.stderr);
assert.equal(r.error, undefined);
assert.equal(r.status, 1, 'tampered data must fail the probe');
assert.match(r.stderr, /FAIL 1 page data hash/);
console.log('ok negative control: copied page with tampered data fails check 1; copy: ' + tmp);
