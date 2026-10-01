/* System Validation → Runtime tab (logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md §1, §5).
   - Fills the reference metrics and scenario chips from js/jev-runtime-model.js (the vendored simulated engine).
   - Owns the iframe with the vendored demo (jev-runtime/demo/), loaded on the first visit to the tab.
   - Run: animates the six steps, then injects the scenario into the frame and describes that run from the
     envelopes the frame returned. Latest request wins: every asynchronous step checks its request token. */
import { summarize, describeRun } from './jev-runtime-model.js';

const DEMO = 'jev-runtime/demo/index.html';
const BACK = '../../index.html#view=long-term&tab=runtime';     // relative to the demo page
const READY_MS = 10000;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let summary = null, frame = null, frameDomain = null, token = 0, cancelPrevious = null;

function renderReference() {
  try { summary = summarize(); } catch (e) {
    $('rtScenarios').innerHTML = `<p class="rt-ref">The simulated engine did not load: ${esc(e.message)}</p>`; return;
  }
  for (const [k, v] of Object.entries(summary.metrics)) {
    const el = document.querySelector(`#rtMetrics [data-rt-metric="${k}"] .metric-value`); if (el) el.textContent = String(v);
  }
  $('rtReference').textContent = `Reference figures: ${summary.reference}. Policy Studio edits inside the demo below change the demo, not these figures.`;
  const group = (domain, label) => `<div><h3>${esc(label)}</h3>${summary.scenarios.filter(x => x.domain === domain).map(x =>
    `<div class="rt-row" data-rt-scenario="${esc(x.id)}"><span class="rt-id">${esc(x.id)}</span><span class="rt-title" title="${esc(x.title)}">${esc(x.title)}</span>
      <span class="rt-chip" data-rt-outcome data-kind="${esc(x.outcome.kind)}" title="Default-policy reference outcome">${esc(x.outcome.label)}</span>
      <button type="button" class="btn secondary" data-rt-run="${esc(x.id)}">Run</button></div>`).join('')}</div>`;
  $('rtScenarios').innerHTML = group('ap', 'AP payments agent') + group('soc', 'SOC triage agent');
}

const demoWin = () => { try { return frame?.contentWindow ?? null; } catch { return null; } };
const demoReady = () => { const w = demoWin(); try { return w?.__jevDemo?.ready ? w.__jevDemo : null; } catch { return null; } };

function loadFrame(domain, autoplay) {
  const wrap = $('rtFrameWrap');
  if (!frame) { frame = document.createElement('iframe'); frame.id = 'rtFrame'; frame.title = 'Jev runtime demo (simulated)'; wrap.textContent = ''; wrap.appendChild(frame); }
  frameDomain = domain;
  frame.src = `${DEMO}?embed=1&domain=${domain}&autoplay=${autoplay ? 1 : 0}`;
}

/* Resolves with the demo's API once the frame shows `domain`; rejects after READY_MS. */
function frameOn(domain, isCurrent) {
  const d = demoReady();
  if (d && d.domain === domain) return Promise.resolve(d);
  if (!(frame && !d && frameDomain === domain)) loadFrame(domain, false);   // a frame still loading this agent is awaited, not reloaded
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (!isCurrent()) return reject(new Error('stale'));
      const r = demoReady();
      if (r && r.domain === domain) return resolve(r);
      if (Date.now() - t0 > READY_MS) return reject(new Error('timeout'));
      setTimeout(poll, 100);
    };
    poll();
  });
}

function setResult(text, ok) {
  const r = $('rtResult');
  r.textContent = text;
  r.className = `decision-state ${ok ? 'approved' : 'rejected'} show`;
}

async function run(id) {
  const sc = summary?.scenarios.find(x => x.id === id); if (!sc) return null;
  const mine = ++token, isCurrent = () => mine === token;
  // A newer Run cancels this one at once. Its guarded step animation stops without calling onDone, so waiting on it
  // alone would never settle and would leave this Run's button disabled (code review / probe P2).
  cancelPrevious?.();
  let cancel; const cancelled = new Promise((_, rej) => { cancel = () => rej(new Error('stale')); });
  cancelled.catch(() => {});
  cancelPrevious = cancel;
  const btn = document.querySelector(`[data-rt-run="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }
  const status = $('rtStatus'); status.textContent = 'Running'; status.className = 'status running'; status.style.cssText = '';
  $('rtResult').className = 'decision-state';
  try {
    const animated = new Promise(res => window.__siteRunSteps($('rtSteps'), { ms: 260, isCurrent, onDone: res }));
    const ready = frameOn(sc.domain, isCurrent);
    const [, demo] = await Promise.race([Promise.all([animated, ready]), cancelled]);
    if (!isCurrent()) return null;
    const envs = demo.inject(id);
    const line = describeRun(envs, { id });
    setResult(line, true);
    status.textContent = 'Complete'; status.className = 'status'; status.style.cssText = 'background:var(--green-bg);color:var(--green)';
    $('rtFrameWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return line;
  } catch (e) {
    if (!isCurrent() || e.message === 'stale') return null;
    setResult('The simulated demo did not load; open it full page.', false);
    status.textContent = 'Error'; status.className = 'status blocked'; status.style.cssText = '';
    return null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Run'; }
    if (cancelPrevious === cancel) cancelPrevious = null;
  }
}

function shown() {
  if (!frame) loadFrame('ap', true);
}

$('rtScenarios').addEventListener('click', e => { const b = e.target.closest('[data-rt-run]'); if (b && !b.disabled) run(b.dataset.rtRun); });
// Open full page: the frame's current agent and seed, no embed, and a back link to this tab.
$('rtOpenFull').addEventListener('click', () => {
  const d = demoReady();
  const q = new URLSearchParams({ domain: d?.domain ?? frameDomain ?? 'ap' });
  if (d?.seed != null) q.set('seed', String(d.seed));
  q.set('back', BACK);
  $('rtOpenFull').href = `${DEMO}?${q}`;
});

renderReference();
window.__jevRuntimeShown = shown;
window.__jevRuntime = { ready: true, run, summary: () => summary };
if (!$('ltRuntime').hidden) shown();
