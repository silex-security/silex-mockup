# Studio ↔ site contract (cutover plan: logs/2026-09-24_STUDIO_CUTOVER_PLAN.md v0.4)

## Files and owners

| File | Owner | What |
|---|---|---|
| `blueprint_studio/web/src/state/summary.js` | Claude (done) | Publishes `bs.summary.v1` (schema in the plan §2.3) and `fnv1a(raw)` |
| `blueprint_studio/js/store.js` | Claude (done) | Registrations under `bs.reg.<encodeURIComponent(docId\|rev\|hash)>`; `readRegistrations(storage)` |
| `tests/site/fixtures/storage.sample.json` | Claude (done) | Real `bs.doc.*`, `bs.reg.*` and `bs.summary.v1` values. It holds one document per state: awaiting approve; approved with a non-recommended candidate and the child registered; awaiting accept, with an HTML-looking name |
| `js/studio-bridge.mjs` | DeepSeek | Pure logic and DOM renderers (below). No globals, no `innerHTML` |
| `tests/site/studio-bridge.test.mjs` | DeepSeek | node tests over the fixture and mutated copies |
| `assurance.html` | DeepSeek | Retire the duplicate Studio (plan §2.5) |
| `js/studio-host.mjs` | Claude | The frame, `window.openStudio`, storage listeners, and calls to the bridge renderers |
| `index.html` | Claude | Removes the legacy Studio; adds the containers below |
| `tests/site/run-site-probes.mjs` | Codex | S1–S12 |

## `js/studio-bridge.mjs` API (ES module, browser and node)

```js
export function fnv1a(str)                    // identical to summary.js
export function readSummary(storage)          // -> { ok: true, summary } | { ok: false, reason }
                                              //    schema check per plan §2.3: v===1, types, finite numbers, num<=den
export function docStatus(summary, storage)   // -> Map(docId -> 'fresh' | 'stale' | 'missing')
                                              //    stale: fnv1a(storage['bs.doc.'+id]) !== fp; missing: no such key
export function projectPending(summary, storage)   // -> [{ key, docId, name, rev, label, hash, kind: 'approve'|'accept',
                                              //        recommended?: { id, label, violationsClosed:{num,den} }, runs?: n, scenarioSetId }]
                                              //    only 'fresh' documents; stale ones → [{ key, docId, name, stale: true }]
export function projectPcp(summary, storage)  // -> [{ key, docId, name, rev, label, hash, state: 'awaiting'|'approved'|'accepted',
                                              //        candidate?: { id, label }, scorecard?: {...}, metrics?: {...}, scenarioSetId,
                                              //        childLabel?, stale?: true }]
                                              //    awaiting: the recommended candidate; approved: the DECISION's candidate and scorecard
export function projectLibrary(storage, summary)   // -> [{ key, docId, name, domain, rev, label, hash, registeredAt, status,
                                              //        sourceReplaced: bool, evidence }]   from bs.reg.*; sourceReplaced when the
                                              //        saved document lacks that revision or its hash differs
export function renderPending(container, rows, { onOpen })   // builds rows with createElement/textContent only
export function renderPcp(container, cards, { onOpen, onTrace })
export function renderLibrary(container, rows, { onOpen, onTrace })
export function renderUnavailable(container, reason)
```

**Command objects** passed to `onOpen`/`onTrace`: `{ cmd: 'open', doc, rev, hash, view: 'assurance'|'trace', stage?: 'decide' }`.

## Host DOM hooks (Claude adds them to `index.html`; the renderers fill them; the probes use them)

| Selector | Where | Content |
|---|---|---|
| `section#blueprint > #studioFrameWrap > iframe#studioFrame` | Studio view | `src` set on first show: `blueprint_studio/app/index.html?embed=1#cmd=…&n=…` |
| `#ovStudioPending` | Overview · Policy Decisions | rows `[data-studio-pending="<key>"]`, with a button `[data-studio-open]`; stale rows carry `[data-studio-stale]` |
| `#ovPendingCount` (existing) | Overview | incident pending + Studio awaiting |
| `#pcpStudioCards` | PCP page | cards `[data-studio-pcp="<key>"][data-state="awaiting\|approved\|accepted"]`, with `[data-studio-open]` and `[data-studio-trace]` |
| `#libStudioGroup` | Workflow Library | rows `[data-studio-reg="<key>"]`, with `[data-studio-open]` (disabled when `[data-source-replaced]`) and `[data-studio-trace]` |
| `[data-studio-summary="unavailable"]` | any of the three containers | shown when `readSummary` fails; no numbers are rendered |
| `window.openStudio(cmd, params)` | global, from `studio-host.mjs` | `cmd` ∈ `resume` \| `new` \| `open` |

Keys are the registration key `docId|rev|hash`. A pending or PCP row for an unregistered revision uses the same form.

## Studio side (`blueprint_studio/web/src/embed.js`, Claude)

**Hash commands:**
- `#cmd=resume&n=<k>`
- `#cmd=new&n=<k>`
- `#cmd=open&doc=<enc>&rev=<n>&hash=<64hex>&view=builder|assurance|trace[&stage=confirm|validate|optimize|decide|register]&n=<k>`

**Behaviour:**
- Each nonce is consumed once, and the hash is then cleared with `history.replaceState`.
- `open` validates before it mutates (plan §2.2).
- The Studio republishes `bs.summary.v1` after every store change.
