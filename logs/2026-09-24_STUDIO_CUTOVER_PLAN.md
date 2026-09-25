# Plan: replace the live site's Blueprint Studio with the React Blueprint Studio, and keep every link consistent

Author: Claude (lead) · 2026-09-24 · Status: **v0.1, for review by DeepSeek and Codex. Nothing is changed or pushed before unanimous approval.**

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

### 2.2 Host → Studio: a validated hash route (no postMessage)

The React app gets a small `embed.js`. It parses `location.hash` at boot and on `hashchange`, and accepts only these routes:

| Route | Effect in the Studio |
|---|---|
| `#resume` | Opens the last document, as the standalone app does |
| `#new` | Opens the **template gallery**. The current document is kept until the user picks a template |
| `#doc=<id>&rev=<n>&view=builder\|assurance\|trace[&stage=<stage>]` | Loads that saved document and revision. If the document is not in this browser, it shows a toast "This Blueprint is not in this browser" and falls back to `#resume` |

- Any other key or value is ignored.
- `id` must match `^[\w.-]{1,80}$`, and `rev` must be an integer that exists.
- Nothing from the hash is rendered as HTML.

In embed mode (`?embed=1`):
- the Studio's SILEX brand link is hidden (the host has one), so the frame never nests the site inside itself;
- links that must leave the Studio use `target="_top"`.

### 2.3 Studio → host: a versioned summary in localStorage, read by the host

On every store change, the React app writes one key, `bs.summary.v1`. It is derived, never authoritative:

```js
{ v: 1, at: ISO, docs: [ { docId, name, domain, owner,
    revs: [ { rev, label, status: 'draft'|'confirmed', origin: 'edit'|'approve', hash,
              validated: bool, findings: n|null, optimized: bool,
              awaitingDecision: bool,             // optimized, not decided, and a recommended (tested, current, not rejected) candidate exists
              recommended: { id, label, closes: n, of: n } | null,
              decision: { action: 'approve'|'accept', childRev: n|null } | null } ] } ] }
```

- The host reads it, and the existing `bs.inventory` (React's Register output), on load, on every `storage` event (the iframe writes, so the host document receives the event), and whenever a host view is shown.
- **Host projections** live in a new `js/studio-bridge.js`, outside any build output. It has pure functions `projectPending(summary)`, `projectLibrary(inventory, summary)` and `projectPcp(summary)` that return plain data, and a renderer that builds the DOM with `textContent` only (F9).
- Studio identity is namespaced `bs:<docId>:<rev>`, and it is **never** mapped to `WF-*` or `I-*` (F5).

### 2.4 Host changes in `index.html` (origin/main version)

| Area | Change |
|---|---|
| `#blueprint` view (646–859) | Replaced by the frame container (§2.1). The legacy markup is removed |
| Legacy Studio script (`1399–1411`, `1512–1555`, and its init references in `1827`) | Removed atomically: `bp*` state, `BP_ORDER`/`BP_VARIANTS`, `setBpStage`/`setBpState`, the editor handlers, the inspector patch, and `WF-041` registration. **Kept:** the shared `decisionModal`/`decisionCb`, used by incidents, plus `showView`, the pending Set for incidents, and the toast |
| Nav + `data-jump=blueprint` + change-log Go | `openStudio('resume')` |
| New Blueprint (Overview 577, Library 1040) and the unregistered Library rows (`data-new-blueprint`) | `openStudio('new')`, which opens the gallery. It no longer relabels a singleton refund draft as another workflow |
| Overview Policy Decisions (615) + `ovPendingCount` | The static BP-REFUND row is removed. Rows come from `projectPending`: "*{name}* {rev} · awaiting a person's decision · recommended by the objectives rule: *{label}* · closes {closes}/{of} findings in simulation" → `openStudio('doc=…&view=assurance&stage=decide')`. The count = incident pending + Studio awaiting. With none awaiting: "No Blueprint decision is awaiting review" |
| PCP page Blueprint card + executive preview row (1151–1155, 1173) | The static Candidate B, "94% confidence", "+12% approval" and "+18 s" are removed. The card is rendered from `projectPcp`: the recommended candidate's label; its **simulated** result (findings closed, benign completion, friction), labelled "simulated · declared adversary model"; a link to the Trace. With no Studio evidence, an empty state points to the Studio. Incident PCP cards are untouched |
| Library (1458–1483) | A new group, **"Registered from Blueprint Studio · this browser · not deployed"**, rendered from `bs.inventory` joined with `bs.summary.v1`. Each row shows the name, revision, short hash, "Registered · not deployed", the time registered, and actions **Open in Studio** / **Trace**. Fixture rows and `updateCounts` are unchanged; Studio entries are counted separately, so fixture KPIs keep their meaning (Codex §4). Registering twice does not duplicate a row (the key is `docId:rev`) |
| Workflow Detail (1100) | The inert sentence becomes: "Illustrative fixture — it has no Blueprint document. **Model a workflow in Blueprint Studio →**" (`openStudio('new')`). The default detail text claiming "paths B/C/D closed" is scoped as "illustrative" (F4) |
| Change log (1381–1391) and Definitions (1357–1368) | One change-log entry is added, describing the Studio as a computed editor with a Decision Trace. The Definitions modal scopes its claims: "Blueprint Studio computes its results on the declared graph (simulated); the other panels are illustrative" |
| Pre-release, Incidents, Enterprise World Model | **No behavioural change** (Codex §3–4): their fixtures stay fixtures. The World Model's `WF-021`/`I-1042` fixture labels stay as they are, and nothing links them to Studio documents |

### 2.5 `assurance.html` (F7)

Recommendation: **retire only its duplicate Studio**. Its Blueprint view becomes a short notice, "Blueprint Studio moved to the main demo", with a link to `index.html#studio`. Its Studio entry points (New, review, PCP card and row, change-log Go) link to `index.html#studio` / `#studio=new`, and its `WF-041` registration and `BP-REFUND` pending code are removed. The rest of the A/B page is untouched.

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

- **S1.** Every upstream entry in F3 lands on the Studio view with the frame loaded and the right Studio route:
  - nav, the Assurance job and change-log Go → resume;
  - New Blueprint and the unregistered rows → the gallery is open;
  - review from Overview and PCP → the right document, revision and Decide stage;
  - `index.html#studio` and `#studio=new` → as in §2.6.
- **S2.** The frame is not loaded before the first Studio visit: no request to `blueprint_studio/app/assets/*` on Overview.
- **S3.** The whole lifecycle inside the frame (Confirm → Validate → Optimize) updates the host:
  - Overview shows one awaiting row with the recommended label, and `ovPendingCount` = incidents + 1;
  - the PCP card shows the same label and **computed** numbers (equal to `bs.summary.v1`);
  - Approve → the row disappears, and the count drops by one.
- **S4.** Register in the frame → one Library row in the Studio group ("Registered · not deployed"). Registering again doesn't duplicate it. A second template adds a second row. A reload preserves both. **Open in Studio** opens that document and revision, not the last one edited.
- **S5.** No legacy residue:
  - none of `bpState`, `WF-041` or `BP-REFUND` is in the DOM or scripts of either page;
  - none of "Candidate B", "94%", "2,400", "1,200 scenarios" or "Observed" appears inside Studio-linked cards;
  - there are **no console errors** on any view of either page.
- **S6.** Injection: a document named `<img src=x onerror=alert(1)>` is registered in the frame. The Library and Overview render it as text, and no element is created.
- **S7.** Incidents still work: approving I-1042 through the shared `decisionModal` resolves only the incident, and Pre-release and the World Model views render unchanged. Also, the pending-row counts for incidents are equal before and after the cutover.
- **S8.** Naming: neither page nor the Studio (en and zh) contains "Security World Model" or "Security Ontology".
- **S9.** Widths 1440, 1024, 768 and 390: the Studio frame fills the content area, with no horizontal page scroll. The Trace's record modal and the split button are usable. At 390 px the Studio is usable with its own responsive rules; this is checked by screenshot.
- **S10.** `assurance.html`: its Studio notice and links reach `index.html#studio`; it has no legacy Studio DOM and no console errors.
- **S11.** In the frame, Copy JSON, the record download and file import still work. Ask AI shows its rule-based note, because no Claude sample exists on the static site.

**Studio tests:**
- all existing tests: 149 engine, 55 web, the 58 app probes, i18n, `npm run check`;
- new unit tests for `embed.js` (hash validation) and the summary publisher (the `awaitingDecision` and `recommended` rules equal the controller's);
- a unit test for `studio-bridge.js`'s projection functions, run with node against fixture payloads (including stale, rejected, approved and accept).

**Live read-back after the push:** S1, S3, S4 and S5 are rerun against `https://silex-mockup.vercel.app/`, once the deploy serves the new commit, and recorded.

## 4. Ownership

User direction: give Codex build work.

| # | Owner | Files | Acceptance |
|---|---|---|---|
| 0 | claude | Rebase `blueprint-studio` onto `origin/main` first (DeepSeek verified it is conflict-free); the naming fixes (§2.7) | tests green |
| 1 | claude | `blueprint_studio/web/src/embed.js`, the summary publisher in `state/`, embed-mode UI tweaks, Register copy, the spine note, and their tests | the unit tests in §3 |
| 2 | deepseek | `js/studio-bridge.js` (pure projections + a `textContent` renderer), `tests/site/studio-bridge.test.mjs`, and the `assurance.html` retirement (§2.5) | projection tests; S10 |
| 3 | claude | `index.html` host changes (§2.4, §2.6), the root README, the change-log entry | S1–S9 |
| 4 | codex | `tests/site/run-site-probes.mjs` (S1–S11, headless, reusing the probe style of `blueprint_studio/tests/probe`), plus the live read-back mode `--base <url>` | reports PASS/FAIL; UI defects reported, not fixed |

- Slices 1 and 2 build against §2.3's summary format; Claude commits a sample `bs.summary.v1` fixture first.
- Code review: all three seats, unanimous. Then push, then the live read-back.

## 5. Out of scope

- Changing the fixtures of Pre-release, Incidents or the World Model.
- Linking Studio documents to L4 runtime nodes.
- Any backend or real registration.
- Server-side routing.

## 6. Review record

*(pending)*
