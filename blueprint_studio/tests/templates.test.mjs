import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashGraph } from '../js/model.js';
import { generateScenarioSet, scenarioParams } from '../js/adversary.js';
import { lint, validate } from '../js/validate.js';
import { optimize } from '../js/optimize.js';
import { checkGraph, importDocument, exportDocument } from '../js/io.js';
import { newDocument } from '../js/store.js';

/* The 13 gallery templates: the 11 new n8n-style ones plus the two originals.
   Every template is lint-clean, importable, and its generated requests obey the
   §3.11.2 range table. The 11 new ones also commit their observed expectedFindings
   and a recommendation. */
const NEW = [
  'ai-rag-support-agent', 'ai-multi-agent-content', 'support-email-triage',
  'sales-lead-enrichment', 'sales-discount-approval', 'marketing-rss-social',
  'docops-invoice-processing', 'docops-contract-review',
  'itops-access-request', 'itops-alert-containment', 'hr-employee-onboarding',
];
const ORIGINAL = ['customer-refund', 'vendor-bank-change'];
const ALL = [...NEW, ...ORIGINAL];

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));
const cent = x => Number.isFinite(x) && Math.abs(x - Math.round(x * 100) / 100) < 1e-9;
const dupTemplates = () => ALL.filter(n => tpl(n).graph.nodes.some(p => p.type === 'prohibited' && p.config.monitor === 'duplicate_effect'));

for (const name of ALL) {
  const t = tpl(name);
  const meta = { name: t.name, domain: t.domain };

  test(`template ${name}: imports, is lint-clean and schema-complete`, () => {
    assert.ok(t.id === 'bp-' + name, 'id is bp-<filename>');
    assert.ok(t.category && typeof t.category === 'string', 'has a category');
    for (const k of ['name', 'domain', 'owner', 'description']) assert.ok(typeof t[k] === 'string' && t[k], k);
    if (NEW.includes(name)) {
      assert.ok(Array.isArray(t.integrations), 'integrations is an array');
      assert.ok(typeof t.n8nPattern === 'string' && t.n8nPattern, 'has an n8n pattern');
      assert.ok(typeof t.amountMeaning === 'string' && t.amountMeaning, 'discloses what amount means');
      assert.ok(typeof t.customerMeaning === 'string' && t.customerMeaning, 'discloses what customer means');
      assert.ok(typeof t.orderMeaning === 'string' && t.orderMeaning, 'discloses what order means');
      assert.ok(Array.isArray(t.expectedFindings) && t.expectedFindings.length, 'declares expected findings');
      assert.ok('recommendation' in t, 'declares a recommendation');
      assert.ok(/Modelled on a common n8n pattern; integrations are represented as steps, not live connections\./.test(t.description), 'description discloses the n8n modelling');
    }

    const g = checkGraph(t.graph, name);
    assert.ok(g.ok, JSON.stringify(g.error));
    assert.deepEqual(lint(t.graph).filter(i => i.severity === 'error'), [], 'no lint errors');

    const doc = newDocument(t);
    assert.ok(importDocument(exportDocument(doc)).ok, 'a fresh document from the template imports cleanly');
  });

  test(`template ${name}: generated requests obey the §3.11.2 range table`, () => {
    const graph = t.graph;
    const baseHash = hashGraph(graph, meta);
    const set = generateScenarioSet(graph, { n: 20, baseHash });
    const params = scenarioParams(graph);
    const tp = params.t > 0 ? params.t : params.hi;

    for (const sc of set.scenarios) {
      for (const r of sc.requests) {
        assert.ok(Number.isFinite(r.amount), `${sc.id}: amount finite`);
        assert.ok(Number.isFinite(r.eligible), `${sc.id}: eligible finite`);
        assert.ok(cent(r.amount) && cent(r.eligible), `${sc.id}: cent precision`);
        assert.ok(r.amount >= 0 && r.eligible >= 0, `${sc.id}: non-negative`);
        const zeroOk = sc.template === 'duplicate_submit' || sc.template === 'injection_exfil' || (sc.template === 'below_threshold' && params.lo === 0);
        if (!zeroOk) assert.ok(r.amount > 0, `${sc.id}: ${sc.template} amount must be positive`);
      }
      const r1 = sc.requests[0];
      switch (sc.template) {
        case 'below_threshold':
          assert.ok(params.lo <= r1.amount && r1.amount <= params.hi, `${sc.id}: below_threshold in [lo, hi]`);
          assert.equal(r1.eligible, 0);
          break;
        case 'split':
          assert.ok(params.hi <= r1.amount && r1.amount <= 2 * params.hi, `${sc.id}: split in [hi, 2hi]`);
          assert.equal(r1.eligible, r1.amount);
          break;
        case 'replay': {
          const r2 = sc.requests[1];
          assert.ok(params.hi <= r1.amount && r1.amount <= 2 * params.hi, `${sc.id}: replay in [hi, 2hi]`);
          assert.equal(r2.amount, r1.amount, `${sc.id}: replay uses the same amount`);
          assert.equal(r1.eligible, r1.amount);
          assert.equal(r2.eligible, 0);
          break;
        }
        case 'duplicate_submit':
        case 'injection_exfil':
          assert.ok(r1.amount <= tp, `${sc.id}: ${sc.template} in [0, t')`);
          assert.equal(r1.eligible, r1.amount);
          break;
        case 'benign':
          assert.ok(r1.amount >= 20 && r1.amount <= 3000, `${sc.id}: benign in [20, 3000]`);
          assert.equal(r1.eligible, r1.amount);
          break;
      }
    }
  });

  if (NEW.includes(name)) {
    test(`template ${name}: baseline validation yields exactly its declared findings, and optimize recommends`, () => {
      const graph = t.graph;
      const baseHash = hashGraph(graph, meta);
      const set = generateScenarioSet(graph, { n: 20, baseHash });
      const v = validate(graph, set);
      const observed = v.findings.map(f => f.id).sort();
      const declared = t.expectedFindings.map(f => f.id).sort();
      assert.deepEqual(observed, declared, 'observed findings equal the committed expectedFindings');
      for (const f of t.expectedFindings) assert.ok(typeof f.why === 'string' && f.why.length, `${f.id} has a why`);

      const opt = optimize(graph, { ...v, scenarioSetId: set.id }, set, meta);
      if (t.recommendation === 'exists') assert.ok(typeof opt.recommended === 'string', 'optimize produces a recommendation');
      else { assert.equal(t.recommendation.none, undefined, 'none-recommendation carries a reason'); assert.equal(opt.recommended, null); }
    });
  }
}

for (const name of dupTemplates()) {
  test(`template ${name}: both duplicate_submit writes execute (no write_denied)`, () => {
    const graph = tpl(name).graph;
    const meta = { name: tpl(name).name, domain: tpl(name).domain };
    const set = generateScenarioSet(graph, { n: 20, baseHash: hashGraph(graph, meta) });
    const runs = validate(graph, set).runs.filter(r => r.template === 'duplicate_submit');
    assert.ok(runs.length === 20, '20 duplicate_submit runs');
    for (const r of runs) {
      const writes = r.session.effects.filter(e => e.type === 'write');
      assert.equal(writes.length, 2, `${r.scenarioId}: two write effects`);
      assert.ok(!r.session.effects.some(e => e.type === 'write_denied'), `${r.scenarioId}: no write_denied`);
    }
  });
}

test('the two original templates are re-categorised without touching their graphs', () => {
  assert.equal(tpl('customer-refund').category, 'Support');
  assert.equal(tpl('vendor-bank-change').category, 'Document Ops');
  assert.equal(tpl('customer-refund').graph.nodes.length, 14);
  assert.equal(tpl('vendor-bank-change').graph.nodes.length, 10);
});
