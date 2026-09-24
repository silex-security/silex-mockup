# Decision Trace — data contract (plan: logs/2026-09-24_DECISION_TRACE_PROPOSAL.md v0.4)

The Trace view (Claude: `TraceView.jsx`, `Spine.jsx`, `ThreadGraph.jsx`, `DecisionRecord.jsx`) renders **only** what
`derive.js` returns. `derive.js` (DeepSeek) is pure: no React, no store import, no DOM, no i18n. It returns data plus
English strings for the exported record. The UI translates labels by key.

## Files (DeepSeek)

| File | What |
|---|---|
| `blueprint_studio/tools/ontology-slice.mjs` | Reads `swm/data/ontology.json` and writes `blueprint_studio/ontology/slice.json`. Takes `--check` (exit 1 if the slice on disk differs from a fresh build) |
| `blueprint_studio/ontology/slice.json` | `{ version, generated, source: "swm/data/ontology.json", classes: [...13 L3 ag:*], threats: [...], links: [...] }`, see below |
| `blueprint_studio/web/src/trace/mapping.js` | `STEP_CLASS` rules (§4.1), `FAMILIES` (§4.2), `describePatch` (§4.3), `publicUrl(id)` |
| `blueprint_studio/web/src/trace/derive.js` | `deriveTrace(input)`, described below |
| `blueprint_studio/tests/trace-data.test.mjs` | slice and mapping tests (plan §6 row 1) |
| `blueprint_studio/web/tests/derive.test.mjs` | derive tests (plan §6 row 2) |

## slice.json

- `classes[]`: `{ id, label, def, layer: 3, src }` for the 13 `ag:*` nodes.
- `threats[]`: `{ id, label, def, group: "threat", src }`. Covers every threat that has a `THREATENS` link to any `ag:*`, plus the ids named in `FAMILIES` (so an id related through a family is present even if it has no link).
- `links[]`: `{ s, t, pred, src }` for `THREATENS` links into `ag:*`, with `src` kept as-is (`"silex"`).
- `version`: the ontology's `version` (e.g. `swm-1.0`). `generated`: copied from the source, never `Date.now()`, so a rebuild is byte-identical.

## mapping.js

```js
export const STEP_CLASS = (node) => ({ classId: 'ag:planner' | ... | null, criterion: '<English, why it maps>' | null, reason: '<English, why unmapped>' | null });
// §4.1 exactly: agent→ag:planner; tool→ag:tool-reg; control human_approval|dual_approval→ag:hitl; control policy_gate→ag:guardrail;
// outcome|prohibited→ag:harness; data, trigger, decision → null with the §4.1 reason.
export const FAMILIES = [ { id: 'below_threshold', law: 'authority', related: [{ threatId, limit }], sampling: '<English §4.2 text>' }, ... ]; // all 6, TEMPLATE order
export const LAWS = { authority: '...', 'approval binding': '...', idempotency: '...', taint: '...' };   // one-line English definitions
export function describePatch(graph, patch) -> [{ text: '<English>', stepId: string|null, newStep: boolean, classId: string|null }]  // §4.3, derived from ops
export function publicUrl(id) -> string|null   // atlas:AML.Txxxx → https://atlas.mitre.org/techniques/AML.Txxxx ; owasp:LLMnn → https://genai.owasp.org/llmrisk/llmnn-… (or the Top 10 index page); owaspa:Tn → the OWASP Agentic threats page; else null
```

## deriveTrace(input) → Trace

`input = { doc, revNo, slice, meta }`. `doc` is the store document (read-only). `revNo` is the revision shown.
`meta = { name, domain }`.

```js
{
  stamp: { ontologyVersion, revLabel: 'v1.0', hash, scenarioSetId: string|null, grades: ['declared','simulated'] },
  binding: { kind: 'draft'|'confirmed'|'evaluated'|'approvedChild', parent: { revLabel, hash }|null, child: { revLabel, hash }|null },
     // approvedChild: numbers below come from the parent's candidate run (the store's childValidationResult), and binding.parent says so
  stage: { validated: bool, optimized: bool, decided: bool },

  schema: {
    steps: [{ id, label, type, classId|null, criterion|null, reason|null }],   // every node of the revision graph
    mappedCount, unmappedCount,
    classes: [{ id, label, def, stepIds: [] }],                              // only instantiated classes
    associated: [{ threatId, label, classId, url|null, src }],                // THREATENS into instantiated classes, deduped by threatId (first classId kept; also `classIds`)
    related: [{ threatId, label, family, limit, url|null, instantiated: bool, classId|null }], // from FAMILIES; instantiated = its THREATENS target class is instantiated
    counts: { associated, relatedInstantiated, withoutRelatedFamily, relatedOutside }
  },
  laws: null | { families: [{ id, law, related: [...], sampling, runs, violatingRuns }] },   // runs/violatingRuns counted from result.runs
  worldState: { paths: [{ prohibited, target, path: [ids], guards: [ids] }] },            // validation.result.potential if validated, else validate.potentialPaths(graph)
  simulation: null | {
    runs, adversarial: { num, den }, benign: { num, den },
    findings: [{ id, prohibited, monitor, family, severity, violating, run, paths: [{ nodes, count }],
                 attributed: [stepIds],        // §3.2 rule: steps on violating paths that can produce the effect
                 declaredWatch: [stepIds],     // prohibited.config.watches
                 attributionDiffers: bool, law, related: [threatIds] }]
  },
  objectives: { eligibility: [English strings, verbatim from optimize.score], rank: ['friction','addedLatencyMedian','patchOps'],
                approximated: ['risk','friction','latency'], notModelled: ['coverage','compliance','cost','performance'] },
  candidates: null | [{ id, label, state: 'eligible'|'ineligible'|'stale'|'rejected'|'approved',
                        paramsVersion, testedParamsVersion|null, runId|null, eligible: bool|null, reasons: [], scorecard|null,
                        changes: describePatch(...), closes: [findingIds]   // only for current tested evidence, else []
                      }],
  recommended: candidateId|null,             // controller rule: tested, current, not rejected → optimize.recommend
  decision: null | { action: 'approve'|'accept', candidateId|null, childRevLabel|null, childHash|null, decidedAt|null },
  funnel: { steps, mapped, unmapped, classes, associated, relatedInstantiated, withoutRelatedFamily, relatedOutside,
            paths, runs|null, adversarial|null, benign|null, findings|null,
            candidates|null, tested|null, eligible|null, ineligible|null, stale|null, rejectedByPerson|null, approved|null },
  statement: null | { generatedFrom: '<English>', violationsFound: [{ finding, violating, run }],
                      zeroViolations: [{ prohibited, label, runs }], notSimulated: [English], text: '<English>' },
  rationale: null | '<English, one sentence, assembled from declared facts>',
  thread: { nodes: [{ id, column: 0..6, kind: 'step'|'class'|'threat'|'family'|'finding'|'candidate'|'decision', label, ref, state? }],
            edges: [{ id, from, to, style: 'declared'|'simulated'|'association'|'untested', label? }] },
  record: { ... plan §3.4, JSON-serialisable, English ... }
}
```

**Thread columns:** 0 step, 1 class, 2 related threat, 3 family, 4 finding, 5 candidate, 6 decision. Only the following are included:
- steps that are attributed to a finding, or touched by a candidate;
- their classes;
- related threats;
- families that produced a finding;
- findings;
- candidates.

Edge styles:
- step→class and class→threat: `association`.
- threat→family: `association` (labelled with the limit).
- family→finding: `simulated`.
- finding→step (declared watch): `declared`.
- finding→candidate that closes it: `simulated`, only for current tested evidence.
- candidate→decision: `simulated`.
- stale or human-rejected candidates: `untested`.

**Hard rules, tested:**
- No grade other than `declared`, `simulated` or `not run`.
- The words safe, certified, verified, latent and observed never appear in any string.
- Every count comes from the stored results or the slice.
- `statement.text` says "no violations" only when every monitor is zero in the cited result.
