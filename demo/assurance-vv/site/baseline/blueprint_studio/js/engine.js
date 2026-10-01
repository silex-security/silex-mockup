/* Token/DAG interpreter (plan §4.2-4.3, contract §4).
   Deterministic: same graph + scenario -> byte-identical result.
   No DOM, no eval/Function. */

import { nodeById, flowOut, flowIn, accessOf } from './model.js';
import { parse, evaluate } from './expr.js';

const SENS_RANK = { public: 0, internal: 1, secret: 2 };
const round2 = x => Math.round(x * 100) / 100;

/* ------------------------------------------------------------------ helpers */
function newSession(scenario) {
  return {
    scenarioId: scenario.id,
    template: scenario.template,
    activations: [],
    trace: [],
    effects: [],
    ledger: { writes: [], approvals: {} },
    approvalSeq: [],
    latencyMinutes: 0,
    humanApprovals: 0,
    paths: {},              // activation -> [nodeId] executed
    children: {},           // split parent activation -> piece activation ids
    effectMark: 0,          // effects before this index are attached to a trace step
    nodeState: {},          // `${activation}\n${nodeId}` -> {fired, delivered:Set, gotToken, firstToken}
    seq: 0
  };
}

function snapshot(token) {
  return { req: token.req, labels: token.labels, approval: token.approval, principal: token.principal, injected: token.injected };
}
function cloneToken(token) {
  return { activation: token.activation, requestId: token.requestId, parentRequestId: token.parentRequestId, piece: token.piece,
    req: token.req, labels: token.labels.slice(), approval: token.approval, principal: token.principal, injected: token.injected, trust: token.trust };
}
function unionLabels(a, b) {
  const seen = new Set(a.map(x => x.data));
  const out = a.slice();
  for (const it of b) if (!seen.has(it.data)) { out.push(it); seen.add(it.data); }
  return out;
}

export function runScenario(graph, scenario, opts = {}) {
  const run = createRun(graph, scenario, { interactive: false, ...opts });
  let guard = 0;
  while (!run.done) { run.step(); if (++guard > 100000) throw new Error('run did not terminate'); }
  return run.result();
}

export function createRun(graph, scenario, opts = {}) {
  const interactive = !!opts.interactive;
  const approver = opts.approver || batchApprover;
  const s = newSession(scenario);
  const queue = [];               // LIFO stack of events
  const pending = [];             // requests not yet started
  let pendingApproval = null;
  let requests = scenario.requests.slice();

  const push = ev => queue.push(ev);
  const pop = () => queue.pop();

  const stKey = (activation, node) => activation + '\n' + node;
  const getState = (activation, node) => {
    const k = stKey(activation, node);
    if (!s.nodeState[k]) s.nodeState[k] = { fired: false, delivered: new Set(), gotToken: false, firstToken: null };
    return s.nodeState[k];
  };

  /* Every effect belongs to the trace step that produced it: a step takes the
     effects emitted since the previous step; effects emitted after a step (a
     dangling-port error, say) are flushed onto that step by flushEffects(). */
  const traceStep = (activation, node, type, status, inp, out, _effects, note) => {
    const step = { seq: s.trace.length, activation, node: node ? node.id : null, type, status, in: inp, out, effects: s.effects.slice(s.effectMark), note };
    s.effectMark = s.effects.length;
    s.trace.push(step);
    return step;
  };
  const flushEffects = () => {
    const last = s.trace[s.trace.length - 1];
    if (last && s.effects.length > s.effectMark) { last.effects.push(...s.effects.slice(s.effectMark)); s.effectMark = s.effects.length; }
  };
  const effect = e => { s.effects.push(e); return e; };

  /* an edge from a node's out port; null if the port is dangling */
  const edgeFrom = (nodeId, port) => flowOut(graph, nodeId, port);

  /* enqueue a token leaving (fromNode, port). A dangling taken port -> error. */
  const sendToken = (fromNodeId, port, token) => {
    const edge = edgeFrom(fromNodeId, port);
    if (!edge) {
      effect({ type: 'error', node: fromNodeId, activation: token.activation, code: 'dangling_port', message: 'Taken port has no edge' });
      endActivation(token, fromNodeId, 'error');
      return;
    }
    push({ kind: 'token', activation: token.activation, edgeId: edge.id, toNode: edge.to.node, token });
  };
  const sendSkip = (fromNodeId, port, activation) => {
    const edge = edgeFrom(fromNodeId, port);
    if (!edge) return;
    push({ kind: 'skip', activation, edgeId: edge.id, toNode: edge.to.node });
  };

  const endActivation = (token, endNodeId, status) => {
    const path = s.paths[token.activation] || [];
    s.activations.push({ id: token.activation, requestId: token.requestId, parentRequestId: token.parentRequestId, piece: token.piece, status, end: endNodeId, path });
  };

  const varsOf = token => {
    let dayTotal = 0;
    for (const w of s.ledger.writes) if (w.customer === token.req.customer) dayTotal += w.amount;
    dayTotal += token.req.amount;
    return { amount: token.req.amount, customer: token.req.customer, order: token.req.order, channel: token.req.channel, trust: token.trust, eligible: token.req.eligible, dayTotal: round2(dayTotal) };
  };

  const evalExpr = (src, token) => {
    const ast = parse(src);
    if (!ast.ok) return ast;
    const r = evaluate(ast.value, varsOf(token));
    return r;
  };

  const alreadyWritten = token => {
    let sum = 0;
    for (const w of s.ledger.writes) if (w.parentRequestId === token.parentRequestId) sum += w.amount;
    return sum;
  };

  function batchApprover(ctx) {
    return ctx.amount + ctx.alreadyWritten <= ctx.eligible;
  }

  /* ------------------------------------------------------------------ fire */
  function fireNode(node, token) {
    const activation = token.activation;
    s.paths[activation] = s.paths[activation] || [];
    s.paths[activation].push(node.id);
    const inp = snapshot(token);
    const effects = [];
    const take = (effectsList) => ({ effects: effectsList });

    if (node.type === 'trigger') {
      // trigger is only reached via startRequest; handled there. Defensive:
      token.trust = node.config.trust;
      if (token.req.injected && node.config.trust === 'untrusted') token.injected = true;
      traceStep(activation, node, 'trigger', 'ok', inp, { port: 'out', payload: snapshot(token) }, []);
      sendToken(node.id, 'out', token);
      return { fired: true };
    }

    if (node.type === 'agent') {
      token.principal = node.id;
      const readSet = [];
      for (const data of accessOf(graph, node.id)) {
        effect({ type: 'data_read', node: node.id, activation, data: data.id, sensitivity: data.config.sensitivity });
        readSet.push({ data: data.id, sensitivity: data.config.sensitivity });
      }
      if (token.injected) token.labels = unionLabels(token.labels, readSet);
      else {
        const ceiling = node.config.outputCeiling ?? 'internal';
        token.labels = unionLabels(token.labels, readSet.filter(it => SENS_RANK[it.sensitivity] <= SENS_RANK[ceiling]));
      }
      traceStep(activation, node, 'agent', 'ok', inp, { port: 'out', payload: snapshot(token) }, effects);
      if (node.config.canSplit && token.req.intent && token.req.intent.split) {
        const k = token.req.intent.split;
        const amounts = splitAmounts(token.req.amount, k);
        /* Settle the request's pending skips first, so every piece inherits the
           final branch state and pieces run strictly one after another. */
        for (;;) {
          const i = queue.findIndex(e => e.kind === 'skip' && e.activation === activation);
          if (i < 0) break;
          deliver(queue.splice(i, 1)[0]);
        }
        s.children[activation] = [];
        for (let i = k; i >= 1; i--) {
          const piece = cloneToken(token);
          piece.activation = activation + '#' + i;              // unique under nesting; = requestId#i for a first split
          piece.piece = i;
          const { intent, ...rest } = token.req;                  // the split intent is consumed once
          piece.req = { ...rest, amount: amounts[i - 1] };
          s.children[activation].unshift(piece.activation);
          for (const [k2, st] of Object.entries(s.nodeState)) {  // skips already delivered to the parent apply to each piece
            const [act, nid] = k2.split('\n');
            if (act === activation && !st.fired) s.nodeState[piece.activation + '\n' + nid] = { fired: false, delivered: new Set(st.delivered), gotToken: false, firstToken: null };
          }
          s.paths[piece.activation] = [...(s.paths[activation] || [])];   // a piece's path starts with the request's path up to the split
          sendToken(node.id, 'out', piece);
        }
      } else {
        sendToken(node.id, 'out', token);
      }
      return { fired: true };
    }

    if (node.type === 'decision') {
      const r = evalExpr(node.config.condition, token);
      if (!r.ok) {
        effect({ type: 'error', node: node.id, activation, code: r.error.code, message: r.error.message });
        traceStep(activation, node, 'decision', 'error', inp, { port: null, payload: null }, []);
        sendSkip(node.id, 'true', activation); sendSkip(node.id, 'false', activation);
        endActivation(token, node.id, 'error');
        return { fired: true };
      }
      const taken = r.value ? 'true' : 'false';
      const other = r.value ? 'false' : 'true';
      traceStep(activation, node, 'decision', 'ok', inp, { port: taken, payload: snapshot(token) }, []);
      sendSkip(node.id, other, activation);
      sendToken(node.id, taken, token);
      return { fired: true };
    }

    if (node.type === 'control') {
      let applies = true;
      if (node.config.appliesWhen !== '' && node.config.appliesWhen != null) {
        const r = evalExpr(node.config.appliesWhen, token);
        if (!r.ok || typeof r.value !== 'boolean') {
          const err = r.ok ? { code: 'expr_type', message: 'appliesWhen must be a boolean' } : r.error;
          effect({ type: 'error', node: node.id, activation, code: err.code, message: err.message });
          traceStep(activation, node, 'control', 'error', inp, { port: null, payload: null }, []);
          sendSkip(node.id, 'approved', activation); sendSkip(node.id, 'denied', activation);
          endActivation(token, node.id, 'error');
          return { fired: true };
        }
        applies = r.value;
      }

      if (node.config.kind === 'policy_gate') {
        if (node.config.action === 'redact') {
          if (applies) {
            const removed = [];
            const kept = [];
            for (const it of token.labels) {
              if (SENS_RANK[it.sensitivity] > SENS_RANK[node.config.redactAbove ?? 'internal']) removed.push(it);
              else kept.push(it);
            }
            token.labels = kept;
            effect({ type: 'redact', node: node.id, activation, removed });
          }
          traceStep(activation, node, 'control', 'ok', inp, { port: 'approved', payload: snapshot(token) }, effects);
          sendSkip(node.id, 'denied', activation);
          sendToken(node.id, 'approved', token);
          return { fired: true };
        }
        // block
        if (!applies) {
          traceStep(activation, node, 'control', 'ok', inp, { port: 'approved', payload: snapshot(token) }, effects);
          sendSkip(node.id, 'denied', activation);
          sendToken(node.id, 'approved', token);
          return { fired: true };
        }
        const rr = evalExpr(node.config.rule, token);
        if (!rr.ok) { effect({ type: 'error', node: node.id, activation, code: rr.error.code, message: rr.error.message }); traceStep(activation, node, 'control', 'error', inp, { port: null, payload: null }, []); endActivation(token, node.id, 'error'); return { fired: true }; }
        const taken = rr.value ? 'approved' : 'denied';
        const other = rr.value ? 'denied' : 'approved';
        traceStep(activation, node, 'control', 'ok', inp, { port: taken, payload: snapshot(token) }, effects);
        sendSkip(node.id, other, activation);
        sendToken(node.id, taken, token);
        return { fired: true };
      }

      // human / dual approval
      if (!applies) {
        traceStep(activation, node, 'control', 'ok', inp, { port: 'approved', payload: snapshot(token) }, effects);
        sendSkip(node.id, 'denied', activation);
        sendToken(node.id, 'approved', token);
        return { fired: true };
      }
      // presented approval (replay), human/dual only
      const presented = resolvePresented(node, token);
      if (presented) {
        effect({ type: 'approval_reused', node: node.id, activation, id: presented.id });
        token.approval = presented.id;
        traceStep(activation, node, 'control', 'ok', inp, { port: 'approved', payload: snapshot(token) }, effects);
        sendSkip(node.id, 'denied', activation);
        sendToken(node.id, 'approved', token);
        return { fired: true };
      }
      // ask the approver
      if (interactive) {
        pendingApproval = { activation, node, token, inp };
        return { fired: true, paused: true };
      }
      const approve = approver({ amount: token.req.amount, eligible: token.req.eligible, alreadyWritten: alreadyWritten(token), request: token.req, customer: token.req.customer, order: token.req.order });
      if (approve) {
        const ap = issueApproval(node, token);
        token.approval = ap.id;
        traceStep(activation, node, 'control', 'ok', inp, { port: 'approved', payload: snapshot(token) }, effects);
        sendSkip(node.id, 'denied', activation);
        sendToken(node.id, 'approved', token);
      } else {
        effect({ type: 'approval_denied', node: node.id, activation });
        traceStep(activation, node, 'control', 'ok', inp, { port: 'denied', payload: snapshot(token) }, effects);
        sendSkip(node.id, 'approved', activation);
        sendToken(node.id, 'denied', token);
      }
      return { fired: true };
    }

    if (node.type === 'tool') {
      if (node.config.sideEffect === 'write') {
        const principal = token.principal ? nodeById(graph, token.principal) : null;
        const cap = node.config.cap;
        let reason = null;
        if (!principal) reason = 'no_principal';
        else {
          const entry = (principal.config.capabilities || []).find(c => c.cap === cap);
          if (!entry) reason = 'no_capability';
          else if (entry.limit < token.req.amount) reason = 'over_limit';
        }
        if (reason) {
          effect({ type: 'write_denied', node: node.id, activation, cap, amount: token.req.amount, reason });
          traceStep(activation, node, 'tool', 'error', inp, { port: null, payload: null }, []);
          endActivation(token, node.id, 'error');
          return { fired: true };
        }
        if (node.config.idempotencyKey) {
          const dup = s.ledger.writes.find(w => w.customer === token.req.customer && w.order === token.req.order && w.cap === cap && w.parentRequestId !== token.parentRequestId);
          if (dup) {
            effect({ type: 'write_denied', node: node.id, activation, cap, amount: token.req.amount, reason: 'duplicate' });
            traceStep(activation, node, 'tool', 'error', inp, { port: null, payload: null }, []);
            endActivation(token, node.id, 'error');
            return { fired: true };
          }
        }
        const writeId = 'w' + (s.ledger.writes.length + 1);
        const write = { writeId, node: node.id, activation, requestId: token.requestId, parentRequestId: token.parentRequestId, customer: token.req.customer, order: token.req.order, amount: token.req.amount, cap, approvalId: token.approval };
        s.ledger.writes.push(write);
        effect({ type: 'write', ...write });
        if (token.approval) {
          effect({ type: 'approval_consumed', node: node.id, activation, id: token.approval, writeId });
          if (s.ledger.approvals[token.approval]) s.ledger.approvals[token.approval].consumedBy.push(writeId);
        }
      }
      traceStep(activation, node, 'tool', 'ok', inp, { port: 'out', payload: snapshot(token) }, effects);
      sendToken(node.id, 'out', token);
      return { fired: true };
    }

    if (node.type === 'outcome') {
      effect({ type: 'emit', node: node.id, activation, labels: token.labels.slice(), external: !!node.config.external, success: !!node.config.success });
      traceStep(activation, node, 'outcome', 'ok', inp, { port: null, payload: snapshot(token) }, effects);
      endActivation(token, node.id, node.config.success ? 'success' : 'failure');
      return { fired: true };
    }

    // prohibited / data have no flow behaviour
    return { fired: true };
  }

  function resolvePresented(controlNode, token) {
    const intent = token.req.intent;
    if (!intent || !intent.presentApprovalOf) return null;
    const rid = intent.presentApprovalOf;
    // most recent approval issued during an activation of request rid
    let ap = null;
    for (let i = s.approvalSeq.length - 1; i >= 0; i--) {
      const a = s.ledger.approvals[s.approvalSeq[i]];
      if (a && a.requestId === rid) { ap = a; break; }
    }
    if (!ap) return null;
    if (ap.singleUse && ap.consumedBy.length) return null;
    for (const f of Object.keys(ap.binding)) {
      if (ap.binding[f] !== token.req[f]) return null;
    }
    return ap;
  }

  function issueApproval(controlNode, token) {
    const approvers = controlNode.config.kind === 'dual_approval' ? 2 : 1;
    const sla = controlNode.config.slaMinutes ?? 15;
    const id = 'ap' + (Object.keys(s.ledger.approvals).length + 1);
    const binding = {};
    for (const f of (controlNode.config.binding || [])) binding[f] = token.req[f];
    const ap = { id, node: controlNode.id, activation: token.activation, requestId: token.requestId, binding, approvers, singleUse: !!controlNode.config.singleUse, consumedBy: [] };
    s.ledger.approvals[id] = ap;
    s.approvalSeq.push(id);
    s.latencyMinutes += sla * approvers;
    s.humanApprovals += 1;
    effect({ type: 'approval_issued', node: controlNode.id, activation: token.activation, id, binding, approvers, singleUse: ap.singleUse, latency: sla * approvers });
    return ap;
  }

  function splitAmounts(amount, k) {
    const totalCents = Math.round(amount * 100);
    const perCents = Math.round(totalCents / k);
    const pieces = [];
    for (let i = 0; i < k - 1; i++) pieces.push(perCents / 100);
    const used = perCents * (k - 1) / 100;
    pieces.push(round2(amount - used));
    return pieces;
  }

  /* ------------------------------------------------------- skip propagation */
  function forwardSkip(activation, node) {
    s.paths[activation] = s.paths[activation] || [];
    traceStep(activation, node, node.type, 'skip', null, { port: null, payload: null }, []);
    for (const port of (node.type === 'decision' ? ['true', 'false'] : node.type === 'control' ? ['approved', 'denied'] : node.type === 'outcome' ? [] : ['out'])) {
      sendSkip(node.id, port, activation);
    }
  }

  /* ----------------------------------------------------------------- deliver */
  function deliver(ev) {
    const node = nodeById(graph, ev.toNode);
    if (!node) return { none: true };
    if (ev.kind === 'skip' && s.children[ev.activation])       // a skip for a split request reaches every piece
      for (const c of s.children[ev.activation]) push({ ...ev, activation: c });
    const st = getState(ev.activation, ev.toNode);
    if (st.fired) return { none: true };
    st.delivered.add(ev.edgeId);
    if (ev.kind === 'token') { st.gotToken = true; if (!st.firstToken) st.firstToken = ev.token; }
    const inEdges = flowIn(graph, node.id);
    const join = node.config && node.config.join === 'all' ? 'all' : 'first';
    if (join === 'all') {
      if (st.delivered.size >= inEdges.length && st.gotToken) { st.fired = true; return fireNode(node, st.firstToken); }
      if (st.delivered.size >= inEdges.length && !st.gotToken) { st.fired = true; forwardSkip(ev.activation, node); return { skipped: true }; }
      return { waited: true };
    }
    // join first
    if (st.gotToken) { st.fired = true; return fireNode(node, st.firstToken); }
    if (st.delivered.size >= inEdges.length && !st.gotToken) { st.fired = true; forwardSkip(ev.activation, node); return { skipped: true }; }
    return { waited: true };
  }

  /* ------------------------------------------------------------------ start */
  function startRequest(request) {
    const trigger = request.trigger ? nodeById(graph, request.trigger) : graph.nodes.find(n => n.type === 'trigger');
    const token = { activation: request.id, requestId: request.id, parentRequestId: request.id, piece: 0, req: request, labels: [], approval: null, principal: null, injected: false, trust: null };
    if (!trigger) {
      effect({ type: 'error', node: null, activation: request.id, code: 'no_trigger', message: 'No trigger node' });
      endActivation(token, null, 'error');
      return;
    }
    token.trust = trigger.config.trust;
    if (request.injected && trigger.config.trust === 'untrusted') token.injected = true;
    // execute the trigger directly (no incoming edges)
    s.paths[token.activation] = s.paths[token.activation] || [];
    s.paths[token.activation].push(trigger.id);
    traceStep(token.activation, trigger, 'trigger', 'ok', snapshot(token), { port: 'out', payload: snapshot(token) }, []);
    sendToken(trigger.id, 'out', token);
  }

  function step() {
    if (pendingApproval) return { done: false, waiting: { activation: pendingApproval.activation, node: pendingApproval.node.id }, step: null };
    let guard = 0;
    while (true) {
      if (queue.length === 0) {
        if (requests.length) { const r = requests.shift(); startRequest(r); flushEffects(); if (queue.length) return { done: false, waiting: null, step: s.trace[s.trace.length - 1] || null }; continue; }
        finalize();
        return { done: true, waiting: null, step: null };
      }
      const ev = pop();
      const r = deliver(ev);
      flushEffects();
      if (r && r.paused) {
        return { done: false, waiting: { activation: pendingApproval.activation, node: pendingApproval.node.id }, step: null };
      }
      if (r && (r.fired || r.skipped)) {
        return { done: false, waiting: null, step: s.trace[s.trace.length - 1] || null };
      }
      if (++guard > 1000000) throw new Error('step did not terminate');
    }
  }

  /* An activation that started but never reached an outcome (e.g. a join that
     can never fire) is an execution error, not a silent success. */
  let finalized = false;
  function finalize() {
    if (finalized) return; finalized = true;
    const ended = new Set(s.activations.map(a => a.id));
    for (const act of Object.keys(s.paths).sort()) {
      if (ended.has(act) || s.children[act]) continue;
      const path = s.paths[act];
      const last = path[path.length - 1] || null;
      const [requestId, ...pieces] = act.split('#');
      effect({ type: 'error', node: last, activation: act, code: 'unfinished', message: 'Activation never reached an outcome' });
      s.activations.push({ id: act, requestId, parentRequestId: requestId, piece: pieces.length ? Number(pieces[pieces.length - 1]) : 0, status: 'error', end: last, path });
    }
    flushEffects();
  }

  function resolveApproval(approve) {
    if (!pendingApproval) return { done: false, waiting: null, step: null };
    const { activation, node, token, inp } = pendingApproval;
    pendingApproval = null;
    const effects = [];
    if (approve) {
      const ap = issueApproval(node, token);
      token.approval = ap.id;
      traceStep(activation, node, 'control', 'ok', inp, { port: 'approved', payload: snapshot(token) }, effects);
      sendSkip(node.id, 'denied', activation);
      sendToken(node.id, 'approved', token);
    } else {
      effect({ type: 'approval_denied', node: node.id, activation });
      traceStep(activation, node, 'control', 'ok', inp, { port: 'denied', payload: snapshot(token) }, effects);
      sendSkip(node.id, 'approved', activation);
      sendToken(node.id, 'denied', token);
    }
    return step();
  }

  const result = () => (queue.length === 0 && requests.length === 0 && !pendingApproval && finalize(), {
    scenarioId: s.scenarioId,
    template: s.template,
    activations: s.activations,
    trace: s.trace,
    effects: s.effects,
    ledger: { writes: s.ledger.writes, approvals: s.ledger.approvals },
    latencyMinutes: round2(s.latencyMinutes),
    humanApprovals: s.humanApprovals
  });

  return {
    step,
    resolveApproval,
    get waiting() { return pendingApproval ? { activation: pendingApproval.activation, node: pendingApproval.node.id } : null; },
    get done() { return !pendingApproval && queue.length === 0 && requests.length === 0; },
    result
  };
}
