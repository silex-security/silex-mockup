# SWM Ontology Graph: Network zoom buttons do nothing — plan and fix

Base: `main` at `50a87f4`. Branch `fix-graph-zoom`. Reported by the product owner on 2026-10-04: in
Enterprise World Model → Ontology Graph, clicking **+** and **−** has no effect, while trackpad pinch and
scroll zoom work.

## Diagnosis (reproduced in headless Chrome, real mouse events)

- The Ontology Graph opens on the **Network** view. There the top bar's `+ − Fit` group is hidden on purpose;
  the zoom control is the Network column at the stage's right edge (`.vw-zoom`: `+`, vertical slider, `−`, `Fit`,
  `swm/js/swm-vowl-ui.js`).
- `.vw-zoom` is absolutely positioned over the canvas with **no `z-index`**, while the canvas
  `.swm-stage svg` has `position:relative; z-index:1` (`swm/css/swm.css`). The canvas paints over the column, so
  `document.elementFromPoint` at the centre of `+` and `−` returns `svg#swmSvg`: every click lands on the canvas.
  Pinch and wheel act on the canvas itself, which is why they work.
- The handlers are correct: calling them directly zooms. The Graph and Hierarchy views use the top-bar buttons,
  which are not covered and work (scale 1 → 1.35 on `+`).
- Present since the Network view shipped (`cb3e9b8`, 2026-09-21). Synthetic `element.click()` bypasses hit
  testing, so no probe caught it.

## Fix

1. `swm/css/swm-vowl.css`: `.vw-zoom` gets `z-index:5`, above the canvas (1) and below the progress bar and the
   Modes pop-over (6).
2. Regression probe `ZOOM` in `probe-swm.mjs`, with **real mouse events at the button's centre**, not
   `element.click()`: in the Network view, `+` must hit the button and raise the canvas scale, `−` lower it, `Fit`
   change it back; in the Graph view, the top-bar `+` must raise the scale.

## Acceptance

`probe-swm.mjs` (all checks incl. `ZOOM`), `preview-panels.mjs`, `tests/site/run-site-probes.mjs` 42/42.
No data, copy or layout change.

## Outcome (2026-10-04)

- The new `ZOOM` probe **fails on `50a87f4`** (ZOOM-N: every click hits `svg#swmSvg`, scale stays 0.296) and
  **passes with the fix**: `+` 0.296 → 0.385, `−` → 0.296 → 0.228, `Fit` → 0.296; the Graph view's top-bar `+`
  1 → 1.35 both before and after (it was never affected).
- `probe-swm.mjs` 26/26, `preview-panels.mjs` ok, `tests/site/run-site-probes.mjs` 42/42. Screenshot unchanged
  apart from the zoom column now painting above node labels.
- One line of CSS; the vertical slider, also covered before, works again.
