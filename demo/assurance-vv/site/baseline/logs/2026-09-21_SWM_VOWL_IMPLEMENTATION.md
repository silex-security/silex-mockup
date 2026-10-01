# SWM Network (VOWL-style) — implementation log

Plan: `logs/2026-09-21_SWM_VOWL_NETWORK_PLAN.md` v0.2 (approved round 2, hash `7f11c9f`). Contract: `logs/swm-vowl-2026-09-21/CONTRACT.md`.
Branch: `swm-vowl-network`, BASE `8ec7346`. Private; not pushed or merged.

## Steps

1. **Research.** WebVOWL 1.1.7 on the SEPSES page: read the source (`webvowl.js`) and ran it locally. Spike on our bundle (`logs/swm-vowl-2026-09-21/spike.html`).
2. **Plan review.** Round 1: DeepSeek PLAN-APPROVED, Codex PLAN-REJECTED (4 points). Round 2: DEEPSEEK: PLAN-APPROVED · CODEX: PLAN-APPROVED · CLAUDE: PLAN-APPROVED.
3. **T3a (Codex).** Adapted regression harness: Graph checks select Graph explicitly. 16/16 modes green.
4. **T0 (Claude), `6344f4a`.** Integration contract, Network default, stubs. The regression suite is green on it.
5. **Budget amendment**, total unchanged at 38,000 B: integration 7,000 · engine 20,000 · UI 8,000 · CSS 3,000. **BUDGET-APPROVED** by both Codex and DeepSeek.
6. **T1 (Claude).** Engine `swm/js/swm-vowl.js`.
7. **T2 (DeepSeek).** `swm/js/swm-vowl-ui.js` and `swm/css/swm-vowl.css`. After DeepSeek reported done, Claude integrated them:
   - bar moved into normal flow (it overlapped the legend at 1600/768);
   - CSS `font-size` rules that overrode the engine's label fitting removed;
   - `pointer-events:none` on the hidden layer;
   - pin marker styled.
   The contract's "changes recorded" section lists these.
8. **T3b (Codex).** `probe-vowl.mjs`: V1–V16 and the §4 gates, 32/32 PASS. Full regression 16/16 modes PASS. Numbers:
   - cold ready median 360 ms, worst 496 ms (gate 1,200);
   - per-tick work 4.36 ms (gate 8);
   - 0 ticks after rest.
   Claude's own real-input check: a drag moves a neighbour 27 px; pin and unpin work; the Tab order reaches the nodes with a visible focus ring.

## Implementation review

### Round 1: frozen `c270604`

**CODEX: IMPL-APPROVED · DEEPSEEK: IMPL-REJECTED · CLAUDE: IMPL-APPROVED.**

- **DeepSeek #1 (blocking, real):** a deferred cross-tier search locate never fired. `done(false)` ran `ready()` while the phase was still `prelayout`, so `locate()` re-deferred. Probes missed it because L3 was already cached. Reproduced cold (halo 0).
  - Fix (`swm-vowl.js`): set the phase before `done(false)`. Verified cold (halo 1).
- **DeepSeek non-blocking #1:** the bar was shown over the empty state.
  - Fix (`swm-ontology.js`): `show(!!f.nodes.length)`. Verified.
- Plan §3.4 wording about the `'scope'` event has been aligned with the contract (metadata).

### Round 2: frozen `e978d6a` (the r1 delta is exactly the two fixes above)

**CODEX: IMPL-APPROVED · DEEPSEEK: IMPL-APPROVED · CLAUDE: IMPL-APPROVED** (unanimous).

- **Codex:** re-ran everything on r2.
  - `probe-vowl.mjs` 34/34, now including a cold L1 → L3 search that ends centred with the halo. All 16 regression modes pass.
  - §4 gates:
    - L1 full pre-layout 236.7 ms;
    - ready → rest 2,663 ms;
    - live tick-interval p95 26.8 ms (L1 full) vs 27.2 ms (L4);
    - per-tick work 4.52 ms;
    - cold ready ≤ 1,200 ms gate passes;
    - no ticks after rest.
- **DeepSeek:** re-traced the locate path statically and re-measured the budget.
- Budget, final: engine 16,819 · UI 7,148 · CSS 2,916 · integration 6,503 · **total 33,386 of 38,000 B**.
- **V15 legibility** was judged on the screenshots by Claude and Codex. DeepSeek's seat has no image input, so it deferred on V15 and relied on the automated no-overlap check. Recorded as such.
- **Non-blocking, carried forward:**
  - no Escape handler on the Modes popover (it matches the existing Filters popover);
  - the pre-existing fixture-label duplication in the edge card;
  - inline styles in the T2 stats markup;
  - labels hidden at the L1 fit zoom, by design.
- Final frames: `logs/swm-vowl-2026-09-21/final-*.png`.

**Status:** committed on the private branch `swm-vowl-network`. **Not merged, not pushed, not deployed** — that needs the user's go-ahead (the earlier SWM visual-upgrade deploy question is also still open).

## Deploy (2026-09-22)

The user authorized it ("合并两个分支到 main 并 push 部署").
- `main` was fast-forwarded `16409f1 → cb3e9b8`; this includes the `swm-visual-upgrade` commits `413436a` and `8ec7346`. Pushed.
- Vercel status: success. The live `swm/js/swm-vowl.js` is byte-identical to the repo.
- Live headless smoke test at 1366:
  - L1 370/362 and L4 24/28;
  - rest, with 0 ticks after rest;
  - selecting a node preserves the layout;
  - locate goes to L3 with the halo;
  - Graph view still works;
  - no console errors.
- Ready took 1,153 ms after the click on the live site. This includes the first fetch of the lazy D3 and ontology bundle over the network (the 1,200 ms gate was measured locally).
