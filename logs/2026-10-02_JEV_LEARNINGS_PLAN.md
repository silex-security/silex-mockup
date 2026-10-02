# What silex-mockup can take from jev-simplified's "Ontology link" — plan (v5, feasibility review round 5)

Status: **draft for review; nothing is implemented.** The user asked for a plan that agents review for feasibility.

Base: silex-mockup `origin/main` at `7a6f216`. Before starting, fetch it and confirm `swm/data/ontology.json` reports `swm-2.0` with 766 nodes; a stale local `main` ref still points at `74ed19a`, the 598-node bundle.

Source: [silex-lab-ai/jev-simplified](https://github.com/silex-lab-ai/jev-simplified) `origin/main` at `c073c61` (2026-10-02). The relevant records are its "Ontology link" plan and session summary: `logs/2026-10-02_ONTOLOGY_LINK_PLAN.md` and `logs/2026-10-02_SESSION_SUMMARY_ZH.md`.

## What jev-simplified did

jev-simplified copied this repo's Enterprise World Model, as it stood at `74ed19a` (before the ontology-rigor run), into its SOC demo. It then linked the two:

1. **Ontology chips on every runtime decision.** Each decision shows a "Decided by" group (the rule, or the question that crossed its threshold) and an "Also checked" group (with scores and status). Each chip opens the World Model focused on its node.
2. **A hand-authored mapping, `site/ontology/jev-map.js`.** Each Jev question or rule maps to ontology nodes with a relation (`signals` or `mitigates`) and a one-line reason. A static check verifies every id exists.
3. **A "Show what Jev checks at runtime" toggle.** It highlights the mapped nodes and adds an inspector section, "Checked at runtime by Jev", with evaluated and flagged counts and a jump back to the first flagged event.
4. **An L4 → L3 chain inspector.** It writes the chain out in words: runtime instance → component → threats → which Jev check covers each.
5. **Deep links.** `#view=…&node=…` routes support Back and Forward; a malformed link falls back to the default view with a notice.
6. **Robustness fixes to the copied World Model code**, found in its code review:
   - the loader can retry, re-requesting only failed files;
   - `focus()` clears any filter hiding the target;
   - a load that finishes after the view is hidden does not start the graph;
   - hard-coded CSSOM writes become classes.
7. **Tests:**
   - a 390 px no-overflow check;
   - keyboard search → select;
   - zero CSP violations;
   - a lifecycle check (no simulation ticks while hidden);
   - the browser suite run three times in a row to catch flakiness.

## Facts checked in this repo (computed, not assumed)

| # | Fact | How checked |
|---|---|---|
| F1 | The World Model loader has no Retry control and no resumable loading. On failure it sets `state = 'error'` and prints a message. A later `SWMLoad()`, for example on re-entering the view, restarts the **whole** script chain, re-executing files that already loaded | `swm/js/swm-loader.js:21-49` (corrected in round 1) |
| F2 | `goToNode()` restores the node's group filter but not the Network minimum-degree or subclass filters. A searched node can stay hidden | `swm/js/swm-ontology.js` `goToNode` |
| F3 | The hash router accepts only `view=runtime-observation` and `view=long-term`; any other value is ignored. There is no World Model deep link (this run hit it: `#view=security-model` opened the default view) | `index.html` `applyViewHash` |
| F4 | All 8 node ids in jev's mapping exist in the current `swm-2.0` bundle: `owasp:LLM01`, `atlas:AML.T0051`, `owaspa:T3`, `attack:TA0010`, `owasp:LLM02`, `owasp:LLM06`, `owaspa:T6`, `ag:hitl` | Python over `swm/data/ontology.json` |
| F5 | The bundle's two runtime **fixture** incidents lead to curated chains. Their numbers collide with the site's incident ids, but they are different records (see F8) | Bundle query (below) |
| F6 | Runtime Observation embeds `jev-runtime/demo/`, a **hash-pinned vendored copy** of jev-runtime-observability (`jev-runtime/VENDORED.json`, commit `be8fda2`), inside an iframe | `js/jev-runtime-host.js:3,8,51` |
| F7 | jev-simplified's World Model snapshot is the pre-rigor bundle (598 nodes, `swm-1.0`) | jev-simplified `VENDORED.json` → `world_model.source_commit` |
| F8 | **The site owns incident numbering.** The site's I-1042 is "Vendor bank mutation attempted" (Finance · Vendor Master Update; external email → vendor update; intent–approval binding failure). The site's I-1038 is "Aggregate refund limit exceeded" (cross-agent value composition, $1,200). The site has **no I-0987**. The bundle's `rt-inc-1042` "Refund loop" and `rt-inc-0987` "Vendor bank change" are SWM fixtures, and `swm-core.js` already relabels the bare fixture number "I-1042 · Refund loop (SWM fixture)" so the two are never confused. Records must never be joined by number | `index.html` `incidentData`, `renderIncident`; `swm/js/swm-core.js:61-65` |
| F9 | Ordinary navigation does not write the hash (`showView()`), and `applyViewHash()` ignores blank and non-`view=` hashes. Studio owns `#studio` and `#studio=new` (`js/studio-host.js:80-90`). `goToNode()` is private to the explorer, and `SWMLoad(panelId)` has no readiness callback | `index.html:1312` (`showView`), `:1663-1665` (`applyViewHash`). The inline router script runs during parsing, **before** `swm/js/swm-loader.js` (`index.html:1673`) defines `window.SWMLoad`, and `showView('security-model')` only loads `if (window.SWMLoad)`. `SWMLoad` knows only `wm-overview`, `wm-ontology` and `wm-architecture` (`swm-loader.js:18`); `wm-landscape` and `wm-gaps` are static. The repo already defers a cross-view focus with `window.SWM_PENDING_COVERAGE_FOCUS` (`index.html:1630`) |

The F5 bundle query gives:
- `rt-inc-1042` `EXHIBITS` `hz:haz-support-refund-loop`, which `CHARACTERIZES` `owasp:LLM06` and is `MITIGATED_BY` the core value-ceiling control.
- `rt-inc-0987` `EXHIBITS` `hz:haz-proc-bank-detail-unverified`, which `CHARACTERIZES` `atlas:AML.T0052` and is `MITIGATED_BY` the core dual-approval control.

## Proposed items, ranked by value against risk

| Item | What | Why it is worth taking | Risk | Recommendation |
|---|---|---|---|---|
| **A. World Model deep links** | **Routes**: `#view=security-model[&tab=<panel>][&node=<id>]` and, for the Incident Detail view, `#view=incident&incident=<site id>`.<br><br>**Panels and nodes**:<br>• `<panel>` ∈ `wm-architecture` (default), `wm-ontology`, `wm-overview`, `wm-landscape`, `wm-gaps`.<br>• **A `node=` implies `wm-ontology`.** Only the Ontology Graph can focus a node. A `node=` with any other `tab=` shows the notice and opens `wm-ontology`.<br>• Static tabs (`wm-landscape`, `wm-gaps`) bypass lazy loading.<br><br>**Cold-load mechanism (F9)**:<br>• **Explicit requests carry a cancellation token.** Only an explicit route request records a pending focus, `window.SWM_PENDING_NODE = { node, route, gen }`, following the existing `SWM_PENDING_COVERAGE_FOCUS` pattern. An explicit route request is a cold load's initial hash, a `hashchange`, or a chip or link click.<br>• A global `routeGen` increments on every navigation that abandons the destination: `showView` to another view, a World Model sub-tab change, or a newer route. A request whose `gen` is not the current one is discarded.<br>• **The loader–router hand-off is page-agnostic.** `swm-loader.js` only dispatches a `swm:loader-ready` event on `window` after defining `SWMLoad`. `index.html`'s router listens for it, and for `window` `load`, but **only resumes an existing, uncancelled pending request**. It never re-derives navigation from the current hash, and never pushes or replaces history.<br>• The listener is registered in the inline script, which runs before `swm-loader.js`, with a comment pinning that order. `assurance.html` has no router and does not listen, so the change is inert there (F checks this). After a failed load and Retry, a re-dispatched ready event can only resume a still-current request.
<br>• The pending focus is cleared once consumed or superseded by a newer route, so re-running is idempotent and a later hashchange never re-focuses a stale node.<br>• `SWMLoad(panelId, onReady)` calls `onReady` immediately for a panel it does not lazy-load, so it can never hang.<br>• **Two separate gates, checked immediately before acting:**<br>&nbsp;&nbsp;– *Visibility*, from the DOM on every page, using the existing `SWM.isShown(mountEl)` (`swm-core.js:199`, which checks `offsetParent` and `getClientRects`). An inactive panel or view is `display:none`, so this one test covers both. It never uses `SWM_ACTIVE_PANEL`, which `assurance.html` does not set.<br>&nbsp;&nbsp;– *Request*, for a deep link only: the pending request's `gen` is still current and `location.hash` still equals its route.<br>• A deep-link focus needs both gates. Ordinary lazy boot, including a blank hash, needs only visibility.<br>• So navigating to another view or switching sub-tab while loading cancels the focus **permanently**, even though both leave the hash unchanged. Returning to the same view later does not revive it. Only a new explicit request focuses again.<br>• The explorer exposes `SWM.focusNode(id) → boolean` and `SWM.currentNode() → id | null`. `currentNode()` returns `null` before the explorer has booted. It is used by the blank-origin rewrite. It returns `true` only if the node is actually rendered (with B2). An unknown or unrenderable node, an unknown tab or a malformed hash falls back to the default sub-tab with a short notice.<br><br>**History contract**:<br>• Before a deep link is opened, **a non-empty origin hash is kept as it is.** That covers Studio's `#studio` and `#studio=new` and an existing World Model or incident route. The new route is pushed on top.<br>• **A blank origin hash** is first rewritten with `replaceState` to the complete current state:<br>&nbsp;&nbsp;– the view id;<br>&nbsp;&nbsp;– `&incident=<id>` when the Incident Detail view is showing;<br>&nbsp;&nbsp;– `&tab=` and `&node=` when the World Model is showing a selected node.<br>• `applyViewHash` restores each of these states.<br>• `#view=security-model` with no tab or node still lands on `wm-architecture` (probe D1 unchanged). An unknown `incident=` id falls back with the same notice as an unknown node.<br>• Known limitation, kept on purpose and stated in the test expectations: ordinary nav clicks still do not write the hash, so Back returns to the last recorded route rather than to an intermediate view reached by nav.<br><br>**Consumers**: C's chips; the Assurance "Open the full World Model explorer" button (an allowed exception, below) | F3: nothing can link into a node today | Medium: the router owns other views, so site probes S13 and S17 and the new history probes (F) guard it | **Do** |
| **B. Robustness back-ports** | **B1, loader retry**: a Retry button; the loader keeps a per-file `loaded` set and re-requests only the failed and remaining files, so loaded files are not re-executed (fixes F1).<br>**B2, focus clears filters**: `goToNode` / `SWM.focusNode` also clear the Network minimum-degree and subclass filters, and report whether the node is rendered (fixes F2).<br>**B3, hidden lifecycle**: the audit checks **both** a hidden mount and simulation ticks after a load that finishes once the user has left the view; today the loader boots every queued panel on load (`swm-loader.js:47`, `swm-core.js:253-257`). If either happens, it is suppressed: a queued panel boots only when it passes A's **DOM visibility gate**. That gate is not the route gate and does not depend on `SWM_ACTIVE_PANEL`, so ordinary lazy boot and `assurance.html` are unaffected. The trigger matches F's acceptance criterion | Real defects in shared code, already found and fixed once by jev's review | Low | **Do B1, B2 and B3** |
| **C. Incident → ontology chain** | **Keyed by the site's incident, never by number (F8).** In the Incident Detail view (`#incident`, the `.ontology` evidence block), add an "Ontology" row from an explicit site-level mapping `INCIDENT_ONTOLOGY` in `index.html`. That mapping is Silex-authored and graded `curated`, and each pairing is reviewed on its scenario:<br>• **Site I-1042** (external email → vendor bank update, blocked) → *related model hazard* `hz:haz-proc-bank-detail-unverified` "Bank Detail Change From Unverified Instruction" → characterizes `atlas:AML.T0052` → mitigated by the ontology's dual-approval control.<br>• The row's wording says four things:<br>&nbsp;&nbsp;– it is a related potential hazard (curated), not an observed outcome; the incident was a blocked attempt;<br>&nbsp;&nbsp;– Phishing is the closest available public characterization of an unverified external instruction, not a claim that the site's prompt-injection case is phishing;<br>&nbsp;&nbsp;– the control is the ontology's dual-approval control, not the incident's PAY-042 guard or its candidate remedy, and it is not shown as proof of mitigation;<br>&nbsp;&nbsp;– the hazard sits in the Procurement pack while the site files the incident under Finance.<br>• **Site I-1038** (cumulative refunds across agents) → **no modelled hazard yet**, shown as an explicit blind spot. None of the bundle's hazards describes cross-agent value composition, and the refund-loop fixture is a different mechanism.<br>• Other site incidents get no row.<br>Chips open the World Model on the node via A. Each chip shows the node's review grade, and the relation grades are shown separately: the site-to-hazard pairing is `curated`, and `CHARACTERIZES` and `MITIGATED_BY` are `curated`. The bundle's illustrative `EXHIBITS` fixture links are not used | It is the mockup's equivalent of jev's decision chips. It needs no change to the vendored iframe, and it makes a blind spot visible honestly | Medium: the new local probes in `run-site-probes.mjs` cover it (S10 runs on `assurance.html` and does not touch this row) | **Do, as corrected** |
| **D. "Checked at runtime" overlay** | — | — | — | **Cut (both reviewers).** It is not worth a frozen-contract change. jev's `mitigates ag:hitl` treats a component as a control, and the live counts describe the vendored demo, not the mockup. If revisited, it would be clearly labelled Silex metadata outside the ontology predicates, with each relation reviewed |
| **E. Chain text in the inspector** | For an L4 node, write the chain in words with edge direction explicit: instance `INSTANCE_OF` component; threats that `THREATENS` that component; countermeasures that `COUNTERS` each threat, or "no mapped countermeasure". For a fixture incident, also show its `EXHIBITS` hazard, labelled illustrative. Node and relation review grades are shown separately. Rendering the L3 context inside the L4 graph, as jev's r5 does, is **deferred**. Visible limitation: the L4 graph keeps only its own tier, so L4 nodes still render without their L3 links | Same idea as jev's chain inspector, and cheap | Low | **Do (text only)** |
| **F. Probe hardening** | **In `probe-swm.mjs` (World Model panels):**<br>• 390 px no horizontal overflow on the three panels;<br>• keyboard search → select;<br>• focus with a degree or subclass filter on (B2);<br>• loader fail-then-Retry, blocking one file and asserting loaded files are not re-executed (B1);<br>• hidden lifecycle: no hidden mount and no ticks after a late load (B3).<br><br>**In `tests/site/run-site-probes.mjs` (site routes, new local-only probes; the `--base` live subset is unchanged):**<br>• **first deliverable, a cold `#view=security-model&node=<id>` link**, the loader-not-ready path;<br>• cold `node=` with the default tab and with a static tab;<br>• unknown or malformed fallback with the notice;<br>• Back while loading is delayed; **navigating to another view, and switching World Model sub-tab, during a delayed load** (no hidden mount, no focus);<br>• **cancellation:** leave → return with the same hash both before and after the delayed load finishes, and a late `swm:loader-ready` or `load` event after cancellation. None of these focuses the stale node. An ordinary visible-panel boot still works, and a new explicit deep link afterwards focuses normally;<br>• `#view=security-model` alone still opens Ontology Layers; an unknown `incident=` shows the notice;<br>• **`assurance.html`**: its World Model panels (`wm-ontology`, `wm-architecture`) still render, including after a hidden late load, and the panels requested while visible boot without the `[SWM] … not booted` warning. That warning is checked only for the deferred panel, because `SWM.boot` emits it by design before `SWM.ready()`. No console errors appear (the loader change stays inert there);<br>• blank-hash origin → node → Back → Forward;<br>• Back/Forward from both incident records (I-1042 and I-1038) and from one World Model node route to another;<br>• `#studio` / `#studio=new` kept as return destinations;<br>• the I-1042 Ontology row ids and the I-1038 blind-spot row (C).<br><br>Both suites (`probe-swm.mjs` and the site probes) run **three times in a row** before each gate | These are the checks that caught jev's defects | Low | **Do** |

**Considered and not proposed:**

| Idea | Why not |
|---|---|
| Strict CSP, no inline styles, system fonts | jev needed this for its standalone site. silex-mockup is a single-file shell with inline styles and Google Fonts, so it would be a large rewrite of every view for no demo value |
| Ontology chips inside Runtime Observation's iframe | The demo is a hash-pinned vendored copy of another repo (F6). Changing it forks the vendoring. Item C delivers the same idea on the mockup's own incident views. If wanted, it belongs upstream in jev-runtime-observability, followed by a re-sync |
| Dropping the Coverage panel | jev removed it to keep its demo honest. silex-mockup keeps Coverage, with every figure labelled illustrative |

**Follow-up for another repo (not this plan):** jev-simplified ships the pre-rigor World Model (F7). Its mapping ids still exist in `swm-2.0` (F4), so re-vendoring the new bundle there looks straightforward. That belongs in jev-simplified's own run.

## Draft task split (to be confirmed at the plan gate)

| # | Owner | Task | Files |
|---|---|---|---|
| T1 | planner | A (router, pending focus, history contract, notice) and C (Incident Detail Ontology row, `INCIDENT_ONTOLOGY`) | `index.html` (router, `#incident` view, Assurance button) |
| T2 | deepseek | F probes. The cold `node=` probe is written first and must fail before A lands | `swm/skills/swm-data-rebuild/scripts/probe-swm.mjs`, `tests/site/run-site-probes.mjs` (new local probes only) |
| T3 | planner | B1, B2, B3, the `SWMLoad(panelId, onReady)` callback with the route check, `SWM.focusNode`, and E | `swm/js/*`, `swm/css/swm.css` |

Codex's weekly quota is about 10%, so Codex reviews and builds nothing.

## Must not change

- The vendored `jev-runtime/` files: they stay byte-identical to `VENDORED.json`.
- The coverage figures.
- Public node ids.
- The Refund example (probe R1).
- Every non-World-Model view. The allowed exceptions are the router, the Incident Detail Ontology row, and the Assurance "Open the full World Model explorer" button switching to a deep link.
- Site probes stay 20/21, with S20 environmental. Re-confirm this on `origin/main` `7a6f216` when the branch is cut, because the router change touches S17's hashes. Check: site probes stay 20/21, with S20 environmental as at BASE.

## Questions for the reviewers (feasibility)

1. Is each item buildable as described against the current code? Specifically: the `applyViewHash` extension alongside Studio's `#studio` routes; the incident modal structure; the loader retry inside `SWMLoad`'s panel-id API.
2. Is D worth a frozen-contract change, or should it be cut to a static, data-only section (or dropped)?
3. Do the claims stay honest? Chips must show review grades; the runtime-check mapping is a Silex interpretation, not an official crosswalk.
4. Is anything missing from jev-simplified's changes that is worth more than the items here?

## Round log

### Round 1 — both PLAN-REJECTED

| Objection (who) | Change in v2 |
|---|---|
| C joined records by colliding numbers: site I-1042 is a vendor-bank mutation, the bundle's `rt-inc-1042` is a refund-loop fixture, and the site has no I-0987; it is a view, not a modal (DeepSeek 1, Codex 1) | New fact F8. C is keyed by site incident through an explicit, reviewed `INCIDENT_ONTOLOGY`: I-1042 → bank-detail hazard; I-1038 → explicit "no modelled hazard yet" (no hazard fits cross-agent value composition). It targets the `#incident` view and does not use `EXHIBITS` fixtures |
| A lacked a history and focus contract: nav does not write the hash, Back leaves the World Model visible, cold `node=` cannot wait for the lazy bundle, and `goToNode` is private (Codex 2; DeepSeek NB) | New fact F9. Origin recorded with `replaceState`; `applyViewHash` learns all nav views; `SWMLoad(panelId, onReady)`; public `SWM.focusNode(id) → boolean`; panel ids named; Studio routes preserved; history probes added in F |
| F1 overstated "permanently" (both) | F1 corrected: a later `SWMLoad` restarts the whole chain, re-executing loaded files |
| D: cut, no frozen-contract change; `mitigates ag:hitl` treats a component as a control (both) | D cut |
| E: make edge direction explicit, show node and relation grades separately; graph rendering of L3 context (DeepSeek) | E reworded; rendering deferred, because it changes the shared layout |
| F: add lifecycle, malformed-link, history and incident-row probes, no re-execution on retry, three consecutive runs (both) | F extended |
| Base caveat: confirm `origin/main` and `swm-2.0` before starting (DeepSeek) | Base line updated |
| Codex: reduced-motion coverage if visualisation changes | Not triggered: v2 does not change rendering (E is text only) |

### Round 2 — both PLAN-REJECTED (A's mechanics; B3 alignment)

| Objection (who) | Change in v3 |
|---|---|
| Cold load cannot fire: `SWMLoad` is undefined when the inline router runs, and `showView` loads only `if (window.SWMLoad)` (DeepSeek 1) | F9 extended. A pending focus (`SWM_PENDING_NODE`, following the `SWM_PENDING_COVERAGE_FOCUS` pattern) is consumed by re-running `applyViewHash()` from the loader and on `window` `load`. F's first probe is the cold link |
| Node routes undefined for most panels; static tabs not in `PANELS` (DeepSeek 1, Codex 2) | `node=` implies `wm-ontology`; incompatible combinations show the notice; static tabs bypass lazy loading; `onReady` fires immediately for unknown panels |
| The ready callback must check that its route is still current (Codex 2) | `onReady` acts only if `location.hash` equals the pending route; a probe covers Back while loading is delayed |
| Origin replaced by `#view=<view>` only, losing incident identity and node routes, and could overwrite Studio (Codex 1) | A non-empty origin hash is kept as is. A blank origin becomes the complete state (`view`, plus `&incident=` or `&tab=&node=`). `applyViewHash` restores incident and World Model routes. Probes cover both incidents, node → node, and Studio return |
| B3's trigger (ticks) conflicted with F's no-mount criterion (Codex 3) | B3 audits mount and ticks and suppresses either. Queued panels boot only when visible |
| C wording: related potential hazard, not observed; Phishing as the closest characterization; ontology control, not PAY-042, and not proof of mitigation (DeepSeek NB, Codex NB) | Added to C |
| Assurance button is a change outside the World Model (DeepSeek NB) | Listed as an allowed exception |
| Incident-row probes belong in `run-site-probes.mjs`; the cold probe comes first (DeepSeek NB) | F split by harness; T2 orders the cold probe first |
| Nav clicks still do not write the hash (DeepSeek NB) | Stated as a known, intentional limitation in A |
| E: L4 still renders without its L3 links (DeepSeek NB) | Stated in E as a visible limitation |
| Re-confirm 20/21 on `origin/main` when cutting the branch (DeepSeek NB) | Added to "Must not change" |

### Round 3 — both PLAN-REJECTED (one objection each)

| Objection (who) | Change in v4 |
|---|---|
| The shared loader would call a router that `assurance.html` lacks, and a visibility gate based on `SWM_ACTIVE_PANEL` would never boot `assurance.html`'s World Model (DeepSeek 1) | Page-agnostic hand-off: the loader dispatches `swm:loader-ready`, and only `index.html` listens. Visibility is defined from the DOM. A new `assurance.html` probe checks render and no warnings |
| A hash-equality check does not detect leaving by nav or sub-tab switch, which leaves the hash unchanged (Codex 1) | Two gates checked immediately before acting: DOM visibility (always) and route (deep links only). Probes for nav-away and sub-tab switch during a delayed load |
| No accessor for the current node (DeepSeek NB) | `SWM.currentNode()` |
| Clear the pending focus after use (DeepSeek NB) | Cleared once consumed or superseded; re-runs are idempotent |
| Default `#view=security-model` and unknown `incident=` (DeepSeek NB) | Stated and probed |
| C's risk cell wrongly cited S10 (DeepSeek NB) | Fixed |
| Three consecutive runs apply to both suites (DeepSeek NB) | Stated |
| History limitation visible in test expectations (Codex NB) | Stated in A and in F's expectations |

### Round 4 — DeepSeek PLAN-APPROVED · Codex PLAN-REJECTED (1 objection)

| Objection (who) | Change in v5 |
|---|---|
| An abandoned focus request is not permanently cancelled. Leave and return with an unchanged hash can revive it, and readiness re-runs can recreate it from the stale hash (Codex 1) | Explicit requests carry a `gen` token; `routeGen` increments on view change, sub-tab change or a newer route. Readiness events resume only an existing, uncancelled request and never re-derive navigation from the hash. F tests leave → return before and after the load, a late ready or load event after cancellation, and a normal boot and new deep link afterwards |
| Reuse `SWM.isShown`; one visibility semantic (DeepSeek NB) | The gate uses `SWM.isShown(mountEl)` only |
| `currentNode()` before boot; listener-order comment; ready or load never pushes history; Retry cannot revive stale focus (DeepSeek NB) | All stated in A |
| The `[SWM]` warning assertion was too broad (DeepSeek NB) | Scoped to the deferred panel |

DeepSeek approved v4. v5 changes approved text, so both seats confirm it.

### Round 5 — plan gate passed (v5)

| Seat | Verdict on v5 |
|---|---|
| coder-deepseek (DeepSeek V4.1 Flash) | PLAN-APPROVED |
| reviewer-codex (Codex, GPT-6-Luna medium; weekly quota about 9%) | PLAN-APPROVED |
| PLANNER (claude) | PLAN-APPROVED |

**Implementation notes from round 5.** These are non-blocking and do not change the approved text; they are applied when building.

- The router's own destination navigation (`showView`/`selectWmTab` called by `applyViewHash`) must not bump `routeGen`. Record the pending request after that navigation, capturing the post-navigation `gen`; otherwise a cold or Forward link cancels itself.
- `SWM_PENDING_NODE` may carry `node: null` for a view-only or tab-only route. "Resume" then selects the tab (the default is `wm-architecture`) and boots it, skipping `focusNode`.
- After a successful Retry, resumption goes through the `SWMLoad(panelId, onReady)` callback the router already holds. A re-dispatched ready event can only resume a still-current request.
- The cancellation probes include a newer route that lands on `#studio`.
- The `assurance.html` warning check is "no `[SWM] … not booted` for the deferred panel, and no console errors".

**Feasibility verdict:**
- **Do:** A (deep links with the history, focus and cancellation contract), B1–B3 (back-ported robustness fixes), C (the I-1042 Ontology row and the I-1038 blind spot), E (chain text), F (probes, three consecutive runs).
- **Cut:** D (runtime-check overlay).
- **Not started.** Implementation waits for the user's go-ahead.

## Code review

Base `df79519`.

### Round 1 — DeepSeek IMPL-APPROVED · Codex IMPL-REJECTED (1 blocking)

Commit `1e9b168`.

| Defect (who) | Change |
|---|---|
| The L4 chain text rendered "threat THREATENS → countermeasure COUNTERS" without the object, which reads as a reversed relation (Codex 1) | Each line is now one complete, directed assertion, `<span class="swm-assert" data-s data-p data-t>`, with its own grade. New probe P6 checks subjects, predicates and objects against the bundle, and fails on `1e9b168` |
| The loader duplicates `SWM.isShown` (both, NB) | The loader calls `SWM.isShown` |
| No probe covers the Assurance deep-link button (DeepSeek NB) | New probe S38: Assurance → Ontology Graph, and Back/Forward |
| Dead `[data-wm-target]` listener (DeepSeek NB) | Removed |
| Summary wording on the three runs (DeepSeek NB) | Reworded with exact counts |
| The stale-origin rewrite in `openRoute`, beyond the plan's blank-origin rule | Accepted by both (DeepSeek: an improvement) |
| `assurance.html`'s own explorer button still uses `data-jump` | Out of scope: `assurance.html` is a separate snapshot |

Three consecutive runs at round 2: `probe-swm` 15/15 each run; site probes 37/38 each run (S20 environmental, the same failure as at BASE).

### Round 2 — DeepSeek IMPL-APPROVED · Codex IMPL-REJECTED (1 blocking)

Commit `b076a27`.

| Defect (who) | Change |
|---|---|
| The I-1042 row drew hazard → `CHARACTERIZES` → Phishing → `MITIGATED_BY` → Dual Approval as one line. That implies a nonexistent "Phishing `MITIGATED_BY` Dual Approval" (Codex 1) | The hazard chip comes first, then one row per relation: `.inc-onto-assert` with `data-s`, `data-p` and `data-t`, each with its own grade. Both rows start from the hazard. Chinese summary and changelog updated. S35 is extended to check both assertions and their grades against the bundle, and that no assertion starts at Phishing; it fails on `b076a27` |
| DeepSeek NB: loader indentation; `assurance.html`'s own explorer button | Cosmetic. `assurance.html` is out of scope (a separate snapshot) |

Three consecutive runs at round 3: `probe-swm` 15/15 each run; site probes 37/38 each run (S20 environmental, the same failure as at BASE).

### Round 3 — code gate passed

Commit `8b6f2ae`, diff revision `54c48e1`, base `df79519`.

| Seat | Verdict |
|---|---|
| coder-deepseek (DeepSeek V4.1 Flash) | IMPL-APPROVED |
| reviewer-codex (Codex, GPT-6-Luna medium) | IMPL-APPROVED (no non-blocking suggestions) |
| PLANNER (claude) | IMPL-APPROVED. Three consecutive runs: `probe-swm` 15/15, site probes 37/38 (S20 environmental, as at BASE) |

## Outcome

- **Gates:** plan unanimous after 5 rounds (v1 → v5); code unanimous after 3 rounds.
- **Shipped:**
  - A: deep links, with the history, focus and cancellation contract;
  - B1–B3;
  - C: the I-1042 row, as two hazard-sourced assertions, and the I-1038 blind spot;
  - E: chain text, as directed assertions.
- **Cut:** D.
- **New probes:** P1–P6 and S22–S38. Each one added for a fix was shown to fail on the code it guards against (S22 on `df79519`, P6 on `1e9b168`, S35 on `b076a27`).
- **What each seat caught:**
  - *Codex:* the plan's number-joined incidents (with DeepSeek); the history contract, the route-check and cancellation gaps; the reversed `COUNTERS` chain; the linear I-1042 row implying a false relation.
  - *DeepSeek:* the cold-load mechanism (`SWMLoad` undefined when the router runs); the shared-loader risk to `assurance.html`; the B3/F mismatch; probe placement.
  - *Planner:* the facts F1–F9, `SWM_PENDING_COVERAGE_FOCUS` as precedent, and the stale-origin rewrite (accepted by both).
- **User's instruction:** "feel free to push when code review and final round passes". The deploy is recorded below.

## Deploy record

`main` was fast-forwarded `7a6f216..f9431a1`, and Vercel deployed it.

Live read-back:
- `index.html`, `swm-loader.js`, `swm-core.js`, `swm-ontology.js`, `swm.css` and the Chinese summary are byte-identical to `f9431a1`. The first loader fetch returned a stale edge copy; it matched on recheck.
- Rendered on production:
  - `#view=incident&incident=I-1042` shows the two hazard-sourced assertions (`CHARACTERIZES` `atlas:AML.T0052`, `MITIGATED_BY` `core:core-control-dual-approval`);
  - a cold `#view=security-model&node=owasp%3ALLM01` selects "Prompt Injection".
- `run-site-probes --base` live subset: 8 of 9 pass. S20 is environmental, as at BASE.
