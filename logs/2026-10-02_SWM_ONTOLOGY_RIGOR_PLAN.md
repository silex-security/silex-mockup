# SWM ontology rigor and coverage — plan (v3, round 3 review)

Branch `swm-ontology-rigor`, cut from `main` at `74ed19a`. Review base: `BASE=74ed19a`.

Roster: **planner** Claude (Opus 5.5, calling pane) · **coder-deepseek** OpenCode `deepseek/deepseek-flash` (DeepSeek V4.1 Flash) · **reviewer-codex** Codex (third judge).
Both gates are unanimous.

## Why

The Security World Model graph (`swm/data/ontology.json`, built by `swm/tools/build-ontology.mjs` from
public ontologies plus `swm/tools/silex-seed.mjs`) is presented as a rigorous four-layer model. Read as an
ontology, several of its assertions are wrong or unsupported.

We compared it against an external reference security ontology, which we reviewed locally and did not
commit. **No text or data from that ontology is copied.** Only modelling principles are adopted (below).

### Baseline defects

Computed with a python pass over `ontology.json` at BASE. Both reviewers re-derived these numbers in round 1.

| # | Defect | Evidence (current bundle) |
|---|---|---|
| D1 | The layer chain is enforced through a single `parent`, so domain membership is written as specialisation | 6 domain packs have `parent = grp:workflow` via `SPECIALIZES` ("Finance is a kind of Workflow") |
| D2 | Generic L3 components hang under one arbitrary domain | 13 components. Parent `dom:support` ×7, `dom:horizontal` ×3, `dom:finance` ×2, `dom:procurement` ×1 |
| D3 | Prohibited outcomes and states are modelled as business entity types | 5 L2 `entity` nodes labelled "(prohibited)" |
| D4 | No action or effect semantics | L1 `workflow` group has 1 node and `outcome` has 2. The 31 L2 workflows have no actions. 0 action or effect nodes; 0 `MAY_CAUSE` links |
| D5 | No reusable L1 authority, intent or provenance concepts, which the Correspondence Problem depends on | No L1 Request, Purpose, Authority/Scope, Provenance, Value Flow, Trust Boundary or Consent. Access Request and Leave Request exist only as L2 entities |
| D6 | Countermeasure mapping is a first-keyword match and incomplete | 32 of 105 L3 threats have a `COUNTERS` edge |
| D7 | No domain-level hazard joins business entity and action to a general threat, a control and evidence | 0 hazards. The 80 ATLAS techniques attach to components via the regex `mapThreatToComponent`; the 25 OWASP risks via explicit seed targets |
| D8 | Validation is one rule: parent within one layer up | No predicate domain/range check, no cycle check |
| D9 | Heuristic and curated assertions look the same as published ones | Links carry only `src`; 400 of 800 links are `silex`; no `review` field anywhere |

## Principles adopted

1. **Layers are presentation groups, not taxonomic ranks.**
   - Only `SUBCLASS_OF` asserts subsumption.
   - Domain membership is `PART_OF_DOMAIN` and deployment is `DEPLOYED_IN`.
   - The old `SPECIALIZES` edge to an L1 group anchor is renamed `GROUPED_UNDER`, which is navigation, not subsumption.
2. **Action, effect, state, hazard and prohibited outcome are separate kinds.**
   - `MAY_CAUSE`: action → effect.
   - A hazard is a *condition* (for example "unverified bank-detail change"). It is not an outcome or an action subtype.
   - `HAZARD_FOR`: hazard → entity | action.
   - `MAY_LEAD_TO`: hazard → prohibited outcome. A prohibited outcome is an `effect` or a `state` with `prohibited:true`.
3. **Every hazard closes one chain:**
   - `CHARACTERIZES` → a general threat
   - `MITIGATED_BY` → a control
   - `REQUIRES_EVIDENCE` → an evidence type, which is `RECORDED_BY` → a telemetry record schema
4. **Every predicate has a signature** (allowed source kinds × target kinds).
   - The build rejects violations.
   - `verify-bundle.mjs` keeps its *own* copy of the signature table, written from this plan, not imported from `schema.mjs`, and checks the bundle against it.
5. **Every node and link carries a `review` grade.** The inspector shows it.
   - `published`: structure taken from a public source.
   - `curated`: a Silex-authored semantic assertion.
   - `heuristic`: keyword-mapped.
   - `illustrative`: mock runtime and coverage data, plus any link derived from it, such as `DEPLOYED_IN`, `INSTANCE_OF`, `OCCURRED_IN`, `BELONGS_TO`, `REALISES` and `EXHIBITS`.

## Scope

In scope:
- Fix D1–D9 in the generated bundle.
- Add a Silex-authored L1 core: identity and authority; intent and provenance; action, effect and state taxonomies; controls; evidence types; security objectives.
- Add actions, hazards and prohibited outcomes to the existing 5 domain packs.
- Add **CRM** and **Legal** as *candidate* domain packs (`candidate:true`, `review:'curated'`).
  - They are L2 anchors in the ontology only.
  - They stay outside the coverage tree, its KPIs and the site's "5 domain packs" pill.
  - Their entities, actions and hazards meet the same rules as everyone else's, including `ENTITY_ISA` and the hazard chain.
- Add competency questions as executable checks.
- Bring every current-copy count and chain claim in line with the new bundle.

Out of scope, for a later run:
- Trimming the D3FEND artifact tree.
- Deriving coverage percentages from evidence.
- Promoting CRM and Legal into the coverage tree.
- Historical records (`logs/*`, `swm/BUILD_HISTORY.md`), which stay dated as written.
- Any view outside Security World Model and the Assurance view's counts.

## Contract (foundation, built first by the planner, committed before dispatch)

### `swm/tools/schema.mjs` (new)

Imported by the build and by `validate-seed.mjs`.

- `KINDS`: the existing kinds plus `core`, `action`, `effect`, `state`, `hazard`, `control`, `evidence`, `record`, `objective`. `prohibited:true` and `candidate:true` are flags, not kinds.
- `PRED_SIGNATURES`: `{ PRED: { s:[kinds], t:[kinds], tree:bool, review:[allowed grades] } }` for every predicate the build emits. The new or renamed predicates are:
  - `PART_OF_DOMAIN`
  - `GROUPED_UNDER`
  - `MAY_CAUSE`
  - `HAZARD_FOR`
  - `MAY_LEAD_TO`
  - `CHARACTERIZES`
  - `MITIGATED_BY`
  - `REQUIRES_EVIDENCE`
  - `RECORDED_BY`
  - `IMPLEMENTS` (L4 tool → L2 action)
  - `USED_IN` (action → workflow)
  - `RELATED_MATCH` (core → public node)
  - `EXHIBITS` (L4 incident → L2 hazard; illustrative)
  - `DEFINED_IN` is retired in favour of `PART_OF_DOMAIN`.
- `TREE_PREDS` (allowed as `parentPred`): `SUBCLASS_OF`, `PART_OF`, `PART_OF_DOMAIN`, `INSTANCE_OF`, `ACHIEVES`, `OCCURRED_IN`, `GROUPED_UNDER`.
- `INHERITANCE_PREDS = ['SUBCLASS_OF']`. This is the only set the VOWL subclass filter and hollow inheritance arrows use.
- `REVIEW = ['published','curated','heuristic','illustrative']`.

### New seed exports in `silex-seed.mjs`

The shapes are fixed by the contract; the content is DeepSeek's.

- `CORE_L1`: `[{ id, label, group, kind, def, parent /* core id or grp:x */, relatedMatch?: [publicId] }]`. The L1 hazard root is abstract and exempt from the hazard chain; principle 3 applies to every **L2** hazard.
- `ENTITY_ISA[domainId][entityLabel] = coreId`. Required for **every** L2 entity in all 7 packs, candidates included.
- `DOMAIN_ACTIONS[domainId]`: `[{ id, label, isA /* core action id */, mayCause:[effectId], workflows:[WF-id], implementedBy?:[rt-id] }]`
- `PROHIBITED[domainId]`: `[{ id, label, kind /* 'effect'|'state' */, isA /* core effect or state id */, def }]`
  - Holds the 5 former "(prohibited)" entities, each retyped with a one-line justification in `def`.
  - "Unrecoverable Payout" → effect. "Standing Privilege" → state. The other three are DeepSeek's call, justified the same way.
- `DOMAIN_HAZARDS[domainId]`: `[{ id, label, def, hazardFor:[entity|action id], mayLeadTo?:[prohibited id], characterizes:[threat id], mitigatedBy:[control id], requiresEvidence:[evidence id] }]`
- `RECORD_SCHEMAS`: `[{ id, label, def, records:[evidence id] }]`, which hang under `ag:trace` via `PART_OF`. Every evidence type referenced by any hazard must appear in some `records`, and validate-seed checks this.
- `COUNTER_MAP`: `[{ threat /* L3 threat id */, control /* d3f or core control id */, note }]`
- `INCIDENT_HAZARDS`: `[{ incident:'rt-inc-0987'|'rt-inc-1042', hazard }]`. These become `EXHIBITS` edges, graded `illustrative`.
- `CANDIDATE_DOMAINS`: the CRM and Legal packs, with capabilities, workflows and entities but no coverage figures.

## Display-tree rules (replacing the old chain rule)

General rules:
- Each non-anchor node keeps one display `parent`, used by the Hierarchy view, plus a new `parentPred`.
- `parentPred` must be in `TREE_PREDS`, and the parent's layer must be ≤ the child's layer.
- **Two separate acyclicity checks**, both in the build and in `verify-bundle.mjs`:
  - the whole display-parent graph, whatever the predicate;
  - the `SUBCLASS_OF` graph, which is a different graph now that L2 entities, actions and prohibited outcomes have `PART_OF_DOMAIN` display parents and separate `SUBCLASS_OF` links.
  - Each check is proved by a negative fixture. For the subclass check, the fixture has valid display parents and a `SUBCLASS_OF` cycle through non-parent links.

Per node kind:

| Node kind | Display parent (`parentPred`) | Other edges and notes |
|---|---|---|
| L2 domain pack, candidates included | none: it becomes an L2 anchor (`parent:null`, `anchor:true`) | The false `SPECIALIZES grp:workflow` edge is removed |
| L2 capability → workflow | unchanged (`PART_OF`) | |
| L2 entity | domain (`PART_OF_DOMAIN`) | `SUBCLASS_OF` its `ENTITY_ISA` core class; `GROUPED_UNDER` its group anchor |
| L2 action | domain (`PART_OF_DOMAIN`) | `SUBCLASS_OF` core action type; `USED_IN` each workflow; `MAY_CAUSE` each effect |
| L2 hazard | domain (`PART_OF_DOMAIN`) | The principle-3 edges and `HAZARD_FOR` |
| L2 prohibited outcome | domain (`PART_OF_DOMAIN`) | `SUBCLASS_OF` a core effect or state |
| L3 component | L1 core class (`SUBCLASS_OF`) | Details below |
| L3 record schema | `ag:trace` (`PART_OF`) | |
| ATLAS technique | its ATLAS tactic (`ACHIEVES`, `published`) | `THREATENS` its component is an edge graded `heuristic` |
| OWASP risk | `grp:threat` (`GROUPED_UNDER`) | `THREATENS` its component is graded `curated` |
| L4 nodes | unchanged | Their links are graded `illustrative` |

L3 component details:
- **`DEPLOYED_IN` edges go exactly to the set of domains of its runtime instances.**
- A component with no runtime instance gets **no** `DEPLOYED_IN` and a node attribute `deployment:'unobserved'`. The inspector shows this as "no runtime instance in the illustrative graph".
- At BASE these are `ag:memory-st`, `ag:subagent` and `ag:exec-ctx`.
- `dom:horizontal` is removed from the ontology bundle because nothing honest points at it. Coverage gap `g-horizontal` stays unchanged in `coverage.json`.

The Ontology Layers panel:
- Keeps adjacent-hop ribbons.
- Summarises layer-skipping edges (for example L3 → L1 `SUBCLASS_OF`) in a new `chain.skips` field, shown as one caption line.
- Its "Specialises / Specialised by" facts become "Relations with L(n−1) / Relations with L(n+1)". Hop counts include both directions.

## Tasks

| # | Owner | Task | Acceptance check |
|---|---|---|---|
| T0 | planner | `schema.mjs` with the **complete, frozen** predicate signatures (T7's independent table is written from it), plus seed export stubs (empty) so the build runs green before content lands. Checkpoint commit. | `node swm/tools/build-ontology.mjs --offline` exit 0 with stubs |
| T1 | deepseek | `CORE_L1`: about 40–50 concepts, in our own words (see the list below). `relatedMatch` only to public IDs that exist in the BASE bundle. | `validate-seed.mjs` exit 0; every `relatedMatch` resolves |
| T2 | deepseek | For all 7 packs: `ENTITY_ISA` for every entity; 4–8 actions per existing domain and 3–5 per candidate; `PROHIBITED` for the 5 former entities; 3–5 hazards per existing domain and 2–3 per candidate. | validate-seed checks each item listed below and exits 0 |
| T3 | deepseek | `RECORD_SCHEMAS` (6–8); `COUNTER_MAP` covering all 25 OWASP risks plus every ATLAS technique that can honestly be justified, each with a `note`; `INCIDENT_HAZARDS` for both incidents; `CANDIDATE_DOMAINS`. | validate-seed exit 0 |
| T4 | deepseek | Extend `validate-seed.mjs` and `references/seed-schema.md` for the new exports. | The script fails on a deliberately broken copy (proved once, reverted) |
| T5 | planner | Changes to `build-ontology.mjs`, listed below. | build exit 0; bundle ≤ 700 KB; zero violations |
| T6 | planner | UI and copy changes, listed below. | `probe-swm.mjs` and `check-copy.mjs` pass; screenshots reviewed |
| T7 | reviewer-codex (build slice) | `verify-bundle.mjs` and the new `competency.mjs`, described below. | Both exit 0 on the new bundle and **both fail on the BASE pair**, staged in a temp dir from `git show 74ed19a:swm/data/{ontology,coverage}.{json,js}` |
| T8 | planner | Regenerate `swm/data/*`, run every check, write the changelog and this plan's Outcome. | All acceptance checks |

**T1, the `CORE_L1` concept list:**
- principal, identity and authority (Principal, Human User, Service Account, Agent identity, External Party, Authenticated Subject, Credential, Authority, Authorization Scope, Delegation)
- intent and provenance (Request, Purpose, Provenance, Value Flow, Trust Boundary, Consent)
- 6 action types
- 8 effect types
- state types (at least the classes the prohibited states need)
- 6 security objectives
- 7 control types
- 8 evidence types
- a hazard root

**T2, what `validate-seed.mjs` checks:**
- every ID resolves, and every hazard's `characterizes`, `mitigatedBy` and `requiresEvidence` are non-empty;
- every prohibited outcome is reached by ≥ 1 hazard via `mayLeadTo`;
- **no hazard label equals or contains a prohibited-outcome label**, the anti-relabel check;
- every prohibited `kind` is `effect` or `state`, with `isA` resolving to a core class of that kind.

**T5, changes to `build-ontology.mjs`:**
- Consume the new exports and implement the display-tree rules.
- Emit `review` on every node and link, and add `schema` (the signatures) to the bundle.
- Enforce `PRED_SIGNATURES`, display-parent acyclicity and `SUBCLASS_OF` acyclicity, with no orphans (a non-anchor node with no parent or no edge).
- Replace the keyword `COUNTERS` with `COUNTER_MAP`. Keyword matches that are not in the map are dropped.
- Emit `uncountered`, `chain.skips` and `version:'swm-2.0'`.
- Write `ontologyCompleteness` as a **top-level key** of `coverage.json`, never inside `tree`. It is the share of hazards per domain with the full principle-3 chain, named "structural completeness".
- `kpis[entities].delta` keeps being generated from `graph.nodes.length`.

**T6, UI changes (`swm/js/*`):**
- Hierarchy shows the L2 domain anchors and candidate packs, with a "candidate" tag. `swm-ontology.js` currently assumes one anchor per group (`anchorOf`); the 7 L2 anchors share group `workflow`, so that lookup is reworked.
- `HIER` in `swm-ontology.js` uses `TREE_PREDS`; VOWL's `SUB` becomes `INHERITANCE_PREDS` only (`SUBCLASS_OF`).
- The inspector shows the node `review` grade, the selected-edge `review` grade, `deployment:'unobserved'` and "no mapped countermeasure" for uncountered threats.
- The Layers panel gets the skips caption and relabelled facts.

**T6, copy changes:**
- `index.html`: the `#wm-ontology` and `#wm-architecture` About blocks, and the Assurance view's KPI delta, layer counts, source counts and "N nodes" button.
- `assurance.html`: the same Assurance lines.
- `SECURITY_WORLD_MODEL.md` §3–§4, rewritten so presentation grouping and adjacency are not called subsumption.
- `swm/README.md` and `swm/skills/swm-data-rebuild/SKILL.md`.
- Every number comes from the built bundle.

**T6, new scripts:**
- `swm/skills/swm-data-rebuild/scripts/check-copy.mjs` (new): for each current-copy file above, extracts the node, relation, layer and source counts and compares them with the bundle.
- `swm/skills/swm-data-rebuild/scripts/probe-swm.mjs` (new): headless interaction checks (below).
- `preview-panels.mjs`: its ontology check is fixed to count `g.vw-node` (Network default) or `g.swm-node`.

**T7, what reviewer-codex builds:**
- `verify-bundle.mjs`:
  - its own local signature table, written from this plan;
  - display-parent acyclicity, `SUBCLASS_OF` acyclicity and the tree rules, each with a negative fixture that it rejects;
  - its local signature table equals the bundle's `schema` (a drift check that keeps the two copies independent but agreeing);
  - `review` present and allowed for each predicate;
  - DEPLOYED_IN equals the runtime-domain set, and `deployment:'unobserved'` exactly when that set is empty;
  - no `(prohibited)` entity.
- `swm/skills/swm-data-rebuild/scripts/competency.mjs` (new), implementing the CQs below with their per-CQ pass rules.

### Competency questions (T7)

Each prints its answer.

| CQ | Question | Pass when |
|---|---|---|
| CQ1 | For WF-055 Vendor Master Change: the hazards whose `HAZARD_FOR` targets an action `USED_IN` WF-055 or an entity of its domain; for each, its required evidence and the record schemas that `RECORDED_BY` it | ≥ 1 hazard, and every hazard has ≥ 1 evidence with ≥ 1 record schema |
| CQ2 | Actions that `MAY_CAUSE` a financial-value-transfer effect (or a subclass of it), whose hazards have **no mapped** human-approval control (or subclass). The output says "no mapped control", never "no control" | Runs cleanly. **An empty result is a valid pass.** A missing financial-value-transfer class or human-approval class is a fail |
| CQ3 | For each L3 component: the threats that `THREATENS` it, and which of them are in `uncountered` | Every L3 threat appears exactly once, either countered or uncountered |
| CQ4 | L2 entities, candidate packs included, with no `SUBCLASS_OF` to an L1 node | Count is 0 |
| CQ5 | `rt-inc-0987` → `OCCURRED_IN` trace → `REALISES` workflow; `EXHIBITS` hazard → `CHARACTERIZES` threat and `MITIGATED_BY` control | Every hop resolves. The `EXHIBITS` hop is printed with its `illustrative` grade |
| CQ6 | L2 hazards in all packs missing any principle-3 link, **including the `RECORDED_BY` hop for each required evidence**, and prohibited outcomes not reached by any hazard | Both counts are 0 |

### `probe-swm.mjs` checks (T6)

- **H1**: the Hierarchy view at L2 shows the 5 domain anchors plus 2 candidate anchors, the candidates tagged.
- **N1**: in the Network view, with `minDegree:0` and fixed group filters, the subclass toggle hides only `SUBCLASS_OF` edges; the count of other edges is unchanged.
- **I1**: selecting a node shows its `review` grade.
- **I2**: selecting an edge shows its `review` grade.
- **I3**: selecting `ag:exec-ctx` shows the "no runtime instance" text.
- **L1**: the Layers panel shows the skips caption with a count equal to `chain.skips` in the bundle.
- **R1**: the Refund example shows the same 9 nodes and 8 relations as at BASE. The probe is also run against a BASE checkout to prove equality.
- **E1**: no JS errors across the three panels.

## File ownership (literal; touch nothing else)

- **planner**:
  - `swm/tools/schema.mjs` (new) and `swm/tools/build-ontology.mjs`
  - `swm/js/*.js` and `swm/css/swm.css`
  - `index.html` (the two About blocks and the Assurance count lines only) and `assurance.html` (the Assurance count lines only)
  - `SECURITY_WORLD_MODEL.md`, `swm/README.md` and `swm/skills/swm-data-rebuild/SKILL.md`
  - `swm/skills/swm-data-rebuild/scripts/{check-copy,probe-swm,preview-panels}.mjs`
  - `swm/data/*` (generated only) and `logs/*`
- **deepseek**: `swm/tools/silex-seed.mjs`, `swm/skills/swm-simulation-data/scripts/validate-seed.mjs`, and the swm-simulation-data docs (`SKILL.md`, `references/seed-schema.md` with its `dom:horizontal` fallback line removed, `references/worked-example.md`, which is re-pointed from adding Legal to adding another domain, since Legal is now a built-in candidate pack).
- **reviewer-codex**: `swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs`, `swm/skills/swm-data-rebuild/scripts/competency.mjs` (new).

## Must not change (and what may)

**`coverage.json`:**
- `tree`, `gaps`, `dimensions` and every KPI's `id`, `label`, `value`, `note` and `dir` are identical to BASE.
- **Allowed to change:** `generated`, the new top-level `ontologyCompleteness`, and `kpis[entities].delta`, which must equal `` `${nodes.length} ontology types` `` of the new bundle.
- Check: a JSON diff with exactly those exceptions.

**The rest:**
- Every view outside Security World Model and the Assurance count lines. Check: `node tests/site/run-site-probes.mjs` passes as at BASE.
- Public-source node IDs. Check: the set of non-silex node IDs equals BASE's.
- `ontology.json` will change in `version`, `generated`, `chain` and counts, by design.

## Acceptance (all must pass at the reviewed revision)

Scripts:
- `validate-seed.mjs`
- `build-ontology.mjs --offline`
- `verify-bundle.mjs`
- `competency.mjs`
- `check-copy.mjs`
- `probe-swm.mjs`
- `run-site-probes.mjs`
- `preview-panels.mjs`, with screenshots reviewed by the planner and Codex
- the bundle ≤ 700 KB. If tight, `schema` ships as the compact signature table only.

Post-conditions, computed from the bundle and reported, not typed:
- 0 `SPECIALIZES` links;
- 0 "(prohibited)" entities;
- 0 signature violations;
- 0 display-parent cycles and 0 `SUBCLASS_OF` cycles;
- deployment equality, as defined above;
- L3 threats with ≥ 1 `COUNTERS`, against the BASE 32/105, with the rest listed in `uncountered`.

## Claim discipline

- New core concepts, hazards and mappings are `curated` Silex content.
- Keyword-derived links are `heuristic`.
- Runtime-derived links are `illustrative`.
- CRM and Legal are labelled candidate packs.
- `ontologyCompleteness` is named structural completeness, not observed coverage.
- CQ2 says "no mapped control".
- The reference ontology is not named or quoted on the public site or in the committed bundle; this plan names it only generically.

## Deploy

`main` auto-deploys to Vercel. Merge and push only after unanimous IMPL-APPROVED **and** the user's explicit go-ahead.

## Round log

### Round 1 objections → changes

| Objection (who) | Change |
|---|---|
| Prohibited outcomes are not hazards; "Standing Privilege" is a state; `KINDS` lacks `state` (Codex 1, DeepSeek 5) | Added `state` kind and a `PROHIBITED` export (effect or state, `isA` a core class). Hazards are separate conditions with `MAY_LEAD_TO`. validate-seed has an anti-relabel check |
| No incident → hazard path for CQ5 (Codex 2) | `INCIDENT_HAZARDS` export and an `EXHIBITS` predicate (L4 → L2, `illustrative`), owned by DeepSeek; CQ5 states the path |
| VOWL `SUB` set must stay subsumption only (Codex 3) | `INHERITANCE_PREDS = ['SUBCLASS_OF']` drives VOWL; display predicates are separate; `SPECIALIZES` → `GROUPED_UNDER`; probe N1 |
| Deployment rule contradicts the acceptance check (Codex 4, DeepSeek 4) | No `DEPLOYED_IN` without a runtime instance; `deployment:'unobserved'` instead; `dom:horizontal` dropped from the bundle; equality check redefined |
| Frozen KPIs conflict with regeneration; `ontologyCompleteness` inside `tree` (Codex 5, DeepSeek 2) | Exact allowed-diff list in "Must not change"; `ontologyCompleteness` is a top-level key |
| Ownership leaves false copy visible: Assurance counts, `#wm-architecture`, SECURITY_WORLD_MODEL §3–4, Layers labels (Codex 6, DeepSeek 1) | Ownership widened to those lines and files; T6 lists every one; a new `check-copy.mjs` ties copy counts to the bundle |
| UI checks cannot validate the changes; `preview-panels` counts the wrong selector and is unowned (Codex 7) | Planner owns `preview-panels.mjs` (selector fixed) and a new `probe-swm.mjs` with H1, N1, I1–I3, L1, R1 and E1 |
| CQs must not fail on a valid empty answer (Codex 8) | Per-CQ pass rules; CQ2 empty is a pass, worded "no mapped control" |
| CQ4 fails for candidate entities (DeepSeek 3) | `ENTITY_ISA` is required for all 7 packs; CQ4 covers candidates |
| Cycle check only covers `SUBCLASS_OF` (DeepSeek 6) | Acyclicity of the whole display-parent graph, in the build and in verify-bundle |
| Non-blocking (DeepSeek): independent signatures; action, hazard and candidate tree rules; review grade of runtime links; version bump; BASE pair staging | All folded in: verify-bundle keeps a local table; rows added to the display-tree rules; runtime-derived links are `illustrative`; `swm-2.0`; T7 stages the four BASE files |
| Non-blocking (Codex): narrow D5 and D7 wording | Folded into the defects table |

### Round 2 objections → changes

Verdicts: DeepSeek PLAN-APPROVED; Codex PLAN-REJECTED (1 blocking).

| Objection (who) | Change |
|---|---|
| Display-parent acyclicity no longer implies taxonomy acyclicity; check `SUBCLASS_OF` cycles too, with a negative fixture (Codex 1, blocking; DeepSeek, non-blocking) | Two separate acyclicity checks in the build and verify-bundle, each with a negative fixture; added to the post-conditions |
| N1 must fix `minDegree:0` and the group filters (Codex) | N1 updated |
| The hazard chain applies to L2 hazards, not the abstract L1 root (Codex) | Stated in `CORE_L1` and CQ6 |
| T0 freezes the full signatures before T7 (Codex) | T0 wording |
| "Relations with L(n±1)": hop counts are bidirectional (Codex) | Layers wording |
| Unowned simulation-data docs still describe the old model (DeepSeek) | Assigned to DeepSeek, with worked-example and `dom:horizontal` fixes |
| CQ6 must include the `RECORDED_BY` hop; every referenced evidence needs a record schema (DeepSeek) | `RECORD_SCHEMAS` rule, a validate-seed check, CQ6 wording |
| Dual-maintained signature tables can drift (DeepSeek) | verify-bundle compares its local table with the bundle's `schema` |
| `anchorOf` assumes one anchor per group (DeepSeek) | Named in T6 |
| Watch the 700 KB budget (DeepSeek) | Acceptance note |

### Round 3 — plan gate passed (v3)

| Seat | Verdict on v3 |
|---|---|
| coder-deepseek | PLAN-APPROVED |
| reviewer-codex | PLAN-APPROVED |
| PLANNER (claude) | PLAN-APPROVED |

DeepSeek's round-3 non-blocking notes are not plan changes. They are handled as follows, without editing the approved text:

- Root `README.md` line 16 ("over one L1 → L2 → L3 → L4 chain") describes presentation adjacency and stays as is, outside ownership.
- The Assurance layer-bar percentages are numbers on owned lines, so T6's "every number comes from the built bundle" covers them. `check-copy.mjs` checks them too.
- The independent signature table is written from the frozen T0 contract, and the drift check keeps it consistent.

Review base: `BASE=74ed19a`.

### T0 contract clarifications (before dispatch; no change to approved semantics)

- **`COMPONENT_ISA[componentId] = coreId`** is added to the seed exports, owned by DeepSeek under T1. The approved rule "L3 component: display parent is an L1 core class (`SUBCLASS_OF`)" needs a source for that mapping, and none of the approved exports supplied one.
- `schema.mjs` encodes the signatures as kind pairs, plus a `SUBCLASS_COMPAT` table so a child may only specialise a parent of a compatible kind. Both are frozen at T0.
- `CHARACTERIZES` targets published threats (ATT&CK/ATLAS techniques and tactics, OWASP risks). No core threat kind is introduced.
- Source cache populated by a full online build at BASE. The result was identical to the committed bundle except `generated`, so there is no upstream drift.

### Progress checkpoint (planner, mid-implementation, usage limit reached)

**Done:**
- T0, the frozen contract.
- T1–T4, delivered by DeepSeek: `validate-seed` passes and fails on a broken copy.
- T5, the builder: 755 nodes, 1,377 links. Contract checks pass, and the bundle is not written on any violation.
- T6, most of it:
  - UI: review chips, candidate packs, unobserved deployment, uncountered threats, skips caption, VOWL `SUBCLASS_OF` only.
  - `probe-swm.mjs`: N1, I1, I2, I3, H1, L1, R1 and E1 all pass. N1 is proven to fail with `GROUPED_UNDER` injected. R1 is equal to BASE by exact IDs.
  - The `preview-panels` selector fix.
  - Copy: `index.html` Assurance lines and both About blocks, `assurance.html` count lines, `SECURITY_WORLD_MODEL.md`, `swm/README.md`, rebuild `SKILL.md`.
- Post-conditions computed:
  - no `SPECIALIZES` links and no "(prohibited)" entities;
  - deployment equality holds;
  - public ID set equal to BASE;
  - `coverage.json` differs only in `kpis[entities].delta`;
  - `ontology.js` is 577 KB;
  - 45 of 105 threats countered.

**Still open:**
- DeepSeek follow-up on label collisions, which was sent: tautological core labels such as Execution Context ⊑ Execution Context, plus a validate-seed rule.
- `assurance.html`'s own `#wm-architecture` About block (around line 948) still has the old "single chain" copy.
- `check-copy.mjs` is not written yet.
- `swm/data/*` needs regenerating after DeepSeek's fix.
- `run-site-probes.mjs` has not been run.
- Codex T7 is in progress: `verify-bundle.mjs` and `competency.mjs`.
- The rebuild `SKILL.md` line about verify-bundle (around line 83) waits on T7.
- Step 7 code review, both seats, has not started.
- Not merged, not pushed.

## Code review

Review base `74ed19a`. The round-1 candidate is `924cc99`, diff revision `3342aee`. The generated `ontology.json`, `ontology.js` and `coverage.js` are excluded from the text diff because of size; they are reproducible from the offline build.

### Round 1 — DeepSeek IMPL-APPROVED · Codex IMPL-REJECTED (7 blocking)

| Defect (who) | Change |
|---|---|
| False `SUBCLASS_OF` assertions in CORE_L1, ENTITY_ISA, COMPONENT_ISA and PROHIBITED: Scope or Delegation ⊑ Authority, Purpose ⊑ Request, Credential Broker ⊑ credential, Tool Registry ⊑ tool, Opportunity or Campaign ⊑ obligation, compensation change ⊑ transfer (Codex 1) | DeepSeek: each subtype re-checked against both definitions; new general classes where needed |
| Offboarding modelled as granting authority (Codex 2) | DeepSeek: revocation or removal action and effect |
| Unrelated `CHARACTERIZES` targets (Codex 3) | DeepSeek: replaced, and every alignment audited against the target's definition |
| Dual Approval not a kind of Human Approval, so CQ2 was misleading (Codex 4) | DeepSeek: `SUBCLASS_OF human-approval`; CQ2's answer changes accordingly |
| `COUNTER_MAP` rationales exceed what the control does (Codex 5) | DeepSeek: entries remapped to controls whose definitions cover the claim (new rate-limit and review-throttle controls); count stays 45/105 |
| About notes and README still call all L1, and domain inheritance, public (Codex 6) | Planner: `index.html`, `assurance.html` and README distinguish published from curated |
| Worked example does not validate; validator forbids a sixth outcome (Codex 7; DeepSeek NB3) | DeepSeek: id fixed, validator relaxed to "the five remain", recipe proven |
| Both: accept the `assurance.html` scope extension; accept the budget as the browser `.js` payload | Accepted; `SECURITY_WORLD_MODEL.md` states the `ontology.js` size against the 700 KB verifier budget |
| DeepSeek NB4: cross-pack `MAY_LEAD_TO`; NB6: candidate rows in `ontologyCompleteness` | DeepSeek owns NB4; NB6 is documented in the README |
| DeepSeek NB1: core concepts exceed "about 40–50" | Accepted deviation. The extra classes are the generic anchors the frozen `SUBCLASS_COMPAT` requires plus the supertypes added in the round-1 fixes; the final count is in the Outcome |

### Round 2 — DeepSeek IMPL-APPROVED · Codex IMPL-REJECTED (2 blocking)

Commit `6b9cff1`, diff revision `da2ca1d`.

| Defect (who) | Change |
|---|---|
| `ag:subagent` (a hand-off) `SUBCLASS_OF` core Agent, an actor (Codex 1; DeepSeek NB1, which also questions Planner) | DeepSeek: a general hand-off class; Planner re-tested under the same rule |
| Unverified Bank Change ⊑ record alteration, but an accurate update can still be unverified (Codex 2) | DeepSeek: re-parented to a data-write / state-change effect; the missing-verification condition stays in its definition |
| DeepSeek NB2, NB3, NB5: stale numbers and wording in this log | Planner: corrected in the round-1 table |
| DeepSeek NB6 (T8 note wording), NB7 (order-splitting alignment) | DeepSeek, if cheap |
| DeepSeek NB4: `core-tool` has no subclasses now | Kept as a general concept with its public match; no change |

### Round 3 — both IMPL-REJECTED, one shared defect

Commit `cb4b86d`.

Both seats found that the commit shipped the stale pre-round-2 bundle. The seed and the copy were correct; the generated `swm/data/*` was not. That left the two round-2 subsumption errors in the graph the UI loads, and the copy contradicted the data.

Cause: a race. The planner built the corrected bundle and ran the checks. DeepSeek, still finishing its round-2 task, then ran its acceptance step (`build`, then `git checkout -- swm/data`), which restored the old bundle just before the planner's commit.

Fix: commit `d47fb7d` regenerates the bundle with both other seats idle. Every check now runs against a clean `git archive HEAD` export, not the working tree: validate-seed, verify-bundle, competency, check-copy, the fixture runner, and probe-swm `--root <export>` (8/8).

Lesson: verify committed artifacts from an export of the commit, and never commit generated files while another seat may rebuild.

### Round 4 — code gate passed

Commit `515e525`, diff revision `34261e2`, base `74ed19a`.

| Seat | Verdict |
|---|---|
| coder-deepseek (DeepSeek V4.1 Flash) | IMPL-APPROVED. It also rebuilt from the seed outside the repo; the output is byte-identical to the committed bundle apart from `generated` |
| reviewer-codex (Codex) | IMPL-APPROVED. Rounds 1–2 ran on GPT-6.1-Sol high. Round 3 was resent after a swallowed prompt; rounds 3–4 ran on GPT-6-Luna medium after the weekly limit fell to 10% |
| PLANNER (claude) | IMPL-APPROVED. Verified from a clean `git archive` export of `d47fb7d`: all scripts exit 0 and probe-swm passes 8/8 |

## Outcome

- **Gates:** plan gate unanimous after 3 rounds (v1 → v3); code gate unanimous after 4 rounds.
- **Result** (all numbers computed from the bundle):

  | Measure | BASE | Now |
  |---|---|---|
  | Nodes | 598 | 766 |
  | Typed relations | 800 | 1,389 |
  | Public IDs | 467 | 467 (unchanged) |
  | L1 Silex core concepts | — | 80 (accepted deviation from "about 40–50") |
  | Domain packs | 5 | 5 + 2 candidates (CRM, Legal) |
  | Hazards | — | 25, each with a complete chain |
  | Prohibited outcomes | 5 entities | 5, retyped as effects or states |
  | Record schemas | — | 7 |
  | L3 threats countered | 32 of 105 | 45 of 105 (60 listed as uncountered) |
  | `SPECIALIZES` links, signature violations, display or `SUBCLASS_OF` cycles | — | 0 |
  | `ontology.js` | — | 570 KB, against the 700 KB budget |
- **What each seat caught:**
  - *Codex:* false subsumptions throughout the authored taxonomy (rounds 1–2); misaligned hazard → threat links and countermeasure rationales; dual approval missing from human approval, which made CQ2 misleading; copy still calling curated L1 public; a broken worked example; the shipped stale bundle (round 3).
  - *DeepSeek:* frozen-KPI and ownership contradictions in plan v1; candidate entities and CQ4; the `RECORDED_BY` coverage rule; signature-table drift; the one-anchor-per-group UI assumption; label-collision follow-ups; stale numbers in this log; the stale bundle (round 3).
  - *Planner:* the missing `COMPONENT_ISA` contract gap; label collisions found in screenshots; the I2 probe's `innerText` bug; the upstream no-drift check; the S20 failure shown to be pre-existing at BASE.
- **Unchanged:**
  - views outside the Security World Model: site probes 20/21, the same as at BASE, with S20 environmental;
  - coverage `tree`, `gaps` and `dimensions`;
  - public node IDs;
  - the Refund example (R1, exact IDs).
- **Not merged or pushed:** `main` auto-deploys to Vercel and needs the user's go-ahead.

## Deploy record

The user said "push to main", which is the deploy go-ahead. `main` was fast-forwarded `74ed19a..89c3ef5`, and Vercel deployed it.

Live read-back:
- `swm/data/ontology.js` reports `swm-2.0` (HTTP 200, `application/javascript`).
- The page shows "766 types · 1389 relations" and the presentation-groups wording.
- Nine key files are byte-identical to `89c3ef5`: `index.html`, `assurance.html`, `ontology.js`, `coverage.js`, four SWM scripts and `swm.css`.
- `run-site-probes --base` live subset: 8 of 9 pass. S20 fails from this machine's headless Chrome exactly as it does at BASE (scrollbar geometry).
