// Ontology tab · Graph & files · The vision (logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, amendment v0.4/v0.5, task T5).
// A hand-drawn relation sketch of where Silex is heading, centred on one fleet action (Ad Buyer · launch paid campaign):
// ring 1 is that decision's own world, each node joined by a labelled typed relation; ring 2 is the rest of the
// enterprise, drawn faint. A node is "today" when it names a class or team of the candidate pack; a relation is "today"
// only when its (subject class, predicate, object class) triple is one of the pack's edges. Everything else is the
// vision and is drawn dashed. Switch A shows the call as a trace carries it (its real arguments, read from the engine's
// X1Bb span) or with the ontology's answers; switch B shows the whole enterprise or only this decision. Fixed
// coordinates in a viewBox: no d3, no layout, no numbers beyond the call's own arguments. Motion is CSS transitions
// only; under reduced motion the ontology view is set at mount. No DOM access at module top level.
import { scenarioById } from '../jev-runtime/demo/js/engine/scenarios.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const noTip = () => '';
export const GRADE = 'Where Silex is heading, not the current build. Nodes and relations marked today exist in the candidate pack; the rest are the vision. No figure here is a measurement.';
export const CAPTION = 'Not deleting the world; choosing the context this one step needs.';
export const SCENARIO = 'X1Bb';
const AUTO_MS = 1400;

// Geometry (SVG user units): hand-placed. Ring 1 round the centre, ring 2 along the left and right edges.
export const VIEW = { w: 1240, h: 720 };
const C = { x: 620, y: 360 };

/** Nodes: id, label (null: built in visionGraph from the engine's X1Bb call and the pack), type, the pack id it stands for (null for a vision-only node), ring and position. */
export const NODES = [
  { id: 'action', label: null, type: 'Reviewable action', pack: 'pack:ActionLaunchCampaign', ring: 0, at: [C.x, C.y] },
  { id: 'video', label: null, type: 'Video', pack: 'pack:Video', ring: 1, at: [620, 150] },
  { id: 'subject', label: 'A minor', type: 'Subject', pack: 'pack:Subject', ring: 1, at: [870, 95] },
  { id: 'purpose', label: 'Advertising', type: 'Purpose', pack: 'pack:Purpose', ring: 1, at: [980, 215] },
  { id: 'hotpool', label: 'Hot pool', type: 'Pool', pack: 'pack:Pool', ring: 1, at: [990, 335] },
  { id: 'adpool', label: 'Ad candidates', type: 'Pool', pack: 'pack:Pool', ring: 1, at: [960, 455] },
  { id: 'budget', label: 'Campaign budget', type: 'Budget', pack: 'pack:Budget', ring: 1, at: [860, 600] },
  { id: 'team', label: null, type: 'Team', pack: 'team:trust-safety', ring: 1, at: [620, 610] },
  { id: 'rule', label: 'No minors in ads', type: 'Hard rule', pack: null, ring: 1, at: [390, 600] },
  { id: 'person', label: 'Campaign manager', type: 'Person', pack: null, ring: 1, at: [270, 480] },
  { id: 'license', label: 'Track license', type: 'License', pack: 'pack:License', ring: 1, at: [230, 350] },
  { id: 'music', label: 'Music track', type: 'Asset', pack: 'pack:Asset', ring: 1, at: [290, 225] },
  { id: 'consent', label: 'Consent record', type: 'Consent record', pack: 'pack:ConsentRecord', ring: 1, at: [370, 95] },
  { id: 'supplier', label: 'Supplier payments', pack: null, ring: 2, at: [100, 90] },
  { id: 'soc', label: 'SOC triage', pack: null, ring: 2, at: [1150, 90] },
  { id: 'creators', label: 'Other creators', pack: 'pack:Creator', ring: 2, at: [1150, 215] },
  { id: 'campaigns', label: 'Other campaigns', pack: 'pack:ActionLaunchCampaign', ring: 2, at: [1150, 340] },
  { id: 'refunds', label: 'Refunds', pack: 'pack:ActionRefund', ring: 2, at: [1150, 560] },
  { id: 'access', label: 'Access requests', pack: null, ring: 2, at: [140, 630] },
  { id: 'contracts', label: 'Contracts', pack: null, ring: 2, at: [100, 480] },
  { id: 'onboarding', label: 'Onboarding', pack: null, ring: 2, at: [100, 350] },
  { id: 'payroll', label: 'Payroll', pack: null, ring: 2, at: [100, 220] },
];
/** Relations: subject, predicate, object. Whether one is "today" is decided against the pack, never typed here. */
export const EDGES = [
  ['action', 'USES', 'video'],
  ['video', 'FEATURES', 'subject'],
  ['purpose', 'EXCLUDES', 'subject'],
  ['hotpool', 'SYNCS_TO', 'adpool'],
  ['action', 'SELECTED_FROM', 'adpool'],
  ['action', 'CHARGES', 'budget'],
  ['action', 'OWNED_BY_TEAM', 'team'],
  ['rule', 'GATES', 'action'],
  ['person', 'DELEGATES_AUTHORITY', 'action'],
  ['music', 'LICENSED_UNDER', 'license'],
  ['video', 'DERIVED_FROM', 'music'],
  ['consent', 'COVERS', 'video'],
  ['supplier', 'RELATES_TO', 'consent'],
  ['soc', 'RELATES_TO', 'subject'],
  ['creators', 'RELATES_TO', 'purpose'],
  ['campaigns', 'RELATES_TO', 'hotpool'],
  ['refunds', 'RELATES_TO', 'budget'],
  ['access', 'RELATES_TO', 'rule'],
  ['contracts', 'RELATES_TO', 'person'],
  ['onboarding', 'RELATES_TO', 'license'],
  ['payroll', 'RELATES_TO', 'music'],
].map(([s, p, o]) => ({ s, p, o }));
// Trace only: the four things a bare call leaves open, each placed where its answer appears with the ontology.
const QUESTIONS = [
  { text: 'Who is in it?', at: [C.x + 150, C.y - 140] },
  { text: 'May it be used for ads?', at: [C.x + 175, C.y + 125] },
  { text: 'Which team reviews?', at: [C.x - 175, C.y + 125] },
  { text: 'Who allowed this?', at: [C.x - 150, C.y - 140] },
];
const STEPS = [
  { text: 'Fill in context', status: 'today', where: 'Agent fleet tab: each call carries its ontology slice' },
  { text: 'Narrow to this decision', status: 'vision' },
  { text: 'Hard rules for red lines, the judge for grey areas', status: 'today', where: 'Decision plane tab' },
  { text: 'People for the exceptions', status: 'vision' },
];

const typeLine = n => (n.type ? `${n.type}${n.status === 'today' ? ' · today' : ''}` : '');
const width = n => (n.ring === 0 ? 330 : Math.max(132, Math.round(Math.max(n.label.length, typeLine(n).length) * 8.4 + 30)));
const height = n => (n.ring === 0 ? 104 : n.ring === 1 ? 56 : 38);

/** Where the line between two boxes leaves the first and enters the second. */
function clip(a, b) {
  const [x1, y1] = a.at, [x2, y2] = b.at, dx = x2 - x1, dy = y2 - y1;
  const cut = n => Math.min(dx ? (width(n) / 2 + 3) / Math.abs(dx) : Infinity, dy ? (height(n) / 2 + 3) / Math.abs(dy) : Infinity);
  const ka = cut(a), kb = cut(b);
  return [x1 + dx * ka, y1 + dy * ka, x2 - dx * kb, y2 - dy * kb].map(v => Math.round(v * 10) / 10);
}

/** Statuses from the pack: a node is today if its pack id is a pack class or team; an edge if its triple is a pack edge. */
export function visionGraph(pack) {
  const ids = new Set([...(pack?.classes ?? []).map(c => c.id), ...(pack?.teams ?? []).map(t => t.id)]);
  const triples = new Set((pack?.edges ?? []).map(e => `${e.s}|${e.p}|${e.o}`));
  const packLabel = id => [...(pack?.classes ?? []), ...(pack?.teams ?? [])].find(x => x.id === id)?.label ?? null;
  const call = traceCall();
  const title = s => String(s).split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const actionLabel = packLabel('pack:ActionLaunchCampaign');
  const LABEL = {
    action: `${title(call.agent)} · ${actionLabel ? actionLabel.charAt(0).toLowerCase() + actionLabel.slice(1) : call.tool}`,
    video: `Video ${call.args.video_id ?? ''}`.trim(),
    team: packLabel('team:trust-safety') ?? 'Trust & Safety',
  };
  const nodes = NODES.map(n => ({ ...n, label: n.label ?? LABEL[n.id], status: n.pack && ids.has(n.pack) ? 'today' : 'vision' }));
  const by = new Map(nodes.map(n => [n.id, n]));
  const edges = EDGES.map(e => {
    const s = by.get(e.s), o = by.get(e.o);
    const today = s.status === 'today' && o.status === 'today' && triples.has(`${s.pack}|${e.p}|${o.pack}`);
    return { ...e, ring: Math.max(s.ring, o.ring), status: today ? 'today' : 'vision' };
  });
  return { nodes, edges };
}

/** The X1Bb launch call's tool, agent and arguments, as the engine's span carries them. */
export function traceCall() {
  const span = scenarioById(SCENARIO)?.spans.find(sp => sp.boundary === 'pre_tool' && sp.tool?.name === 'ads.launch_campaign');
  return { tool: span?.tool?.name ?? '', agent: span?.agent ?? '', args: { ...(span?.tool?.args ?? {}) } };
}

/** @returns {{ play(): void, pause(): void }} */
export function mountOntoVision(el, opts = {}) {
  const tip = opts.tip ?? noTip;
  const noop = { play() {}, pause() {} };
  if (!el) return noop;
  const { nodes, edges } = visionGraph(opts.pack);
  const by = new Map(nodes.map(n => [n.id, n]));
  const call = traceCall();
  const reduced = () => !!opts.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const edgeSvg = edges.map(e => {
    const s = by.get(e.s), o = by.get(e.o), [x1, y1, x2, y2] = clip(s, o);
    const label = e.ring === 2 ? '' : `<text class="rt-vz-elabel" x="${Math.round((x1 + x2) / 2)}" y="${Math.round((y1 + y2) / 2) - 5}" text-anchor="middle">${esc(e.p)}</text>`;
    return `<g class="rt-vz-edge" data-vision-edge data-s="${esc(e.s)}" data-o="${esc(e.o)}" data-p="${esc(e.p)}" data-status="${e.status}" data-ring="${e.ring}">
<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#rtVzArrow)"/>${label}</g>`;
  }).join('');

  const fields = Object.entries(call.args);
  const nodeSvg = nodes.map(n => {
    const w = width(n), h = height(n), [x, y] = n.at;
    const attrs = `class="rt-vz-node" data-vision-node="${esc(n.id)}" data-status="${n.status}" data-ring="${n.ring}"${n.status === 'today' ? ` data-pack-id="${esc(n.pack)}"` : ''} transform="translate(${x} ${y})"`;
    const box = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${n.ring === 0 ? 16 : 12}"/>`;
    if (n.ring === 0) {
      return `<g ${attrs}>${box}
<text class="rt-vz-ctitle" y="-22" text-anchor="middle">${esc(n.label)}</text>
<text class="rt-vz-mono" y="2" text-anchor="middle">${esc(call.tool)}</text>
<text class="rt-vz-mono rt-vz-fields" y="28" text-anchor="middle">${fields.map(([k, v], i) => `${i ? '<tspan> · </tspan>' : ''}<tspan data-vision-field="${esc(k)}">${esc(k)}: ${esc(v)}</tspan>`).join('')}</text></g>`;
    }
    if (n.ring === 2) return `<g ${attrs}>${box}<text class="rt-vz-r2" y="5" text-anchor="middle">${esc(n.label)}</text></g>`;
    return `<g ${attrs}>${box}<text class="rt-vz-label" y="-3" text-anchor="middle">${esc(n.label)}</text>
<text class="rt-vz-type" y="17" text-anchor="middle">${esc(typeLine(n))}</text></g>`;
  }).join('');

  const qSvg = QUESTIONS.map(q => {
    const w = q.text.length * 8.4 + 34;
    return `<g class="rt-vz-q" data-vision-question transform="translate(${q.at[0]} ${q.at[1]})"><rect x="${-w / 2}" y="-19" width="${w}" height="38" rx="19"/><text y="5" text-anchor="middle">${esc(q.text)}</text></g>`;
  }).join('');

  const aria = `Illustration: the action ${by.get('action').label}, with ${nodes.filter(n => n.ring === 1).map(n => n.label).join(', ')} around it, and the rest of the enterprise further out.`;
  el.innerHTML = `<section class="rt-vz" data-onto-vision data-view="trace" data-focus="all">
<div class="rt-vz-head">
<div><h3>The vision: one decision, in its own small world</h3>
<p class="rt-vz-grade" data-vision-grade><span class="rt-chip" data-kind="sim">Illustration</span> ${esc(GRADE)}</p></div>
<div class="rt-vz-switches">
<div class="rt-vz-switch" role="group" aria-label="What the decision sees" data-vision-switch="view">
<button type="button" data-vision-view="trace" aria-pressed="true">Trace only</button><button type="button" data-vision-view="onto" aria-pressed="false">With the ontology</button></div>
<div class="rt-vz-switch" role="group" aria-label="How much of the enterprise" data-vision-switch="focus">
<button type="button" data-vision-focus="all" aria-pressed="true">Whole enterprise</button><button type="button" data-vision-focus="local" aria-pressed="false">This decision</button></div>
</div></div>
<div class="rt-vz-scroll">
<svg class="rt-vz-svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" role="img" aria-label="${esc(aria)}">
<defs><marker id="rtVzArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z"/></marker></defs>
<g class="rt-vz-edges">${edgeSvg}</g><g class="rt-vz-nodes">${nodeSvg}</g><g class="rt-vz-qs">${qSvg}</g>
</svg></div>
<div class="rt-vz-foot">
<p class="rt-vz-status" data-vision-status></p>
<p class="rt-vz-caption" data-vision-caption>${esc(CAPTION)}</p>
<p class="rt-vz-legend"><span class="today">today: in the candidate pack</span><span class="vision">vision: not built yet</span>
<span class="far">the rest of the enterprise</span>${tip('A node is <b>today</b> when it names a class or team of the candidate Creator Platform Pack. A relation is today only when the pack declares that relation between those two classes; every other relation is the vision, even between two today nodes.')}</p>
</div>
<ol class="rt-vz-steps">${STEPS.map((s, i) => `<li data-vision-step="${i + 1}" data-status="${s.status}"><b>${i + 1}</b><span>${esc(s.text)}</span>
<small class="rt-vz-tag">${s.status === 'today' ? `today · simulated on this site${s.where ? ` — ${esc(s.where)}` : ''}` : 'vision'}</small></li>`).join('')}</ol>
</section>`;

  const root = el.firstElementChild;
  const statusEl = root.querySelector('[data-vision-status]');
  let timer = 0, played = false, chose = false;   // chose: the visitor picked a view by hand
  function set(kind, value) {
    root.dataset[kind] = value;
    for (const b of root.querySelectorAll(`[data-vision-${kind}]`)) if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.getAttribute(`data-vision-${kind}`) === value));
    statusEl.textContent = root.dataset.view === 'trace'
      ? 'Trace only: the call and the fields it carries. Four questions stay open.'
      : root.dataset.focus === 'local' ? 'With the ontology, narrowed to this decision: the rest of the enterprise steps back.' : 'With the ontology: typed relations answer the four questions; the dashed ones are not built yet.';
  }
  const stop = () => { clearTimeout(timer); timer = 0; };
  const onClick = e => {
    const b = e.target.closest('button[data-vision-view], button[data-vision-focus]');
    if (!b || !root.contains(b)) return;
    if (b.dataset.visionView) { stop(); played = true; chose = true; set('view', b.dataset.visionView); } else set('focus', b.dataset.visionFocus);
  };
  root.addEventListener('click', onClick);
  // On a narrow screen the sketch scrolls inside its card; the first time it is on screen, centre it on the action.
  const scroller = root.querySelector('.rt-vz-scroll');
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver(entries => {
      if (!entries.some(x => x.isIntersecting)) return;
      io.disconnect();
      scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
    });
    io.observe(scroller);
  }
  set('view', reduced() ? 'onto' : 'trace');
  if (reduced()) played = true;
  return {
    /** First show: switch once from the trace to the ontology view. */
    play() {
      if (played) return;
      if (reduced()) { played = true; set('view', 'onto'); return; }
      stop();
      timer = setTimeout(() => { timer = 0; played = true; set('view', 'onto'); }, AUTO_MS);
    },
    /** Leaving before the automatic switch settles it, so a return never finds the trace view it was about to leave. */
    pause() {
      if (!timer) return;
      stop(); played = true;
      if (!chose) set('view', 'onto');
    },
  };
}
