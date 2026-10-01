/* Trace monitors (plan §4.4, contract §5).
   Evaluated over a session's ledger and effects. One result per prohibited node. */

export function evaluateMonitors(graph, sessionResult) {
  const { ledger, effects } = sessionResult;
  const prohibited = graph.nodes.filter(n => n.type === 'prohibited').sort((a, b) => a.id < b.id ? -1 : 1);
  return prohibited.map(node => ({ node: node.id, monitor: node.config.monitor, violations: evaluateOne(node, ledger, effects) }));
}

function evaluateOne(node, ledger, effects) {
  const cfg = node.config;
  switch (cfg.monitor) {
    case 'unauthorized_write': return unauthorizedWrite(cfg, ledger);
    case 'duplicate_effect': return duplicateEffect(cfg, ledger);
    case 'secret_exposure': return secretExposure(effects);
    default: return [];
  }
}

/* scope key: write -> writeId, request -> parentRequestId, customer_day -> customer */
function scopeKey(scope, w) {
  if (scope === 'write') return w.writeId;
  if (scope === 'customer_day') return w.customer;
  return w.parentRequestId; // 'request'
}

function unauthorizedWrite(cfg, ledger) {
  const { cap, threshold = 0, scope = 'request', minApprovers = 1 } = cfg;
  const writes = ledger.writes.filter(w => w.cap === cap);
  const running = {};
  const out = [];
  for (const w of writes) {
    const key = scopeKey(scope, w);
    running[key] = (running[key] || 0) + w.amount;
    if (running[key] > threshold) {
      if (!isProper(w, ledger, minApprovers)) out.push({ activation: w.activation, writeId: w.writeId, reason: properReason(w, ledger, minApprovers) });
    }
  }
  return out;
}

function isProper(w, ledger, minApprovers) {
  if (!w.approvalId) return false;
  const ap = ledger.approvals[w.approvalId];
  if (!ap) return false;
  if (ap.consumedBy[0] !== w.writeId) return false;
  if (ap.approvers < minApprovers) return false;
  for (const f of Object.keys(ap.binding)) if (ap.binding[f] !== w[f]) return false;
  return true;
}

function properReason(w, ledger, minApprovers) {
  if (!w.approvalId) return 'no_approval';
  const ap = ledger.approvals[w.approvalId];
  if (!ap) return 'no_approval';
  if (ap.consumedBy[0] !== w.writeId) return 'reused_approval';
  if (ap.approvers < minApprovers) return 'insufficient_approvers';
  return 'binding_mismatch';
}

function duplicateEffect(cfg, ledger) {
  const { cap } = cfg;
  const writes = ledger.writes.filter(w => w.cap === cap);
  const first = {};   // `${customer}|${order}` -> parentRequestId of first write
  const out = [];
  for (const w of writes) {
    const key = `${w.customer}|${w.order}`;
    if (!(key in first)) { first[key] = w.parentRequestId; continue; }
    if (w.parentRequestId !== first[key]) out.push({ activation: w.activation, writeId: w.writeId, reason: 'duplicate' });
  }
  return out;
}

function secretExposure(effects) {
  const out = [];
  for (const e of effects) {
    if (e.type === 'emit' && e.external) {
      if ((e.labels || []).some(l => l.sensitivity === 'secret')) out.push({ activation: e.activation, emitNode: e.node, reason: 'secret_in_external_emit' });
    }
  }
  return out;
}
