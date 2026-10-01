/* Ask AI (n8n-style prompt editing; plan §3.10–3.10.1). A request produces a
   PROPOSAL bound to {docId, rev, graphHash, requestId}; nothing changes until
   the user clicks Apply, which re-checks the binding and dispatches exactly the
   previewed ops as one patch, once. Claude proposes inside a Claude Artifact
   (the `sample` capability); elsewhere the rule-based proposer does. */
import { useEffect, useRef, useState } from 'react';
import { useStudio, store, bump } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { lint } from '../../../js/validate.js';
import { t } from '../i18n/index.js';
import Icon, { I } from '../ui/Icon.jsx';
import { validateProposal } from './validateProposal.js';
import { proposeWithClaude, getSample, PERMANENT } from './propose.js';
import { proposeByRules } from './rules.js';
import { layoutOps, dirOf } from '../builder/layout.js';
import { typeLabel, monitorLabel } from '../builder/catalog.js';
import { lintSentence } from '../builder/Checklist.jsx';
import { describeOp } from '../assurance/common.jsx';

/* Session state survives closing the panel; it resets with the document. */
export const assist = { turns: [], proposal: null, consumed: null, seq: 0, current: 0, busy: false, mode: null, claudeOff: null, ctl: null, highlight: [] };
const MAX_MESSAGE = 2000;

const bindingNow = () => { const r = store.active(); return { docId: store.doc.id, rev: r.rev, hash: store.hashOf(r), draft: r.status === 'draft' }; };
export const isStale = p => { if (!p) return true; const b = bindingNow(); return assist.consumed === p.id || b.docId !== p.binding.docId || b.rev !== p.binding.rev || b.hash !== p.binding.hash || !b.draft; };

const ERR = {
  rate_limited: ['assist.err.rate', 'Too many requests right now. Try again in a little while.'],
  session_expired: ['assist.err.session', 'Your Claude session expired. Sign in again, then retry.'],
  refused: ['assist.err.refused', 'Claude declined this request. Try rephrasing it.'],
  empty_completion: ['assist.err.empty', 'No answer came back. Ask for less at a time.'],
  invalid_json: ['assist.err.json', 'The answer could not be read as a change list. Try again.'],
  prompt_too_large: ['assist.err.large', 'This workflow is too large to send in one request. Ask about one part of it.'],
  upstream_error: ['assist.err.upstream', 'The request failed. Try again.']
};
const errText = code => { const e = ERR[code] || ERR.upstream_error; return t(e[0], e[1]); };

function describe(op, g) {
  const lbl = r => typeof r === 'string' ? (g.nodes.find(n => n.id === r)?.label || r) : r && r.ref ? `“${r.ref}”` : '?';
  switch (op.op) {
    case 'insertStep': return t('assist.op.insert', 'Insert {type} “{label}” between {a} and {b}', { type: typeLabel(op.type), label: op.label || typeLabel(op.type), a: lbl(op.from), b: lbl(op.to) });
    case 'addNext': return t('assist.op.next', 'Add {type} “{label}” after {a} ({port})', { type: typeLabel(op.type), label: op.label || typeLabel(op.type), a: lbl(op.node), port: op.port });
    case 'addMonitor': return t('assist.op.monitor', 'Protect {a} with a “{kind}” monitor', { a: lbl(op.node), kind: monitorLabel(op.kind) });
    case 'addData': return t('assist.op.data', '{a} reads new data “{label}” ({s})', { a: lbl(op.node), label: op.label, s: t('sens.' + op.sensitivity, op.sensitivity) });
    case 'connect': return t('assist.op.connect', 'Connect {a} → {b}', { a: lbl(op.from?.node), b: lbl(op.to?.node) });
    case 'setLabel': return t('assist.op.rename', 'Rename {a} to “{label}”', { a: lbl(op.node), label: op.label });
    case 'setConfig': return t('assist.op.set', 'Set {key} of {a} to {v}', { key: t('field.' + op.key, op.key), a: lbl(op.node), v: JSON.stringify(op.value) });
    case 'removeNode': return t('assist.op.remove', 'Delete {a}', { a: lbl(op.node) });
    case 'removeEdge': return t('assist.op.removeEdge', 'Disconnect {a} → {b}', { a: lbl(op.from), b: lbl(op.to) });
    default: return op.op;
  }
}

/* Every primitive change the proposal will make — settings and connections
   included — labelled against the graph it came from (removals) or produces
   (everything else). This, not the model's own wording, is what Apply applies. */
function expandedLines(before, after, ops) {
  return ops.filter(o => o.op !== 'moveNode').map(o => (o.op === 'removeNode' || o.op === 'removeEdge') ? describeOp(before, o) : describeOp(after, o));
}

function lintDelta(before, after) {
  const key = i => i.code + ':' + (i.nodeId || i.edgeId || '');
  const b = new Set(before.map(key)), a = new Set(after.map(key));
  return { added: after.filter(i => !b.has(key(i))), removed: before.filter(i => !a.has(key(i))) };
}

store.on(ev => { if (ev.reason === 'load') resetAssist(); });
export function resetAssist() { assist.ctl?.abort(); Object.assign(assist, { turns: [], proposal: null, busy: false, highlight: [], current: ++assist.seq }); }

export default function AssistantPanel() {
  useStudio();
  const [text, setText] = useState('');
  const [claudeReady, setClaudeReady] = useState(null);           // null = checking, true, false
  const listRef = useRef(null);
  const rev = store.active(), locked = rev.status !== 'draft';

  useEffect(() => { let live = true; getSample().then(s => { if (live) setClaudeReady(!!s); }); return () => { live = false; }; }, []);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); });
  const claudeUsable = claudeReady === true && !assist.claudeOff;
  const mode = assist.mode === 'rules' || !claudeUsable ? 'rules' : 'claude';

  const push = m => { assist.turns.push(m); bump(); };
  const settle = (id, fn) => { if (id !== assist.current) return; fn(); assist.busy = false; bump(); };

  async function send() {
    const msg = text.trim();
    if (!msg || locked) return;
    if (msg.length > MAX_MESSAGE) { push({ role: 'note', text: t('assist.tooLong', 'That message is too long; keep it under {n} characters.', { n: MAX_MESSAGE }) }); return; }
    assist.ctl?.abort();
    const id = ++assist.seq; assist.current = id;
    const b = bindingNow(), graph = rev.graph;
    assist.proposal = null; assist.highlight = [];
    push({ role: 'user', text: msg }); setText('');
    const accept = raw => {
      const v = validateProposal(graph, raw);
      if (!v.ok) { push({ role: 'assistant', text: (raw && typeof raw.summary === 'string' && v.error.code === 'empty') ? raw.summary.slice(0, 400) : t('assist.rejected', 'I could not turn that into a valid change: {why}', { why: v.error.message }), kind: v.error.code === 'empty' ? 'info' : 'error' }); return; }
      const before = lint(graph), after = lint(v.value.graph);
      assist.proposal = Object.freeze({ id, binding: b, raw, ops: Object.freeze(v.value.ops), touched: v.value.touched, delta: lintDelta(before, after), summary: v.value.summary, mode: raw.__mode,
        requested: (raw.ops || []).map(op => describe(op, graph)), lines: expandedLines(graph, v.value.graph, v.value.ops), after: v.value.graph });
      assist.consumed = null;
      assist.highlight = v.value.touched;
      push({ role: 'assistant', text: raw.__mode === 'rules' ? t('assist.proposedRules', 'Here is what the rule-based mode understood. Review it, then Apply or Discard.') : (v.value.summary || t('assist.proposed', 'Here is a proposal. Review it, then Apply or Discard.')), proposalId: id });
    };
    if (mode === 'rules') {
      const r = proposeByRules(msg, graph);
      if (!r.ok) { push({ role: 'assistant', text: r.error.message, kind: 'error' }); return; }
      if (!r.value.ops.length) { push({ role: 'assistant', text: t('assist.rulesNone', 'The rule-based mode did not understand: {u}. Try e.g. “add a human approval after Refund Eligibility”.', { u: (r.value.unmatched || [msg]).join(' · ') }), kind: 'info' }); return; }
      accept({ ...r.value, __mode: 'rules' });
      if (r.value.unmatched?.length) push({ role: 'note', text: t('assist.rulesPartial', 'Not understood: {u}', { u: r.value.unmatched.join(' · ') }) });
      return;
    }
    const ac = new AbortController(); assist.ctl = ac; assist.busy = true; bump();
    const history = assist.turns.filter(m => m.role === 'user' || (m.role === 'assistant' && m.kind !== 'error')).slice(0, -1).slice(-8).map(m => ({ role: m.role, content: m.text })).filter(m => m.content);
    const hist = history.length && history[0].role === 'assistant' ? history.slice(1) : history;
    try {
      const raw = await proposeWithClaude(graph, hist.length && hist[hist.length - 1].role === 'user' ? hist.slice(0, -1) : hist, msg, ac.signal);
      settle(id, () => { if (isPlain(raw)) accept({ ...raw, __mode: 'claude' }); else push({ role: 'assistant', text: errText('invalid_json'), kind: 'error' }); });
    } catch (e) {
      settle(id, () => {
        const code = e && e.code;
        if (code === 'cancelled') return;
        if (PERMANENT.has(code)) { assist.claudeOff = code; push({ role: 'note', text: t('assist.claudeOff', 'Claude is not available here ({code}). Switched to the rule-based mode for this session.', { code }) }); return; }
        push({ role: 'assistant', text: errText(code), kind: 'error', retry: code === 'invalid_json' || code === 'upstream_error' || !ERR[code] ? msg : null });
      });
    }
  }
  const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  function apply() {
    const p = assist.proposal;
    if (!p || assist.consumed === p.id || isStale(p)) return ctl.toast(t('assist.stale', 'The workflow changed since this was proposed — ask again.'), 'error');
    assist.consumed = p.id;                               // consumed before dispatch: a double click cannot apply twice
    // The previewed, frozen patch — applied unchanged; only positions are added: the layout of the previewed
    // result in the direction the graph has now (a switch after proposing leaves the proposal valid; plan §3.12.1).
    const r = store.dispatch({ type: 'patch', ops: [...p.ops, ...layoutOps({ ...p.after, direction: dirOf(store.active().graph) })], label: 'Ask AI' });
    if (r.ok) { assist.highlight = []; push({ role: 'note', text: t('assist.applied', 'Applied. Undo reverts it in one step.') }); }
  }
  function discard() { if (assist.proposal) { assist.proposal = null; assist.highlight = []; push({ role: 'note', text: t('assist.discarded', 'Discarded.') }); } }
  function stop() { assist.ctl?.abort(); assist.current = ++assist.seq; assist.busy = false; bump(); }

  const p = assist.proposal, consumed = p && assist.consumed === p.id, stale = p && isStale(p) && !consumed;
  return (
    <aside className="config assist" aria-label={t('assist.title', 'Ask AI')}>
      <header className="cp-head">
        <span className="si-tile" style={{ '--tc': 'var(--blue)' }}><svg viewBox="0 0 24 24" className="icon"><path d={I.spark} /></svg></span>
        <div className="cp-title"><b>{t('assist.title', 'Ask AI')}</b><small>{mode === 'claude' ? t('assist.byClaude', 'Claude proposes; you review and apply.') : t('assist.byRules', 'Rule-based — no AI.')}</small></div>
        <button className="btn ghost sm" aria-label={t('cp.close', 'Close')} onClick={() => ctl.setPanel(null)}><Icon d={I.x} /></button>
      </header>
      {claudeUsable ? <div className="assist-mode" role="radiogroup" aria-label={t('assist.modeLabel', 'Who proposes')}>
        <button role="radio" aria-checked={mode === 'claude'} className={mode === 'claude' ? 'on' : ''} onClick={() => { assist.mode = 'claude'; bump(); }}>{t('assist.modeClaude', 'Claude')}</button>
        <button role="radio" aria-checked={mode === 'rules'} className={mode === 'rules' ? 'on' : ''} id="assistRulesMode" onClick={() => { assist.mode = 'rules'; bump(); }}>{t('assist.modeRules', 'Rule-based')}</button>
      </div> : <p className="assist-note" id="assistRulesNote">{claudeReady === null ? t('assist.checking', 'Checking whether Claude is available…') : t('assist.noClaude', 'AI proposals are available when this page runs as a Claude artifact. Here the rule-based mode understands requests like “add a human approval after Refund Eligibility”, “删除 Duplicate Compensation” or “rename Payment API to Stripe Refunds”.')}</p>}
      <div className="assist-list" ref={listRef} id="assistList">
        {assist.turns.length === 0 ? <div className="assist-empty">
          <p>{t('assist.hello', 'Describe a change and I will propose it. Nothing changes until you press Apply.')}</p>
          {[t('assist.ex1', 'Add a human approval above $1,000 after Refund Eligibility'), t('assist.ex2', 'Delete the Duplicate Compensation monitor'), t('assist.ex3', 'Rename Payment API to Stripe Refunds')].map(x => <button key={x} className="chip-toggle" disabled={locked} onClick={() => setText(x)}>{x}</button>)}
        </div> : null}
        {assist.turns.map((m, i) => (
          <div key={i} className={'msg ' + m.role + (m.kind ? ' ' + m.kind : '')}>
            <p>{m.text}</p>
            {m.retry ? <button className="link" onClick={() => setText(m.retry)}>{t('assist.tryAgain', 'Try again')}</button> : null}
            {m.proposalId && p && p.id === m.proposalId ? (
              <div className="proposal" id="proposalCard" data-stale={stale ? '1' : '0'}>
                <p className="proposal-sub">{t('assist.requested', 'Requested')}</p>
                <ol className="requested">{p.requested.map((line, k) => <li key={k}>{line}</li>)}</ol>
                <p className="proposal-sub">{t('assist.willChange', 'Exactly what Apply changes ({n})', { n: p.lines.length })}</p>
                <ul className="expanded" id="proposalLines">{p.lines.map((line, k) => <li key={k}>{line}</li>)}</ul>
                <div className="delta">
                  {p.delta.removed.length ? <span className="chip ok">{t('assist.fixes', 'fixes {n} issue(s)', { n: p.delta.removed.length })}</span> : null}
                  {p.delta.added.length ? <span className="chip warn" title={p.delta.added.map(x => lintSentence(x, store.active().graph)).join('\n')}>{t('assist.adds', 'leaves {n} issue(s) to fix', { n: p.delta.added.length })}</span> : <span className="chip">{t('assist.noNew', 'no new issues')}</span>}
                  <span className="chip">{p.mode === 'claude' ? t('assist.fromClaude', 'proposed by Claude') : t('assist.fromRules', 'rule-based')}</span>
                </div>
                {stale ? <p className="err">{t('assist.stale', 'The workflow changed since this was proposed — ask again.')}</p> : null}
                <div className="ref-actions">
                  <button className="btn primary sm" id="assistApply" disabled={stale || consumed} onClick={apply}><Icon d={I.check} />{t('assist.apply', 'Apply')}</button>
                  <button className="btn sm" id="assistDiscard" disabled={consumed} onClick={discard}>{t('assist.discard', 'Discard')}</button>
                </div>
              </div>) : null}
          </div>))}
        {assist.busy ? <div className="msg assistant thinking" id="assistThinking"><p>{t('assist.thinking', 'Thinking… (the first request asks your permission to use Claude)')}</p><button className="btn sm" id="assistStop" onClick={stop}>{t('assist.stop', 'Stop')}</button></div> : null}
      </div>
      {locked ? <div className="assist-locked"><p>{t('assist.locked', '{rev} is confirmed and locked. Start a new revision to change it.', { rev: ctl.revLabel(rev.rev) })}</p><button className="btn sm" onClick={() => ctl.newRevision()}>{t('builder.newRevision', 'Edit as new revision')}</button></div> : null}
      <form className="assist-input" onSubmit={e => { e.preventDefault(); send(); }}>
        <textarea id="assistInput" rows={3} disabled={locked || assist.busy} value={text} maxLength={MAX_MESSAGE * 2} placeholder={t('assist.placeholder', 'e.g. 在 Refund Eligibility 后面加一个人工审批，超过 1000 才需要')}
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
        <button className="btn primary" id="assistSend" type="submit" disabled={locked || assist.busy || !text.trim()}>{t('assist.send', 'Propose')}</button>
      </form>
      <p className="assist-foot">{mode === 'claude' ? t('assist.footClaude', 'Uses your Claude account. Proposals are checked before you can apply them; review every change.') : t('assist.footRules', 'Rule-based: fixed phrases in English and 中文. It never guesses.')}</p>
    </aside>);
}
