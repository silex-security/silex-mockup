// Fleet ontology graph: logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, Contract C.
// Fixed layout, independent of animation and panel visibility.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const words = value => String(value).toLowerCase().replaceAll('_', ' ');
let libraryPromise;
let graphNumber = 0;

/** Share one request; a failed request can be retried. */
export function loadD3() {
  if (window.d3) return Promise.resolve(window.d3);
  if (!libraryPromise) {
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'swm/vendor/d3.v7.min.js';
      script.onload = () => {
        if (window.d3) resolve(window.d3);
        else { script.remove(); reject(new Error('Graph library unavailable')); }
      };
      script.onerror = () => { script.remove(); reject(new Error('Graph library unavailable')); };
      document.head.appendChild(script);
    }).catch(error => { libraryPromise = null; throw error; });
  }
  return libraryPromise;
}
export default loadD3;

export function mountOntoGraph(el, model, opts = {}) {
  const markerId = 'rt-og-arrow-' + ++graphNumber;
  const tip = opts.tip ?? (() => '');
  let currentMode = 'schema', currentRule = '', anchors = true, subclass = true;
  let currentTrace = model.traces.find(t => t.id === 'X1Bb') ?? model.traces[0];
  let currentCall = currentTrace?.calls.find(c => c.index === currentTrace.deciding) ?? currentTrace?.calls.at(-1);
  let selected = null, d3 = null, pending = null;
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const fileRow = f => `<tr data-graph-file="${esc(f.path)}"><td data-label="File"><a href="${esc(f.path)}">${esc(f.path)}</a></td><td data-label="Size">${f.bytes == null ? '—' : esc(f.bytes + ' bytes')}</td><td data-label="What it holds">${esc(f.holds)}</td><td data-label="Where used">${esc(f.usedBy)}</td></tr>`;
  const fileTable = files => `<div class="rt-og-table-wrap"><table><thead><tr><th>File</th><th>Size</th><th>What it holds</th><th>Where used</th></tr></thead><tbody>${files.map(fileRow).join('')}</tbody></table></div>`;
  const filesMarkup = model.files.groups.map(group => {
    const files = model.files.files.filter(f => f.group === group.id);
    let content;
    if (group.id === 'experiments') {
      content = Object.entries(model.files.folders).map(([dir, description]) => {
        const folderPath = 'swm/experiments/ontology-value' + (dir === '.' ? '' : '/' + dir);
        const rows = files.filter(f => f.path.slice(0, f.path.lastIndexOf('/')) === folderPath);
        return `<details data-graph-folder="${esc(dir)}"><summary>${esc(dir)} · ${rows.length} files</summary><p>${esc(description)}</p>${fileTable(rows)}</details>`;
      }).join('');
    } else content = fileTable(files);
    return `<section><h4>${esc(group.title)} · ${files.length} files</h4><p>${esc(group.about)}</p>${content}</section>`;
  }).join('');

  el.innerHTML = `<section class="rt-og card">
    <h2>Graph &amp; files</h2>
    <p class="rt-og-grade" data-onto-fleet-grade>Simulated engine · fictional tenant · candidate pack, outside the coverage figures. Not the measured result in the first sub-tabs.</p>
    <div class="rt-og-controls">
      <div role="group" aria-label="Graph mode"><button type="button" class="btn secondary" data-graph-mode="schema">Schema</button> <button type="button" class="btn secondary" data-graph-mode="facts">Call facts</button></div>
      <label data-graph-schema-control><input type="checkbox" data-graph-anchors checked> L1 anchors</label>
      <label data-graph-schema-control><input type="checkbox" data-graph-subclass checked> Subclass links</label>
      <label data-graph-schema-control>Rule <select data-graph-rule>${option('', 'All predicates')}${model.rules.map(r => option(r.id, r.id + ' · ' + r.effect)).join('')}</select></label>
      <label data-graph-facts-control hidden>Trace <select data-graph-trace>${model.traces.map(t => option(t.id, t.id + ' · ' + t.title)).join('')}</select></label>
      <label data-graph-facts-control hidden>Call <select data-graph-call></select></label>
    </div>
    <div class="rt-og-predicates" aria-label="Pack predicates">${model.predicates.map(p => `<span data-graph-pred="${esc(p.id)}" data-kind="${esc(p.kind)}" data-hi="false" data-complete="false">${esc(p.id)} <small>${esc(p.kind)}</small>${tip(esc(p.domain.join(', ') + ' → ' + p.range.join(', ')))}</span>`).join('')}</div>
    <p class="rt-og-caption" data-graph-caption aria-live="polite"></p>
    <div class="rt-og-columns"><div class="rt-og-stage" tabindex="0" role="region" aria-label="Ontology graph; scroll horizontally to see all nodes"><div data-graph-status role="status">Open the graph to load its layout.</div><p data-graph-empty role="status" hidden>No declared facts for this call</p><svg data-graph-svg viewBox="0 0 1000 700" role="group" aria-label="Ontology relation graph"></svg></div>
      <aside data-graph-inspector aria-label="Selected node">Select a node to inspect its relations.</aside></div>
    <div class="rt-og-legend"><span>Declared — solid</span><span>Observed – – dashed</span><span>Inferred ··· dotted</span><span>Circles: class, action, team, anchor or instance</span><span>Boxes: attributes or literals</span><span>Blue: read by the rule / used by the call</span><span>Amber: declared complete</span><span>Notation adapted from VOWL</span><span>Scroll or pinch to zoom · drag to pan · Enter to inspect</span></div>
    <p class="rt-og-limits" data-onto-fleet-limits>The chain comes from declared typed facts, not from linking traces at runtime. Each check is evaluated on its own. In a real run, the hold at the first step means the later calls never happen.</p>
    <details data-graph-table><summary>Show as table</summary><div class="rt-og-table-wrap" data-graph-table-body></div></details>
    <section data-graph-files><h3>Ontology files · ${model.files.files.length}</h3>${filesMarkup}</section>
  </section>`;
  const root = el.querySelector('.rt-og');
  const svg = root.querySelector('svg');
  const inspector = root.querySelector('[data-graph-inspector]');
  const status = root.querySelector('[data-graph-status]');
  let resizeLabels = () => {};
  const labelObserver = new ResizeObserver(() => resizeLabels());
  labelObserver.observe(svg);
  const findRule = () => model.rules.find(r => r.id === currentRule);
  function data() {
    if (currentMode === 'facts') return {
      nodes: (currentCall?.facts.nodes ?? []).map(n => ({ ...n, role: n.literal ? 'literal' : 'instance' })),
      links: (currentCall?.facts.links ?? []).map(l => ({ ...l, role: 'relation' })),
    };
    const nodes = model.schema.nodes.filter(n => anchors || n.role !== 'anchor');
    const ids = new Set(nodes.map(n => n.id));
    return { nodes, links: model.schema.links.filter(l => ids.has(l.s) && ids.has(l.o) && (subclass || l.role !== 'subclass')) };
  }
  function flags(p) {
    const r = findRule();
    return { hi: currentMode === 'schema' && !!r?.predicates.includes(p), complete: currentMode === 'schema' && !!r?.complete.includes(p) };
  }
  function nodePredicate(n) { return model.schema.links.find(l => l.o === n.id && l.role === 'attribute')?.p; }
  function inspect() {
    const graph = data(), node = graph.nodes.find(n => n.id === selected);
    for (const e of svg.querySelectorAll('[data-graph-node]')) e.setAttribute('aria-pressed', String(e.dataset.graphNode === selected));
    if (!node) { selected = null; inspector.textContent = 'Select a node to inspect its relations.'; return; }
    const incoming = graph.links.filter(l => l.o === selected), outgoing = graph.links.filter(l => l.s === selected);
    const predicates = new Set([...incoming, ...outgoing].map(l => l.p));
    const superclass = model.schema.links.filter(l => l.s === selected && l.role === 'subclass').map(l => l.o);
    const related = model.rules.filter(r => [...r.predicates, ...r.complete].some(p => predicates.has(p)));
    const relations = ls => ls.length ? `<ul>${ls.map(l => `<li>${esc(l.s)} → ${esc(l.p)} → ${esc(l.o)}</li>`).join('')}</ul>` : '<p>None in this view</p>';
    inspector.innerHTML = `<h3>${esc(node.label)}</h3><dl><dt>Id</dt><dd>${esc(node.id)}</dd><dt>Kind</dt><dd>${esc(node.kind ?? node.cls ?? node.role)}</dd><dt>Role</dt><dd>${esc(node.role)}</dd><dt>Superclass</dt><dd>${esc(superclass.join(', ') || 'None in this view')}</dd></dl>
      <h4>Incoming relations</h4>${relations(incoming)}<h4>Outgoing relations</h4>${relations(outgoing.filter(l => l.role !== 'attribute'))}
      <h4>Attributes</h4>${relations(outgoing.filter(l => l.role === 'attribute' || graph.nodes.find(n => n.id === l.o)?.literal))}
      <h4>Rules reading these predicates</h4><p>${esc(related.map(r => r.id).join(', ') || 'None')}</p>
      ${node.role === 'anchor' && node.wm ? `<button type="button" class="btn secondary" data-graph-wm data-wm-route="${esc(node.wm)}">Open in the Enterprise World Model →</button>` : ''}`;
  }
  function table(graph) {
    root.querySelector('[data-graph-table-body]').innerHTML = `<table><caption>${graph.nodes.length} nodes · ${graph.links.length} links</caption><thead><tr><th>Type</th><th>Id / source</th><th>Label / predicate</th><th>Kind / target</th><th>Grade / use</th></tr></thead><tbody>
      ${graph.nodes.map(n => `<tr data-graph-row="node"><td>${esc(n.role)}</td><td><button type="button" data-graph-select="${esc(n.id)}">${esc(n.id)}</button></td><td>${esc(n.label)}</td><td>${esc(n.kind ?? n.cls)}</td><td></td></tr>`).join('')}
      ${graph.links.map(l => `<tr data-graph-row="link"><td>${esc(l.role)}</td><td>${esc(l.s)}</td><td>${esc(l.p)}</td><td>${esc(l.o)}</td><td>${esc(l.grade ?? '—')}${l.used ? ' · used' : ''}</td></tr>`).join('')}</tbody></table>`;
  }
  function draw(graph) {
    if (!d3) return;
    const width = 1000, height = currentMode === 'schema' ? 1120 : 620;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const empty = graph.nodes.length === 0;
    root.querySelector('[data-graph-empty]').hidden = !empty;
    if (empty) {
      d3.select(svg).selectAll('*').remove();
      d3.select(svg).on('.zoom', null);
      svg.__zoom = d3.zoomIdentity;
      svg.dataset.edgeLabels = 'false';
      resizeLabels = () => {};
      return;
    }
    const ranks = {};
    const nodes = graph.nodes.map((n, i) => {
      const rank = ranks[n.role] ?? 0;
      ranks[n.role] = rank + 1;
      const regions = {
        anchor: [90, 130, 2], class: [460, 120, 3],
        action: [1010, 130, 2], team: [1010, 1090, 2], attribute: [90, 1190, 3],
      };
      const [left, top, columns] = regions[n.role] ?? [200, 170, 3];
      const tx = currentMode === 'schema' ? left + rank % columns * 172 : 500 + Math.cos(i * 2.39996) * 210;
      const ty = currentMode === 'schema' ? top + Math.floor(rank / columns) * 142 : 310 + Math.sin(i * 2.39996) * 170;
      const box = ['attribute', 'literal'].includes(n.role);
      return { ...n, x: tx, y: ty, tx, ty, box, radius: ['team', 'action'].includes(n.role) ? 27 : 24 };
    });
    const links = graph.links.map((l, i) => ({ ...l, source: l.s, target: l.o, key: i }));
    const simulation = d3.forceSimulation(nodes).randomSource(d3.randomLcg(7)).stop()
      .force('link', d3.forceLink(links).id(n => n.id)
        .distance(l => currentMode === 'facts' ? 230 : ({ subclass: 180, owned: 200, attribute: 155 }[l.role] ?? 190))
        .strength(currentMode === 'schema' ? .035 : .35))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('x', d3.forceX(n => n.tx).strength(currentMode === 'schema' ? .35 : .035))
      .force('y', d3.forceY(n => n.ty).strength(currentMode === 'schema' ? .35 : .035))
      .force('collide', d3.forceCollide(n => n.box ? 88 : 78).iterations(3));
    simulation.tick(360);
    simulation.stop();

    // Include the label block in the fit; node sizes stay in graph units in both modes.
    const minX = Math.min(...nodes.map(n => n.x - 92)), maxX = Math.max(...nodes.map(n => n.x + 92));
    const minY = Math.min(...nodes.map(n => n.y - 35)), maxY = Math.max(...nodes.map(n => n.y + 100));
    const fit = Math.min((width - 64) / (maxX - minX), (height - 64) / (maxY - minY), currentMode === 'facts' ? 1.15 : 1);
    const initial = d3.zoomIdentity.translate(width / 2 - (minX + maxX) / 2 * fit, height / 2 - (minY + maxY) / 2 * fit).scale(fit);
    const canvas = d3.select(svg);
    canvas.selectAll('*').remove();
    canvas.append('defs').append('marker').attr('id', markerId).attr('viewBox', '0 -5 10 10')
      .attr('refX', 9).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L9,0L0,4Z').attr('fill', 'var(--muted)');
    const layer = canvas.append('g').attr('class', 'rt-og-layer');
    const labelSize = () => {
      // Only typography reads the screen transform; layout and fit also work while hidden.
      for (const text of svg.querySelectorAll('[data-graph-node] text')) {
        const matrix = text.getScreenCTM();
        const screenScale = matrix && Math.hypot(matrix.a, matrix.b);
        text.style.fontSize = (innerWidth >= 900 && screenScale > 0 ? Math.max(20, 11.25 / screenScale) : 20) + 'px';
      }
    };
    const zoom = d3.zoom().extent([[0, 0], [width, height]]).scaleExtent([fit * .6, 5]).on('zoom', e => {
      layer.attr('transform', e.transform);
      svg.dataset.edgeLabels = String(e.transform.k > fit * 1.65);
      labelSize();
    });
    canvas.call(zoom);
    const paths = layer.append('g').selectAll('g').data(links).join('g')
      .attr('data-graph-link', l => l.key).attr('data-s', l => l.s).attr('data-o', l => l.o).attr('data-p', l => l.p).attr('data-role', l => l.role)
      .attr('data-grade', l => l.grade ?? '').attr('data-used', l => String(!!l.used))
      .attr('data-hi', l => String(flags(l.p).hi)).attr('data-complete', l => String(flags(l.p).complete))
      .attr('tabindex', 0).attr('aria-label', l => l.s + ' → ' + l.p + ' → ' + l.o);
    const edgeEnd = (node, toward) => {
      const dx = toward.x - node.x, dy = toward.y - node.y;
      const distance = Math.hypot(dx, dy) || 1;
      const inset = node.box ? Math.min(77 / (Math.abs(dx) / distance || 1e-9), 29 / (Math.abs(dy) / distance || 1e-9)) : node.radius + 3;
      return { x: node.x + dx / distance * inset, y: node.y + dy / distance * inset };
    };
    paths.append('line').attr('x1', l => edgeEnd(l.source, l.target).x).attr('y1', l => edgeEnd(l.source, l.target).y)
      .attr('x2', l => edgeEnd(l.target, l.source).x).attr('y2', l => edgeEnd(l.target, l.source).y)
      .attr('marker-end', 'url(#' + markerId + ')');
    paths.append('text').attr('x', l => (l.source.x + l.target.x) / 2).attr('y', l => (l.source.y + l.target.y) / 2 - 6).text(l => words(l.p));
    paths.append('title').text(l => l.s + ' → ' + l.p + ' → ' + l.o);
    const groups = layer.append('g').selectAll('g').data(nodes).join('g').attr('data-graph-node', n => n.id).attr('data-role', n => n.role)
      .attr('data-hi', n => String(n.role === 'attribute' && flags(nodePredicate(n)).hi))
      .attr('transform', n => `translate(${n.x.toFixed(3)},${n.y.toFixed(3)})`)
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', n => n.label + ', ' + (n.cls ?? n.kind ?? n.role))
      .on('click', (e, n) => select(n.id)).on('keydown', (e, n) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); }
      });
    const wrap = label => {
      const words = String(label).replaceAll('_', ' ').replaceAll(':', ': ').split(/\s+/), lines = [];
      for (const word of words) {
        const last = lines.at(-1);
        if (last && last.length + word.length < 16) lines[lines.length - 1] += ' ' + word;
        else lines.push(word.length > 18 ? word.slice(0, 16) + '…' : word);
      }
      return lines.length > 3 ? [...lines.slice(0, 2), lines[2].slice(0, 14) + '…'] : lines;
    };
    groups.each(function(n) {
      const group = d3.select(this);
      if (n.box) group.append('rect').attr('x', -75).attr('y', -27).attr('width', 150).attr('height', 54).attr('rx', 4);
      else group.append('circle').attr('r', n.radius);
      const label = group.append('text').attr('class', 'rt-og-node-label').attr('text-anchor', 'middle');
      const lines = wrap(n.label);
      lines.forEach((line, i) => label.append('tspan').attr('x', 0).attr('y', n.box ? 7 + (i - (lines.length - 1) / 2) * 23 : 51 + i * 23).text(line));
      if (n.cls) group.append('text').attr('class', 'rt-og-class').attr('text-anchor', 'middle')
        .attr('y', 51 + wrap(n.label).length * 23).text(n.cls.replace('pack:', ''));
      group.append('title').text(n.id + ': ' + n.label + (n.cls ? ' · ' + n.cls : ''));
    });
    canvas.call(zoom.transform, initial);
    labelSize();
    // A panel can become visible or resize after ensure() has drawn its fixed layout.
    resizeLabels = labelSize;
    inspect();
  }
  function render() {
    const graph = data();
    svg.dataset.mode = currentMode;
    root.querySelectorAll('[data-graph-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.graphMode === currentMode)));
    root.querySelectorAll('[data-graph-schema-control]').forEach(e => { e.hidden = currentMode !== 'schema'; });
    root.querySelectorAll('[data-graph-facts-control]').forEach(e => { e.hidden = currentMode !== 'facts'; });
    root.querySelector('[data-graph-rule]').value = currentRule;
    root.querySelector('[data-graph-trace]').value = currentTrace?.id ?? '';
    root.querySelector('[data-graph-call]').innerHTML = (currentTrace?.calls ?? []).map(c => option(c.index, 'Call ' + (c.index + 1) + ' · ' + c.tool)).join('');
    root.querySelector('[data-graph-call]').value = currentCall?.index ?? '';
    for (const chip of root.querySelectorAll('[data-graph-pred]')) {
      const f = flags(chip.dataset.graphPred);
      chip.dataset.hi = String(f.hi); chip.dataset.complete = String(f.complete);
    }
    const decision = d => d.decision + (d.rules.length ? ' (' + d.rules.join(', ') + ')' : '');
    root.querySelector('[data-graph-caption]').textContent = currentMode === 'schema'
      ? `${graph.nodes.length} nodes · ${graph.links.length} links · ${currentRule || 'All pack predicates'}`
      : `${currentTrace.id} · call ${currentCall.index + 1} · ${currentCall.tool} · as of ${currentCall.as_of} · with the slice: ${decision(currentCall.on)} · trace only: ${decision(currentCall.off)}`;
    table(graph); draw(graph); inspect();
  }
  function ensure() {
    if (d3) return Promise.resolve();
    if (pending) return pending;
    status.textContent = 'Loading graph…';
    pending = Promise.resolve().then(() => (opts.loadD3 ?? loadD3)()).then(library => {
      d3 = library; status.hidden = true;
      try { render(); } catch (error) {
        console.error(error);
        status.hidden = false;
        status.textContent = 'The graph could not be drawn.';
      }
    }, () => {
      status.hidden = false;
      status.innerHTML = 'Could not load the graph library <button type="button" class="btn secondary" data-graph-retry>Retry</button>';
    }).finally(() => { pending = null; });
    return pending;
  }
  function mode(value) { if (['schema', 'facts'].includes(value)) { currentMode = value; selected = null; render(); } }
  function rule(id) { currentRule = model.rules.some(r => r.id === id) ? id : ''; render(); }
  function trace(id, call) {
    const next = model.traces.find(t => t.id === id);
    if (!next) return;
    const nextCall = next.calls.find(c => c.index === (call == null ? next.deciding : Number(call))) ?? next.calls.at(-1);
    currentTrace = next; currentCall = nextCall; selected = null; render();
  }
  function select(id) { selected = data().nodes.some(n => n.id === id) ? id : null; inspect(); }
  root.addEventListener('click', e => {
    const modeButton = e.target.closest('[data-graph-mode]'), row = e.target.closest('[data-graph-select]');
    if (modeButton) mode(modeButton.dataset.graphMode);
    if (row) select(row.dataset.graphSelect);
    if (e.target.closest('[data-graph-retry]')) ensure();
  });
  root.addEventListener('change', e => {
    if (e.target.matches('[data-graph-anchors]')) { anchors = e.target.checked; render(); }
    if (e.target.matches('[data-graph-subclass]')) { subclass = e.target.checked; render(); }
    if (e.target.matches('[data-graph-rule]')) rule(e.target.value);
    if (e.target.matches('[data-graph-trace]')) trace(e.target.value);
    if (e.target.matches('[data-graph-call]')) trace(currentTrace.id, Number(e.target.value));
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') select(null); });
  render();
  return { ensure, play() {}, pause() {}, mode, rule, trace, select };
}
