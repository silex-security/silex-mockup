/* The Security World Model contract (plan logs/2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md, T0).

   Layers are presentation groups, not taxonomic ranks: only SUBCLASS_OF asserts
   subsumption. Every predicate the build emits is listed here with the node-kind
   pairs it may join, whether it can serve as a display-tree parent edge, and the
   review grades it may carry. build-ontology.mjs and validate-seed.mjs import this
   file; verify-bundle.mjs keeps its own copy and checks the two agree.

   Frozen at T0. Changing it after dispatch needs a confirmation round. */

export const REVIEW = ['published', 'curated', 'heuristic', 'illustrative'];

/* L4 runtime node kinds (the `type` of a RUNTIME node, which is the id of the
   L3 component it instantiates) */
export const RUNTIME_KINDS = ['planner', 'memory-st', 'memory-lt', 'retriever', 'tool-reg', 'mcp', 'subagent',
  'cred-store', 'exec-ctx', 'guardrail', 'hitl', 'trace', 'harness', 'incident'];

/* Silex L1 core concepts carry one of these kinds (CORE_L1[].kind) */
export const CORE_KINDS = ['core', 'action', 'effect', 'state', 'control', 'evidence', 'objective', 'hazard'];

export const KINDS = [
  'group',                                            // L1 Silex group anchors
  'class', 'countermeasure', 'tactic', 'technique',   // L1 public (UCO, D3FEND, ATT&CK, ATLAS tactics)
  ...CORE_KINDS,                                      // L1 Silex core; action/effect/state/hazard also at L2
  'domain', 'capability', 'workflow', 'entity',       // L2 domain packs
  'component', 'record', 'risk',                      // L3 (ATLAS techniques are kind 'technique' at L3)
  ...RUNTIME_KINDS                                    // L4
];

/* A SUBCLASS_OF child may only specialise a parent of a compatible kind */
export const SUBCLASS_COMPAT = {
  class:          ['class'],
  countermeasure: ['countermeasure'],
  core:           ['core'],
  action:         ['action'],
  effect:         ['effect'],
  state:          ['state'],
  control:        ['control'],
  evidence:       ['evidence'],
  objective:      ['objective'],
  hazard:         ['hazard'],
  entity:         ['core'],
  component:      ['core']
};

const ANY_L1_L3 = ['class', 'countermeasure', 'tactic', 'technique', ...CORE_KINDS, 'entity', 'component', 'risk', 'record'];
const PUBLIC = ['class', 'countermeasure', 'tactic', 'technique', 'risk'];
const pairs = (S, T) => S.flatMap(s => T.map(t => [s, t]));

/* pred: { pairs:[[sKind,tKind]…], tree, review:[grades], note } */
export const PRED_SIGNATURES = {
  /* subsumption — the only inheritance predicate */
  SUBCLASS_OF:      { pairs: Object.entries(SUBCLASS_COMPAT).flatMap(([s, ts]) => ts.map(t => [s, t])),
                      tree: true,  review: ['published', 'curated'] },

  /* navigation and composition */
  GROUPED_UNDER:    { pairs: pairs(ANY_L1_L3, ['group']), tree: true, review: ['curated'] },
  PART_OF:          { pairs: [['capability', 'domain'], ['workflow', 'capability'], ['record', 'component']],
                      tree: true, review: ['curated', 'illustrative'] },
  PART_OF_DOMAIN:   { pairs: pairs(['entity', 'action', 'hazard', 'effect', 'state'], ['domain']),
                      tree: true, review: ['curated'] },
  ACHIEVES:         { pairs: [['technique', 'tactic']], tree: true, review: ['published'] },
  INSTANCE_OF:      { pairs: pairs(RUNTIME_KINDS, ['component']), tree: true, review: ['illustrative'] },
  OCCURRED_IN:      { pairs: [['incident', 'trace']], tree: true, review: ['illustrative'] },

  /* agentic system ↔ domain and threats */
  DEPLOYED_IN:      { pairs: [['component', 'domain']], tree: false, review: ['illustrative'] },
  THREATENS:        { pairs: pairs(['technique', 'risk'], ['component']), tree: false, review: ['heuristic', 'curated'] },
  COUNTERS:         { pairs: pairs(['countermeasure', 'control'], ['technique', 'risk']), tree: false, review: ['curated'] },
  RELATED_MATCH:    { pairs: pairs(CORE_KINDS, PUBLIC), tree: false, review: ['curated'] },

  /* action, effect, hazard chain (principles 2 and 3) */
  USED_IN:          { pairs: [['action', 'workflow']], tree: false, review: ['curated'] },
  MAY_CAUSE:        { pairs: [['action', 'effect']], tree: false, review: ['curated'] },
  HAZARD_FOR:       { pairs: pairs(['hazard'], ['entity', 'action']), tree: false, review: ['curated'] },
  MAY_LEAD_TO:      { pairs: pairs(['hazard'], ['effect', 'state']), tree: false, review: ['curated'] },
  CHARACTERIZES:    { pairs: pairs(['hazard'], ['technique', 'tactic', 'risk']), tree: false, review: ['curated'] },
  MITIGATED_BY:     { pairs: pairs(['hazard'], ['control', 'countermeasure']), tree: false, review: ['curated'] },
  REQUIRES_EVIDENCE:{ pairs: [['hazard', 'evidence']], tree: false, review: ['curated'] },
  RECORDED_BY:      { pairs: [['evidence', 'record']], tree: false, review: ['curated'] },

  /* runtime → ontology (all illustrative: the runtime graph is mock content) */
  BELONGS_TO:       { pairs: pairs(RUNTIME_KINDS, ['domain']), tree: false, review: ['illustrative'] },
  REALISES:         { pairs: [['trace', 'workflow']], tree: false, review: ['illustrative'] },
  IMPLEMENTS:       { pairs: [['tool-reg', 'action']], tree: false, review: ['illustrative'] },
  EXHIBITS:         { pairs: [['incident', 'hazard']], tree: false, review: ['illustrative'] },

  /* runtime ↔ runtime (seed RUNTIME.links) */
  ...Object.fromEntries(['DELEGATES_AUTHORITY', 'AUTHORIZES', 'READS_WRITES', 'RETRIEVES_FROM', 'CALLS', 'MUTATES',
    'GOVERNS', 'GATES', 'EXECUTED_BY', 'REACHES', 'CONTRIBUTED_TO', 'INTENDS', 'INVOKES', 'INFORMS', 'CAN_REACH']
    .map(p => [p, { pairs: pairs(RUNTIME_KINDS, RUNTIME_KINDS), tree: false, review: ['illustrative'] }]))
};

export const TREE_PREDS = Object.keys(PRED_SIGNATURES).filter(p => PRED_SIGNATURES[p].tree);
export const INHERITANCE_PREDS = ['SUBCLASS_OF'];

/* compact form shipped in the bundle as `schema` */
export const compactSchema = () => ({
  review: REVIEW,
  inheritance: INHERITANCE_PREDS,
  tree: TREE_PREDS,
  predicates: Object.fromEntries(Object.entries(PRED_SIGNATURES)
    .map(([p, s]) => [p, { pairs: s.pairs.map(([a, b]) => `${a}>${b}`), review: s.review }]))
});
