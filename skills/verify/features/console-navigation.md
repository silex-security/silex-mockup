# Console navigation

The console is one page with 11 views in a sidebar. A visitor moves between views, and the URL, the highlighted sidebar entry and the visible view always name the same view, so a link or a reload reopens it.

## Sub-features

- `nav-sidebar` opens the sidebar from the top bar and keeps it pinned.
- `nav-view` shows a view when its sidebar entry is chosen.
- `nav-deeplink` opens a view from `#view=<view>`, with `&tab=` or `&path=` where the view has them.
- `nav-history` returns to the previous view with the browser's Back.
- `nav-rail` jumps between products from the suite rail in the top bar (not covered by a journey).
- `nav-redirect` sends removed views to their replacements, for example `#view=short-term` to Runs & Results (not covered by a journey).
- `nav-phone` lays the sidebar out as a grid below 760px wide (not covered by a journey).

## How to get to it (user POV)

- Open the site. The home view, Platform, is `#view=assurance`.
- Choose the panel button at the left of the top bar to open the sidebar, then choose a view.
- Move the pointer to the left edge of the window to reveal the sidebar without pinning it.
- Open a link that carries `#view=<view>`.

## Driving it with drive.mjs

Journey: `skills/verify/journeys/console-navigation.mjs`.

- **Open the sidebar.** `click('#navToggle')`, then wait until `window.__siteNav.state()` reports `open` and `settled` and the sidebar's left edge is at 0 or more.
- **Choose a view.** `click('aside .nav button[data-view="<view>"]')`. The view is shown when `location.hash` starts with `#view=<view>`, `aside .nav button.active` has that `data-view`, and exactly one `section.view.active` is visible.
- **Back.** `ev('history.back()')`, then wait for the hash and the highlighted entry of the view before.
- **Deep link.** `go('#view=<view>&tab=<tab>')` and check the same three things.
- **Proof.** `shot()` after opening the sidebar and after the last view. The report lists the state read for each view.

## Gotchas

- The sidebar starts off-screen (`transform: translateX(-100%)`) and is `inert`. A click on a sidebar entry before the sidebar is open fails as "covered". Open it first.
- `#navToggle` pins the sidebar and stores `silex.nav.pinned` in `localStorage`. `data-nav-open` stays `false` when pinned, so read `__siteNav.state().open`, not the attribute.
- `__siteNav.open()` and `.pin()` exist for diagnostics. Do not call them in a proof; click the control.
- The World Model adds its default tab to the URL (`#view=security-model&tab=wm-architecture`), so compare the hash with `startsWith`.
- The four Agent Gym views share one frame and one `section`. Switching between them does not reload the app.
