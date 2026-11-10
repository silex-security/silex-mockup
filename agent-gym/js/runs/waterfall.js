// Layout of one execution's events as a trace waterfall. Events carry an order and no timestamps or durations,
// so the axis is the step sequence: event k fills [k-1, k]. Nothing here is a time.

const RESPONSE = { ok: ['blue', null], timeout: ['amber', 'hatch'], denied: ['red', null], error: ['red', null] };
const NAMES = { model: 'Model', decision: 'Decision', approval: 'Approval', note: 'Note' };
const isTool = e => e.type === 'tool_call' || e.type === 'policy_block';

function look(e) {
  if (e.type === 'policy_block') return { tone: 'red', fill: null, mark: 'fail' };
  if (e.type === 'tool_call') {
    const [tone, fill] = RESPONSE[e.responseState] ?? ['grey', 'soft'];
    return tone === 'red' ? { tone, fill, mark: 'fail' } : { tone, fill };
  }
  if (e.type === 'model') return { tone: 'violet', fill: null };
  if (e.type === 'approval') return /requested/i.test(e.note) ? { tone: 'amber', fill: 'hatch' } : { tone: 'green', fill: null };
  return { tone: 'grey', fill: 'soft' };
}

const span = (events, tone) => ({ tone: events.some(e => look(e).mark) ? 'red' : tone, fill: 'soft' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Contiguous runs of the same node, as step ranges. */
function runsOf(events) {
  const out = [];
  for (const e of events) {
    const last = out.at(-1);
    if (last && last.end === e.seq - 1) { last.end = e.seq; last.events.push(e); } else out.push({ start: e.seq - 1, end: e.seq, events: [e] });
  }
  return out;
}

/**
 * @param {import('../model.js').TraceEvent[]} events
 * @param {Record<string, string>} nodeLabels
 * @param {{pass:boolean}[]} assertions
 */
export function runWaterfall(events, nodeLabels, assertions = []) {
  if (!events.length) return { total: 0, rows: [], counts: { tools: 0, timeouts: 0, failed: 0, assertionsFailed: 0 } };
  const groups = new Map();
  for (const e of events) {
    const id = e.nodeId || '';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(e);
  }
  const rows = [{
    key: 'run', depth: 0, parent: null, name: 'Run', sub: plural(events.length, 'event'),
    bars: [{ start: 0, end: events.length, ...span(events, 'blue') }], start: 0, end: events.length, label: plural(events.length, 'step'),
  }];
  for (const [id, own] of groups) {
    const runs = runsOf(own);
    rows.push({
      key: `node:${id}`, depth: 1, parent: 'run', name: id ? nodeLabels[id] ?? id : 'Scenario event', sub: plural(own.length, 'event'),
      bars: runs.map(r => ({ start: r.start, end: r.end, ...span(r.events, 'blue') })), start: runs[0].start, end: runs.at(-1).end, label: '',
    });
    for (const e of own) {
      const effect = e.sideEffectState && e.sideEffectState !== 'none' ? ` · ${e.sideEffectState}` : '';
      rows.push({
        key: `e${e.seq}`, depth: 2, parent: `node:${id}`, name: isTool(e) ? e.tool : NAMES[e.type] ?? NAMES.note, sub: isTool(e) ? '' : e.note,
        bars: [{ start: e.seq - 1, end: e.seq, ...look(e) }], start: e.seq - 1, end: e.seq,
        label: isTool(e) ? `${e.responseState}${effect}` : '',
        badges: e.attemptedPolicyViolation ? [{ text: 'Policy violation attempted', tone: 'red' }] : [],
        flags: { tool: isTool(e), timeout: e.responseState === 'timeout', fail: Boolean(look(e).mark) },
      });
    }
  }
  const tools = events.filter(isTool);
  return {
    total: events.length, rows,
    counts: {
      tools: tools.length,
      timeouts: events.filter(e => e.responseState === 'timeout').length,
      failed: events.filter(e => look(e).mark).length,
      assertionsFailed: assertions.filter(a => !a.pass).length,
    },
  };
}
