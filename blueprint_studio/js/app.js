/* Blueprint Studio app. Task 0: bootstrap — load a template (or the autosaved
   document), render it read-only. The full UI lands in Task 6. */
import { createStore, newDocument, revLabel } from './store.js';
import { createCanvas } from './canvas.js';

const $ = id => document.getElementById(id);
const storage = (() => { try { localStorage.setItem('bs.t', '1'); localStorage.removeItem('bs.t'); return localStorage; } catch { return null; } })();

export async function loadTemplate(name) {
  const res = await fetch(`templates/${name}.json`);
  if (!res.ok) throw new Error('Template not found: ' + name);
  return res.json();
}

const store = createStore({ storage });
const canvas = createCanvas({ wrap: $('canvasWrap'), viewport: $('viewport'), nodesEl: $('nodes'), edgesEl: $('edges') });

function renderAll() {
  const rev = store.active();
  $('docName').textContent = store.doc.name;
  $('revChip').textContent = `${revLabel(rev.rev)} · ${rev.status === 'draft' ? 'Draft' : 'Confirmed'}`;
  canvas.render(rev.graph);
}

async function boot() {
  if (!store.restore()) store.load(newDocument(await loadTemplate('customer-refund')));
  store.on(renderAll);
  renderAll();
  document.title = 'SILEX · Blueprint Studio · ' + store.doc.name;
  window.__bs = { store, canvas };
}
boot().catch(err => { console.error(err); $('toast').textContent = String(err.message || err); $('toast').className = 'toast show err'; });
