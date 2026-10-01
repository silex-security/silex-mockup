/* Studio ↔ site bridge (cutover plan logs/2026-09-24_STUDIO_CUTOVER_PLAN.md v0.4;
   contract js/STUDIO_BRIDGE_CONTRACT.md). Pure logic (usable in browser and node)
   plus DOM renderers that build everything with createElement/textContent — never
   innerHTML — and emit the data-* hooks the site probes read. The summary is
   derived, never authoritative: the host only projects fresh documents, and every
   rendered number is labelled 'simulated · declared adversary model · scenario set <id>'. */

export const SUMMARY_KEY = 'bs.summary.v1';
export const DOC_PREFIX = 'bs.doc.';
export const REG_PREFIX = 'bs.reg.';

const SIM = 'simulated · declared adversary model';

/* 32-bit FNV-1a over UTF-16 code units, 8 hex chars — identical to
   blueprint_studio/web/src/state/summary.js. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------- storage */
function storageKeys(storage) {
  const out = [];
  if (!storage) return out;
  if (typeof storage.length === 'number' && typeof storage.key === 'function') { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k != null) out.push(k); } }
  else if (typeof storage.keys === 'function') out.push(...storage.keys());
  return out;
}
const getRaw = (storage, k) => (storage ? storage.getItem(k) : null);

/* --------------------------------------------------------------- schema check */
const isStr = v => typeof v === 'string';
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isInt = v => Number.isInteger(v);
const isHash = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const optStr = v => v == null || typeof v === 'string';
const optInt = v => v == null || Number.isInteger(v);
/* a metric is either null/absent, or {num,den} finite with num <= den */
function metricOk(m) {
  if (m == null) return true;
  if (typeof m !== 'object' || Array.isArray(m)) return false;
  return isNum(m.num) && isNum(m.den) && m.num <= m.den;
}
function metricsOk(m) {
  if (m == null) return true;
  if (typeof m !== 'object') return false;
  return metricOk(m.residualReachability) && metricOk(m.benignCompletion) && metricOk(m.friction);
}
function scorecardOk(sc) {
  if (sc == null) return true;
  if (typeof sc !== 'object') return false;
  return metricOk(sc.violationsClosed) && metricOk(sc.residualReachability) && metricOk(sc.benignCompletion) && metricOk(sc.friction)
    && (sc.addedLatencyMedian == null || isNum(sc.addedLatencyMedian)) && (sc.patchOps == null || isNum(sc.patchOps));
}
function revOk(r) {
  if (!r || typeof r !== 'object') return false;
  if (!isInt(r.rev) || r.rev < 0 || !isStr(r.label)) return false;
  if (r.hash != null && !isHash(r.hash)) return false;
  if (r.optimization != null && (typeof r.optimization !== 'object' || !optStr(r.optimization.scenarioSetId))) return false;
  if (r.awaiting != null && r.awaiting !== 'approve' && r.awaiting !== 'accept') return false;
  if (r.validation != null) {
    const v = r.validation;
    if (typeof v !== 'object' || !isStr(v.scenarioSetId) || !isNum(v.runs) || !Array.isArray(v.findings) || !metricsOk(v.metrics)) return false;
    if (!v.findings.every(f => f && typeof f === 'object' && isStr(f.id))) return false;
  }
  if (r.recommended != null) {
    const rec = r.recommended;
    if (typeof rec !== 'object' || !isStr(rec.id) || !isStr(rec.label) || !scorecardOk(rec.scorecard)) return false;
  }
  if (r.decision != null) {
    const d = r.decision;
    if (typeof d !== 'object' || (d.action !== 'approve' && d.action !== 'accept')) return false;
    if (!optStr(d.candidateId) || !optStr(d.label) || !optInt(d.childRev) || !optStr(d.childLabel) || !(d.childHash == null || isHash(d.childHash)) || !optStr(d.scenarioSetId)) return false;
    if (d.scorecard != null && !scorecardOk(d.scorecard)) return false;
    if (d.metrics != null && !metricsOk(d.metrics)) return false;
  }
  return true;
}
function docOk(d) {
  if (!d || typeof d !== 'object') return false;
  if (!isStr(d.docId) || !d.docId) return false;
  if (!optStr(d.name) || !optStr(d.domain) || !optStr(d.owner)) return false;
  if (!isStr(d.fp) || !/^[0-9a-f]{8}$/.test(d.fp)) return false;
  if (!Array.isArray(d.revs) || !d.revs.every(revOk)) return false;
  return true;
}

/* readSummary(storage) -> { ok, summary } | { ok, reason }. Schema check per plan §2.3. */
export function readSummary(storage) {
  const raw = getRaw(storage, SUMMARY_KEY);
  if (raw == null) return { ok: false, reason: 'no summary' };
  let s;
  try { s = JSON.parse(raw); } catch { return { ok: false, reason: 'summary is not JSON' }; }
  if (!s || typeof s !== 'object') return { ok: false, reason: 'summary is not an object' };
  if (s.v !== 1) return { ok: false, reason: 'unknown summary version' };
  if (!Array.isArray(s.docs)) return { ok: false, reason: 'summary docs is not an array' };
  for (const d of s.docs) if (!docOk(d)) return { ok: false, reason: 'summary doc is malformed' };
  return { ok: true, summary: s };
}

/* docStatus(summary, storage) -> Map(docId -> 'fresh' | 'stale' | 'missing') */
export function docStatus(summary, storage) {
  const out = new Map();
  for (const d of summary.docs || []) {
    const raw = getRaw(storage, DOC_PREFIX + d.docId);
    if (raw == null) out.set(d.docId, 'missing');
    else out.set(d.docId, fnv1a(raw) === d.fp ? 'fresh' : 'stale');
  }
  return out;
}

/* ---------------------------------------------------------------- registration */
/* A registration is used only if its identity and every field the Library renders have the stored types. */
function regOk(e) {
  return !!e && typeof e === 'object' && isStr(e.docId) && e.docId !== '' && isInt(e.rev) && e.rev >= 0 && isHash(e.hash)
    && e.key === `${e.docId}|${e.rev}|${e.hash}` && optStr(e.name) && optStr(e.domain) && optStr(e.registeredAt) && optStr(e.status);
}
export function readRegistrations(storage) {
  const out = [];
  for (const k of storageKeys(storage)) {
    if (!k.startsWith(REG_PREFIX)) continue;
    try { const e = JSON.parse(getRaw(storage, k)); if (regOk(e) && e.key === decodeURIComponent(k.slice(REG_PREFIX.length))) out.push(e); } catch { /* skip malformed */ }
  }
  return out.sort((a, b) => String(a.registeredAt ?? '').localeCompare(String(b.registeredAt ?? '')) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/* the saved revision a registration points at, or null if the document is gone
   or lacks that revision with that hash (source replaced). */
function savedRevision(storage, entry) {
  const raw = getRaw(storage, DOC_PREFIX + entry.docId);
  if (raw == null) return null;
  let doc; try { doc = JSON.parse(raw); } catch { return null; }
  if (!doc || !Array.isArray(doc.revisions)) return null;
  const r = doc.revisions.find(x => x.rev === entry.rev);
  if (!r || r.hash !== entry.hash) return null;
  return r;
}

const keyOf = (docId, rev, hash) => `${docId}|${rev}|${hash}`;
const labelOf = rev => `v1.${rev}`;

/* --------------------------------------------------------------- projections */
function freshDocs(summary, storage) {
  const status = docStatus(summary, storage);
  return (summary.docs || []).filter(d => status.get(d.docId) === 'fresh');
}

/* projectPending: one row per awaiting revision of a fresh document. Stale docs
   surface a placeholder; missing docs are dropped. */
export function projectPending(summary, storage) {
  const status = docStatus(summary, storage);
  const rows = [];
  for (const d of summary.docs || []) {
    const st = status.get(d.docId);
    if (st === 'missing') continue;
    if (st === 'stale') { rows.push({ key: keyOf(d.docId, -1, ''), docId: d.docId, name: String(d.name || d.docId), stale: true }); continue; }
    for (const r of d.revs || []) {
      if (!r.awaiting) continue;
      const key = keyOf(d.docId, r.rev, r.hash);
      if (r.awaiting === 'approve') {
        rows.push({ key, docId: d.docId, name: String(d.name || d.docId), rev: r.rev, label: r.label, hash: r.hash, kind: 'approve',
          recommended: r.recommended ? { id: r.recommended.id, label: r.recommended.label, violationsClosed: r.recommended.scorecard?.violationsClosed ?? null } : null,
          scenarioSetId: r.validation?.scenarioSetId ?? r.optimization?.scenarioSetId ?? null });
      } else {
        rows.push({ key, docId: d.docId, name: String(d.name || d.docId), rev: r.rev, label: r.label, hash: r.hash, kind: 'accept',
          runs: r.validation?.runs ?? null, scenarioSetId: r.validation?.scenarioSetId ?? null });
      }
    }
  }
  return rows;
}

/* projectPcp: a card per awaiting or decided revision of a fresh document. */
export function projectPcp(summary, storage) {
  const status = docStatus(summary, storage);
  const cards = [];
  for (const d of summary.docs || []) {
    const st = status.get(d.docId);
    if (st === 'missing') continue;
    if (st === 'stale') { cards.push({ key: keyOf(d.docId, -1, ''), docId: d.docId, name: String(d.name || d.docId), stale: true }); continue; }
    for (const r of d.revs || []) {
      if (r.awaiting === 'approve' && r.recommended) {
        cards.push({ key: keyOf(d.docId, r.rev, r.hash), docId: d.docId, name: String(d.name || d.docId), rev: r.rev, label: r.label, hash: r.hash,
          state: 'awaiting', candidate: { id: r.recommended.id, label: r.recommended.label }, scorecard: r.recommended.scorecard, scenarioSetId: r.validation?.scenarioSetId ?? r.optimization?.scenarioSetId ?? null });
      } else if (r.awaiting === 'accept') {
        cards.push({ key: keyOf(d.docId, r.rev, r.hash), docId: d.docId, name: String(d.name || d.docId), rev: r.rev, label: r.label, hash: r.hash,
          state: 'awaiting', metrics: r.validation?.metrics ?? null, scenarioSetId: r.validation?.scenarioSetId ?? null });
      } else if (r.decision?.action === 'approve') {
        cards.push({ key: keyOf(d.docId, r.rev, r.hash), docId: d.docId, name: String(d.name || d.docId), rev: r.rev, label: r.label, hash: r.hash,
          state: 'approved', candidate: { id: r.decision.candidateId, label: r.decision.label ?? r.decision.candidateId }, scorecard: r.decision.scorecard,
          childLabel: r.decision.childLabel ?? null,
          child: r.decision.childRev != null && r.decision.childHash ? { rev: r.decision.childRev, hash: r.decision.childHash, label: r.decision.childLabel ?? labelOf(r.decision.childRev) } : null,
          scenarioSetId: r.decision.scenarioSetId ?? r.validation?.scenarioSetId ?? null });
      } else if (r.decision?.action === 'accept') {
        cards.push({ key: keyOf(d.docId, r.rev, r.hash), docId: d.docId, name: String(d.name || d.docId), rev: r.rev, label: r.label, hash: r.hash,
          state: 'accepted', metrics: r.decision.metrics ?? r.validation?.metrics ?? null, scenarioSetId: r.decision.scenarioSetId ?? r.validation?.scenarioSetId ?? null });
      }
    }
  }
  return cards;
}

/* projectLibrary: the union of bs.reg.*, marking a registration whose saved
   document no longer holds that revision+hash as replaced. */
export function projectLibrary(storage, summary) {
  return readRegistrations(storage).map(e => {
    const replaced = savedRevision(storage, e) == null;
    return { key: e.key, docId: e.docId, name: e.name ?? e.docId, domain: e.domain ?? '', rev: e.rev, label: labelOf(e.rev), hash: e.hash,
      registeredAt: e.registeredAt ?? null, status: e.status ?? 'Registered · not deployed', sourceReplaced: replaced, evidence: e.evidence ?? null };
  });
}

/* ---------------------------------------------------------------- renderers */
const docOf = container => container && (container.ownerDocument || (typeof document !== 'undefined' ? document : null));
const el = (d, tag, cls) => { const e = d.createElement(tag); if (cls) e.className = cls; return e; };
const txt = (d, text) => { const n = d.createTextNode(String(text)); return n; };
const setText = (e, s) => { e.textContent = s; return e; };

const simLabel = id => `${SIM} · scenario set ${id}`;
const frac = m => (m && Number.isFinite(m.num) && Number.isFinite(m.den) ? `${m.num}/${m.den}` : '—');

function clear(container) { while (container && container.firstChild) container.removeChild(container.firstChild); }

export function renderUnavailable(container, reason) {
  if (!container) return;
  const d = docOf(container); if (!d) return;
  clear(container);
  const p = el(d, 'div', 'muted'); p.setAttribute('data-studio-summary', 'unavailable');
  p.appendChild(txt(d, 'Blueprint Studio summary unavailable — open the Studio to refresh'));
  container.appendChild(p);
}

const staleNote = (d, parent) => { parent.appendChild(setText(el(d, 'span', 'muted'), 'changed since the Studio last summarised it — open the Studio to refresh')); };

const emptyNote = (d, container, text) => { const p = el(d, 'div', 'muted studio-empty'); p.textContent = text; container.appendChild(p); };

export function renderPending(container, rows, { onOpen } = {}) {
  if (!container) return;
  const d = docOf(container); if (!d) return;
  clear(container);
  if (!rows || !rows.length) return emptyNote(d, container, 'No Blueprint decision is awaiting review.');
  for (const row of rows || []) {
    const div = el(d, 'div', 'row');
    div.setAttribute('data-studio-pending', row.key);
    if (row.stale) { div.setAttribute('data-studio-stale', ''); setText(div, `${row.name} · `); staleNote(d, div); }
    else {
      const b = el(d, 'b'); b.textContent = `${row.name} ${row.label}`;
      const p = el(d, 'span', 'muted');
      if (row.kind === 'approve') {
        p.appendChild(txt(d, ' · awaiting a person\'s decision · recommended by the objectives rule: '));
        const lb = el(d, 'span'); lb.textContent = row.recommended?.label ?? '—'; p.appendChild(lb);
        p.appendChild(txt(d, ` · closes ${frac(row.recommended?.violationsClosed)} findings`));
      } else {
        p.appendChild(txt(d, ` · no findings in ${row.runs ?? '—'} simulated runs · awaiting acceptance`));
      }
      const s = el(d, 'small', 'muted'); s.textContent = simLabel(row.scenarioSetId ?? '—');
      const btn = el(d, 'button', 'btn sm'); btn.setAttribute('data-studio-open', '');
      btn.textContent = 'Open in Studio';
      btn.addEventListener('click', () => onOpen && onOpen({ cmd: 'open', doc: row.docId, rev: row.rev, hash: row.hash, view: 'assurance', stage: 'decide' }));
      div.appendChild(b); div.appendChild(p); div.appendChild(s); div.appendChild(btn);
    }
    container.appendChild(div);
  }
}

/* Where a PCP card opens: awaiting → the evaluated revision at Decide; approved → the approved CHILD at Register
   (Register needs the child); accepted → that revision at Register. */
export function openFor(card) {
  if (card.state === 'approved' && card.child) return { cmd: 'open', doc: card.docId, rev: card.child.rev, hash: card.child.hash, view: 'assurance', stage: 'register' };
  if (card.state === 'approved') return { cmd: 'open', doc: card.docId, rev: card.rev, hash: card.hash, view: 'assurance', stage: 'decide' };
  return { cmd: 'open', doc: card.docId, rev: card.rev, hash: card.hash, view: 'assurance', stage: card.state === 'awaiting' ? 'decide' : 'register' };
}

/* The visible claim framing of a card (Codex r1 #3): recommended ≠ approved ≠ accepted. */
export function statusText(card) {
  if (card.state === 'awaiting' && card.candidate) return 'Recommended by the objectives rule — awaiting a person\'s approval';
  if (card.state === 'awaiting') return 'No findings in the simulated runs — awaiting acceptance';
  if (card.state === 'approved') return `Approved by a person${card.child ? ' → ' + card.child.label : ''}`;
  if (card.state === 'accepted') return 'Accepted as is by a person';
  return '';
}

export function renderPcp(container, cards, { onOpen, onTrace } = {}) {
  if (!container) return;
  const d = docOf(container); if (!d) return;
  clear(container);
  if (!cards || !cards.length) return emptyNote(d, container, 'No Blueprint decision yet: model and validate a workflow in Blueprint Studio.');
  for (const card of cards || []) {
    const c = el(d, 'div', 'card workflow-card studio-card');
    c.setAttribute('data-studio-pcp', card.key);
    c.setAttribute('data-state', card.stale ? 'stale' : card.state);
    if (card.stale) { setText(c, `${card.name} · `); staleNote(d, c); container.appendChild(c); continue; }
    const st = el(d, 'span', 'status ' + (card.state === 'awaiting' ? 'review' : 'running'));
    st.setAttribute('data-studio-status', card.state); st.textContent = statusText(card);
    c.appendChild(st);
    const head = el(d, 'b'); head.textContent = `${card.name} ${card.label}`;
    c.appendChild(head);
    const body = el(d, 'p', 'muted');
    if (card.candidate) {
      const cand = el(d, 'span'); cand.textContent = card.candidate.label; body.appendChild(cand);
    }
    if (card.scorecard) {
      const ul = el(d, 'ul');
      for (const [k, label] of [['violationsClosed', 'findings closed'], ['benignCompletion', 'benign completion'], ['friction', 'friction']]) {
        if (card.scorecard[k]) { const li = el(d, 'li'); li.textContent = `${label} ${frac(card.scorecard[k])}`; ul.appendChild(li); }
      }
      if (card.scorecard.addedLatencyMedian != null) { const li = el(d, 'li'); li.textContent = `added latency ${card.scorecard.addedLatencyMedian}`; ul.appendChild(li); }
      body.appendChild(ul);
    } else if (card.metrics) {
      const ul = el(d, 'ul');
      for (const [k, label] of [['benignCompletion', 'benign completion'], ['friction', 'friction']]) {
        if (card.metrics[k]) { const li = el(d, 'li'); li.textContent = `${label} ${frac(card.metrics[k])}`; ul.appendChild(li); }
      }
      body.appendChild(ul);
    }
    const s = el(d, 'small', 'muted'); s.textContent = simLabel(card.scenarioSetId ?? '—');
    c.appendChild(body); c.appendChild(s);
    const acts = el(d, 'div', 'row-actions');
    const openBtn = el(d, 'button', 'btn sm'); openBtn.setAttribute('data-studio-open', ''); openBtn.textContent = 'Open in Studio';
    openBtn.addEventListener('click', () => onOpen && onOpen(openFor(card)));
    const traceBtn = el(d, 'button', 'btn sm'); traceBtn.setAttribute('data-studio-trace', ''); traceBtn.textContent = 'Trace';
    traceBtn.addEventListener('click', () => onTrace && onTrace({ cmd: 'open', doc: card.docId, rev: card.rev, hash: card.hash, view: 'trace' }));
    acts.appendChild(openBtn); acts.appendChild(traceBtn);
    c.appendChild(acts);
    container.appendChild(c);
  }
}

export function renderLibrary(container, rows, { onOpen, onTrace } = {}) {
  if (!container) return;
  const d = docOf(container); if (!d) return;
  clear(container);
  if (!rows || !rows.length) return emptyNote(d, container, 'No workflow has been registered from Blueprint Studio in this browser yet.');
  for (const row of rows || []) {
    const r = el(d, 'div', 'row');
    r.setAttribute('data-studio-reg', row.key);
    const name = el(d, 'b'); name.textContent = `${row.name} ${row.label}`;
    const meta = el(d, 'span', 'muted'); meta.textContent = ` · ${(row.hash || '').slice(0, 8)} · ${row.status}${row.registeredAt ? ' · ' + row.registeredAt : ''}`;
    r.appendChild(name); r.appendChild(meta);
    if (row.sourceReplaced) {
      r.setAttribute('data-source-replaced', '');
      r.appendChild(setText(el(d, 'span', 'warn'), ' · source revision replaced in this browser'));
    }
    const acts = el(d, 'div', 'row-actions');
    const openBtn = el(d, 'button', 'btn sm'); openBtn.setAttribute('data-studio-open', ''); openBtn.textContent = 'Open in Studio';
    if (row.sourceReplaced) openBtn.disabled = true;
    openBtn.addEventListener('click', () => onOpen && onOpen({ cmd: 'open', doc: row.docId, rev: row.rev, hash: row.hash, view: 'assurance' }));
    const traceBtn = el(d, 'button', 'btn sm'); traceBtn.setAttribute('data-studio-trace', ''); traceBtn.textContent = 'Trace';
    traceBtn.addEventListener('click', () => onTrace && onTrace({ cmd: 'open', doc: row.docId, rev: row.rev, hash: row.hash, view: 'trace' }));
    acts.appendChild(openBtn); acts.appendChild(traceBtn);
    r.appendChild(acts);
    container.appendChild(r);
  }
}
