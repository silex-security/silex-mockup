import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fnv1a, readSummary, docStatus, projectPending, projectPcp, projectLibrary,
  renderPending, renderPcp, renderLibrary, renderUnavailable,
} from '../../js/studio-bridge.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/storage.sample.json', import.meta.url), 'utf8'));

function mapStorage(obj) {
  const m = new Map(Object.entries(obj));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    key: i => [...m.keys()][i],
    get length() { return m.size; },
  };
}

/* ---- minimal fake DOM for the injection test (no jsdom, no deps) ---- */
function fakeDocument() {
  const created = [];
  const mk = (tag, text) => ({ tagName: tag, children: [], attrs: {}, textContent: text ?? '', className: '', disabled: false,
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); this.firstChild = this.children[0] || null; },
    addEventListener() {},
    get firstChild() { return this.children[0] || null; } });
  return {
    created,
    createElement: tag => { const e = mk(tag); created.push(e); return e; },
    createTextNode: text => ({ nodeType: 3, text: String(text) }),
  };
}
function fakeContainer(doc) { return { ownerDocument: doc, children: [], appendChild(c) { this.children.push(c); }, removeChild() { this.children = []; }, get firstChild() { return this.children[0] || null; } }; }
function collectText(node, out = []) {
  if (node == null) return out;
  if (node.nodeType === 3) { out.push(node.text); return out; }
  if (typeof node.textContent === 'string' && node.textContent && node.children.length === 0) out.push(node.textContent);
  for (const c of node.children || []) collectText(c, out);
  return out;
}

/* ------------------------------------------------------------------ tests */
test('fnv1a matches the fixture fingerprints', () => {
  assert.equal(fnv1a(fixture['bs.doc.bp-fixture-accept']), 'e937f4be');
  assert.equal(fnv1a(fixture['bs.doc.bp-fixture-approved']), 'cf036228');
  assert.equal(fnv1a(fixture['bs.doc.bp-fixture-awaiting']), 'ed92fc32');
});

test('readSummary accepts the fixture and rejects malformed summaries', () => {
  const r = readSummary(mapStorage(fixture));
  assert.ok(r.ok, r.reason);
  assert.equal(r.summary.v, 1);
  assert.equal(r.summary.docs.length, 3);

  const st = mapStorage(fixture);
  st.setItem('bs.summary.v1', '{not json');
  assert.equal(readSummary(st).ok, false);

  const st2 = mapStorage(fixture);
  st2.setItem('bs.summary.v1', JSON.stringify({ v: 2, docs: [] }));
  assert.equal(readSummary(st2).ok, false);

  const st3 = mapStorage(fixture);
  const s3 = JSON.parse(st3.getItem('bs.summary.v1'));
  s3.docs[0].revs[0].validation.metrics.benignCompletion = { num: 40, den: 10 };   // num > den
  st3.setItem('bs.summary.v1', JSON.stringify(s3));
  assert.equal(readSummary(st3).ok, false);

  const st4 = mapStorage(fixture);
  st4.removeItem('bs.summary.v1');
  assert.equal(readSummary(st4).ok, false);
});

test('docStatus: fresh, stale and missing', () => {
  const st = mapStorage(fixture);
  const s = readSummary(st).summary;
  for (const d of s.docs) assert.equal(docStatus(s, st).get(d.docId), 'fresh');

  const st2 = mapStorage(fixture);
  st2.setItem('bs.doc.bp-fixture-awaiting', fixture['bs.doc.bp-fixture-awaiting'] + ' ');   // raw changed, fp stale
  assert.equal(docStatus(s, st2).get('bp-fixture-awaiting'), 'stale');

  const st3 = mapStorage(fixture);
  st3.removeItem('bs.doc.bp-fixture-accept');
  assert.equal(docStatus(s, st3).get('bp-fixture-accept'), 'missing');
});

test('projectPending: awaiting approve (recommended) and awaiting accept', () => {
  const s = readSummary(mapStorage(fixture)).summary;
  const rows = projectPending(s, mapStorage(fixture));
  assert.equal(rows.length, 2);
  const approve = rows.find(r => r.kind === 'approve');
  const accept = rows.find(r => r.kind === 'accept');
  assert.ok(approve && accept);
  assert.equal(approve.docId, 'bp-fixture-awaiting');
  assert.equal(approve.recommended.id, 'threshold:dayTotal:500+binding+idem+inj:a');
  assert.equal(approve.recommended.violationsClosed.num, 6);
  assert.equal(approve.recommended.violationsClosed.den, 6);
  assert.equal(accept.docId, 'bp-fixture-accept');
  assert.equal(accept.runs, 60);
});

test('projectPending: a stale document becomes a placeholder, a missing one is dropped', () => {
  const st = mapStorage(fixture);
  const s = readSummary(st).summary;
  st.setItem('bs.doc.bp-fixture-awaiting', fixture['bs.doc.bp-fixture-awaiting'] + 'x');
  const rows = projectPending(s, st);
  assert.ok(rows.some(r => r.docId === 'bp-fixture-awaiting' && r.stale));

  const st2 = mapStorage(fixture);
  const s2 = readSummary(st2).summary;
  st2.removeItem('bs.doc.bp-fixture-accept');
  assert.ok(!projectPending(s2, st2).some(r => r.docId === 'bp-fixture-accept'));
});

test('projectPcp: recommended while awaiting, the decision once approved, metrics while awaiting accept', () => {
  const s = readSummary(mapStorage(fixture)).summary;
  const cards = projectPcp(s, mapStorage(fixture));
  assert.equal(cards.length, 3);
  const awaiting = cards.find(c => c.state === 'awaiting' && c.candidate);
  const acceptAwaiting = cards.find(c => c.state === 'awaiting' && c.metrics);
  const approved = cards.find(c => c.state === 'approved');
  assert.ok(awaiting && acceptAwaiting && approved);

  assert.equal(awaiting.docId, 'bp-fixture-awaiting');
  assert.equal(awaiting.candidate.id, 'threshold:dayTotal:500+binding+idem+inj:a');
  assert.equal(awaiting.scorecard.friction.num, 18);
  assert.equal(awaiting.scorecard.friction.den, 40);

  assert.equal(approved.docId, 'bp-fixture-approved');
  assert.equal(approved.candidate.id, 'threshold:dayTotal:0+binding');   // the DECISION's, not the recommended threshold:amount:0+binding
  assert.equal(approved.scorecard.friction.num, 40);
  assert.equal(approved.childLabel, 'v1.1');

  assert.equal(acceptAwaiting.docId, 'bp-fixture-accept');
  assert.equal(acceptAwaiting.metrics.benignCompletion.num, 10);
});

test('projectLibrary: the registered child, not replaced; replaced when the saved doc differs', () => {
  const st = mapStorage(fixture);
  const rows = projectLibrary(st, readSummary(st).summary);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.key, 'bp-fixture-approved|1|a2baeca45af7ae6f52ff640b70ac02ed1ef48b408a432e2d8aec463483e0148a');
  assert.equal(r.docId, 'bp-fixture-approved');
  assert.equal(r.rev, 1);
  assert.equal(r.label, 'v1.1');
  assert.equal(r.sourceReplaced, false);

  // mutate the saved doc so rev 1's hash differs -> replaced
  const doc = JSON.parse(st.getItem('bs.doc.bp-fixture-approved'));
  doc.revisions.find(x => x.rev === 1).hash = '0'.repeat(64);
  st.setItem('bs.doc.bp-fixture-approved', JSON.stringify(doc));
  assert.equal(projectLibrary(st, readSummary(st).summary)[0].sourceReplaced, true);

  // delete the doc -> replaced
  const st2 = mapStorage(fixture);
  st2.removeItem('bs.doc.bp-fixture-approved');
  assert.equal(projectLibrary(st2, readSummary(st2).summary)[0].sourceReplaced, true);
});

test('renderers build DOM with createElement/textContent only, no innerHTML, and escape the HTML-looking name', () => {
  const s = readSummary(mapStorage(fixture)).summary;
  const doc = fakeDocument();
  const container = fakeContainer(doc);
  renderPending(container, projectPending(s, mapStorage(fixture)), {});   // includes the accept row (HTML-looking name)
  assert.ok(!doc.created.some(e => e.tagName === 'img'), 'no <img> element may be created');
  assert.ok(!doc.created.some(e => e.tagName === 'SCRIPT'), 'no script element');
  const text = collectText(container).join(' ');
  assert.ok(text.includes('<img src=x onerror=alert(1)> Refund'), 'the HTML-looking name is rendered as text');
});

test('renderers carry the simulated + scenario-set label and the data hooks', () => {
  const s = readSummary(mapStorage(fixture)).summary;
  const st = mapStorage(fixture);

  const pDoc = fakeDocument(), pCont = fakeContainer(pDoc);
  renderPending(pCont, projectPending(s, st), {});
  assert.equal(pDoc.created.filter(e => e.attrs && e.attrs['data-studio-pending']).length, 2);
  assert.ok(pDoc.created.some(e => e.attrs && e.attrs['data-studio-open'] !== undefined));
  assert.ok(collectText(pCont).join(' ').includes('simulated · declared adversary model · scenario set'));

  const cDoc = fakeDocument(), cCont = fakeContainer(cDoc);
  renderPcp(cCont, projectPcp(s, st), {});
  const cEls = cDoc.created.filter(e => e.attrs && e.attrs['data-studio-pcp']);
  assert.equal(cEls.length, 3);
  assert.ok(cEls.some(e => e.attrs['data-state'] === 'approved'));
  assert.ok(cDoc.created.some(e => e.attrs && e.attrs['data-studio-open'] !== undefined));
  assert.ok(cDoc.created.some(e => e.attrs && e.attrs['data-studio-trace'] !== undefined));

  const lDoc = fakeDocument(), lCont = fakeContainer(lDoc);
  renderLibrary(lCont, projectLibrary(st, s), {});
  const lEls = lDoc.created.filter(e => e.attrs && e.attrs['data-studio-reg']);
  assert.equal(lEls.length, 1);
  assert.ok(lDoc.created.some(e => e.attrs && e.attrs['data-studio-open'] !== undefined));
  assert.ok(lDoc.created.some(e => e.attrs && e.attrs['data-studio-trace'] !== undefined));
});

test('renderUnavailable marks the container and makes no claims', () => {
  const doc = fakeDocument(), container = fakeContainer(doc);
  renderUnavailable(container, 'no summary');
  const el = doc.created.find(e => e.attrs && e.attrs['data-studio-summary'] === 'unavailable');
  assert.ok(el);
  assert.ok(collectText(container).join(' ').includes('unavailable'));
});
