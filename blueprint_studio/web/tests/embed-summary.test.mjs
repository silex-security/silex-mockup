/* Cutover plan 2026-09-24 §2.2–2.3: host commands and the bs.summary.v1 publisher. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCommand, checkOpen } from '../src/embed.js';
import { buildSummary, docSummary, fnv1a, SUMMARY_KEY } from '../src/state/summary.js';
import { memoryStorage, createStore, newDocument } from '../../js/store.js';
import { exportDocument } from '../../js/io.js';

const fixture = JSON.parse(readFileSync(new URL('../../../tests/site/fixtures/storage.sample.json', import.meta.url)));
const storageFrom = obj => { const s = memoryStorage(); for (const [k, v] of Object.entries(obj)) s.setItem(k, v); return s; };
const snapshot = s => JSON.stringify([...s.keys()].sort().map(k => [k, s.getItem(k)]));
const H = 'a'.repeat(64);

test('parseCommand: accepts only the three commands with a nonce and valid fields', () => {
  assert.deepEqual(parseCommand('#cmd=new&n=1'), { cmd: 'new', n: '1' });
  assert.deepEqual(parseCommand('#cmd=resume&n=22'), { cmd: 'resume', n: '22' });
  assert.equal(parseCommand('#cmd=new'), null);                                   // no nonce
  assert.equal(parseCommand('#cmd=delete&n=1'), null);
  assert.equal(parseCommand(`#cmd=open&doc=x&rev=1&hash=${H}&view=admin&n=1`), null);
  assert.equal(parseCommand(`#cmd=open&doc=x&rev=1&hash=nothex&n=1`), null);
  assert.equal(parseCommand(`#cmd=open&doc=x&rev=1&hash=${H}&stage=nope&n=1`), null);
  const long = 'd'.repeat(260) + ' <b>&x+y';
  const c = parseCommand(`#cmd=open&doc=${encodeURIComponent(long)}&rev=3&hash=${H}&view=trace&stage=decide&n=9`);
  assert.equal(c.doc, long); assert.equal(c.rev, 3); assert.equal(c.view, 'trace'); assert.equal(c.stage, 'decide');
});

test('checkOpen: validates document, id, revision and hash without touching storage', () => {
  const s = storageFrom(fixture), before = snapshot(s);
  const sum = JSON.parse(fixture[SUMMARY_KEY]);
  const d = sum.docs.find(x => x.docId === 'bp-fixture-approved'), child = d.revs.find(r => r.origin === 'approve');
  assert.ok(checkOpen(s, { doc: d.docId, rev: child.rev, hash: child.hash }).ok);
  assert.equal(checkOpen(s, { doc: d.docId, rev: child.rev, hash: H }).code, 'hash');
  assert.equal(checkOpen(s, { doc: d.docId, rev: 99, hash: child.hash }).code, 'rev');
  assert.equal(checkOpen(s, { doc: 'nope', rev: 0, hash: H }).code, 'missing');
  s.setItem('bs.doc.broken', '{not json'); const b2 = snapshot(s);
  assert.equal(checkOpen(s, { doc: 'broken', rev: 0, hash: H }).code, 'invalid');
  assert.equal(snapshot(s), b2);
  s.removeItem('bs.doc.broken');
  assert.equal(snapshot(s), before);
});

test('checkOpen: a document id longer than 200 characters reopens', () => {
  const t = JSON.parse(readFileSync(new URL('../../templates/customer-refund.json', import.meta.url)));
  const s = memoryStorage(), st = createStore({ storage: s });
  const id = 'long-' + 'x'.repeat(240);
  st.load(newDocument({ ...t, id }));
  assert.ok(st.dispatch({ type: 'confirm' }).ok);
  const r = st.active();
  assert.ok(checkOpen(s, { doc: id, rev: r.rev, hash: r.hash }).ok);
});

test('summary: rules for awaiting approve / accept, recommended vs approved decision', () => {
  const s = storageFrom(fixture);
  const sum = buildSummary(s, 'T');
  assert.equal(sum.v, 1);
  const by = id => sum.docs.find(d => d.docId === id);
  const aw = by('bp-fixture-awaiting').revs[0];
  assert.equal(aw.awaiting, 'approve'); assert.equal(aw.recommended.id, 'threshold:dayTotal:500+binding+idem+inj:a');
  assert.ok(aw.recommended.scorecard.benignCompletion && aw.recommended.scorecard.friction);
  const ap = by('bp-fixture-approved');
  assert.equal(ap.revs[0].awaiting, null);
  assert.equal(ap.revs[0].decision.action, 'approve');
  assert.notEqual(ap.revs[0].decision.candidateId, ap.revs[0].recommended.id);           // a person chose a non-recommended candidate
  assert.ok(ap.revs[0].decision.scorecard.violationsClosed);
  const child = ap.revs.find(r => r.origin === 'approve');
  assert.equal(child.awaiting, null); assert.equal(child.validation.candidateRun, true);
  const ac = by('bp-fixture-accept').revs[0];
  assert.equal(ac.awaiting, 'accept'); assert.equal(ac.validation.findings.length, 0); assert.equal(ac.recommended, null);
  for (const d of sum.docs) assert.equal(d.fp, fnv1a(s.getItem('bs.doc.' + d.docId)));
});

test('summary: rebuilt from every saved document; deletion drops, malformed is skipped', () => {
  const s = storageFrom(fixture);
  assert.equal(buildSummary(s).docs.length, 3);
  s.removeItem('bs.doc.bp-fixture-accept');
  s.setItem('bs.doc.junk', 'not json');
  const ids = buildSummary(s).docs.map(d => d.docId);
  assert.deepEqual(ids.sort(), ['bp-fixture-approved', 'bp-fixture-awaiting']);
  assert.equal(docSummary('{"id":1}'), null);
});

test('summary: matches the committed fixture summary (same rules, same store data)', () => {
  const s = storageFrom(fixture);
  const fresh = buildSummary(s, JSON.parse(fixture[SUMMARY_KEY]).at);
  assert.deepEqual(fresh, JSON.parse(fixture[SUMMARY_KEY]));
});
