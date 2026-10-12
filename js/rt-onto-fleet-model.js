// Ontology tab · the fleet's ontology as data (logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, Contract A, task T1).
// One pure model for the "In the agent fleet" and "Graph & files" sub-tabs: the candidate Creator Platform Pack as a
// schema graph (classes, teams, the L1 concepts it specialises, attribute boxes), the eight typed creator rules with the
// predicates they read, and, per scripted pre_tool call, the ontology slice the vendored engine reads, the triples it
// used, and its decision with the slice and trace only. Decisions, queues and the X1 chain come from fleetModel(), so
// these sub-tabs and the Agent fleet tab cannot disagree. Nothing is typed in: every figure is computed here from the
// pack, the vendored engine and the generated files list. No DOM access at module top level; imports under node.
import { prepareSpan } from '../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor } from '../jev-runtime/demo/js/engine/scenarios.js';
import { buildState } from '../jev-runtime/demo/js/engine/state.js';
import { DOMAINS } from '../jev-runtime/demo/js/engine/domains.js';
import { fleetModel, FACT_OF_RULE } from './rt-fleet.js';

export const PACK_PATH = 'swm/data/packs/creator-platform.json';
export const FILES_PATH = 'data/ontology-files.json';
export const TOOL_ACTION = {
  'promo.push_trend_to_homepage': 'pack:ActionPushTrend', 'promo.add_to_hot_pool': 'pack:ActionHotPool',
  'ads.select_creative': 'pack:ActionSelectCreative', 'ads.launch_campaign': 'pack:ActionLaunchCampaign',
  'help.update_login_email': 'pack:ActionUpdateLoginEmail', 'help.refund_coins': 'pack:ActionRefund',
  'creator.update_payout_account': 'pack:ActionPayoutChange', 'studio.buy_promotion': 'pack:ActionBuyPromotion',
  'creator.get_creator_analytics': 'pack:ActionAnalyticsRead', 'studio.use_asset': 'pack:ActionUseAsset',
};
export const PREFIX_CLASS = {
  account: 'pack:Account', agency: 'pack:MCNAgency', asset: 'pack:Asset', budget: 'pack:Budget',
  card: 'pack:PaymentInstrument', creator: 'pack:Creator', event: 'pack:SensitiveEvent', license: 'pack:License',
  pool: 'pack:Pool', purpose: 'pack:Purpose', region: 'pack:Region', scope: 'pack:Scope', session: 'pack:Session',
  subject: 'pack:Subject', team: 'pack:Team', topic: 'pack:Topic', video: 'pack:Video',
};

const META = new Set(['SUBCLASS_OF', 'COMPLETE_FOR']);
const ROOT_ACTION = 'pack:ReviewableAction';
const wmRoute = id => `#view=security-model&tab=wm-ontology&node=${encodeURIComponent(id)}`;
const RULE_OF_FACT = Object.fromEntries(Object.entries(FACT_OF_RULE).map(([rule, fact]) => [fact, rule]));
const tripleKey = t => JSON.stringify([t.s, t.p, t.o, t.grade ?? null]);
const sorted = xs => [...new Set(xs)].sort();

/** "core:core-authenticated-subject" → "Authenticated Subject", "uco:observable:Account" → "Account". */
export function anchorLabel(id) {
  const last = String(id).split(':').at(-1).replace(/^core-/, '');
  return last.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** The pack class of an instance id in a slice, by its prefix; null for a literal (number, date, level, predicate name). */
export function classOf(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^([a-z]+):(.+)$/);
  if (!m) return null;
  if (m[1] === 'tool') return TOOL_ACTION[m[2]] ?? null;
  return PREFIX_CLASS[m[1]] ?? null;
}

/** The pack's predicates, each marked relation (range is a kind), attribute (range literal) or meta. */
function predicatesOf(pack) {
  return Object.entries(pack.predicates).map(([id, sig]) => ({
    id, kind: META.has(id) ? 'meta' : sig.range.includes('literal') ? 'attribute' : 'relation',
    domain: [...sig.domain], range: [...sig.range],
  }));
}

/** Schema graph from the pack only: classes, teams, L1 anchors, attribute boxes; relation, subclass and attribute links. */
function schemaOf(pack, predicates) {
  const byId = new Map(pack.classes.map(c => [c.id, c]));
  const isAction = c => { for (let x = c, n = 0; x && n < 50; x = byId.get(x.subClassOf), n++) if (x.id === ROOT_ACTION) return true; return false; };
  const nodes = pack.classes.map(c => ({ id: c.id, label: c.label, kind: c.kind, role: isAction(c) ? 'action' : 'class' }));
  for (const t of pack.teams) nodes.push({ id: t.id, label: t.label, kind: 'team', role: 'team' });
  const anchors = [...new Set(pack.classes.map(c => c.subClassOf).filter(id => id && !byId.has(id)))];
  for (const id of anchors) nodes.push({ id, label: anchorLabel(id), kind: 'anchor', role: 'anchor', wm: wmRoute(id) });

  const links = pack.edges.map(e => ({ s: e.s, p: e.p, o: e.o, grade: e.grade ?? null, role: e.p === 'OWNED_BY_TEAM' ? 'owned' : 'relation' }));
  for (const c of pack.classes) if (c.subClassOf) links.push({ s: c.id, p: 'SUBCLASS_OF', o: c.subClassOf, grade: null, role: 'subclass' });

  // Attribute boxes: per literal-valued predicate (COMPLETE_FOR aside) and domain kind, one box on each class of that
  // kind whose superclass is not of the same kind, so a box sits on the top class of a kind, not on its subclasses.
  for (const pr of predicates.filter(x => x.kind === 'attribute')) {
    for (const kind of pr.domain) {
      for (const c of pack.classes) {
        if (c.kind !== kind || byId.get(c.subClassOf)?.kind === kind) continue;
        const id = `attr:${pr.id}@${c.id}`;
        nodes.push({ id, label: pr.id, kind: 'literal', role: 'attribute' });
        links.push({ s: c.id, p: pr.id, o: id, grade: null, role: 'attribute' });
      }
    }
  }
  return { nodes, links };
}

/** The 22 creator traces, each with its pre_tool calls in order: tool, as_of, slice triples and the engine's used sets. */
function engineCalls() {
  return scenariosFor('creator').map(t => ({
    id: t.scenario, title: t.title, agent: t.spans[0]?.agent ?? null,
    calls: t.spans.filter(sp => sp.boundary === 'pre_tool').map((span, index) => {
      const slice = span.context?.creator ?? null;
      const used = buildState(prepareSpan(span, { ontology: true }), [], TENANT, 0).facts.creator?.used ?? {};
      return { index, tool: span.tool?.name ?? null, as_of: slice?.as_of ?? null, triples: slice?.triples ?? [], used };
    }),
  }));
}

/** The call's slice as a small graph: instance nodes with their pack class, one literal node per literal-valued triple. */
function factsOf(call) {
  const usedKeys = new Set(Object.values(call.used).flat().map(tripleKey));
  const nodes = new Map(), links = [];
  const instance = id => { if (!nodes.has(id)) nodes.set(id, { id, label: id, cls: classOf(id), literal: false }); return id; };
  call.triples.forEach((t, i) => {
    const s = instance(t.s);
    let o;
    if (classOf(t.o)) o = instance(t.o);
    else { o = `lit:${i}:${t.p}`; nodes.set(o, { id: o, label: String(t.o), cls: null, literal: true }); }
    links.push({ s, p: t.p, o, grade: t.grade ?? null, used: usedKeys.has(tripleKey(t)) });
  });
  return { nodes: [...nodes.values()], links };
}

const brief = x => (x ? { decision: x.decision, stopped: x.stopped, rules: [...x.rules] } : null);

/**
 * The fleet ontology (Contract A). Pure: the parsed pack and files list in, a plain object out.
 * @param {object} pack  the parsed swm/data/packs/creator-platform.json
 * @param {object} files the parsed data/ontology-files.json (passed through)
 */
export function fleetOntology(pack, files, { seed = 7 } = {}) {
  const fm = fleetModel({ seed });
  const predicates = predicatesOf(pack);
  const schema = schemaOf(pack, predicates);
  const raw = engineCalls();
  const decisions = new Map(fm.scenarios.map(s => [s.id, s]));

  const traces = raw.map(t => {
    const d = decisions.get(t.id);
    const calls = t.calls.map(c => ({
      index: c.index, tool: c.tool, as_of: c.as_of, on: brief(d?.on[c.index]), off: brief(d?.off[c.index]), facts: factsOf(c),
    }));
    const first = calls.findIndex(c => c.on?.stopped);
    return { id: t.id, title: t.title, agent: t.agent, variant: t.id.slice(-1), deciding: first >= 0 ? first : calls.length - 1, calls };
  });

  const rules = DOMAINS.creator.rules.map(([id, effect, tools, text]) => {
    const fact = FACT_OF_RULE[id];
    const usedTriples = raw.flatMap(t => t.calls.flatMap(c => c.used[fact] ?? []));
    const stopped = side => traces.filter(t => t.calls.some(c => c[side]?.stopped && c[side].rules.includes(id))).map(t => t.id);
    return {
      id, effect, tools: tools.split(' · '), text,
      predicates: sorted(usedTriples.map(x => x.p)),
      complete: sorted(usedTriples.filter(x => x.p === 'COMPLETE_FOR').map(x => x.o)),
      stoppedOn: stopped('on'), stoppedOff: stopped('off'),
    };
  });

  const count = role => schema.nodes.filter(n => n.role === role).length;
  return {
    pack: { id: pack.meta.id, title: pack.meta.title, tenant: pack.meta.tenant, candidate: true, outside_coverage: true, path: PACK_PATH },
    counts: {
      classes: pack.classes.length, teams: pack.teams.length, relations: pack.edges.length, predicates: predicates.length,
      anchors: count('anchor'), attributes: count('attribute'), traces: traces.length,
      calls: traces.reduce((n, t) => n + t.calls.length, 0),
      triples: traces.reduce((n, t) => n + t.calls.reduce((m, c) => m + c.facts.links.length, 0), 0),
      rules: rules.length,
    },
    predicates, schema, rules, traces,
    queues: fm.queues, x1: fm.x1,
    files,
  };
}

const defaultFetchJson = async url => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
};

/** Fetches the pack and the files list, then builds the model. */
export async function loadFleetOntology({ fetchJson = defaultFetchJson, seed = 7 } = {}) {
  const [pack, files] = await Promise.all([fetchJson(PACK_PATH), fetchJson(FILES_PATH)]);
  return fleetOntology(pack, files, { seed });
}

/**
 * Contract D: every scripted call's slice, as data/creator-slice.json holds it. The slices do not depend on the seed.
 * `vendoredCommit` is the commit in jev-runtime/VENDORED.json; the generator reads that file and passes it in, since
 * this module never touches the file system.
 */
export function sliceExport({ seed = 7, vendoredCommit = null } = {}) {
  void seed;
  return {
    source: 'jev-runtime/demo/js/engine/scenarios-creator.js',
    vendored_commit: vendoredCommit,
    tenant: DOMAINS.creator.tenant,
    pack: PACK_PATH,
    note: 'Generated by tools/gen-onto-data.mjs from the vendored engine; do not edit. One entry per scripted pre_tool call: '
      + 'the ontology slice the engine reads for that call (span.context.creator): the date time-bounded facts are read '
      + 'against, and the typed triples. Scripted, simulated data for a fictional tenant; not a measurement.',
    traces: engineCalls().map(t => ({
      id: t.id, title: t.title, agent: t.agent, variant: t.id.slice(-1),
      calls: t.calls.map(c => ({ index: c.index, tool: c.tool, as_of: c.as_of, triples: c.triples.map(x => ({ s: x.s, p: x.p, o: x.o, grade: x.grade })) })),
    })),
  };
}
