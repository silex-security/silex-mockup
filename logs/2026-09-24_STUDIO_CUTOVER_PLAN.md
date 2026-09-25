# Plan: replace the live site's Blueprint Studio with the React Blueprint Studio, and keep every link consistent

Author: Claude (lead) · 2026-09-24 · Status: **v0.4 — APPROVED unanimously in round 4: DEEPSEEK: PLAN-APPROVED · CODEX: PLAN-APPROVED · CLAUDE: PLAN-APPROVED.**

## 0. The ask

**User (2026-09-24):** "把blueprint studio 的design 写入 github 取代现有网站studio逻辑，并检查上下游链路保证逻辑一致。给出修改方案并给其他agent review，一致通过后执行。"

In English:
- Put the Blueprint Studio design (the React app in `blueprint_studio/`, including Ask AI, the templates and the Decision Trace) on GitHub.
- Make it **replace** the live site's Studio logic.
- Check every upstream and downstream link so the site stays logically consistent.
- Review this plan with the other agents, and execute after unanimous approval.

**Inputs:**
- Codex's link-and-state audit of `origin/main` ([`studio-cutover-2026-09-24/codex-link-audit.md`](studio-cutover-2026-09-24/codex-link-audit.md), summarised in §1).
- DeepSeek's naming and rebase check ([`studio-cutover-2026-09-24/deepseek-naming-check.md`](studio-cutover-2026-09-24/deepseek-naming-check.md)).
- A read of `origin/main:index.html` §`#blueprint` (lines 646–859).

**"Execute" means pushing to `main`.** The site deploys from `main` by direct commits: there are no pull requests, and Vercel serves the repo root. After the code gate passes, the branch is rebased onto `origin/main` and fast-forwarded. The live site is then read back.

## 1. What the audits found

| # | Finding | Source |
|---|---|---|
| F1 | The live Studio (`index.html:646–859` + inline script `1399–1411`, `1512–1555`) is a **static mock**. Its numbers are fixtures, not computed: "1,200 scenarios", "18% residual", candidates A/B/C with "2,400 scenarios", "94% confidence". Its paths are graded **Observed/Latent**, which a pre-deployment check must never claim (product spec N4/B1) | Codex §2, Claude |
| F2 | The mock is wired into other pages through one inline script. Old handlers dereference Studio DOM, so deleting the HTML alone crashes site start-up | Codex §2, §6 |
| F3 | **Upstream entries** into the Studio: nav (`439`), Assurance job (`564`), New Blueprint on Overview and Library (`577`, `1040`), the Library's unregistered rows (`1478–1479`), Overview's pending decision (`615`), the PCP card and preview row (`1151–1155`, `1173`), change-log Go (`1383`), and `resetBlueprint`/`newBlueprint`/`openBlueprintForReview`. Workflow Detail's "open Agentic Blueprint Studio" (`1100`) is plain text, not a link | Codex §3 |
| F4 | **Downstream effects**: the legacy Register always writes the fixed `WF-041`; the pending Set uses a singleton `BP-REFUND`; the PCP and Overview cards carry static Candidate B text; Workflow Detail defaults claim that paths B, C and D are closed | Codex §4 |
| F5 | **Identity collisions**: `WF-021` is Vendor Master Update in Operations but Customer Refund in the World Model fixtures, and `I-1042` differs the same way. WF-014, WF-041 and the React `bp-customer-refund-*` are three different objects | Codex §5 |
| F6 | **Thresholds**: $2,000 is React's *routing* threshold, $500 is the monitor's *policy* threshold, and $10,000 is the agent's capability limit. The site's "autonomous up to $2,000" is shorthand, and the World Model fixture's "500 USD ceiling" is a separate fixture | Codex §5 |
| F7 | `assurance.html` (the A/B proposal page) contains a **second full copy** of the legacy Studio with its own WF-041 registration | Codex §3 |
| F8 | **Upstream renames** on `origin/main`: Security World Model → **Enterprise World Model**, Security Ontology → **Ontology Graph**. The Studio uses the old name in 4 places. The ontology slice is unaffected (byte-identical), and a rebase is conflict-free | DeepSeek |
| F9 | **Risks**: global CSS collisions between the apps; imported Studio names flowing into the host's `innerHTML` templates (an injection sink); a 907 KB bundle (280 KB gzip); relative asset paths; storage shared on one origin; widths down to 390 px | Codex §6 |

## 2. Design

### 2.0 Revisions from round 1 (v0.2)

| # | Defect | Change |
|---|---|---|
| Codex 1 · DeepSeek 1 | The summary can't support the PCP card's numbers; recommended vs approved isn't distinguished | §2.3's schema carries each revision's own validation metrics, the recommended candidate's scorecard and evidence ids, and the decision with its own scorecard. The PCP card shows the recommendation while a decision is awaited and the approved result once decided. S3 checks against the **store**, not the summary |
| Codex 2 · DeepSeek nit 3 | Registration identity drops the hash; the id syntax is too narrow | One key everywhere, `docId\|rev\|hash`. `open` passes the hash and refuses a mismatch. A replaced source is shown as such, with the pinned evidence. The id accepts any non-empty string (encoded). A test covers replacement |
| Codex 3 | Summary persistence and reconciliation are underspecified | The summary is rebuilt from all `bs.doc.*`, checked against a schema, and each document is fingerprinted and checked by the host. Tests cover stale, malformed, replacement, deletion and two contexts |
| Codex 4 | Identical hash requests don't repeat | A nonce per command, and the hash is cleared after it is consumed. A test sends consecutive identical requests without a reload |
| Codex 5 | Accept-as-is is missing from pending | `awaiting: 'accept'`, with its own wording. A test covers validation → pending → accept → register |
| Codex 6 | `assurance.html` keeps contradictory figures | The Blueprint card and row become neutral notices; its legacy handlers and init dependencies are removed |
| DeepSeek nits 1, 2, 4 | The load path; findings semantics per revision; recommendation vs decision | §2.2 load path; `validation` is each revision's own (the child's is the labelled candidate run); §2.3 rules |

### 2.0b Revisions from round 2 (v0.3)

| # | Defect | Change |
|---|---|---|
| Codex 1 | The load path mutates state before validating | §2.2: parse, import-check, revision and hash checks all run **before** any store call. A refused command leaves the document, the active revision, storage and jobs unchanged, and a test checks this |
| Codex 2 | A 200-character id limit excludes valid imports | The limit is removed: any non-empty string, as `io.importDocument` accepts. A test reopens a registered document whose id is longer than 200 characters |
| Codex 3 | Two open contexts can overwrite each other's registrations (the store writes its cached inventory array) | `js/store.js` (Claude) makes the inventory **merge-safe** (superseded in v0.4 by per-key registrations, §2.0c). `register` re-reads `bs.inventory` from storage immediately before writing and merges by key. A new `store.syncInventory()` merges the stored array with memory (union by key) and is called on `storage` events for `bs.inventory`. S12 registers from two contexts and checks that both entries survive a reload |

### 2.0c Revision from round 3 (v0.4)

| # | Defect | Change |
|---|---|---|
| Codex 1 | Read-merge-write can still lose a registration across tabs if the overwritten writer closes before repairing | Each registration is persisted under **its own key**, `bs.reg.<encodeURIComponent(docId\|rev\|hash)>`. Unrelated registrations never write the same key, so none can overwrite another; the same key is idempotent. The inventory is the union of `bs.reg.*`. The old `bs.inventory` array is read once, migrated into per-key entries, and left in place, never rewritten. S12 forces overlapping writes and closes a writer immediately |

### 2.1 Embed the Studio in an iframe; don't mount it into the host page

- `section#blueprint.view` stays, because the router discovers views by that wrapper.
- Its content becomes a full-height container, `#studioFrameWrap`, holding `<iframe id="studioFrame" title="Blueprint Studio">`.
- The frame's `src` is set **on first show only**, so the 280 KB gzip bundle never loads on Overview: `blueprint_studio/app/index.html?embed=1#<route>`.

Why an iframe:
- It isolates CSS both ways (F9).
- It keeps the Studio's own router, store and tests unchanged.
- Being same-origin, it shares `localStorage` with the host.
- It is the same build the standalone app and the artifacts use.

The frame is `100%` wide, and its height is `calc(100vh − host topbar)`; the host page does not scroll around it. On widths ≤ 760 px the host sidebar collapses (existing rule) and the frame takes the full width.

### 2.2 Host → Studio: validated, repeatable hash commands (no postMessage)

The React app gets `web/src/embed.js`. It parses `location.hash` at boot and on `hashchange`.

**Every command carries a nonce**, `n=<integer>`, which the host increments per request. After acting on a command, `embed.js` clears the hash with `history.replaceState`, which fires no event. So the host can send an identical request twice, e.g. New Blueprint → pick a template → New Blueprint, and each one is delivered (Codex r1 #4). A command whose nonce was already consumed in this frame is ignored.

| Command | Effect in the Studio |
|---|---|
| `#cmd=resume&n=…` | Opens the last document, as the standalone app does |
| `#cmd=new&n=…` | Opens the **template gallery**. The current document is kept until the user picks a template |
| `#cmd=open&doc=<id>&rev=<n>&hash=<h>&view=builder\|assurance\|trace[&stage=<stage>]&n=…` | Loads a saved document and revision (see the load path below) |

**Load path for `open`** (DeepSeek r1 nit 1; **validate first**, Codex r2 #1). Every check runs before any store call:
1. Read `localStorage['bs.doc.' + id]`.
2. Parse it with `io.importDocument` (the file-import checks).
3. Check that `doc.id === id`, that revision `rev` exists, and that **its hash equals `hash`**.

Only when all of these pass does the Studio call `store.load(doc)` and then `setActiveRevision(rev)`. If any check fails, no store method is called: the document, active revision, `bs.current`, undo history and jobs are untouched. The Studio shows "This revision is no longer in this browser's copy of the document" (Codex r1 #2).

**Validation:**
- `doc` is any non-empty string, with no length limit, `encodeURIComponent`-encoded by the host. This matches `io.importDocument` exactly (Codex r2 #2).
- `rev` is a non-negative integer, and `hash` is 64 hex characters.
- `view` and `stage` come from fixed lists, and any other key is ignored.
- Nothing from the hash is rendered as HTML.

**In embed mode (`?embed=1`):**
- the Studio's SILEX brand link is hidden;
- links that must leave the Studio use `target="_top"`.

### 2.3 Studio → host: a summary rebuilt from all saved documents, checked by the host

**Publisher (Studio).** After every store change, and once at boot, `state/summary.js` **rebuilds** `bs.summary.v1` from **every** `bs.doc.*` key in storage, not only the active document. So:
- inactive documents stay in it;
- deleted documents drop out;
- a replaced document is recomputed.

Each writer rebuilds the whole summary, so two tabs converge: the last writer wins, but with a complete, consistent snapshot (Codex r1 #3).

**Schema (v1).** Every figure below is copied from the store; none is recomputed:

```js
{ v: 1, at: ISO, docs: [ { docId, name, domain, owner,
    fp,                                      // FNV-1a of the raw bs.doc.<id> string the summary was built from
    revs: [ { rev, label, status, origin, parent, hash,
      validation: null | { scenarioSetId, jobId, n, runs, findings: [{ id, prohibited, severity, violating, run }],
                           metrics: { residualReachability, benignCompletion, friction } },   // THIS revision's own validation;
                                             // for an approved child, it is the candidate run (store.childValidationResult), labelled as such
      optimization: null | { scenarioSetId, candidates: n, tested: n, eligible: n },
      recommended: null | { id, label, paramsVersion, testedParamsVersion, runId,
                            scorecard: { violationsClosed, residualReachability, benignCompletion, friction, addedLatencyMedian, patchOps } },
      awaiting: null | 'approve' | 'accept',
      decision: null | { action, candidateId, label, paramsVersion, runId, scenarioSetId, childRev, childHash, decidedAt,
                         scorecard }            // an approved decision's evidence.scorecard; for accept, the validation metrics
    } ] } ] }
```

**Rules:**
- `recommended` is the controller's rule: tested, current parameters, not rejected, then `optimize.recommend`.
- `awaiting = 'approve'` when the revision is optimized, undecided and has a recommended candidate.
- `awaiting = 'accept'` when it is confirmed, validated with **zero findings**, undecided, and not an approved child (Codex r1 #5).
- An approved child never awaits anything.
- **Recommended ≠ approved.** A person may approve a different eligible candidate. The PCP card therefore shows the **recommendation while awaiting**, and the **approved decision (its own label and scorecard) once decided** (DeepSeek r1 nit 4).

**Host validation (`js/studio-bridge.js`):**
- The host parses the summary with a schema check: `v === 1`, the types of every field used, numbers finite, and `num ≤ den`. If the check fails, the host shows **"Blueprint Studio summary unavailable — open the Studio to refresh"** and makes no claim.
- For each document, the host computes the FNV-1a of the current `bs.doc.<id>` string and compares it with `fp`.
  - If they differ, that document is shown as "changed since the Studio last summarised it — open the Studio to refresh", with no numbers.
  - If `bs.doc.<id>` is missing, the document is dropped.
- So a stale summary, from before the lazy iframe ever loads in this session, can never show claims for a document it doesn't match.
- The host re-reads the summary on load, on every `storage` event (the iframe's writes reach the host document), and on every host view change.

**Inventory is conflict-free by construction** (Codex r2 #3, r3 #1). The one engine change, in `js/store.js`:
- `register` writes one key per registration, `bs.reg.<encodeURIComponent(key)>`, with `key = docId|rev|hash`. If the key already exists, its entry is returned unchanged. No array is rewritten.
- `inventory()` returns the union of every `bs.reg.*` entry, sorted by `registeredAt` then `key`.
- **Migration:** at store creation, each entry of a legacy `bs.inventory` array that has no `bs.reg.*` key gets one. `bs.inventory` itself is never written again.
- The controller re-reads the inventory on `storage` events for `bs.reg.*`, so an open Register page and the host both update live.
- Because no two registrations share a key, overlapping writers in any number of tabs cannot lose each other's entries, even if a writer closes immediately.

**Identity** (Codex r1 #2, DeepSeek r1 nit 3):
- Everywhere, the key is the store's registration key, `docId|rev|hash`.
- Library rows deduplicate on it, and **Open** passes `doc`, `rev` and `hash`.
- It is never mapped to `WF-*` or `I-*`.
- A registration whose source revision has been replaced keeps its row. The row shows the **evidence pinned in its registration entry (`bs.reg.*`)** and "source revision replaced in this browser"; its Open action is disabled.

**Projections.** The pure functions are `projectPending(summary, docs)`, `projectPcp(summary, docs)` and `projectLibrary(inventory, summary, docs)`. They return plain data. The renderer uses `textContent` and `createElement` only (F9).

### 2.4 Host changes in `index.html` (origin/main version)

| Area | Change |
|---|---|
| `#blueprint` view (646–859) | Replaced by the frame container (§2.1). The legacy markup is removed |
| Legacy Studio script (`1399–1411`, `1512–1555`, and its init references in `1827`) | Removed atomically: `bp*` state, `BP_ORDER`/`BP_VARIANTS`, `setBpStage`/`setBpState`, the editor handlers, the inspector patch, and `WF-041` registration. **Kept:** the shared `decisionModal`/`decisionCb` (incidents), `showView`, the incident entries of the pending Set, and the toast |
| Nav + `data-jump=blueprint` + change-log Go | `openStudio('resume')` |
| New Blueprint (Overview 577, Library 1040) + unregistered Library rows (`data-new-blueprint`) | `openStudio('new')`, which opens the gallery |
| Overview Policy Decisions (615) + `ovPendingCount` | The static BP-REFUND row is removed. There is one row per `awaiting` revision:<br>• `approve`: "*{name}* {rev} · awaiting a person's decision · recommended by the objectives rule: *{label}* · closes {violationsClosed.num}/{den} findings · simulated";<br>• `accept`: "*{name}* {rev} · no findings in {runs} simulated runs · awaiting acceptance".<br>Both open the Studio at `open … stage=decide`. The count = incident pending + Studio awaiting. With none: "No Blueprint decision is awaiting review" |
| PCP page Blueprint card + preview row (1151–1155, 1173) | The static Candidate B, "94% confidence", "+12% approval" and "+18 s" are removed. A card per awaiting or decided revision, from `projectPcp`:<br>• **awaiting**: the recommended label and its scorecard (findings closed, benign completion, friction, added latency);<br>• **decided**: the approved label and **its** scorecard, or accept-as-is with the validation metrics.<br>Every figure is labelled "simulated · declared adversary model · scenario set {id}", and a Trace link is included. The empty state points to the Studio |
| Library (1458–1483) | Group **"Registered from Blueprint Studio · this browser · not deployed"**, from `projectLibrary`. Each row shows the name, revision, short hash, status, time registered, **Open in Studio**, **Trace**, and the replaced-source state. Fixture rows and `updateCounts` are unchanged |
| Workflow Detail (1100) | "Illustrative fixture — it has no Blueprint document. **Model a workflow in Blueprint Studio →**". The default "paths B/C/D closed" text is labelled illustrative |
| Change log / Definitions | One change-log entry is added. The Definitions modal scopes its claims: the Studio computes; the other panels are illustrative |
| Pre-release, Incidents, Enterprise World Model | No behavioural change. The fixtures, including `WF-021`/`I-1042`, stay fixtures |

### 2.5 `assurance.html` (F7; Codex r1 #6)

Its duplicate Studio is **retired**:
- The Blueprint view becomes a notice, "Blueprint Studio moved to the main demo", with a link to `index.html#studio`.
- Its Blueprint PCP card and preview row (`assurance.html:1002–1006`, `1024`), with their fixed closure, defense and "94% confidence" figures, become a **neutral notice**, "Blueprint decisions are reviewed in the main demo's Blueprint Studio →". Retargeting its static figures would contradict S5, so they go.
- Its Overview review row gets the same neutral notice.
- Its legacy editor, lifecycle, inspector handlers, `WF-041` registration, `BP-REFUND` pending code and their init references are removed.
- Its incident handlers, the shared modal, navigation and everything else are kept.

### 2.6 Deep link into the host

`index.html` gets a tiny hash hook:
- `#studio` → `showView('blueprint')` plus `openStudio('resume')`;
- `#studio=new` → `openStudio('new')`.

It runs after the existing init. No other host routing changes.

### 2.7 The Studio itself

- **Naming (F8):** "Security World Model layers" becomes **"Enterprise World Model layers"** (zh "企业世界模型各层"), and the README uses "Ontology Graph". Generic uses of "ontology" / "world model" stay.
- **The layer axes (Codex §5 last row):** a one-line note in the Trace spine says: "These are the world model's reasoning layers; the Ontology Graph's L1–L4 tiers are a different axis. Schema draws on L1–L3."
- **Register copy (Codex §5):** the header becomes "Workflow inventory · this browser", matching the list.
- **Embed mode (§2.2)** and the summary publisher (§2.3), with tests.

### 2.8 Site README

The root README says "no engine runs behind the page". It is scoped as: "Blueprint Studio runs a deterministic engine on the declared graph (simulated outcomes); the other panels are illustrative." The Enterprise World Model and Ontology Graph names follow upstream.

## 3. Acceptance (automated; the site probes are new)

**S-probes, headless Chrome, against a local static server of the rebased tree, at 1440 × 900 unless noted:**

- **S1.** Every upstream entry in F3 lands on the Studio with the frame loaded and the right command:
  - nav, the Assurance job and change-log Go → resume;
  - New Blueprint and the unregistered rows → the gallery is open;
  - review from Overview and PCP → the right document, revision **and hash**, at Decide;
  - `index.html#studio` and `#studio=new`.
  - **Repeatability:** New Blueprint → pick a template → New Blueprint again opens the gallery again, with no reload. Opening the same review twice after navigating inside the Studio returns to it both times.
- **S2.** The frame is not loaded before the first Studio visit: there is no request to `blueprint_studio/app/assets/*` on Overview.
- **S3.** Lifecycle in the frame, checked against the **store** (the probe reads `bs.doc.*` and recomputes the recommendation with the engine's `recommend`):
  - After Confirm → Validate → Optimize: Overview shows one `approve` row with the recommended label, and the PCP card shows that candidate's scorecard, equal to the store's `verdict.scorecard`. `ovPendingCount` = incidents + 1.
  - Approve a **non-recommended** eligible candidate: the row disappears, and the PCP card shows the approved label and its own scorecard.
  - **Accept-as-is path:** approved child → Edit as new revision → confirm → validate with zero findings → Overview shows an `accept` row → accept → the row disappears → Register → one Library row.
- **S4.** Registration and identity:
  - Register → one Library row, "Registered · not deployed". Registering again doesn't duplicate it; a second template adds a second row; a reload keeps both.
  - **Open in Studio** opens that document, revision and hash, not the last one edited.
  - **Replacement:** import a document with the same id and different content. The old row shows "source revision replaced" with its pinned evidence, Open is disabled, and a forged open command with the old hash is refused.
- **S5.** No legacy residue:
  - none of `bpState`, `WF-041` or `BP-REFUND` is in the DOM or scripts of either page;
  - no fixed Studio figure (Candidate B, 94%, 2,400, 1,200 scenarios, "Observed") appears in any Studio-linked card of **either** page;
  - there are no console errors on any view of either page.
- **S6.** Injection: a document named `<img src=x onerror=alert(1)>` is registered in the frame and rendered as text in the Library, Overview and PCP. No element is created.
- **S7.** Incidents: approving I-1042 through the shared modal resolves only the incident. Pre-release and the World Model views render unchanged, and the incident pending count is the same before and after the cutover.
- **S8.** Naming: neither page nor the Studio (en and zh) contains "Security World Model" or "Security Ontology".
- **S9.** Widths 1440, 1024, 768 and 390: the frame fills the content area; there is no horizontal page scroll; the record modal and the split button are usable.
- **S10.** `assurance.html`: its notices and links reach `index.html#studio`; it has no legacy Studio DOM or handlers and no console errors; its incident flows still work.
- **S11.** In the frame, Copy JSON, the record download and file import still work, and Ask AI shows its rule-based note.
- **S12.** Summary robustness:
  - **malformed:** `bs.summary.v1` set to junk → the host shows "summary unavailable" and no claims;
  - **stale:** a document edited in another context without republishing → the host shows "changed since the Studio last summarised it";
  - **deletion:** a `bs.doc.*` removed → its rows disappear;
  - **two contexts:** two frames or tabs each update a different document, and both appear;
  - **two registrations:** two already-open contexts register different documents with **overlapping** writes (both read the inventory first, then both write). One context is closed immediately after its write. After a reload, both entries are present (Codex r2 #3, r3 #1).

**Studio tests:**
- all existing tests: 149 engine, 55 web, the 58 app probes, i18n, `npm run check`;
- unit tests:
  - `embed.js`: validation, the nonce, id encoding (including an id longer than 200 characters), and a hash mismatch or a missing revision that leaves the store, storage and jobs unchanged;
  - `store.js`: per-key registration is idempotent; `inventory()` is the union; legacy `bs.inventory` is migrated without being rewritten; two stores over one storage, registering in interleaved order, keep both entries;
  - `summary.js`: every rule in §2.3, including approve vs accept, and a non-recommended approval;
  - `studio-bridge.js` projections: fixtures for stale, malformed, replaced, rejected, stale candidates, accept, and approved child.

**Live read-back after the push:** S1, S3 (first bullet), S4 (first bullet) and S5 are rerun against `https://silex-mockup.vercel.app/` once it serves the new commit, and recorded.

## 4. Ownership

User direction: give Codex build work.

| # | Owner | Files | Acceptance |
|---|---|---|---|
| 0 | claude | Rebase `blueprint-studio` onto `origin/main` first (DeepSeek verified it is conflict-free); the naming fixes (§2.7) | tests green |
| 1 | claude | `blueprint_studio/js/store.js` (per-key registrations, §2.3), `blueprint_studio/web/src/embed.js`, `web/src/state/summary.js`, embed-mode UI tweaks, Register copy, the spine note, and their tests. First commits a sample `bs.summary.v1` fixture, `tests/site/fixtures/summary.sample.json` | the unit tests in §3 |
| 2 | deepseek | `js/studio-bridge.js` (schema check, FNV fingerprint, pure projections, a `textContent` renderer), `tests/site/studio-bridge.test.mjs`, and the `assurance.html` retirement (§2.5) | projection tests; S10 |
| 3 | claude | `index.html` host changes (§2.4, §2.6), the root README, the change-log entry | S1–S9 |
| 4 | codex | `tests/site/run-site-probes.mjs` (S1–S12, headless, reusing the probe style of `blueprint_studio/tests/probe`), plus the live read-back mode `--base <url>` | reports PASS/FAIL; UI defects reported, not fixed |

- Slices 1 and 2 build against §2.3's summary format; Claude commits a sample `bs.summary.v1` fixture first.
- Code review: all three seats, unanimous. Then push, then the live read-back.

## 5. Out of scope

- Changing the fixtures of Pre-release, Incidents or the World Model.
- Linking Studio documents to L4 runtime nodes.
- Any backend or real registration.
- Server-side routing.

## 6. Review record

### Round 4 (v0.4): DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED, Claude PLAN-APPROVED

### Round 3 (v0.3): DeepSeek PLAN-APPROVED, Codex PLAN-REJECTED (1)

See §2.0c.

### Round 2 (v0.2): DeepSeek PLAN-APPROVED, Codex PLAN-REJECTED (3)

See §2.0b.

### Round 1 (v0.1): DeepSeek PLAN-REJECTED (1), Codex PLAN-REJECTED (6)

See §2.0.
