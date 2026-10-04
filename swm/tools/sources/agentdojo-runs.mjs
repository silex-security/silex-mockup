/* Source module: AgentDojo `runs/` (public benchmark runs).
   Plan: logs/2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md (R3), Source R1.
   Contract: swm/tools/sources/CONTRACT.md — "L4 benchmark run modules".

   Reads the pinned archive Buffer and emits L4 `published` benchmark agent/tool/run/incident
   nodes. Selection is SEED.BENCHMARK_RUNS.agentdojo plus inBundle, manifest, actionsByTool, limit. */

import { gunzipSync } from 'node:zlib';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const cut = s => { const t = collapse(s); return t.length > 200 ? t.slice(0, 199).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const normIBAN = s => collapse(s).toUpperCase().replace(/\s+/g, '');
const normEmail = s => collapse(s).toLowerCase();
const normPlain = s => collapse(s);
const normField = { recipient: normIBAN, user_email: normEmail, user: normPlain, password: normPlain };

/* extract the text of a message `content` (a string, or an array of {type, content|text} parts) */
const textContent = c => typeof c === 'string' ? c
  : Array.isArray(c) ? c.map(p => typeof p === 'string' ? p : (p.content ?? p.text ?? '')).join(' ') : '';

/* ---- minimal tar reader -------------------------------------------------- */
function parseOctal(b) {
  const s = b.toString('utf8').split('\0')[0].trim();
  if (!s) return 0;
  if (s.charCodeAt(0) & 0x80) { let n = 0; for (const c of Buffer.from(s)) n = n * 256 + c; return n - (1 << (8 * s.length)); }
  return parseInt(s, 8);
}
function readTar(data) {
  const entries = [];
  let off = 0;
  while (off + 512 <= data.length) {
    const h = data.subarray(off, off + 512);
    if (h.every(b => b === 0)) break;
    const size = parseOctal(h.subarray(124, 136));
    const typeflag = String.fromCharCode(h[156]);
    const name = h.subarray(0, 100).toString('utf8').split('\0')[0];
    const prefix = h.subarray(345, 499).toString('utf8').split('\0')[0];
    const dataStart = off + 512;
    const payload = data.subarray(dataStart, dataStart + size);
    off = dataStart + Math.ceil(size / 512) * 512;
    if (typeflag === '0' || typeflag === '\0' || typeflag === '') {
      entries.push({ name: prefix ? `${prefix}/${name}` : name, data: payload });
    }
    /* '5' (directory), 'g' (PAX global), 'x' (PAX extended), 'L' (GNU long name) are skipped */
  }
  return entries;
}

/* ---- call-result pairing and predicates ---------------------------------- */
/* Pair each assistant message's tool calls with the tool-result block that immediately follows it.
   Unique `id` ↔ `tool_call_id` when both are present and unique; otherwise, all-null ids pair in
   order, one to one. A call with no paired result, an ambiguous id, or an out-of-order/partial id
   set is never evidence (`ok: false`). Exported for the parser-level tests. */
export function extractCalls(messages) {
  const calls = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const tcs = m.tool_calls;
      let j = i + 1;
      const block = [];
      while (j < messages.length && messages[j].role === 'tool') { block.push(messages[j]); j++; }
      const callsHaveIds = tcs.every(t => t.id != null);
      const resultsHaveIds = block.length > 0 && block.every(r => r.tool_call_id != null);
      const idPairing = callsHaveIds && resultsHaveIds &&
        new Set(tcs.map(t => t.id)).size === tcs.length && new Set(block.map(r => r.tool_call_id)).size === block.length;
      const orderedPairing = !callsHaveIds && !resultsHaveIds;
      for (let k = 0; k < tcs.length; k++) {
        const tc = tcs[k];
        const call = { name: tc.function, args: tc.args || {}, ok: false };
        let result = null;
        if (idPairing) {
          const matches = block.filter(r => r.tool_call_id === tc.id);
          result = matches.length === 1 ? matches[0] : null;
        } else if (orderedPairing) {
          result = k < block.length ? block[k] : null;
        }
        if (result != null) call.ok = (result.error == null || result.error === '');
        calls.push(call);
      }
      i = j;
    } else {
      i++;
    }
  }
  return calls;
}

function checkArgs(pred, args) {
  if (pred.argsEqual) for (const [k, v] of Object.entries(pred.argsEqual)) {
    const nf = normField[k] || normPlain;
    if (nf(args[k]) !== nf(v)) return false;
  }
  if (pred.argsEqualAny) {
    let any = false;
    for (const [k, v] of Object.entries(pred.argsEqualAny)) {
      const nf = normField[k] || normPlain;
      if (nf(args[k]) === nf(v)) { any = true; break; }
    }
    if (!any) return false;
  }
  if (pred.subjectContainsAny) {
    const subject = String(args.subject ?? '').toLowerCase();
    if (!pred.subjectContainsAny.some(v => subject.includes(String(v).toLowerCase()))) return false;
  }
  if (pred.subjectWordAny) {
    const words = String(args.subject ?? '').toLowerCase().split(/\s+/);
    if (!pred.subjectWordAny.some(v => words.includes(String(v).toLowerCase()))) return false;
  }
  if (pred.bodyContains && !String(args.body ?? '').toLowerCase().includes(String(pred.bodyContains).toLowerCase())) return false;
  if (pred.recipientsInclude) {
    const list = Array.isArray(args.recipients) ? args.recipients : (args.recipient ? [args.recipient] : []);
    if (!list.some(r => normEmail(r) === normEmail(pred.recipientsInclude))) return false;
  }
  return true;
}

function matchPredicate(pred, calls) {
  const matching = [];
  for (const [idx, call] of calls.entries()) {
    if (!call.ok || call.name !== pred.call) continue;
    if (!checkArgs(pred, call.args || {})) continue;
    if (pred.minAmountExclusive !== undefined || pred.maxAmount !== undefined) {
      const amount = Number(call.args?.amount);
      if (!Number.isFinite(amount)) continue;
      if (pred.minAmountExclusive !== undefined && !(amount > pred.minAmountExclusive)) continue;
      if (pred.maxAmount !== undefined && !(amount <= pred.maxAmount)) continue;
    }
    matching.push({ idx, call });
  }
  if (pred.minMatchingCalls !== undefined && matching.length < pred.minMatchingCalls) return null;
  return matching[0] || null;
}

const blob = (repo, pin, path) => `https://github.com/${repo}/blob/${pin}/${path}`;
const tree = (repo, pin, path) => `https://github.com/${repo}/tree/${pin}/${path}`;

export function parse(raws, selection) {
  const buf = raws[selection.archive];
  if (buf == null) throw new Error(`agentdojo-runs: missing raw ${selection.archive}`);
  const repo = (selection.manifest[selection.archive].url.match(/codeload\.github\.com\/([^/]+\/[^/]+)\//) || [])[1];
  const pin = selection.manifest[selection.archive].pin;
  if (!repo || !pin) throw new Error(`agentdojo-runs: cannot derive repo/pin from manifest`);
  const entries = readTar(gunzipSync(Buffer.isBuffer(buf) ? buf : Buffer.from(buf)));

  const toolFile = {};
  for (const e of entries) {
    const m = e.name.match(/src\/agentdojo\/default_suites\/v1\/tools\/([^/]+)\.py$/);
    if (m) for (const dm of e.data.toString('utf8').matchAll(/def\s+([a-z_][a-z0-9_]*)\s*\(/g)) toolFile[dm[1]] = m[1];
  }

  const runs = [];
  const re = /^agentdojo-[^/]+\/runs\/([^/]+)\/(banking|slack|workspace)\/user_task_(\d+)\/([^/]+)\/injection_task_(\d+)\.json$/;
  for (const e of entries) {
    const m = e.name.match(re);
    if (!m) continue;
    const model = m[1], suite = m[2], userTask = +m[3], attackType = m[4], injectionTask = +m[5];
    if (!selection.models.includes(model) || attackType !== selection.attackType) continue;
    if (!selection.suites[suite]?.injectionTasks.includes(injectionTask)) continue;
    runs.push({ model, suite, userTask, injectionTask, data: JSON.parse(e.data.toString('utf8')) });
  }

  const perSuite = { banking: 0, slack: 0, workspace: 0 };
  let reportedExecuted = 0;
  for (const r of runs) { perSuite[r.suite]++; if (r.data.security === true) reportedExecuted++; }
  if (runs.length !== selection.expect.runs) throw new Error(`agentdojo-runs: ${runs.length} runs, expected ${selection.expect.runs}`);
  for (const [s, n] of Object.entries(selection.expect.perSuite)) if (perSuite[s] !== n) throw new Error(`agentdojo-runs: ${s} ${perSuite[s]} runs, expected ${n}`);
  if (reportedExecuted !== selection.expect.reportedExecuted) throw new Error(`agentdojo-runs: ${reportedExecuted} reported executed, expected ${selection.expect.reportedExecuted}`);
  if (runs.length > selection.limit) throw new Error(`agentdojo-runs: ${runs.length} runs exceed limit ${selection.limit}`);

  const nodes = [], links = [], omitted = [];

  /* agents (one per model) */
  for (const model of selection.models) {
    const label = selection.modelLabel[model] || model;
    nodes.push({ id: `bench:agent:agentdojo:${model}`, label, group: 'agent', layer: 4, kind: 'planner',
      def: cut(`Public benchmark agent ${label} (AgentDojo).`), review: 'published',
      src: [{ sys: 'agentdojo', id: model, label, ver: 'v1.2.1', url: tree(repo, pin, `runs/${model}/`) }],
      benchmark: { source: 'agentdojo', model, label },
      parentLink: { t: 'ag:planner', pred: 'INSTANCE_OF', src: 'silex', review: 'curated' } });
  }

  /* calls + refusals per run, tool set. Internal calls keep `args` for predicates; the published
     record carries only compact `{ name, ok }` (message bodies and injected text are not copied). */
  const toolSet = new Map();
  const runInfo = [];
  for (const r of runs) {
    const calls = extractCalls(r.data.messages || []);
    const suite = r.suite, domain = selection.suites[suite].domain;
    const outcome = r.data.security === true ? selection.outcome.true : selection.outcome.false;
    for (const c of calls) toolSet.set(`${suite}/${c.name}`, { suite, name: c.name });
    runInfo.push({ ...r, calls, domain, outcome });
  }

  /* tools (one per distinct suite/name) */
  for (const [key, { suite, name }] of toolSet) {
    const file = toolFile[name] || 'banking_client.py';
    nodes.push({ id: `bench:tool:agentdojo:${suite}:${name}`, label: `${name} (${suite})`, group: 'tool', layer: 4, kind: 'tool-reg',
      def: cut(`Public benchmark tool ${name} (${suite}).`), review: 'published',
      src: [{ sys: 'agentdojo', id: `${suite}/${name}`, label: `AgentDojo ${suite} tool ${name}`, ver: 'v1.2.1', url: blob(repo, pin, `src/agentdojo/default_suites/v1/tools/${file}`) }],
      benchmark: { source: 'agentdojo', suite, tool: name },
      parentLink: { t: 'ag:tool-reg', pred: 'INSTANCE_OF', src: 'silex', review: 'curated' } });
    for (const act of selection.actionsByTool[`${suite}/tool/${name}`] || []) {
      if (selection.inBundle.has(act)) links.push({ s: `bench:tool:agentdojo:${suite}:${name}`, t: act, pred: 'IMPLEMENTS', src: 'silex', review: 'curated' });
    }
  }

  /* runs and incidents */
  for (const r of runInfo) {
    const rid = `bench:run:agentdojo:${r.model}:${r.suite}:user_task_${r.userTask}:injection_task_${r.injectionTask}`;
    const firstUser = (r.data.messages || []).find(m => m.role === 'user');
    const label = `${selection.modelLabel[r.model] || r.model} · ${r.suite} · user_task_${r.userTask} · injection_task_${r.injectionTask}`;
    const benchmark = { source: 'agentdojo', model: r.model, suite: r.suite, userTask: r.userTask, injectionTask: r.injectionTask,
      attackType: r.data.attack_type ?? selection.attackType, benchmarkVersion: r.data.benchmark_version, pipelineName: r.data.pipeline_name,
      outcome: r.outcome, utility: r.data.utility === true,
      calls: r.calls.map(c => ({ name: c.name, ok: c.ok })), refusals: [] };
    const runNode = { id: rid, label, group: 'workflow', layer: 4, kind: 'trace', def: cut(textContent(firstUser?.content)), review: 'published',
      src: [{ sys: 'agentdojo', id: rid, label, ver: 'v1.2.1', url: blob(repo, pin, `runs/${r.model}/${r.suite}/user_task_${r.userTask}/important_instructions/injection_task_${r.injectionTask}.json`) }],
      benchmark, domain: r.domain, parentLink: { t: 'ag:trace', pred: 'INSTANCE_OF', src: 'silex', review: 'curated' } };
    nodes.push(runNode);
    links.push({ s: rid, t: `bench:agent:agentdojo:${r.model}`, pred: 'EXECUTED_BY', src: 'agentdojo', review: 'published' });
    for (const c of r.calls) {
      const tid = `bench:tool:agentdojo:${r.suite}:${c.name}`;
      if (!links.some(l => l.s === rid && l.t === tid && l.pred === 'INVOKES')) links.push({ s: rid, t: tid, pred: 'INVOKES', src: 'agentdojo', review: 'published' });
    }
    links.push({ s: rid, t: `dom:${r.domain}`, pred: 'BELONGS_TO', src: 'silex', review: 'curated' });

    if (r.data.security !== true) continue;  // no incident for non-executed runs

    const pred = (selection.predicates || []).find(p => p.suite === r.suite && p.tasks.includes(r.injectionTask));
    const iid = `bench:inc:${rid.replace(/^bench:run:/, '')}`;
    let incidentBenchmark, exh = null;
    if (pred) {
      const hit = matchPredicate(pred, r.calls);
      if (hit) {
        const relevant = {};
        for (const k of Object.keys(pred.argsEqual || {})) relevant[k] = hit.call.args?.[k];
        for (const k of Object.keys(pred.argsEqualAny || {})) relevant[k] = hit.call.args?.[k];
        if (pred.subjectContainsAny || pred.subjectWordAny) relevant.subject = hit.call.args?.subject;
        if (pred.bodyContains) relevant.body = hit.call.args?.body;
        if (pred.recipientsInclude) relevant.recipients = hit.call.args?.recipients ?? hit.call.args?.recipient;
        if (pred.minMatchingCalls !== undefined) relevant.amount = hit.call.args?.amount;
        incidentBenchmark = { source: 'agentdojo', status: 'reported-executed',
          predicate: { hazard: pred.hazard, from: pred.from }, evidenceCall: { index: hit.idx, name: hit.call.name, args: relevant } };
        exh = `hz:${pred.hazard}`;
      } else {
        incidentBenchmark = { source: 'agentdojo', status: 'reported-executed',
          unmapped: selection.unmappedReason[`${r.suite}/${r.injectionTask}`] || selection.unmappedReason.default };
      }
    } else {
      incidentBenchmark = { source: 'agentdojo', status: 'reported-executed',
        unmapped: selection.unmappedReason[`${r.suite}/${r.injectionTask}`] || selection.unmappedReason.default };
    }
    const incNode = { id: iid, label: `Benchmark incident · ${r.outcome}`, group: 'threat', layer: 4, kind: 'incident',
      def: cut(r.outcome), review: 'published',
      src: [{ sys: 'agentdojo', id: iid, label: `AgentDojo incident ${iid}`, ver: 'v1.2.1', url: blob(repo, pin, `runs/${r.model}/${r.suite}/user_task_${r.userTask}/important_instructions/injection_task_${r.injectionTask}.json`) }],
      benchmark: incidentBenchmark, domain: r.domain, parentLink: { t: rid, pred: 'OCCURRED_IN', src: 'silex', review: 'curated' } };
    nodes.push(incNode);
    links.push({ s: iid, t: `dom:${r.domain}`, pred: 'BELONGS_TO', src: 'silex', review: 'curated' });
    if (exh) links.push({ s: iid, t: exh, pred: 'EXHIBITS', src: 'silex', review: 'curated' });
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  links.sort((a, b) => `${a.s}|${a.t}|${a.pred}`.localeCompare(`${b.s}|${b.t}|${b.pred}`));
  return { nodes, links, sources: {}, omitted };
}
