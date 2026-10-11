// S2 of logs/2026-10-10_CREATOR_DOMAIN_FLEET_PLAN.md: the standalone candidate L2 pack for the
// creator platform (design §3). Pure node: reads only the committed pack and swm/data/ontology.json,
// no git and no network, so it also runs inside the CI `git archive` export. The pack is deliberately
// kept out of swm/data/ontology.json, which must stay byte-identical (guarded by the pinned sha256).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK_PATH = join(ROOT, 'swm/data/packs/creator-platform.json');
const pack = JSON.parse(readFileSync(PACK_PATH, 'utf8'));
const bundle = JSON.parse(readFileSync(join(ROOT, 'swm/data/ontology.json'), 'utf8'));

const classById = new Map(pack.classes.map(c => [c.id, c]));
const teamIds = new Set(pack.teams.map(t => t.id));
const bundleIds = new Set(bundle.nodes.map(n => n.id));
const GRADES = new Set(['declared', 'observed', 'inferred']);

/** The kind of an edge endpoint: a pack class kind, or 'team' for a team instance. */
function endpointKind(id) {
  if (classById.has(id)) return classById.get(id).kind;
  if (teamIds.has(id)) return 'team';
  return null;
}

test('meta marks a standalone candidate pack that stays outside the site figures', () => {
  assert.equal(pack.meta.candidate, true);
  assert.equal(pack.meta.outside_coverage, true);
  assert.match(pack.meta.title, /candidate/i);
  assert.ok(typeof pack.meta.note === 'string' && pack.meta.note.length > 0);
});

test('every edge endpoint resolves to a pack class or a team, and every edge carries a grade', () => {
  assert.ok(pack.edges.length > 0);
  for (const e of pack.edges) {
    assert.ok(endpointKind(e.s) != null, `subject ${e.s} does not resolve`);
    assert.ok(endpointKind(e.o) != null, `object ${e.o} does not resolve`);
    assert.ok(GRADES.has(e.grade), `${e.p} ${e.s} has grade ${e.grade}`);
  }
});

test('every edge predicate is declared and its domain/range signature holds', () => {
  for (const e of pack.edges) {
    const sig = pack.predicates[e.p];
    assert.ok(sig, `predicate ${e.p} is not declared`);
    assert.ok(Array.isArray(sig.domain) && sig.domain.length, `${e.p} has a domain`);
    assert.ok(Array.isArray(sig.range) && sig.range.length, `${e.p} has a range`);
    assert.ok(sig.domain.includes(endpointKind(e.s)), `${e.p}: subject kind ${endpointKind(e.s)} not in domain`);
    assert.ok(sig.range.includes(endpointKind(e.o)), `${e.p}: object kind ${endpointKind(e.o)} not in range`);
  }
});

test('every reviewed action type is OWNED_BY_TEAM by the contract §1 team', () => {
  const owned = new Map(pack.edges.filter(e => e.p === 'OWNED_BY_TEAM').map(e => [e.s, e.o]));
  const expected = {
    'pack:ActionPushTrend': 'team:trust-safety',
    'pack:ActionHotPool': 'team:trust-safety',
    'pack:ActionSelectCreative': 'team:trust-safety',
    'pack:ActionLaunchCampaign': 'team:trust-safety',
    'pack:ActionUpdateLoginEmail': 'team:account-security',
    'pack:ActionRefund': 'team:payments-risk',
    'pack:ActionPayoutChange': 'team:payments-risk',
    'pack:ActionBuyPromotion': 'team:payments-risk',
    'pack:ActionAnalyticsRead': 'team:privacy',
    'pack:ActionUseAsset': 'team:legal-ip',
  };
  for (const [action, team] of Object.entries(expected)) assert.equal(owned.get(action), team, action);
});

test('every class has a SUBCLASS_OF parent that exists in the pack or in swm/data/ontology.json', () => {
  assert.ok(pack.predicates.SUBCLASS_OF, 'SUBCLASS_OF is declared');
  for (const c of pack.classes) {
    assert.ok(c.subClassOf, `${c.id} has no parent`);
    assert.ok(classById.has(c.subClassOf) || bundleIds.has(c.subClassOf), `${c.id} -> ${c.subClassOf} does not resolve`);
  }
});

test('there is no SUBCLASS_OF cycle', () => {
  for (const c of pack.classes) {
    const seen = new Set();
    let cur = c.id;
    while (classById.has(cur)) {
      assert.ok(!seen.has(cur), `SUBCLASS_OF cycle at ${cur}`);
      seen.add(cur);
      cur = classById.get(cur).subClassOf;
    }
  }
});

test('the pack names no real consumer platform or parent company', () => {
  const DENY = ['tiktok', 'douyin', 'bytedance', 'kuaishou', 'kwai', 'youtube', 'instagram', 'facebook',
    'meta platforms', 'snapchat', 'bilibili', 'xiaohongshu', 'rednote', 'reelshort', 'dramabox',
    'netflix', 'twitch', 'alphabet'];
  const hit = readFileSync(PACK_PATH, 'utf8').match(new RegExp(`\\b(${DENY.join('|')})\\b`, 'i'));
  assert.equal(hit, null, `pack contains "${hit?.[0]}"`);
});

test('swm/data/ontology.json is byte-identical to the pinned base', () => {
  const sha = createHash('sha256').update(readFileSync(join(ROOT, 'swm/data/ontology.json'))).digest('hex');
  assert.equal(sha, '13d1e4280be87dc62cef0b9591e916891d555795976970f46e02902a602d5494');
});
