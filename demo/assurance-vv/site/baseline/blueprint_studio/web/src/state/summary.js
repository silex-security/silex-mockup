/* bs.summary.v1 — a derived, never authoritative summary of every saved
   Blueprint document, for the host site (plan logs/2026-09-24_STUDIO_CUTOVER_PLAN.md §2.3).
   Rebuilt from all bs.doc.* keys on every publish, so inactive documents stay,
   deleted ones drop out and replaced ones are recomputed. Every figure is
   copied from the stored document; nothing is re-simulated. Pure except for
   publishSummary(storage). */
import { recommend } from '../../../js/optimize.js';
import { revLabel } from '../../../js/store.js';

export const SUMMARY_KEY = 'bs.summary.v1';
export const DOC_PREFIX = 'bs.doc.';

/* 32-bit FNV-1a over UTF-16 code units, 8 hex chars. The host computes the
   same function over the raw bs.doc.<id> string to detect a stale summary. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const pick = (m, k) => (m && m[k] && Number.isFinite(m[k].num) && Number.isFinite(m[k].den) ? { num: m[k].num, den: m[k].den } : null);
const metricsOf = m => ({ residualReachability: pick(m, 'residualReachability'), benignCompletion: pick(m, 'benignCompletion'), friction: pick(m, 'friction') });
const scorecardOf = sc => sc ? {
  violationsClosed: pick(sc, 'violationsClosed'), residualReachability: pick(sc, 'residualReachability'),
  benignCompletion: pick(sc, 'benignCompletion'), friction: pick(sc, 'friction'),
  addedLatencyMedian: Number.isFinite(sc.addedLatencyMedian) ? sc.addedLatencyMedian : null, patchOps: Number.isFinite(sc.patchOps) ? sc.patchOps : null
} : null;

/* The controller's rule (controller.recommendedId): tested at current parameters, not rejected. */
function recommendedOf(rev) {
  const o = rev.optimization; if (!o) return null;
  const current = c => c.state === 'tested' && c.testedParamsVersion === c.candidate.paramsVersion && c.verdict;
  const scored = o.candidates.filter(current).map(c => ({ candidate: c.candidate, result: c.result, verdict: c.verdict }));
  const id = recommend(scored, new Set(o.candidates.filter(c => c.state === 'rejected').map(c => c.candidate.id)));
  const c = id && o.candidates.find(x => x.candidate.id === id);
  return c ? { id, label: c.candidate.label, paramsVersion: c.candidate.paramsVersion, testedParamsVersion: c.testedParamsVersion, runId: c.runId, scorecard: scorecardOf(c.verdict.scorecard) } : null;
}

function revSummary(doc, r) {
  const v = r.validation && r.validation.result ? r.validation : null;
  const validation = v ? {
    scenarioSetId: v.scenarioSetId, jobId: v.jobId ?? null, n: v.n ?? null, runs: (v.result.runs || []).length,
    findings: (v.result.findings || []).map(f => ({ id: f.id, prohibited: f.prohibited, severity: f.severity, violating: f.violating, run: f.run })),
    metrics: metricsOf(v.result.metrics), candidateRun: r.origin === 'approve'      // an approved child's validation is the parent's candidate run
  } : null;
  const o = r.optimization;
  const optimization = o ? {
    scenarioSetId: o.scenarioSetId, candidates: o.candidates.length,
    tested: o.candidates.filter(c => c.state === 'tested' && c.testedParamsVersion === c.candidate.paramsVersion).length,
    eligible: o.candidates.filter(c => c.state === 'tested' && c.testedParamsVersion === c.candidate.paramsVersion && c.verdict?.eligible).length
  } : null;
  const recommended = recommendedOf(r);
  const d = r.decision;
  const decided = !!d || r.origin === 'approve';
  let awaiting = null;
  if (!decided && r.status === 'confirmed') {
    if (o && recommended) awaiting = 'approve';
    else if (validation && validation.findings.length === 0) awaiting = 'accept';
  }
  const decision = d ? (d.action === 'approve'
    ? { action: 'approve', candidateId: d.candidateId, label: d.label ?? null, paramsVersion: d.paramsVersion ?? null, runId: d.runId ?? null,
        scenarioSetId: d.scenarioSetId ?? null, childRev: d.childRev ?? null, childLabel: d.childRev != null ? revLabel(d.childRev) : null, childHash: d.childHash ?? null,
        decidedAt: d.decidedAt ?? null, scorecard: scorecardOf(d.evidence?.scorecard) }
    : { action: 'accept', candidateId: null, label: null, paramsVersion: null, runId: d.runId ?? null, scenarioSetId: d.scenarioSetId ?? null,
        childRev: null, childLabel: null, childHash: null, decidedAt: d.decidedAt ?? null, scorecard: null, metrics: metricsOf(d.evidence?.metrics) }) : null;
  return { rev: r.rev, label: revLabel(r.rev), status: r.status, origin: r.origin, parent: r.parent ?? null, hash: r.hash ?? null,
    validation, optimization, recommended, awaiting, decision };
}

export function docSummary(raw) {
  let doc; try { doc = JSON.parse(raw); } catch { return null; }
  if (!doc || typeof doc.id !== 'string' || !doc.id || !Array.isArray(doc.revisions)) return null;
  try {
    return { docId: doc.id, name: String(doc.name ?? ''), domain: String(doc.domain ?? ''), owner: String(doc.owner ?? ''), fp: fnv1a(raw),
      revs: doc.revisions.map(r => revSummary(doc, r)) };
  } catch { return null; }
}

/* Every bs.doc.* key in storage (getItem/setItem/key/length or a Map-backed stub with keys()). */
export function docKeys(storage) {
  const out = [];
  if (typeof storage.length === 'number' && typeof storage.key === 'function') { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(DOC_PREFIX)) out.push(k); } }
  else if (typeof storage.keys === 'function') for (const k of storage.keys()) if (k.startsWith(DOC_PREFIX)) out.push(k);
  return out.sort();
}

export function buildSummary(storage, at = new Date().toISOString()) {
  const docs = [];
  for (const k of docKeys(storage)) { const raw = storage.getItem(k); const d = raw && docSummary(raw); if (d && DOC_PREFIX + d.docId === k) docs.push(d); }
  return { v: 1, at, docs };
}

export function publishSummary(storage) {
  if (!storage) return null;
  try { const s = buildSummary(storage); storage.setItem(SUMMARY_KEY, JSON.stringify(s)); return s; } catch { return null; }
}
