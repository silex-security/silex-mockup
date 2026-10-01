# Plan: floating left nav — r1

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
