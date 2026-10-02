/* Runtime Observation view (logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md; built in logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md §1, §5).
   - Fills the reference metrics and scenario chips from js/jev-runtime-model.js (the vendored simulated engine).
   - Owns the iframe with the vendored demo (jev-runtime/demo/), loaded on the first visit to the tab.
   - Run: animates the six steps, then injects the scenario into the frame and describes that run from the
     envelopes the frame returned. Latest request wins: every asynchronous step checks its request token. */
import { summarize, describeRun } from './jev-runtime-model.js';

const DEMO = 'jev-runtime/demo/index.html';
const BACK = '../../index.html#view=runtime-observation';     // relative to the demo page
const READY_MS = 10000;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Foundation stub with the js/rt-pipeline.js API (plan §2.1); replaced by mountPipeline in task 3.
const pipeline = { idle() {}, replay: async () => 'done', skip() {}, stop() {}, reset() {}, error() {} };

let summary = null, frame = null, frameDomain = null, nav = 0, token = 0, cancelPrevious = null;

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
/* The frame's current document: which host navigation produced it (&nav=), and its demo API once ready. While a
   navigation is pending, contentWindow is still the outgoing document, so the nav marker tells the two apart. */
function frameDoc() {
  const w = demoWin();
  try {
    const n = new URLSearchParams(w.location.search).get('nav');
    const d = w.__jevDemo?.ready ? w.__jevDemo : null;
    return { nav: n, demo: d, domain: d?.domain ?? null };
  } catch { return { nav: null, demo: null, domain: null }; }
}
/* The demo API, only if the frame shows the latest navigation's document on `domain`. */
function currentDemo(domain) {
  const f = frameDoc();
  return f.nav === String(nav) && f.demo && f.domain === domain ? f.demo : null;
}

function loadFrame(domain, autoplay, tab = null) {
  const wrap = $('rtFrameWrap');
  if (!frame) {
    frame = document.createElement('iframe'); frame.id = 'rtFrame'; frame.title = 'Jev runtime demo (simulated)';
    frame.addEventListener('load', refreshOpenFull);
    wrap.textContent = ''; wrap.appendChild(frame);
  }
  frameDomain = domain;
  frame.src = `${DEMO}?embed=1&domain=${domain}&autoplay=${autoplay ? 1 : 0}&nav=${++nav}${tab ? `&tab=${tab}` : ''}`;   // a newer navigation replaces a pending one
}

/* Resolves with the demo's API once the frame shows `domain` from the latest navigation; rejects after READY_MS. */
function frameOn(domain, isCurrent) {
  const d = currentDemo(domain);
  if (d) return Promise.resolve(d);
  const f = frameDoc();
  // Await the pending navigation only if it targets this agent and the viewer has not switched the agent inside it.
  const awaitPending = frame && frameDomain === domain && !(f.nav === String(nav) && f.demo && f.domain !== domain);
  if (!awaitPending) loadFrame(domain, false);
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (!isCurrent()) return reject(new Error('stale'));
      const r = currentDemo(domain);
      if (r) return resolve(r);
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
    let demo = await Promise.race([frameOn(sc.domain, isCurrent), cancelled]);
    if (!isCurrent()) return null;
    // Re-check right before injecting: the frame may have navigated (or been switched to another agent) since.
    if (currentDemo(sc.domain) !== demo) demo = await Promise.race([frameOn(sc.domain, isCurrent), cancelled]);
    if (!isCurrent()) return null;
    const envs = demo.inject(id);
    refreshOpenFull();
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
// Open full page: the frame's current agent and seed, no embed, and a back link to this tab. The href is kept current
// (frame load, each Run, pointer/focus), so copying the link or opening it in a new tab gets the same target.
function refreshOpenFull() {
  const f = frameDoc();
  const q = new URLSearchParams({ domain: f.domain ?? frameDomain ?? 'ap' });
  if (f.demo?.seed != null) q.set('seed', String(f.demo.seed));
  try { const tab = new URL(f.nav === String(nav) ? demoWin().location.href : frame?.src ?? DEMO, location.href).searchParams.get('tab'); if (tab) q.set('tab', tab); } catch {}
  q.set('back', BACK);
  $('rtOpenFull').href = `${DEMO}?${q}`;
}
for (const ev of ['click', 'pointerenter', 'focus', 'contextmenu']) $('rtOpenFull').addEventListener(ev, refreshOpenFull);

async function renderLearningEvidence() {
  const root = $('rtLearningEvidence');
  try {
    const response = await fetch('jev-runtime/demo/data/learning-evidence.json');
    if (!response.ok) throw new Error('Evidence unavailable');
    const e = await response.json();
    const a = e.models['kev-0.8b'], b = e.models['kev-0.8b-ft'];
    const value = (path, digits = 2) => {
      const n = path.split('/').reduce((v, k) => v[k], e);
      return `<span data-evidence-value="${path}" data-digits="${digits}">${Number(n).toFixed(digits)}</span>`;
    };
    const pair = (family, metric, digits = 2) => ['kev-0.8b', 'kev-0.8b-ft'].map(m => value(`models/${m}/${family}/${metric}`, digits)).join(' → ');
    const label = 'measured on an open benchmark (AgentDojo held-out); benchmark labels, not yet customer reviewers';
    const tile = (title, number, context) => `<div class="card metric"><div class="kicker">${title}</div><div class="metric-value">${number}</div><div class="metric-foot">${context}</div><div class="metric-foot">${label}</div></div>`;
    root.innerHTML = `<div class="rt-learning-tiles">
      ${tile('goal_deviation recall', pair('goal_deviation', 'recall'), `At each model's own calibrated threshold (${value('models/kev-0.8b/goal_deviation/threshold')} released, ${value('models/kev-0.8b-ft/goal_deviation/threshold')} fine-tuned); false-positive rate ${pair('goal_deviation', 'fpr', 3)} (question-level, held-out ${esc(e.test.benchmark)}, n = ${value('test/items', 0)} test items).`)}
      ${tile('instruction_override AUROC', pair('instruction_override', 'auroc'), 'no fitted threshold')}
      ${tile('Local judge HTTP p50', pair('latency', 'p50_ms', 0) + ' ms', `similar local judge HTTP p50 in this run (n = ${value('models/kev-0.8b/latency/n', 0)} released, n = ${value('models/kev-0.8b-ft/latency/n', 0)} fine-tuned; ${esc(e.hardware)}).`)}
    </div>
    <section id="rtLearningGate" aria-labelledby="rtLearningGateTitle">
      <h3 id="rtLearningGateTitle">Would this gate promote it?</h3>
      ${Object.entries(e.gate).map(([id, g]) => {
        const detail = g.safetyOk
          ? `Fixed ${g.fixed} · Broke ${g.broke} · ${g.evidenceOk ? 'evidence check passed' : 'needs more evidence'}`
          : g.missed.after > g.missed.before
            ? `Safety check failed: more missed cases (${g.missed.before} → ${g.missed.after})`
            : `Safety check failed: more false alarms (${g.falseHolds.before} → ${g.falseHolds.after})`;
        return `<p data-evidence-gate="${esc(id)}">${esc(e.models[id].label)}: <span class="rt-chip" data-evidence-verdict data-kind="${g.verdict === 'KEEP' ? 'ran' : g.verdict === 'NEAR-MISS' ? 'review' : 'blocked'}">${esc(g.verdict)}</span> · ${esc(detail)}</p>`;
      }).join('')}
      <p class="rt-ref">Question-level errors at each model’s own threshold, on one benchmark split; a retrospective check, not gateway outcomes.</p>
    </section>
    <details><summary>Measured evidence details and caveats</summary>
      <p>${esc(a.label)} recall 95 % CI: ${a.goal_deviation.recall_ci.map((_, i) => value(`models/kev-0.8b/goal_deviation/recall_ci/${i}`, 3)).join('–')}; ${esc(b.label)}: ${b.goal_deviation.recall_ci.map((_, i) => value(`models/kev-0.8b-ft/goal_deviation/recall_ci/${i}`, 3)).join('–')}.</p>
      <p>Hardware: ${esc(e.hardware)}. Label provenance: ${e.label_provenance.map(esc).join(', ')}. Calibrations not activated.</p>
      <ul>${e.caveats.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p>Generated by ${esc(e.generated_by)}. Sources: ${Object.values(e.sources).map(esc).join('; ')}.</p>
    </details>`;
  } catch {
    root.innerHTML = '<p class="rt-ref">Measured benchmark evidence could not be loaded. Open the demo full page to try again.</p>';
  }
}

$('rtTryLoop').addEventListener('click', () => {
  // Cancels a Run in progress. Its stale path returns without settling the orchestration, so reset it here to Ready.
  const cancelling = !!cancelPrevious;
  ++token; cancelPrevious?.();
  if (cancelling) {
    const status = $('rtStatus'); status.textContent = 'Ready'; status.className = 'status running'; status.style.cssText = '';
    pipeline.reset();
    $('rtResult').className = 'decision-state';
  }
  const f = frameDoc();
  if (f.nav === String(nav) && f.demo) f.demo.openTab('learning');
  else loadFrame(frameDomain ?? 'ap', false, 'learning');
  refreshOpenFull();
  $('rtFrameWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

renderLearningEvidence();
renderReference();
refreshOpenFull();
window.__jevRuntimeShown = shown;
window.__jevRuntime = { ready: true, run, summary: () => summary };
// A cold #view=runtime-observation deep link shows the view before this deferred module runs; later visits go through showView.
if (document.getElementById('runtime-observation')?.classList.contains('active')) shown();
