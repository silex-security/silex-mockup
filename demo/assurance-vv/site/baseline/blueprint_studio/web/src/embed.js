/* Host → Studio commands over the URL hash (cutover plan §2.2,
   js/STUDIO_BRIDGE_CONTRACT.md). Every command carries a nonce; each nonce is
   acted on once and the hash is then cleared, so identical requests repeat.
   `open` validates the saved document, revision and hash BEFORE any store
   call: a refused command changes nothing. Nothing from the hash is rendered
   as HTML. */
import { importDocument } from '../../js/io.js';

export const EMBED = (() => { try { return new URLSearchParams(location.search).get('embed') === '1'; } catch { return false; } })();

const VIEWS = new Set(['builder', 'assurance', 'trace']);
const STAGES = new Set(['confirm', 'validate', 'optimize', 'decide', 'register']);
const HEX64 = /^[0-9a-f]{64}$/;

/* -> { cmd, n, ... } or null. URLSearchParams decodes the host's encodeURIComponent. */
export function parseCommand(hash) {
  let q; try { q = new URLSearchParams(String(hash || '').replace(/^#/, '')); } catch { return null; }
  const cmd = q.get('cmd'), n = q.get('n');
  if (!n || !/^\d{1,15}$/.test(n)) return null;
  if (cmd === 'resume' || cmd === 'new') return { cmd, n };
  if (cmd !== 'open') return null;
  const doc = q.get('doc'), rev = q.get('rev'), hash_ = q.get('hash'), view = q.get('view') || 'assurance', stage = q.get('stage');
  if (!doc || !/^\d{1,9}$/.test(rev || '') || !HEX64.test(hash_ || '') || !VIEWS.has(view) || (stage != null && !STAGES.has(stage))) return null;
  return { cmd, n, doc, rev: Number(rev), hash: hash_, view, stage: stage || null };
}

/* Validate-first: -> { ok: true, doc } | { ok: false, code }. Reads storage only. */
export function checkOpen(storage, c) {
  let raw = null; try { raw = storage ? storage.getItem('bs.doc.' + c.doc) : null; } catch { raw = null; }
  if (!raw) return { ok: false, code: 'missing' };
  const r = importDocument(raw);
  if (!r.ok) return { ok: false, code: 'invalid' };
  const doc = r.value;
  if (doc.id !== c.doc) return { ok: false, code: 'id' };
  const rev = doc.revisions.find(x => x.rev === c.rev);
  if (!rev) return { ok: false, code: 'rev' };
  if (rev.hash !== c.hash) return { ok: false, code: 'hash' };
  return { ok: true, doc };
}

/* Wires hash commands to the controller. `apply` gets {cmd, ...} and a checked doc for 'open'. */
export function initEmbed({ storage, apply, refuse }) {
  const consumed = new Set();
  const handle = () => {
    const c = parseCommand(location.hash);
    if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ } }
    if (!c || consumed.has(c.n)) return;
    consumed.add(c.n);
    if (c.cmd === 'open') {
      const chk = checkOpen(storage, c);
      if (!chk.ok) return refuse(chk.code, c);
      return apply(c, chk.doc);
    }
    apply(c, null);
  };
  window.addEventListener('hashchange', handle);
  handle();
  return handle;
}
