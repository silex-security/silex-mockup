// Runtime Observation · Agent fleet, block E: the scenario matrix (logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md §新页面结构, row E).
// Owner: coder-mimo (T3). Contract: no DOM, window, document or matchMedia at module top level — Node imports this file;
// every DOM call happens inside mountGrid. Nothing here types a decision, a count or a row: model.matrix (fleetModel in
// js/rt-fleet.js) supplies the eleven rows, their cells, their agent, their labels and their ▶ id.
//
// Layout: one card, [data-rt-fgrid]; a header row (a/b × trace only / with slice) and one [data-rt-fgrid-row] per
// scenario. A cell lists the run's calls as [data-rt-fgrid-call] badges joined by arrows, each with an accessible name
// "<tool>: <decision>" and an ⓘ giving the rule id and reason (or "no rule fired"). Rows whose risky ("b") result
// changes with the slice are tinted and carry the visible word "differs". ▶ calls opts.run(row.play); the block never
// reaches for window.__jevRuntime itself.

// Decision → icon. The plan fixes the four symbols; which one a call gets comes from the model's own decision.
const GLYPH = { ALLOW: '\u2713', HOLD: '\u23F8\uFE0E', BLOCK: '\u26D4\uFE0E', REVIEW: '\u25D4' };
const KIND = { ALLOW: 'ran', HOLD: 'held', BLOCK: 'blocked', REVIEW: 'review' };
// Reading order of the four cells: a trace only, a with slice, b trace only, b with slice.
const COLUMNS = [
  { side: 'a', runs: 'off', head: 'a \u00B7 Trace only' },
  { side: 'a', runs: 'on', head: 'a \u00B7 With slice' },
  { side: 'b', runs: 'off', head: 'b \u00B7 Trace only' },
  { side: 'b', runs: 'on', head: 'b \u00B7 With slice' },
];
const HEADER_TIP = '<b>a</b> = normal context, <b>b</b> = risky context: the same tool is called in both, only the facts '
  + 'the slice describes differ.<br>Icons: \u2713 ran \u00B7 \u23F8 hold \u00B7 \u26D4 block \u00B7 \u25D4 review.';
const ARROW = '<span class="rt-fgrid-arrow" aria-hidden="true">\u2192</span>';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The order of decisions and tools in a cell — two cells match when the run reached the same calls with the same result. */
const seqKey = calls => (Array.isArray(calls) ? calls : []).map(c => `${c?.tool}:${c?.decision}`).join('\u2192');

const glyphOf = c => GLYPH[c?.decision] ?? (c?.stopped ? GLYPH.BLOCK : GLYPH.ALLOW);
const kindOf = c => KIND[c?.decision] ?? (c?.stopped ? 'blocked' : 'ran');

/** The ⓘ body for one call: the rule id and the engine's reason, or "no rule fired". Data is escaped first. */
function why(c, cellId) {
  const head = `<b>${esc(cellId)}</b> <span class="mono">${esc(c?.tool)}</span>`;
  return c?.rules?.length
    ? `${head}<br><span class="mono">${esc(c.rules.join(', '))}</span>: ${esc((c.reasons ?? []).join('; '))}`
    : `${head}<br>no rule fired; the call was allowed to run.`;
}

function callHtml(c, cellId, tip) {
  const label = `${c?.tool ?? ''}: ${c?.decision ?? ''}`;
  return `<span class="rt-fgrid-call rt-chip" data-kind="${kindOf(c)}" data-rt-fgrid-call role="img" `
    + `aria-label="${esc(label)}">${glyphOf(c)}</span>${tip(why(c, cellId))}`;
}

function cellHtml(row, col, tip, index) {
  const side = row?.[col.side] ?? {};
  const calls = Array.isArray(side[col.runs]) ? side[col.runs] : [];
  const seq = calls.map(c => `<span class="rt-fgrid-step">${callHtml(c, side.id, tip)}</span>`).join(ARROW)
    || '<span class="rt-fgrid-step rt-fgrid-empty">\u2014</span>';
  return `<div class="rt-fgrid-cell" role="cell" aria-colindex="${index + 2}">
      <span class="rt-fgrid-cap">${esc(col.head)}</span>
      <span class="rt-fgrid-seq">${seq}</span>
    </div>`;
}

function rowHtml(row, index, tip) {
  const differs = seqKey(row?.b?.off) !== seqKey(row?.b?.on);
  const cells = COLUMNS.map((col, i) => cellHtml(row, col, tip, i)).join('');
  return `<div class="rt-fgrid-row${differs ? ' rt-fgrid-differs' : ''}" role="row" data-rt-fgrid-row="${esc(row?.key)}"
      style="--rt-fgrid-i:${index}">
    <div class="rt-fgrid-label" role="rowheader" aria-colindex="1">
      <span class="rt-fgrid-key mono">${esc(row?.key)}</span>
      <span class="rt-fgrid-name">${esc(row?.label)}</span>${differs ? '<span class="rt-fgrid-flag">differs</span>' : ''}
      <span class="rt-fgrid-agent mono">${esc(row?.agent)}</span>
    </div>
    ${cells}
    <div class="rt-fgrid-playcell" role="cell" aria-colindex="6">
      <button type="button" class="rt-fgrid-btn" data-rt-fgrid-play="${esc(row?.play)}"
        aria-label="Play ${esc(row?.play)} in the Scenarios tab">\u25B6</button>
    </div>
  </div>`;
}

function rootHtml(model, { tip, reducedMotion }) {
  const rows = Array.isArray(model?.matrix) ? model.matrix : [];
  const head = `<div class="rt-fgrid-head" role="row">
      <span class="rt-fgrid-hcell" role="columnheader" aria-colindex="1">Scenario</span>
      ${COLUMNS.map((c, i) => `<span class="rt-fgrid-hcell" role="columnheader" aria-colindex="${i + 2}">${esc(c.head)}</span>`).join('\n      ')}
      <span class="rt-fgrid-hcell" role="columnheader" aria-colindex="6">Play</span>
    </div>`;
  return `<section class="card rt-fgrid${reducedMotion ? '' : ' rt-fgrid-animate'}" data-rt-fgrid>
    <h3>Every scenario, with and without the slice <span class="rt-chip" data-kind="sim">Computed by the engine</span>${tip(HEADER_TIP)}</h3>
    <p class="rt-plain">${rows.length} scripted traces, each run four ways. \u25B6 runs the risky one in the Scenarios tab.</p>
    <div class="rt-fgrid-table" role="table" aria-label="Every scenario, with and without the slice">
      ${head}
      ${rows.map((r, i) => rowHtml(r, i, tip)).join('\n      ')}
    </div>
    <p class="rt-plain rt-fgrid-note">Decisions computed at page load by the vendored simulated engine from scripted traces; not measurements.</p>
  </section>`;
}

/**
 * Mount block E into `el`. `model` is fleetModel(); `opts.tip` builds the site's ⓘ markup, `opts.run(id)` plays a row,
 * `opts.reducedMotion` skips the (sub-second) entrance so the block opens at its end state.
 * @returns {{ destroy(): void }}
 */
export function mountGrid(el, model, opts = {}) {
  if (!el) return { destroy() {} };
  const tip = typeof opts.tip === 'function' ? opts.tip : () => '';
  const run = typeof opts.run === 'function' ? opts.run : null;
  el.innerHTML = rootHtml(model, { tip, reducedMotion: !!opts.reducedMotion });
  // One listener for every ▶ in the block: play the row's own id in the Scenarios tab (the host owns that run).
  const onClick = event => {
    const btn = event.target?.closest?.('[data-rt-fgrid-play]');
    if (!btn || !el.contains(btn)) return;
    run?.(btn.getAttribute('data-rt-fgrid-play'));
  };
  el.addEventListener('click', onClick);
  return {
    destroy() {
      el.removeEventListener('click', onClick);
      el.innerHTML = '';
    },
  };
}
