# Plan: floating left nav — r3

Date 2026-09-30 · branch `floating-nav` from `main` `bbf3a7d` · roster: planner Claude, `reviewer-codex`, `coder-deepseek`; both gates unanimous.

**User request:** "把最左边的黑色tab列表变成悬浮，点开一个tab的时候如果鼠标移开，它可以hide，右边内容按比例占满窗口，鼠标移到最左边的时候它可以出现，按照你觉得合理的逻辑design UI。" In English: make the dark left nav float. After a tab is opened and the mouse leaves, the nav hides and the content fills the window. Moving the mouse to the left edge brings it back. The planner designs the details.

**Staffing (user, 2026-09-30):** "可以多给codex安排任务". So Codex builds the feature and the probes, DeepSeek reviews (plan and code), and the planner owns the plan, the integration check and the screenshots.

## 0. Today

- `index.html:20`: `.app{display:grid;grid-template-columns:244px 1fr}`; `.sidebar{position:sticky;top:0;height:100vh;…}`. The sidebar markup is `index.html:450–479` (`<aside class="sidebar">`), followed by `<main class="main">` with a sticky 68 px `.topbar`.
- `index.html:27`, `@media(max-width:760px)`: the sidebar becomes a horizontal icon strip above the content.
- Nav clicks go through `showView(id)` (`index.html:1266`).
- Width-dependent code:
  - `js/studio-host.js:30` sizes the Blueprint Studio iframe on `resize`;
  - World Model D3 panels measure their container when they render.
- Existing `position:fixed` layers: the modal overlay (z 30) and the toast.

## 1. Design (what the user sees), widths > 760 px

1. **Default: auto-hide.** The sidebar is a fixed overlay drawer: `position:fixed; left:0; top:0; height:100vh; width:244px`, closed with `translateX(-100%)`. `.app` becomes one column, so `.main` fills the whole window and the content scales with it.
2. **Reveal:**
   - **Left edge:** a fixed, transparent 8 px hot strip along the left edge. Hovering it for 120 ms opens the drawer. The delay stops a pointer crossing the edge on its way to the browser chrome from opening it.
   - **Hint:** the strip shows a slim 3 px blue handle (`var(--blue)`, 40 % opacity) centred vertically, brightening on hover, so the edge is discoverable.
   - **Topbar button:** a `☰` button at the far left of the topbar opens and closes the drawer. It covers touch, keyboard and discoverability, with `aria-controls="sidebar"` and `aria-expanded`.
3. **Open state:**
   - The drawer slides in over the content (200 ms ease-out; none under `prefers-reduced-motion`) with a soft shadow.
   - There is **no dimming scrim**: it is a peek, not a modal, and the content stays readable beside it.
   - The page does not reflow while the drawer is open over it.
4. **Hide:**
   - The pointer leaving the drawer closes it after 350 ms. Re-entering the drawer or the edge strip cancels the close.
   - **Choosing a nav item:** `showView` runs at once; the drawer closes as soon as the pointer leaves it (350 ms), and immediately if the item was chosen with the keyboard or by touch.
   - `Esc` closes it and returns focus to `☰` if focus was inside the drawer.
   - A click or tap on the content outside the drawer closes it.
   - While keyboard focus is inside the drawer it stays open; Tab out of it closes it.
5. **Pin (keep open):**
   - A pin button sits at the top-right of the drawer, beside the SILEX brand, labelled "Keep sidebar open" / "Auto-hide sidebar", with `aria-pressed`.
   - **Pinned:** today's layout, with a docked 244 px column and the content beside it; no auto-hide.
   - The choice is remembered per viewer in `localStorage` key `silex.nav.pinned`, read and written inside try/catch; a failure means unpinned.
   - Pin changes the content width, so it dispatches one `window` `resize` event after the transition, which re-sizes the Studio iframe and any listener.
6. **First visit:** unpinned and closed. There is no auto-peek on load; the edge handle and `☰` are visible.
7. **≤ 760 px (phones):** unchanged; the existing horizontal icon strip stays. No hover there, and S18's 390 px checks stay valid. The hot strip, `☰` and pin are hidden.
8. **Iframes:** the hot strip is a top-level fixed element (z 25: above content and iframes, below the modal at 30). An iframe never reaches the left edge because the content has padding, and a pointer over an iframe still reaches the strip.
9. **No behaviour change otherwise:**
   - `showView`, deep links and nav order stay as they are; the sidebar markup keeps its buttons and `data-view`;
   - the breadcrumb, region switch and every view's content are untouched.

## 2. Code (owners)

- **Codex (build):**
  - `index.html`: the CSS in one new `<style>` block, or appended to the existing one, scoped with `@media(min-width:761px)`; `id="sidebar"` on the aside; the `☰` button in the topbar; the pin button; the hot strip element;
  - `js/floating-nav.js`, a new classic script loaded after the inline script. It holds the state machine (`closed` · `peek` · `pinned`) and the timers above. It exposes `window.__siteNav = { state(), open(), close(), pin(on) }` for probes.
  - It does not touch `showView` beyond listening for nav clicks (event delegation on `.sidebar`).
- **Codex (probes):** new `S20` in `tests/site/run-site-probes.mjs`, at 1440 px unless stated:
  - closed by default; `.main` left = 0 and width = the viewport; drawer off-screen;
  - edge hover (CDP `Input.dispatchMouseEvent` at x = 2) opens it after the delay; moving to the content closes it after 350 ms; re-entry cancels;
  - nav click switches the view and the drawer closes once the pointer leaves;
  - `Esc`; outside click; `☰` toggles `aria-expanded`;
  - pin docks: `.main` left ≈ 244; persists across reload; unpin restores;
  - Studio iframe width follows pin and unpin;
  - 1024 px the same; 390 px unchanged (no strip or `☰`, horizontal nav as before); no JS errors or horizontal overflow.
  - It also updates any existing probe that assumed the docked sidebar, and the `--base` live subset gains S20.
- **Planner:** integration smoke check, screenshots, README and `logs/README.md` entries.
- **DeepSeek:** plan review and code review, reading the diff and probe output as text.

## 3. Acceptance

| Suite | Expected |
|---|---|
| `node --test tests/site/*.test.mjs` | 20/20 |
| `run-site-probes.mjs` | 20/20 (S1–S19 unchanged in meaning, plus S20) |

**Screenshots before deploy:**
- closed, with full-width content;
- edge peek, open over the content;
- pinned;
- 390 px.

**Deploy:** a push to `main` is public. Show the screenshots and ask first, then run the live read-back.

## r2: resolutions of plan review r1 (these supersede §1–§3 where they differ)

r1 review: `reviewer-codex` PLAN-CHANGES (8 items), `coder-deepseek` PLAN-CHANGES (9 items). Every item is taken; where the two differ, the choice is stated.

**A. Geometry and layers** (DS 1, 3, 4; Codex 6).
- **Drawer:** full height, as today (`position:fixed; top:0; left:0; width:244px; height:100vh; overflow-y:auto`), so the brand stays at the top.
- **When the drawer is open it covers `☰`; that is fine:**
  - `☰` only opens the drawer;
  - closing is pointer leave, `Esc`, an outside click, or choosing an item;
  - `☰`'s `aria-expanded` still tracks the state.
- **Pinned** uses DeepSeek's mechanism (b): the drawer stays fixed and is never transformed, and `.main` gets `margin-left:244px`. `.app` is one column in both modes.
- **Stacking:** content < topbar 5 < edge strip 19 < drawer 20 < host modal 30 < help tooltip 40 < toast 50.
- **Edge strip:** shown only when the drawer is closed and not pinned, never under the open drawer.
- **Short screens:** the drawer scrolls (`overflow-y:auto`); a probe at 1440 × 600 reaches every item and the pin.

**B. Modes and precedence** (Codex 3, 5).
- **State:** `mode` is `auto` or `pinned` (the stored preference, `silex.nav.pinned`); `open` is a boolean that only means something in `auto`.
- **When pinned:**
  - `Esc`, outside click and pointer leave do nothing;
  - `☰` and the strip are hidden;
  - only the pin button unpins.
- **Desktop vs phone:**
  - Desktop rules live under `@media not all and (max-width:760px)`, the exact complement of the existing phone query, so there is no fractional gap. JS uses `matchMedia('(max-width:760px)')`.
  - **Entering phone width:** cancel timers, remove `inert` and transforms, keep the stored preference.
  - **Back to desktop:** restore the pinned dock, or auto with the drawer closed.
- **Timers:** one timer slot.
  - Every explicit action (toggle, `Esc`, outside close, pin change, breakpoint change, nav choice) clears it.
  - Callbacks re-check mode, the breakpoint, hover state and keyboard focus before acting.
  - The 120 ms reveal is cancelled if the pointer leaves the strip first.
  - Re-entering the drawer cancels the 350 ms close.

**C. Focus and keyboard** (Codex 1, 2).
- **Closed in auto mode (desktop):** the drawer is `inert`, so it is out of the tab order and the accessibility tree.
- **`☰`:** a real `<button aria-label="Show navigation" aria-controls="sidebar" aria-expanded>`, grouped with the breadcrumb in a new `.top-left` flex cluster.
- **Input modality:** the last input is `keyboard` after keydown, otherwise `pointer` after pointerdown.
  - **Keyboard focus inside the open drawer** keeps it open.
  - **Pointer focus** (a clicked nav button) does not stop the leave timer.
- **Opening:**
  - from the keyboard (`☰` with Enter or Space): remove `inert` and focus the active nav item;
  - by pointer: no focus move.
- **Choosing a nav item:**
  - by pointer: the view switches, and the drawer closes 350 ms after the pointer leaves;
  - by keyboard or touch: the view switches and the drawer closes at once.

  Before `inert` is applied, focus moves to `<main id="main" tabindex="-1">` for the keyboard case; in the pointer case it is blurred.
- **Esc:**
  - closes the drawer;
  - focus returns to `☰` if it was inside the drawer;
  - ignored while a host modal is open;
  - never listened for inside iframes, so Studio's own Esc is untouched.
- **Focus leaving the drawer** (`focusout` whose new target is outside the drawer, checked on the next tick, including focus entering an iframe) closes it in auto mode.
- **No focus trap:** the drawer is non-modal.

**D. Iframes and outside clicks** (Codex 4; DS 7).
- **"Outside click"** means a host-document `pointerdown` outside the drawer and `☰`.
  - It **passes through**: the peek has no scrim, so the click also reaches its target, which is the least surprising behaviour.
- **Iframes:**
  - nothing is attached inside them;
  - the drawer's own `pointerleave` covers a pointer moving into an iframe;
  - `focusout` covers keyboard focus entering one.
- **S20 checks:**
  - open by toggle, move into and click inside the Runtime and Studio iframes, and the drawer closes;
  - the frame's control still works (the Runtime frame's tab switch, Studio's Esc-closable menu).

**E. Resize after pin changes** (DS 8; Codex 5, 7).
- After a pin change, exactly one `window` `resize` event is dispatched once the dock settles: on `transitionend` of `.main`'s `margin-left`, or a 260 ms fallback, whichever comes first.
- Under `prefers-reduced-motion` it fires on the next frame.
- Nothing listens to `resize` to change docking, so there is no loop.
- **S20 checks**, after the 180 ms World Model debounce:
  - the Studio iframe's width and height follow pin and unpin, with the same frame document;
  - an active World Model panel re-measures.

**F. Probes** (DS 2; Codex 1, 8).
- **`nav(view)` on desktop:**
  - if the target button is not hit-testable (drawer closed), it clicks `☰` with a real CDP click;
  - waits for `__siteNav.state()` to report `{open:true, settled:true}` and the button's rect inside the viewport, checked with `elementFromPoint`;
  - then clicks the button.
- **Phone:** unchanged.
- **Audit:** every other direct `.nav` click is audited and moved to `nav()`.
- **`clickSel`:** asserts `elementFromPoint` hits the target, so an off-screen click fails loudly instead of no-op'ing.
- **S18:** the nav-visibility claim becomes "desktop: reachable through the toggle; 390 px: visible strip".
- **S20** uses real input events only; `__siteNav` is read-only state for waits.
  - It clears `silex.nav.pinned` at start and end, so S1–S19 and the live subset run in auto mode.
  - **Coverage:**
    - edge reveal, and reveal cancelled before 120 ms;
    - leave, and re-entry before 350 ms;
    - an explicit close during a pending reveal;
    - pointer nav choice, then leaving without clicking elsewhere, closes;
    - keyboard open, Tab, Shift+Tab across the boundary, and Esc with focus inside and outside;
    - Tab while closed never focuses a nav item;
    - outside click; iframe interaction;
    - pin persists across reload, with Esc and outside click doing nothing while pinned;
    - rapid pin and unpin;
    - 760 / 761 px, and desktop → 390 → desktop in both modes, including crossing with a pending timer;
    - 1440 × 600 scroll reach;
    - modal over the drawer;
    - reduced motion;
    - no horizontal overflow at 761, 768, 1024 and 1440;
    - no JS errors.
- **`assurance.html`:** its own nav is out of scope and unchanged.

**G. Ownership** (unchanged from §2):
- **Codex:** `index.html` (CSS, markup), `js/floating-nav.js`, `tests/site/run-site-probes.mjs`.
- **Planner:** docs and screenshots.
- **DeepSeek:** review.

Acceptance: unit 20/20; probes 20/20.

### Plan gate

| Round | reviewer-codex | coder-deepseek | planner |
|---|---|---|---|
| r1 | PLAN-CHANGES (8) | PLAN-CHANGES (9) | — |
| r2 | PLAN-APPROVED | PLAN-APPROVED | PLAN-APPROVED |

**Build notes from r2** (non-blocking):
- **Timers:** keep the docking-settlement fallback separate from the interaction timer. Drop stale `transitionend` listeners on rapid pin changes, so each settled layout fires one `resize`.
- **Host modal:** every auto open/close handler is ignored while a host modal is open.
- **`elementFromPoint`** accepts the target or one of its descendants. Frame clicks are checked in that frame's document.
- **`__siteNav.state()`** keeps one shape across desktop, pinned and phone.

## r3: click toggle like chatgpt.com (user, during the r2 build)

**User:** "上面的方案实现完毕后，instead of 依赖鼠标悬浮，也可以参考chatgpt.com 上的toggle sidebar 功能，给一个小图标，click toggle sidebar, click again show it back". In English: rather than depending on hover, add a small sidebar icon. One click hides the sidebar; another click shows it again.

**The r2 build** (`c9b91b4`, Codex) is the base. r3 changes only the following; everything else in r2 stands.

1. **One sidebar-panel icon, two places** (an inline SVG: a rounded rectangle with a left pane, the familiar "toggle sidebar" glyph, 20 px, inheriting `currentColor`).
   - **In the drawer header**, right of the SILEX brand (replacing r2's pin):
     - when the sidebar is shown docked, `aria-label` "Hide sidebar"; a click hides it, and the content widens to the full window;
     - during a hover peek, "Keep sidebar open"; a click docks it.
   - **In the topbar's left cluster** (replacing r2's `☰`), visible only while the sidebar is hidden. `aria-label` "Show sidebar"; a click docks the sidebar (content narrows), the same as clicking again in ChatGPT.
   - Both are real `<button>`s with `aria-controls="sidebar"` and `aria-expanded`, plus a tooltip (`title`) carrying the label.
2. **States** (reuse r2's names):
   - `pinned` is the shown, docked sidebar.
   - `auto` is the hidden sidebar. It is closed, or `open` during a hover peek.
   - The topbar icon now goes `auto → pinned` directly; it no longer opens the overlay.
   - The overlay peek exists only through the left-edge hover, which stays as a bonus shortcut (the user's first request), with r2's timers.
3. **Default and memory:**
   - The first visit is hidden (`auto`), per the user's first request.
   - The choice persists in `silex.nav.pinned`, as in r2.
4. **Keyboard:**
   - The topbar icon (Enter or Space) docks the sidebar and focuses the active nav item.
   - The header icon hides it and moves focus to the topbar icon.
   - Hidden means `inert`, as in r2.
   - `Esc` and outside click only close a peek. They never hide the docked sidebar; only the icon does.
5. **Motion:**
   - Docking and hiding animate `.main`'s `margin-left` and the drawer's transform together (200 ms; instant under reduced motion).
   - One settled `resize`, as in r2.
6. **Phones (≤ 760 px):** unchanged, with neither icon shown.
7. **Probes:**
   - S20 drops r2's keyboard overlay-open path, which is replaced by the topbar icon docking.
   - **It adds:**
     - topbar icon docks;
     - header icon hides;
     - repeat;
     - `aria-expanded` and labels in each state;
     - focus moves;
     - persistence across reload;
     - peek, then header icon docks;
     - `Esc` does not hide the docked sidebar.
   - **`nav()`:** when the button is not hit-testable, click the topbar icon (docks), navigate, then restore the prior state, so S1–S19 still run hidden by default.
   - **Fix the S20 flake** seen in the planner's run: `run-site-probes.mjs` on its own server, without `SITE_BASE`, failed "Timeout: drawer open keyboard 7 … open:false … focus:navToggle", while Codex's `SITE_BASE` run passed. The full suite must pass 3 times in a row in both modes.
