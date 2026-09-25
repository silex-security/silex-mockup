# Blueprint Studio replacement: link and state audit

Audit date: 2026-09-24. Read-only source audit; only this report was written. Site references below are **origin/main**, not the branch's older working-tree index.html. React references are the current blueprint-studio working tree (HEAD 05d718a at audit time). Line ranges identify source spans, including long single-line handlers. No deployment, browser integration test, or Vercel dashboard inspection was performed.

## 1. Executive findings and source boundary

Replacing the Blueprint section alone will not replace its behavior. The legacy editor, six-stage lifecycle, pending decision queue, inventory and workflow detail are coupled through a single inline script. The React application has a separate persistent document store and local inventory, with no adapter to those site objects. There is also a second independently executable legacy application in assurance.html.

The minimum consistent cutover must (a) remove/retarget all old Studio DOM bindings, (b) establish stable document/revision ↔ workflow identity, (c) project actual registered evidence into site inventory and decision cards without converting sampled metrics into confidence claims, (d) preserve incident and environment fixture separation, and (e) retire or redirect the duplicate assurance.html Studio.

| Source | Finding / implication |
|---|---|
| `git log blueprint-studio..origin/main` | Four newer upstream commits: 39fbe01 renames Security World Model → Enterprise World Model and its Ontology tab; 073e073 renames L1/coverage card to Ontology Graph; 6c5f39b updates SECURITY_WORLD_MODEL.md terminology; b5127c6 realigns its layer table. Preserve upstream naming when integrating. |
| `origin/main:index.html:446,509,1284–1327,1436` | Public environment name is Enterprise World Model; stable routing identifier remains `security-model`. Labels and route identifiers are different concerns. |
| `origin/main:README.md:5–15` | Static site documented at silex-mockup.vercel.app; description still contains old Security World Model/Security Ontology wording at 11–13 and says no engine runs at 15. Both become misleading after cutover. |
| `blueprint_studio/web/src/state/controller.js:30–36,56–69,161` | React route is an in-memory object; boot restores the last local document or creates Customer Refund. Register only dispatches to the React store. No host-site routing or inventory callback. |

## 2. Current legacy Studio: DOM, data and executable state

| File:line | What exists / what it reads or changes |
|---|---|
| `index.html:646–859` | Entire `section.view#blueprint`; header 'Agentic Blueprint Studio', `bpState`, six-stage `bpStages`. Replacement boundary ends before Incident Queue at 861. |
| `index.html:664–687` | Build panel `bp-build`: prompt, palette, nine positioned typed nodes, SVG lines, component bindings and inspector; hard-coded Customer Refund graph. Trigger → triage → eligibility → amount decision → approval → execution → Payment API → resolved; prohibited refund side branch. No executable engine. |
| `index.html:667,671–684` | Prompt asks approval above $500, duplicates and credential protection. Component selectors and permission/credential fields are declarations represented in DOM datasets. Footer says Finance Development, Declared environment, nine typed nodes. |
| `index.html:689–714` | Confirm panel; $500 business constraint vs $2,000 autonomy; checkbox enables confirmation. Hard-coded v1.0/v1.1 labels are not immutable graph versions. |
| `index.html:716–768` | Validate panel: timer-driven steps, illustrative findings and paths A–D. Claims include runtime Observed and type-based Latent, despite this being pre-deployment. |
| `index.html:770–811` | Optimize panel: static candidates A/B/C, six-objective cards and recommendation. A = dual approval above $1,000; B = manager approval above $500; C = autonomous refunds only for verified merchants; candidate cards claim 2,400 simulated scenarios. Baseline/validated Defense and Reachability are fixtures. |
| `index.html:813–833` | Decide panel fixed 'Customer Refund Blueprint v1.0'; `bpDecisionChip`, `bpDecisionText`, `bpDecisionState`, `bpDecisionImpact`, Modify thresholds 500/750/1000 and Approve/Modify/Reject. |
| `index.html:835–859` | Register is an inline **stage panel**, not its own registration modal. Shows approved threshold, policy/inventory claims; register completion opens Library or fixed WF-041. |
| `index.html:1345–1352,1448–1450` | Shared **approval confirmation modal**, `decisionModal` + `decisionCb`; used by both Blueprint and incident approval. Do not remove it wholesale with the Studio. There is no separate Register Workflow modal in this source. |
| `index.html:1399–1411` | `bpCanvas`, `selectedBPNode`, `bpNodeCounter`; drawBlueprintEdges, componentCopy, selectBPNode, attachBPNode, addBlueprintNode; drag/select/component/Generate/auto-layout/delete/save handlers. Generate updates badge/toast; Save only toasts. No real compilation/persistence. |
| `index.html:1512–1518` | `BP_ORDER`, `bpReached`, `bpConfirmed`, `bpValidated`, `bpDecision`, `bpRegistered`; reach/setBpStage/setBpState manage DOM. `setBpStage` directly dereferences Register/lock elements. |
| `index.html:1519–1529` | Confirm, revise, timer validation, Optimize/Decide navigation. Validation adds `BP-REFUND` to shared pending Set and updates all matching status chips. reviseBlueprint clears pending status but does not create a real versioned document. |
| `index.html:1530–1538` | renderBpDecision; `BP_VARIANTS` fixed metrics; rerun timer writes text fields; reject resolves pending and returns to Optimize; approve uses shared modal, resolves pending and advances to Register. No graph-derived result. |
| `index.html:1539–1546` | Register assigns `workflowData['WF-041']` (always same ID), sets bpRegistered, rerenders Library. resetBlueprint/newBlueprint/openBlueprintForReview branch on old singleton flags. Starting a new draft does not produce an identity-safe inventory record. |
| `index.html:1549–1555` | Inspector monkey-patches selectBPNode; scopeSel/credSel are obtained through unguarded inspector DOM lookups. These must be removed together with old editor. |

## 3. Every upstream entry and relevant non-entry

| File:line | Entry / current behavior | Required integration behavior |
|---|---|---|
| `index.html:439,1435–1438` | Nav `data-view=blueprint` → showView; toggles active view/nav/crumb and schedules old edge redraw. | Activate React container and correct outer navigation; remove redraw dependency. |
| `index.html:564,1825` | Assurance pre-deployment job `data-jump=blueprint` → showView only. | Open/resume Studio without falsely selecting a workflow or erasing work. |
| `index.html:577,1040,1814` | Overview New Agentic Blueprint / Library New Blueprint → newBlueprint(). | Explicit new-vs-resume semantics, preserving existing document. |
| `index.html:1478–1479` | Unregistered Library table rows and card buttons use `data-new-blueprint=1`. They carry **no selected workflow ID/name/domain**; all go to singleton refund editor. | Carry discovered workflow context or deliberately show template/blank chooser; do not silently label another refund as onboarding/expenses/deployment. |
| `index.html:615,1821` | Overview pending decision row → openBlueprintForReview. Name/threshold static; status chip shared. | Resolve document + evaluated revision + candidate/decision, respecting locks/stale results. |
| `index.html:1151–1155,1173,1821` | PCP workflow card and executive preview row → same review helper. | Preserve context and display actual recommendation/status/evidence, not fixed B/$500/94%. |
| `index.html:1383,1812` | Change-log Go → showView('blueprint'); also enables page change highlights. | Keep destination working and update description to computed editor + Trace. |
| `index.html:1531,1816` | Dynamically inserted `data-bp-go=register` in decision message → setBpStage. | Retire with old decision panel; use guarded React navigation. |
| `index.html:1542–1546` | resetBlueprint/newBlueprint/openBlueprintForReview are all direct JS Studio entry/state helpers. | Replace their callers, not just static links. Review must not reset an in-progress draft. |
| `index.html:1100` | Workflow Detail says “open Agentic Blueprint Studio for the editable graph” but **this is plain text, not a link**. openWorkflow at 1488–1498 never opens Studio. | Add an explicit action only for a workflow with a source document/revision; fixture workflows need a clearly labelled template/model action instead. |
| `index.html:1742,1750,1815,1818–1822` | Incident next actions open affected workflow, revalidate it or return to queue. No incident → Blueprint direct link/state import. | Preserve incident context; do not infer that its fixture recommendation is a tested React candidate. |
| `index.html:1770–1782` | Pre-release opens affected workflow rows and runs fixture revalidation; no direct Studio entry. | Any proposed “edit/revalidate in Studio” is a new integration, not an existing link to preserve. |
| `index.html:1800–1802` | World Model gap focus and Assurance explorer link target SWM panels, not Studio. | Preserve panel state/fixtures; never treat WF-021 as an unqualified cross-app key. |
| `index.html:1827` | Startup initializes pending status, Library, Pre-release, incident detail, then Overview. | Old initializer must not overwrite projected React statuses; neither URL hash nor React stage is currently restored by it. |

No existing hash-based Blueprint router was found in either outer document. `data-jump` is a delegated click protocol, not a URL fragment API; `/#blueprint` would not itself activate the section. There is no existing document-ID handoff to preserve: it must be designed.

### assurance.html is a second legacy application

| File:line (origin/main) | Independent duplicate behavior |
|---|---|
| `assurance.html:333,444,482` | Own Studio navigation, New Blueprint and Overview review entry. |
| `assurance.html:513–726` | Complete duplicate legacy Studio DOM, not a link to index.html or React. |
| `assurance.html:891,951,1006,1024,1200` | Library New, inert Workflow Detail instruction, PCP review button/row, change-log Go. |
| `assurance.html:1216–1228,1251–1363` | Own editor, showView, workflowData, pending Set, lifecycle and WF-041 registration handlers. |
| `assurance.html:1295–1296,1459–1470` | Generated unregistered-workflow entries and delegated new/review routing. |
| `assurance.html:1276–1281,1357` | Same initial Operations inventory / fixed Customer Refund registration identity, but independent page memory. |

It is a reachable static file even without a current internal anchor. Merely changing index.html leaves an alternate old Studio accessible at /assurance.html. Redirect or route its relevant entries to the canonical implementation, or integrate the same host adapter there. Do not maintain a second contradictory workflow inventory. Its initial script also ends by showing Overview; the filename does not make it a specialized link-only Assurance page.

## 4. Downstream effects and state consumers

| File:line | Reads/writes and actual propagation | Cutover requirement |
|---|---|---|
| `index.html:1539–1541` | Legacy registration writes WF-041 with hard-coded graph/counts/coverage/risk and validation activity. Calls renderLibrary → updateCounts. No backend/persistence. | Project an actual React registration once, keyed by docId/revision/hash, retaining source decision/run IDs. Never reuse WF-041 for every template. |
| `index.html:1458–1483` | workflowData drives Library rows/cards and filters. updateCounts computes registered, deployed, revalidation, at-risk, known count and coverage. Initial six registered workflows; all six actually Deployed (static DOM pre-count of one is overwritten). UNREGISTERED is three static entries. | Use a shared inventory projection, distinguish logical workflows from registered revisions, and remove a discovered entry only through explicit identity matching. |
| `index.html:583–608,1472–1475` | Overview counts derive from inventory. atRisk = risk != Low AND open > 0; workflow coverage = round(registered/(registered+unregistered)*100). | Do not equate React finding count to production risk/open paths or sampled success to coverage. Preserve unavailable metrics explicitly. |
| `index.html:1451–1456,1523,1527,1537–1538` | Shared pending Set initially I-1042/I-1038; Blueprint adds/deletes BP-REFUND on validation/revise/approve/reject. refreshPending only updates ovPendingCount. Matching status spans are separately updated. | Recompute queue items by document/revision/candidate state. Register is not approval. Multiple documents and stale/rejected candidates cannot share one BP-REFUND singleton. |
| `index.html:615,1151–1155,1173` | PCP/Overview recommendation text, impact and confidence stay static even when threshold is modified; only status spans synchronize. | Replace entire Studio-derived card data, not only the badge or pending count. |
| `index.html:1488–1498` | Workflow detail reads w.graph/activity/detail and metrics. Missing detail defaults assert paths B/C/D closed and manager approval added at registration. | Supply evidence-derived detail or omit claims. Those defaults are false for arbitrary templates and for fixes leaving noncritical findings. |
| `index.html:1501–1509` | Workflow revalidation uses a timer; everything except WF-033 becomes Revalidated. Mark deployed sets deploy/lifecycle, inserts ST_CHANGES/ST_AFFECTED, rerenders. | Must not overwrite real sampled validation with a fixture “no new reachable paths” result. Keep simulated deployment explicit; registration alone must not enqueue a production change. |
| `index.html:1753–1757` | Incident approval changes incDecision/RX_STATE, resolves incident pending, updates associated workflow policies/lifecycle and Pre-release feed. | Preserve incident behavior separately; do not hijack shared decisionModal or resolve incident items when a Studio candidate is approved. |
| `index.html:1559–1561,1760–1765` | Incident queue uses static INC_WF/INC_META and existing DOM cards. Studio registration creates no incident and doesn't update incident counts. | No implied production monitoring or newly discovered incident from a design-time finding. |
| `index.html:1770–1783` | ST_CHANGES/ST_AFFECTED and workflowData drive Pre-release. System Validation history uses fixed 24 workflows / 53 agents / 2,700 scenarios. | Scope fixture numbers visibly; they do not automatically include newly registered React documents. |
| `index.html:1787–1802`; `swm/js/swm-ontology.js:750`; `swm/tools/silex-seed.mjs:151–190` | SWM loads separately from bundled data; rt-wf-021/rt-policy-500 and runtime edges are static seeded objects. Ontology inspector explicitly says SWM fixture has no linked workflow page. No registration handler mutates these bundles or runtime graph. | Do not promote a declaration into L4 “deployed & observed now.” Link a declaration as such, or keep fixtures explicitly separate. No automatic runtime node creation exists. |
| `index.html:1381–1391,1804–1813` | Change log and definitions are static modal content; Go uses generic router. They are not an event log of registrations. | Update explanatory claims; do not confuse this modal with document/decision history. |
| `index.html:1357–1368` | Definitions say formulas TBD, all values illustrative; Registered vs Deployed meaning correctly distinguishes inventory from production. | Separate legacy illustrative metrics from computed Studio formulas and sampled evidence; keep registration/deployment distinction. |
| `blueprint_studio/js/store.js:11–13,70–77,262–279`; `web/src/assurance/Register.jsx:12–56` | React saves bs.doc.<id>, bs.current and bs.inventory in browser storage; inventory entry has key/docId/name/domain/owner/rev/hash/decisionRef/evidence/registeredAt/status. UI says “Workflow inventory (this browser)”. No host workflowData write, no production action, no WF-number allocation, no graph included in inventory entry. | Host needs source-document resolution and a persistence/refresh policy, not a copied name string. Decide whether Library groups revisions or lists them, and handle reloads without duplicates. |

## 5. Identity, numbers, names and evidence that must remain consistent

| Topic / source | Current disagreement / disposition |
|---|---|
| `index.html:1459,1559`; `swm/tools/silex-seed.mjs:65,167,170` | **WF-021 means Vendor Master Update in Operations but Customer Refund in SWM. I-1042 means vendor bank mutation in Operations but Refund loop in SWM.** Existing `(SWM fixture)` labels and non-links deliberately avoid misrouting. Choose namespaces or explicit ID mapping; never connect by bare ID. |
| `index.html:1460,1540`; `templates/customer-refund.json:2–6`; `controller.js:60` | WF-014 Refund Resolution (production fixture), WF-041 Customer Refund (legacy registered draft), and bp-customer-refund-<timestamp> (new React doc) are distinct objects. No current shared identity. Name matching is insufficient. |
| `index.html:696,733,772`; `templates/customer-refund.json:62–66,113,155–158` | $2,000 is React routing threshold; $500 is unauthorized-write monitor business threshold, request scope; execution capability limit is **$10,000**, not $2,000. Preserve these distinct meanings. Legacy shorthand says autonomous up to $2,000; do not rewrite capability limit to match shorthand. |
| `swm/tools/silex-seed.mjs:158,164` | Runtime fixture issueRefund tool says 500 USD auto-approve ceiling. This is not the baseline React graph's $2,000 route and not proof a particular approved revision is deployed. Label the fixture or explicitly select its modeled revision. |
| `index.html:557` | Assurance “agent handles changes up to $2,000; re-auth bound to identity + intent + amount” is an incident/world-model illustrative before/after, not automatically the Customer Refund template result. Avoid conflating same numeric threshold across domains. |
| `index.html:774–801,815–819,1152–1154,1173` | Legacy candidates A/B/C, Candidate B recommendation, 2,400 runs, 91% defense, 3% reachability, one critical path, +12% approval/+18 seconds and 94% PCP confidence are not React outputs. Must remove from Studio-linked cards rather than cosmetically rename them. |
| `web/src/trace/derive.js:355–419`; `web/tests/derive.test.mjs:33–55` | Refund baseline at n=40 uses 240 runs, 200/200 adversarial violating, 16/40 benign violating, 6 findings, 16 candidates, 2 eligible; 7 static paths. These are testable baseline values, not constants for edited graphs or approved children. Trace schema baseline: 10/14 steps mapped, 4 classes, 48 associated threat classes, 4 related instantiated, 2 outside; related is not tested coverage. |
| `index.html:815,1538,1540`; `web/src/assurance/Register.jsx:30–32`; `js/store.js:243–250` | Legacy freezes all labels at Customer Refund Blueprint v1.0. React distinguishes evaluated parent, approved child, new editable revisions and hash; approved candidate evidence is bound to parent scenarios. Show actual revision/hash everywhere, not a fixed v1.0 activity string. |
| `index.html:754–759,517`; `web/src/trace/TraceView.jsx:130–145`; `Spine.jsx:54–76` | Legacy Blueprint uses Observed/Latent/Declared. React correctly uses declared paths and simulated outcomes; associations carry Silex provenance, Calibration unavailable. Do not upgrade simulated to Observed or label public threat associations Latent evidence. Outer runtime fixture grades can remain with their own scope. |
| `web/src/trace/Spine.jsx:28–29`; `web/src/i18n/zh.js:745` | React still calls spine “Security World Model layers” / 安全世界模型各层; upstream public product name is Enterprise World Model. Update en + zh together if adopting upstream terminology. |
| `Spine.jsx:31–79`; `index.html:509–518` | Trace's Schema/Laws/World State/Simulation/Objectives/Calibration/Decision are seven reasoning layers; site's L1 Ontology Graph → L2 Domain → L3 Agentic → L4 Runtime is a four-level ontology chain. They are different axes, not renamed equivalents; explain their relationship instead of mapping by ordinal. |
| `web/src/assurance/Register.jsx:18,49`; `web/src/i18n/zh.js:567` | Header says enterprise inventory while actual list says “this browser.” After integration, describe local demo inventory consistently and do not imply backend registration. |
| `web/src/App.jsx:43–49`; `origin/main:README.md:15`; `index.html:1357` | React engine is real deterministic computation over modeled agents; outer site says no engine / all illustrative. Scope both claims: actual graph execution in Studio, illustrative production/environment panels. Do not advertise live integrations or deployment. |

## 6. Replacement risks and concrete integration checks

| Evidence file:line | Risk / required check |
|---|---|
| `index.html:1404–1411,1519–1541,1549–1555,1827` | Removing old HTML while leaving script causes null.addEventListener / inspectorField(...).querySelector failures before site initialization. Remove old handlers/state/init references atomically; preserve shared incident/nav/modal helpers. |
| `index.html:1435–1437` | views/nav NodeLists captured once. Retain `section#blueprint.view` wrapper or update router discovery. Hidden canvas initialization may have zero dimensions; test returning after resize, switching Trace/Builder and changing orientation. |
| `web/src/styles/tokens.css:3–20`; `styles/app.css:2–18,195–246`; `index.html:19–27` | Unscoped :root/body/html, .app, .topbar, .card, .modal, .path, .node and button styles collide with the host. React root expects full-height grid; host has sidebar/topbar/content layout. An iframe isolates CSS; direct mounting requires systematic scoping and explicit dimensions, not merely a wrapper. |
| `Register.jsx:45`; `index.html:852,1539`; `web/src/main.jsx:19–22` | Duplicate IDs such as registerBtn and generic global selectors if both implementations coexist. Old delegated document click handling and React actions can interact. Retire old DOM, not hide it. __bs2 is a probe hook, not a versioned integration protocol. |
| `web/src/state/controller.js:31–36`; `index.html:1437,1825,1827` | Both routers are in-memory. URL hash/back/reload/deep links are not implemented contracts. Define host route + document/revision/stage/finding handoff and browser Back semantics. `#blueprint` alone does nothing today. |
| `web/src/state/controller.js:67–69`; `js/store.js:11–13` | React restores last document in shared origin storage; legacy state resets each page load. A review link must load its bound document, not whatever the visitor edited last. Same-origin iframe shares storage but does not automatically sync same-page UI; subscribe to authoritative store/events explicitly. |
| `web/vite.config.js:8–12`; `app/index.html:10–11` | Vite base './', output ../app with emptyOutDir. Built HTML references ./assets/*.js/css. Served at /blueprint_studio/app/ this works; pasting tags at / resolves wrong /assets paths. Use correct base/path or rebuild deliberately; preserve trailing-slash directory resolution. Do not place handwritten integration files inside a build directory that gets emptied. |
| `web/src/main.jsx:1–19`; `web/src/state/controller.js:22`; `trace/TraceView.jsx:10` | React/Flow, eager template JSON and ontology slice bundled. Main mounts #root and changes document language. Direct host mount requires a unique root and intentional language ownership. |
| `app/assets/index-CKayW7aN.js:1`; `app/assets/index-BguOL3mJ.css:1` | Measured current bundles: JS **906,713 bytes raw / 279,685 gzip**; CSS **50,267 / 9,778 gzip** (local gzip measurement, not observed HTTP transfer). Avoid loading on every Overview visit unless intended; check cold load + SWM/D3 coexistence and interactive responsiveness. No claim here about server compression. |
| `web/src/styles/app.css:236–241,303,314`; `index.html:27` | React hides node library below 1024px and overlays config; Trace has 320px + flexible + 290px columns and its final @media(max-width:1100px) rule switches to 300px + flexible while hiding the entire right inspector/mini-blueprint. Outer shell consumes additional width; the 300px spine can leave almost no graph width on a phone. Test effective embedded viewport at 1440/1024/768/390, zoom, menus, record modal, split-button, canvas pan and nested scrolling. Existing standalone screenshots do not establish embedded behavior. |
| `web/src/App.jsx:91` | Brand links absolute live root. In iframe it can navigate the frame into the whole site (nested shell), and on previews it exits to production. Provide intentional host navigation/target behavior. |
| `web/src/assurance/Register.jsx:21–25`; `trace/DecisionRecord.jsx:16–17` | Clipboard/download capabilities depend on secure context and iframe permissions; sandboxing can affect storage, scripts and export. Test Copy JSON/policy, file import, record download and Ask AI static fallback after integration. If postMessage is introduced, validate origin/source and message schema; do not accept arbitrary register payloads. |
| `origin/main:README.md:5`; root tree (no vercel.json or root package.json tracked) | Repository is static output; project dashboard settings are not available from git. No root SPA rewrite/build config found. Do not assume Vercel will build nested web/ automatically. Commit correct app output or explicitly configure build. Verify deployed asset URLs, MIME types, deep-link 404 behavior and preview base paths. |
| `index.html:1481–1497,1772–1775` | Host interpolates workflow names/descriptions/graph labels into innerHTML. Previously mostly constants; imported React names are untrusted. Adapter must render via textContent/escaped DOM, not copy imported strings into these templates. Otherwise replacement introduces stored DOM injection through local inventory. |

## 7. Suggested cutover contract and acceptance matrix

This is an audit recommendation, not an implementation or authorization to modify product behavior. Keep one authoritative document store for Studio. A host adapter should address a document + evaluated/approved revision, expose lifecycle summaries and registration events, and resolve a workflow's source revision. It must not manufacture risk/coverage/deployment metrics. Maintain explicit namespaces for legacy Operations and SWM fixtures until intentionally migrated.

| Scenario | Required observable result |
|---|---|
| Every entry listed in §3 | Correct outer tab and React state, no legacy DOM/editor visible or executing. New vs resume vs review differentiated. |
| Approve/modify/reject/retest/accept-as-is | PCP/Overview labels and pending count match current tested evidence; stale candidates never retain eligible claims; parent/child binding and Trace export retained. |
| Register twice; register new revision; register another template | No duplicate logical workflow or fixed WF-041 overwrite; source revision resolvable; status Registered · not deployed; reload preserves projection. |
| Library → registered workflow → Studio/Trace | Correct graph/hash/decision, not last edited document. Workflow graph labels/counts come from that revision. |
| Existing incidents + Pre-release after cutover | Existing incident fixture navigation still works; shared approval modal works; no accidental production approval or fixture revalidation of real Studio evidence. |
| World Model WF-021 / I-1042 links | Never route to a different semantic entity; fixture labels preserved or deliberate namespace migration implemented. |
| assurance.html and bookmarked outer URLs | Canonical new Studio reached; no second legacy editor or independent registration sink remains. |
| Mobile/direct route/iframe/preview deployment | Correct dimensions, valid assets, no duplicate shell, functioning import/copy/download, return navigation and no global style leakage. |
| Imported malicious labels/name | Rendered as text in Library/detail/activity/policy cards; cannot execute through legacy innerHTML sinks. |
| Claims audit en + zh | New product names agree; simulated != Observed; no uncomputed confidence/coverage/closure/deployment claims added to computed evidence. |

## 8. Method and limitations

Inspected origin/main HTML through git show (no checkout/rebase), newer commit subjects, source handlers and React store/controller/template/Trace/Register/CSS/build configuration. Measured bundle bytes directly. Searched explicit Blueprint navigation and JS helpers, including generated Library entries. No source files or generated assets were edited. No live-site/browser/Vercel configuration verification was performed: deployment concerns above are risks to test, not asserted production failures.
