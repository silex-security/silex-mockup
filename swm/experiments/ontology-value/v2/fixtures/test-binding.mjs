import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseUnique, ontology, checkBinding, agreement, checkArtifacts } from '../binding-check.mjs';
const effects = ['core:core-effect-data-read', ...Array.from({ length: 8 }, (_, i) => `effect-${i}`)];
const snapshot = { nodes: [...effects.map(id => ({ id, layer: 1, kind: 'effect' })),
  { id: 'resource', layer: 1, kind: 'core' }, { id: 'child', layer: 1, kind: 'core' },
  { id: 'entity', layer: 2, kind: 'entity' }, { id: 'hazard', layer: 2, kind: 'hazard' }],
  links: [{ s: 'hazard', pred: 'HAZARD_FOR', t: 'entity' }, { s: 'entity', pred: 'SUBCLASS_OF', t: 'resource' },
    { s: 'child', pred: 'SUBCLASS_OF', t: 'resource' }, { s: 'resource', pred: 'SUBCLASS_OF', t: 'entity' }] };
const manifest = { tools: [{ id: 'agentdojo:banking/write', suite: 'banking', impact: 'write', params: [{ name: 'recipient' }] },
  { id: 'agentdojo:slack/read', suite: 'slack', impact: 'read', params: [{ name: 'query' }] }] };
const valid = { version: 2, tools: {
  'agentdojo:banking/write': { effects: ['effect-0', 'effect-1'], params: { recipient: 'child' }, reason: 'Writes a selected resource.' },
  'agentdojo:slack/read': { effects: ['core:core-effect-data-read'], params: { query: 'none' }, reason: 'Searches using a free text query.' } } };
const good = checkBinding(valid, manifest, snapshot);
assert.deepEqual(good.violations, []); assert.equal(good.eligible_share, .5);
assert.equal(good.hazard_relevant_share, .5); assert.equal(good.COLLAPSE, false);
assert.deepEqual([...ontology(snapshot).hc], ['resource']);
for (const mutate of [
  b => { delete b.tools['agentdojo:banking/write']; },
  b => { b.tools.extra = b.tools['agentdojo:banking/write']; },
  b => { delete b.tools['agentdojo:banking/write'].params.recipient; },
  b => { b.tools['agentdojo:banking/write'].params.extra = 'none'; },
  b => { b.tools['agentdojo:banking/write'].effects = ['resource']; },
  b => { b.tools['agentdojo:banking/write'].effects = ['effect-0', 'effect-0']; },
  b => { b.tools['agentdojo:banking/write'].params.recipient = 'entity'; },
  b => { b.tools['agentdojo:banking/write'].reason = ' '; },
  b => { b.tools['agentdojo:banking/write'].reason = 7; },
  b => { b.tools['agentdojo:banking/write'].extra = true; },
  b => { b.extra = true; }, b => { b.version = 1; }, b => { b.tools = []; },
]) {
  const b = structuredClone(valid); mutate(b); assert.ok(checkBinding(b, manifest, snapshot).violations.length);
}
assert.throws(() => parseUnique('{"tools":{"a":1,"a":2}}'), /duplicate/);
assert.throws(() => parseUnique('{"version":2,"version":2}'), /duplicate/);
const other = structuredClone(valid);
other.tools['agentdojo:banking/write'].effects.reverse();
let a = agreement(valid, other, manifest);
assert.equal(a.overall.effects.share, 1); assert.equal(a.overall.params.share, 1);
other.tools['agentdojo:slack/read'].effects = [];
other.tools['agentdojo:slack/read'].params.query = 'resource';
a = agreement(valid, other, manifest);
assert.equal(a.overall.effects.share, .5); assert.equal(a.per_suite.slack.params.share, 0);
const collapsed = structuredClone(valid);
collapsed.tools['agentdojo:slack/read'].params.query = 'resource';
assert.equal(checkBinding(collapsed, manifest, snapshot).COLLAPSE, true);
collapsed.tools['agentdojo:banking/write'].effects = [];
assert.equal(checkBinding(collapsed, manifest, snapshot).COLLAPSE, false);
const emptyManifest = { tools: [] }, empty = { version: 2, tools: {} };
assert.equal(checkBinding(empty, emptyManifest, snapshot).COLLAPSE, false);
const tmp = mkdtempSync(join(tmpdir(), 'binding-v2-fixture-'));
try {
  mkdirSync(join(tmp, 'out')); mkdirSync(join(tmp, 'v2/out'), { recursive: true });
  writeFileSync(join(tmp, 'out/snapshot.json'), JSON.stringify(snapshot));
  writeFileSync(join(tmp, 'v2/out/tool-manifest-v2.json'), JSON.stringify(manifest));
  const raw = JSON.stringify(valid), sha = createHash('sha256').update(raw).digest('hex');
  for (const file of ['binding-v2.json', 'binding-v2-b.json']) writeFileSync(join(tmp, 'v2', file), raw);
  writeFileSync(join(tmp, 'v2/BINDING-PROMPT.md'), 'Bind tools from descriptions.');
  const corpus = { goals: ['one two three four five six seven'], identifiers: ['fixture@example.test'] };
  const options = { directory: join(tmp, 'v2'), corpus, primarySha256: sha };
  assert.equal(checkArtifacts(options).ok, true);
  assert.equal(checkArtifacts({ ...options, primarySha256: '0'.repeat(64) }).ok, false);
  for (const file of ['BINDING-PROMPT.md', 'binding-v2.json', 'binding-v2-b.json', 'out/tool-manifest-v2.json']) {
    const path = join(tmp, 'v2', file);
    const original = file === 'BINDING-PROMPT.md' ? 'Bind tools from descriptions.' : file.startsWith('out/') ? JSON.stringify(manifest) : raw;
    writeFileSync(path, file.endsWith('.json') ? original.replace('}', ',"leak":"fixture@example.test"}') : 'one two three four five six');
    assert.equal(checkArtifacts({ ...options, primarySha256: undefined }).ok, false);
    writeFileSync(path, original);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
console.log('v2 binding schema, duplicate keys, coverage, collapse, agreement, SHA and firewall fixtures: PASS');
