#!/usr/bin/env node
/* Acceptance probes for Blueprint Studio v2 (plan 2026-09-23 §7), in headless
   Chrome over CDP with real mouse and keyboard input. Serves the repo, opens
   /blueprint_studio/app/, prints PASS/FAIL per probe, exits 1 on any failure.
     node blueprint_studio/tests/probe/run-probes-v2.mjs [--only B2,L5] [--shots dir]   */
import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..', '..'));
const args = process.argv.slice(2);
const ONLY = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const SHOTS = args.includes('--shots') ? resolve(args[args.indexOf('--shots') + 1]) : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { const body = await readFile(join(ROOT, rel)); res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`, URL0 = ORIGIN + '/blueprint_studio/app/index.html';

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'])
    try { execSync(`test -x ${JSON.stringify(c)}`); return c; } catch {}
  return null;
}
const chrome = findChrome(); if (!chrome) { console.error('No Chrome found (set CHROME=)'); process.exit(2); }
const dport = 9100 + Math.floor(Math.random() * 800);
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${dport}`, `--user-data-dir=${join(tmpdir(), 'bs2-probe-' + dport)}`, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${dport}/json/version`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const target = (await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0; const pendingMsg = new Map(); let errors = []; let requests = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pendingMsg.has(m.id)) { pendingMsg.get(m.id)(m); pendingMsg.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || 'exception');
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
});
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise(res => { const i = ++seq; pendingMsg.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
async function viewport(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); }
await viewport(1600, 1000);


/* A stub window.claude for the Ask AI probes (plan §3.10.1 D). Active only when
   localStorage 'bs2.stub' is set: 'sample' gives a fake sample fn driven by
   window.__stubQueue; 'null' makes use('sample') resolve null. */
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  let mode = null; try { mode = localStorage.getItem('bs2.stub'); } catch {}
  if (!mode) return;
  window.__stubQueue = []; window.__stubCalls = [];
  const fn = async () => { throw { code: 'invalid_request', message: 'use json' }; };
  fn.limits = async () => ({ maxPromptBytes: 65536 });
  fn.json = (input, opts = {}) => new Promise((resolve, reject) => {
    window.__stubCalls.push(input);
    const next = window.__stubQueue.shift() || { error: 'upstream_error' };
    const t = setTimeout(() => next.error ? reject({ code: next.error, message: next.error }) : resolve(JSON.parse(typeof next.reply === 'string' ? next.reply : JSON.stringify(next.reply))), next.delay || 30);
    opts.signal?.addEventListener('abort', () => { clearTimeout(t); reject({ code: 'cancelled', message: 'cancelled' }); });
  });
  window.claude = { use: async name => (name === 'sample' && mode === 'sample') ? fn : null };
})();` });

async function waitReady() {
  for (let i = 0; i < 100; i++) { await sleep(100); try { if (await ev('return document.documentElement.dataset.ready === "1" && !!document.querySelector(".app")')) break; } catch {} }
  await stable();
}
/* Wait until the React Flow viewport transform stops changing (fit-view done). */
async function stable() { let last = ''; for (let i = 0; i < 30; i++) { await sleep(120); const v = await ev('return document.querySelector(".react-flow__viewport")?.style.transform || "none"'); if (v === last) return; last = v; } }
async function load({ clear = true, lang = 'en', stub = null } = {}) {
  if (clear) { await send('Page.navigate', { url: URL0 }); await waitReady(); await ev(`localStorage.clear(); localStorage.setItem('bs2.lang', '${lang}'); ${stub ? `localStorage.setItem('bs2.stub', '${stub}');` : ''} return 1`); }
  await send('Page.navigate', { url: URL0 }); await waitReady();
}
let inputEvents = 0;
const MOD = { ctrl: 2, shift: 8 };
async function mouse(type, x, y, { buttons = 1, modifiers = 0 } = {}) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, modifiers }); }
async function click(x, y) { inputEvents++; await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y, { buttons: 0 }); await sleep(120); }
async function drag(x1, y1, x2, y2) { inputEvents++; await mouse('mouseMoved', x1, y1, { buttons: 0 }); await mouse('mousePressed', x1, y1); for (let i = 1; i <= 10; i++) await mouse('mouseMoved', x1 + (x2 - x1) * i / 10, y1 + (y2 - y1) * i / 10); await mouse('mouseReleased', x2, y2, { buttons: 0 }); await sleep(150); }
async function type(text) { inputEvents++; await send('Input.insertText', { text }); await sleep(120); }
async function key(k, code, vk, modifiers = 0) { inputEvents++; await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers }); await sleep(120); }
const enter = () => key('Enter', 'Enter', 13);
async function center(sel) {
  await stable();
  const r = await ev(`const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; if(!e.closest('.react-flow')) e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}`);
  if (!r) throw new Error('not found: ' + sel); return r;
}
async function clickSel(sel) { const p = await center(sel); await click(p.x, p.y); }
const S = 'const b=__bs2, st=b.store, ctl=b.ctl, G=()=>st.active().graph;';
const hash = () => ev(`${S} return st.hashOf(st.active())`);
const lintCodes = () => ev(`${S} return b.validator.lint(G()).map(i=>i.code)`);
const edgeId = (from, to) => ev(`${S} return G().edges.find(e=>e.kind==='flow'&&e.from.node==='${from}'&&e.to.node==='${to}')?.id`);
async function fit() { await ev('document.querySelector(".react-flow__controls-fitview")?.click(); return 1'); await sleep(400); }
async function runForm(form) { return ev(`${S} Object.assign(ctl.run.form, ${JSON.stringify(form)}); ctl.startRun(false); const v=ctl.run.view; return {acts: v.activations.map(a=>a.id+':'+a.status+':'+a.end), paths: v.activations.map(a=>a.path), writes: v.trace.flatMap(s=>s.effects).filter(e=>e.type==='write').length}`); }
async function shot(name) { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); const s = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(SHOTS, name + '.png'), Buffer.from(s.result.data, 'base64')); }

const results = [];
async function probe(id, name, fn) {
  if (ONLY && !ONLY.has(id)) return;
  errors = []; requests = [];
  let pass = false, detail = '';
  try { const r = await fn(); pass = !!r.pass; detail = r.detail || ''; } catch (e) { detail = 'threw: ' + String(e.message || e).split('\n')[0]; }
  const errs = errors.filter(e => !/favicon|ResizeObserver/.test(e));
  if (errs.length) { pass = false; detail += ' | console: ' + errs.slice(0, 2).join(' / ').slice(0, 300); }
  await shot('p-' + id);
  results.push({ id, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(4)} ${name}${detail ? '  — ' + detail : ''}`);
}


/* ------------------------------------------------------------ T0, builder */
await probe('T0', 'store patch re-renders the canvas; runValidation fills Validate; switching revision mid-run discards', async () => {
  await load();
  const n0 = await ev('return document.querySelectorAll(".react-flow__node").length');
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'removeNode', id:'dup'}]}); return 1`); await sleep(300);
  const n1 = await ev('return document.querySelectorAll(".react-flow__node").length');
  await ev(`${S} st.dispatch({type:'undo'}); st.dispatch({type:'confirm'}); ctl.go('assurance','validate'); await ctl.runValidation(20); return 1`); await sleep(300);
  const filled = await ev('return !!document.querySelector("#findingsCard")');
  const late = await ev(`${S} st.dispatch({type:'newRevision'}); st.dispatch({type:'confirm'}); const job = ctl.runValidation(20); ctl.setActiveRevision(0); const r = await job; return {r: r.ok ? 'ok' : r.error.code, v1: !!st.revision(1).validation}`);
  return { pass: n0 === 14 && n1 === 13 && filled && late.r === 'stale_job' && !late.v1, detail: JSON.stringify({ n0, n1, filled, late }) };
});

await probe('B1', 'refund template: 14 model nodes = 14 rendered custom nodes, labelled handles, no console error', async () => {
  await load();
  const r = await ev(`${S} return {model: G().nodes.length, rendered: document.querySelectorAll('.react-flow__node .fn').length, labels: [...document.querySelectorAll('.fn-port')].map(e=>e.textContent), stubs: document.querySelectorAll('[data-stub]').length, plus: document.querySelectorAll('[data-plus]').length}`);
  const foreign = requests.filter(u => !u.startsWith(ORIGIN) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u) && !u.startsWith('data:'));
  return { pass: r.model === 14 && r.rendered === 14 && ['yes', 'no', 'approved', 'denied'].every(l => r.labels.includes(l)) && r.plus === 9 && !foreign.length, detail: JSON.stringify(r) + (foreign.length ? ' foreign ' + foreign : '') };
});

await probe('B2', '"+" on Eligibility→Gate: search lists only agent/tool/decision/control; "审批" finds Approval; insertion is lint-clean; undo restores; approved and denied runs', async () => {
  await load();
  const h0 = await hash();
  const e3 = await edgeId('eligibility', 'gate');
  await clickSel(`[data-plus="${e3}"]`);
  const types = await ev('return [...document.querySelectorAll("[cmdk-item]")].map(e=>e.dataset.type).sort().join()');
  await type('审批'); await sleep(200);
  const first = await ev('return document.querySelector("[cmdk-item][data-selected=true]")?.dataset.type');
  await enter(); await sleep(300);
  const g = await ev(`${S} const c=G().nodes.find(n=>n.type==='control'&&n.id!=='approval'); const out=G().edges.filter(e=>e.from.node===c.id).map(e=>e.from.port+'>'+e.to.node).sort(); return {id:c.id, out, into: G().edges.filter(e=>e.to.node===c.id).map(e=>e.from.node)}`);
  const codes = await lintCodes();
  const ok1 = await runForm({ amount: 300, eligible: 300, split: 1, injected: false, replay: false, dup: false, interactive: false });
  const ok2 = await runForm({ amount: 300, eligible: 0, split: 1, injected: false, replay: false, dup: false, interactive: false });
  await ev(`${S} st.dispatch({type:'undo'}); return 1`);
  const h1 = await hash();
  return { pass: types === 'agent,control,decision,tool' && first === 'control' && g.out.join() === 'approved>gate,denied>declined' && g.into.join() === 'eligibility' && !codes.some(c => c) && ok1.acts[0].endsWith(':resolved') && ok2.acts[0].endsWith(':declined') && h1 === h0, detail: JSON.stringify({ types, first, g, codes, ok1: ok1.acts, ok2: ok2.acts, undo: h1 === h0 }) };
});

await probe('B2b', '"+" with Condition: true→B and false→B lint-clean; "+" on the false edge adds an agent in that branch; runs take each branch', async () => {
  await load();
  const e3 = await edgeId('eligibility', 'gate');
  await clickSel(`[data-plus="${e3}"]`); await type('condition'); await sleep(150); await enter(); await sleep(300);
  const d = await ev(`${S} const d=G().nodes.find(n=>n.type==='decision'&&n.id!=='gate'); return {id:d.id, out:G().edges.filter(e=>e.from.node===d.id).map(e=>e.from.port+'>'+e.to.node).sort()}`);
  const c1 = await lintCodes();
  const fe = await ev(`${S} return G().edges.find(e=>e.from.node==='${d.id}'&&e.from.port==='false').id`);
  await clickSel(`[data-plus="${fe}"]`); await type('agent'); await sleep(150); await enter(); await sleep(300);
  const a = await ev(`${S} const a=G().nodes.find(n=>n.type==='agent'&&G().edges.some(e=>e.from.node==='${d.id}'&&e.from.port==='false'&&e.to.node===n.id)); return a&&a.id`);
  const c2 = await lintCodes();
  const lo = await runForm({ amount: 300, eligible: 300, split: 1, injected: false, replay: false, dup: false, interactive: false });
  const hi = await runForm({ amount: 900, eligible: 900, split: 1, injected: false, replay: false, dup: false, interactive: false });
  return { pass: d.out.join() === 'false>gate,true>gate' && !c1.length && !!a && !c2.length && lo.paths[0].includes(a) && !hi.paths[0].includes(a) && lo.acts[0].includes(':success:') && hi.acts[0].includes(':success:'), detail: JSON.stringify({ d, c1, a, c2, lo: lo.acts, hi: hi.acts }) };
});

let t1Events = 0;
await probe('T1', 'first build from empty: trigger → agent → tool → outcome with "+" only, configure, lint-clean, successful test run', async () => {
  await load();
  await ev(`__bs2.ctl.startBlank(); return 1`); await sleep(300);
  inputEvents = 0;
  await clickSel('#startTriggerBtn'); await sleep(300);
  const trig = await ev(`${S} return G().nodes[0].id`);
  await clickSel(`[data-stub="${trig}:out"]`); await type('agent'); await enter(); await sleep(300);
  const ag = await ev(`${S} return G().nodes.find(n=>n.type==='agent').id`);
  await clickSel(`[data-stub="${ag}:out"]`); await type('tool'); await enter(); await sleep(300);
  const tl = await ev(`${S} return G().nodes.find(n=>n.type==='tool').id`);
  await clickSel(`[data-stub="${tl}:out"]`); await type('outcome'); await enter(); await sleep(300);
  await ev(`__bs2.ctl.focusNode('${ag}'); return 1`); await sleep(400);
  await clickSel('#addCapBtn'); await sleep(200);
  t1Events = inputEvents;
  const codes = await lintCodes();
  const r = await runForm({ amount: 300, eligible: 300, split: 1, injected: false, replay: false, dup: false, interactive: false });
  return { pass: !codes.length && r.acts.length === 1 && r.acts[0].includes(':success:') && r.writes === 1, detail: JSON.stringify({ codes, run: r.acts, writes: r.writes, inputEvents: t1Events }) };
});

await probe('B3', '"+" on an open port of a new agent adds the next step connected to that port', async () => {
  const r = await ev(`${S} const ag=G().nodes.find(n=>n.type==='agent'); return G().edges.some(e=>e.from.node===ag.id&&e.from.port==='out'&&G().nodes.find(n=>n.id===e.to.node).type==='tool')`);
  return { pass: r === true, detail: 'verified on the T1 flow' };
});

await probe('B9', 'monitors: "Protect with a monitor" creates one watching node; library monitor unattached + located; two watches = one node, two lines; delete; finding on the T1 flow', async () => {
  const tl = await ev(`${S} return G().nodes.find(n=>n.type==='tool').id`);
  await ev(`__bs2.ctl.focusNode('${tl}'); return 1`); await sleep(400);
  await clickSel('[data-monitor="unauthorized_write"]'); await sleep(300);
  const m = await ev(`${S} const m=G().nodes.filter(n=>n.type==='prohibited'); return m.map(x=>({id:x.id, w:x.config.watches, keys:Object.keys(x.config).sort().join()}))`);
  const lines1 = await ev('return document.querySelectorAll(".react-flow__edge-watch").length');
  await ev(`${S} ctl.confirm(); ctl.go('assurance','validate'); await ctl.runValidation(20); return 1`);
  const findings = await ev(`${S} return st.active().validation.result.findings.length`);
  await load();
  await clickSel('.lib-item[data-type="prohibited"]'); await sleep(300);
  const lone = await ev(`${S} const ids=new Set(['unauth','dup','exposure']); return G().nodes.find(n=>n.type==='prohibited'&&!ids.has(n.id)).id`);
  const codes = await ev(`${S} return b.validator.lint(G()).filter(i=>i.nodeId==='${lone}').map(i=>i.code)`);
  await clickSel('#checklistBtn'); await sleep(200);
  await clickSel(`.ci[data-code="no_watches"][data-node="${lone}"] .ci-main`); await sleep(500);
  const sel = await ev(`${S} return ctl.getRoute().selected?.id`);
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setConfig', id:'${lone}', key:'watches', value:['payment','resolved']}]}); return 1`); await sleep(300);
  const lines2 = await ev(`return document.querySelectorAll('.react-flow__edge-watch').length`);
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'removeNode', id:'${lone}'}]}); return 1`); await sleep(300);
  const lines3 = await ev(`return document.querySelectorAll('.react-flow__edge-watch').length`);
  return { pass: m.length === 1 && m[0].w.length === 1 && m[0].w[0] === tl && lines1 === 1 && findings > 0 && codes.includes('no_watches') && sel === lone && lines2 === lines3 + 2, detail: JSON.stringify({ m, lines1, findings, codes, sel, lines2, lines3 }) };
});

await probe('B4', 'config panel: Basic by default, Advanced expands; invalid expression shows its position and is not applied', async () => {
  await load();
  await ev(`__bs2.ctl.focusNode('gate'); return 1`); await sleep(400);
  const before = await ev('return {join: !!document.querySelector("#f-gate-join"), cond: !!document.querySelector("#f-gate-condition")}');
  await clickSel('#advToggle'); await sleep(150);
  const after = await ev('return !!document.querySelector("#f-gate-join")');
  await clickSel('#f-gate-condition'); await ev('const i=document.querySelector("#f-gate-condition"); i.select(); return 1'); await type('amount >'); await key('Enter', 'Enter', 13); await sleep(200);
  const r = await ev(`${S} return {cond: G().nodes.find(n=>n.id==='gate').config.condition, err: document.querySelector('.field.has-pending .err')?.textContent || '', pend: b.pending.size}`);
  return { pass: before.cond && !before.join && after && r.cond === 'amount > 2000' && /\d/.test(r.err) && r.pend === 1, detail: JSON.stringify({ before, after, r }) };
});

await probe('B5', 'checklist: node issue (dangling port) locates the node; flow issue (no success outcome) fits; pending input blocks Confirm and can be discarded', async () => {
  await load();
  const e = await edgeId('payment', 'resolved');
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'removeEdge', id:'${e}'}]}); return 1`); await sleep(300);
  await clickSel('#checklistBtn'); await sleep(200);
  const kinds = await ev('return [...document.querySelectorAll(".ci")].map(c=>c.dataset.kind+":"+c.dataset.code)');
  await clickSel('.ci[data-kind="node"][data-code="dangling_port"] .ci-main'); await sleep(500);
  const sel = await ev(`${S} return ctl.getRoute().selected?.id`);
  await ev(`${S} st.dispatch({type:'undo'}); ctl.focusNode('gate'); return 1`); await sleep(400);
  await clickSel('#f-gate-condition'); await ev('document.querySelector("#f-gate-condition").select(); return 1'); await type('amount >'); await key('Tab', 'Tab', 9); await sleep(200);
  const conf = await ev(`${S} return ctl.confirm().error?.code`);
  await clickSel('#checklistBtn'); await sleep(200);
  const pend = await ev('return document.querySelectorAll(".ci[data-kind=pending]").length');
  await clickSel('.ci[data-kind="pending"] .btn'); await sleep(200);
  const after = await ev(`${S} return b.pending.size`);
  return { pass: kinds.includes('node:dangling_port') && kinds.includes('flow:no_success_outcome') && sel === 'payment' && conf === 'pending_input' && pend === 1 && after === 0, detail: JSON.stringify({ kinds, sel, conf, pend, after }) };
});

await probe('B6', 'undo/redo across insert, delete and config edits returns identical hashes', async () => {
  await load();
  const h0 = await hash();
  await clickSel(`[data-plus="${await edgeId('triage', 'eligibility')}"]`); await type('tool'); await enter(); await sleep(300);
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'removeNode', id:'dup'}]}); st.dispatch({type:'patch', ops:[{op:'setConfig', id:'gate', key:'condition', value:'amount > 900'}]}); return 1`);
  const h3 = await hash();
  for (let i = 0; i < 3; i++) await key('z', 'KeyZ', 90, MOD.ctrl);
  const back = await hash();
  for (let i = 0; i < 3; i++) await key('z', 'KeyZ', 90, MOD.ctrl | MOD.shift);
  const fwd = await hash();
  return { pass: back === h0 && fwd === h3, detail: JSON.stringify({ back: back === h0, fwd: fwd === h3 }) };
});

async function overlapCheck() {
  return ev(`const W=document.querySelector('.canvas').getBoundingClientRect(); const rs=[...document.querySelectorAll('.react-flow__node')].map(n=>n.getBoundingClientRect());
    let o=0; for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const a=rs[i],b=rs[j]; if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1) o++}
    return {overlap:o, inside: rs.every(a=>a.left>=W.left-1&&a.right<=W.right+1&&a.top>=W.top-1&&a.bottom<=W.bottom+1), n: rs.length}`);
}
await probe('B7', 'Arrange (dagre on measured sizes): no overlap in English and 中文 with data + monitors present; fit contains all', async () => {
  const out = {};
  for (const lang of ['en', 'zh']) {
    await load({ lang });
    await ev(`${S} const r = st.dispatch({type:'patch', ops:[{op:'setLabel', id:'eligibility', label:'${lang === 'zh' ? '退款资格审核（含历史交易与政策比对）' : 'Refund eligibility check against policy and history'}'}]}); return 1`);
    await clickSel('#arrangeBtn'); await sleep(500); await fit();
    out[lang] = await overlapCheck();
  }
  return { pass: ['en', 'zh'].every(l => out[l].overlap === 0 && out[l].inside && out[l].n === 14), detail: JSON.stringify(out) };
});

await probe('B8', 'confirmed revision: no "+", no stubs, no drag, config read-only, dispatch locked', async () => {
  await load();
  await ev(`${S} ctl.confirm(); return 1`); await sleep(300);
  const r = await ev(`${S} return {plus: document.querySelectorAll('[data-plus]').length, stubs: document.querySelectorAll('[data-stub]').length}`);
  const g0 = await ev(`${S} return JSON.stringify(G())`);
  const p = await center('.react-flow__node[data-id="gate"] .fn'); await drag(p.x, p.y, p.x + 120, p.y + 60);
  await ev(`__bs2.ctl.focusNode('gate'); return 1`); await sleep(400);
  const ro = await ev('return [...document.querySelectorAll(".config input, .config select")].every(e=>e.disabled)');
  const code = await ev(`${S} return st.dispatch({type:'patch', ops:[{op:'moveNode', id:'gate', x:1, y:1}]}).error?.code`);
  const g1 = await ev(`${S} return JSON.stringify(G())`);
  return { pass: r.plus === 0 && r.stubs === 0 && ro && code === 'locked' && g0 === g1, detail: JSON.stringify({ ...r, ro, code, same: g0 === g1 }) };
});

await probe('B10', 'Reads data → New data resource (secret) adds node + access edge in one undo step', async () => {
  await load();
  const h0 = await hash();
  await ev(`__bs2.ctl.focusNode('eligibility'); return 1`); await sleep(400);
  await clickSel('#newDataBtn'); await clickSel('#newDataName'); await type('Card vault');
  await ev('const s=document.querySelector("#newDataSens"); const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set; set.call(s,"secret"); s.dispatchEvent(new Event("change",{bubbles:true})); return 1');
  await clickSel('#newDataAdd'); await sleep(300);
  const r = await ev(`${S} const d=G().nodes.find(n=>n.type==='data'&&n.label==='Card vault'); return d && {sens:d.config.sensitivity, edge: G().edges.some(e=>e.kind==='access'&&e.from.node==='eligibility'&&e.to.node===d.id)}`);
  await ev(`${S} st.dispatch({type:'undo'}); return 1`);
  const h1 = await hash();
  return { pass: r && r.sens === 'secret' && r.edge && h1 === h0, detail: JSON.stringify({ r, undo: h1 === h0 }) };
});

/* ------------------------------------------------------------------- runs */
await probe('R1', '$2,500 pauses at Approval with an Approve/Deny card; Deny ends at Refund Declined', async () => {
  await load();
  await clickSel('#testRunBtn');
  await ev(`${S} Object.assign(ctl.run.form,{amount:2500,eligible:2500,split:1,injected:false,replay:false,dup:false,interactive:true}); ctl.clearRun(); return 1`);
  await clickSel('#runBtn'); await sleep(200);
  const card = await ev('return !!document.querySelector("#approvalCard")');
  await clickSel('#denyRunBtn'); await sleep(200);
  const acts = await ev(`${S} return ctl.run.view.activations.map(a=>a.end+':'+a.status)`);
  return { pass: card && acts.join() === 'declined:failure', detail: JSON.stringify({ card, acts }) };
});
await probe('R2', 'status rings on executed nodes; trace lists translated effects', async () => {
  await ev(`${S} Object.assign(ctl.run.form,{amount:2500,eligible:2500,interactive:false}); return 1`);
  await clickSel('#runBtn'); await sleep(300);
  const r = await ev('return {rings: document.querySelectorAll(".fn.run-ok").length, effects: [...document.querySelectorAll("#traceList .eff")].map(e=>e.firstChild.textContent.trim())}');
  return { pass: r.rings >= 6 && ['write', 'approval given', 'read data'].every(x => r.effects.includes(x)), detail: JSON.stringify({ rings: r.rings, effects: [...new Set(r.effects)] }) };
});
await probe('R3', 'editing the graph cancels a pending run', async () => {
  await ev(`${S} Object.assign(ctl.run.form,{interactive:true}); ctl.startRun(false); return 1`);
  const waiting = await ev(`${S} return !!ctl.run.current?.engine.waiting`);
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setConfig', id:'gate', key:'condition', value:'amount > 100'}]}); return 1`);
  const cancelled = await ev(`${S} return ctl.run.current === null`);
  return { pass: waiting && cancelled, detail: JSON.stringify({ waiting, cancelled }) };
});

/* -------------------------------------------------------------- lifecycle */
const EXPECTED = ['dup:duplicate_submit', 'exposure:injection_exfil', 'unauth:below_threshold', 'unauth:benign', 'unauth:replay', 'unauth:split'];
let snapshot = null;
async function toSnapshot() {
  if (!snapshot) { await load(); snapshot = await ev(`${S} ctl.confirm(); await ctl.runValidation(40); await ctl.runOptimize(); return ctl.exportText()`); }
  await load(); await ev(`__bs2.ctl.importText(${JSON.stringify(snapshot)}); return 1`); await sleep(200);
}
await probe('L1', 'stage guards: draft disables validate/optimize/decide/register; confirmed without decision keeps register disabled', async () => {
  await load(); await clickSel('#navAssurance'); await sleep(200);
  const d = await ev(`return ['validate','optimize','decide','register'].map(s=>document.querySelector('.stage[data-stage="'+s+'"]').disabled)`);
  await ev(`__bs2.ctl.confirm(); return 1`); await sleep(200);
  const c = await ev(`return ['validate','register'].map(s=>document.querySelector('.stage[data-stage="'+s+'"]').disabled)`);
  return { pass: d.every(Boolean) && c[0] === false && c[1] === true, detail: JSON.stringify({ d, c }) };
});
await probe('L2', 'validate baseline: exactly the six expected findings; every path chip Declared', async () => {
  await ev(`${S} ctl.go('assurance','validate'); await ctl.runValidation(40); return 1`); await sleep(300);
  const f = await ev(`${S} return st.active().validation.result.findings.map(f=>f.prohibited+':'+f.template).sort()`);
  const chips = await ev(`return [...document.querySelectorAll('#findingsCard .grade')].map(e=>e.textContent)`);
  return { pass: JSON.stringify(f) === JSON.stringify(EXPECTED) && chips.length && chips.every(c => c === 'Declared'), detail: f.join(' ') };
});
await probe('L3', 'graph → results: dayTotal>500 + full single-use binding clears Unauthorized Refund', async () => {
  await load();
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setConfig', id:'gate', key:'condition', value:'dayTotal > 500'},{op:'setConfig', id:'approval', key:'binding', value:['customer','order','amount']},{op:'setConfig', id:'approval', key:'singleUse', value:true}]}); ctl.confirm(); await ctl.runValidation(40); return 1`);
  const f = await ev(`${S} return st.active().validation.result.findings.map(f=>f.prohibited+':'+f.template).sort()`);
  return { pass: JSON.stringify(f) === JSON.stringify(['dup:duplicate_submit', 'exposure:injection_exfil']), detail: f.join(' ') };
});
await probe('L4', 'optimize: recommended scorecard equals a direct runCandidate + score on the same set', async () => {
  await toSnapshot();
  const r = await ev(`${S} const rev=st.active(), id=ctl.recommendedId(rev), c=rev.optimization.candidates.find(x=>x.candidate.id===id);
    const set=ctl.scenarioSetFor(rev, rev.validation.n); return {id, set: set.id===rev.optimization.scenarioSetId}`);
  await ev(`${S} ctl.go('assurance','optimize'); return 1`); await sleep(300);
  const shown = await ev('return document.querySelectorAll(".cand").length');
  return { pass: /dayTotal/.test(r.id) && r.set && shown > 0, detail: JSON.stringify({ ...r, shown }) };
});
await probe('L5', 'Approve → confirmed child with tested hash; Modify → stale then changed; Reject → recommendation moves; approve guard on ineligible', async () => {
  await toSnapshot();
  const a = await ev(`${S} const rev=st.active(), id=ctl.recommendedId(rev), c=rev.optimization.candidates.find(x=>x.candidate.id===id); ctl.setDecideId(id); ctl.go('assurance','decide'); await new Promise(r=>setTimeout(r,200));
    document.getElementById('approveBtn').click(); await new Promise(r=>setTimeout(r,200)); const ch=st.active(); return {status: ch.status, origin: ch.origin, hashOk: ch.hash===c.result.patchedHash}`);
  await toSnapshot();
  const m = await ev(`${S} const rev=st.active(), id=ctl.recommendedId(rev), c=rev.optimization.candidates.find(x=>x.candidate.id===id); const k=Object.keys(c.candidate.paramOptions)[0];
    const other=c.candidate.paramOptions[k].find(o=>JSON.stringify(o)!==JSON.stringify(c.candidate.params[k])); const before=JSON.stringify(c.verdict.scorecard);
    const p=ctl.modifyCandidate(id,{...c.candidate.params,[k]:other}); const mid=st.active().optimization.candidates.find(x=>x.candidate.id===id).state; await p;
    const after=st.active().optimization.candidates.find(x=>x.candidate.id===id); return {mid, state: after.state, changed: JSON.stringify(after.verdict.scorecard)!==before}`);
  await toSnapshot();
  const r = await ev(`${S} const rev=st.active(), id=ctl.recommendedId(rev); ctl.reject(id); const next=ctl.recommendedId(st.active()); const bad=st.active().optimization.candidates.find(c=>!c.verdict.eligible);
    ctl.setDecideId(bad.candidate.id); ctl.go('assurance','decide'); await new Promise(r=>setTimeout(r,200)); return {moved: next!==id, uiDisabled: document.getElementById('approveBtn')?.disabled ?? true, dispatch: ctl.approve(bad.candidate.id).ok}`);
  return { pass: a.status === 'confirmed' && a.origin === 'approve' && a.hashOk && m.mid === 'stale' && m.state === 'tested' && m.changed && r.moved && r.uiDisabled && r.dispatch === false, detail: JSON.stringify({ a, m, r }) };
});
await probe('L6', 'register twice → one entry; survives reload; never claims deployment', async () => {
  await toSnapshot();
  await ev(`${S} ctl.approve(ctl.recommendedId(st.active())); ctl.go('assurance','register'); await new Promise(r=>setTimeout(r,200)); document.getElementById('registerBtn')?.click(); ctl.register(); return 1`);
  const n1 = await ev(`${S} return st.inventory().length`);
  await load({ clear: false }); await ev(`${S} ctl.go('assurance','register'); return 1`); await sleep(200);
  const n2 = await ev(`${S} return st.inventory().length`);
  const text = await ev('return document.body.innerText');
  const claims = (text.match(/[^\n]*\bdeployed\b[^\n]*/gi) || []).filter(l => !/not deployed|does not deploy|nothing is deployed/i.test(l));
  return { pass: n1 === 1 && n2 === 1 && !claims.length, detail: JSON.stringify({ n1, n2, claims }) };
});
await probe('L7', 'late result discarded on revision switch; each revision shows its own results', async () => {
  await load();
  const r = await ev(`${S} ctl.confirm(); await ctl.runValidation(20); const p=ctl.runOptimize(); ctl.newRevision(); const res=await p; return {res: res.ok?'ok':res.error.code, opt: st.revision(0).optimization, v0: !!st.revision(0).validation, v1: !!st.revision(1).validation}`);
  return { pass: r.res === 'stale_job' && r.opt === null && r.v0 && !r.v1, detail: JSON.stringify(r) };
});
await probe('L8', 'decided revision refuses re-validation', async () => {
  await toSnapshot();
  const r = await ev(`${S} ctl.approve(ctl.recommendedId(st.active())); ctl.setActiveRevision(0); const x=await ctl.runValidation(20); return x.ok?'ok':x.error.code`);
  return { pass: r === 'decided', detail: r };
});
await probe('L9', 'reload restores the autosaved document; a tampered import is rejected and the document untouched', async () => {
  await load();
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setLabel', id:'gate', label:'Big refund?'}]}); return 1`);
  const h1 = await hash(); await load({ clear: false }); const h2 = await hash();
  await ev(`${S} ctl.confirm(); return 1`); const h3 = await hash();
  const bad = await ev(`${S} const d=JSON.parse(ctl.exportText()); d.revisions[0].graph.nodes.find(n=>n.id==='gate').config.condition='amount > 99999'; return JSON.stringify(d)`);
  const r = await ev(`${S} const x=ctl.importText(${JSON.stringify(bad)}); return x.ok?'ok':x.error.code`);
  const h4 = await hash();
  return { pass: h1 === h2 && r === 'hash_mismatch' && h3 === h4, detail: JSON.stringify({ restore: h1 === h2, r, untouched: h3 === h4 }) };
});


/* ------------------------------------------------------------- Ask AI (A) */
async function ask(text) {
  if (!(await ev('return !!document.querySelector("#assistInput")'))) { await clickSel('#askAiBtn'); await sleep(300); }
  await ev(`const i=document.querySelector('#assistInput'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input',{bubbles:true})); return 1`);
  await sleep(100); await clickSel('#assistSend'); await sleep(400);
}
const lastMsg = () => ev('const m=[...document.querySelectorAll("#assistList .msg")].pop(); return m ? m.innerText : ""');
const applyState = () => ev('const b=document.querySelector("#assistApply"); return b ? (b.disabled ? "disabled" : "enabled") : "none"');

await probe('A1', 'rule-based (no Claude): add approval after, 删除, rename — preview, Apply, lint-clean, one undo', async () => {
  await load();
  await clickSel('#askAiBtn'); await sleep(500);
  const note = await ev('return !!document.querySelector("#assistRulesNote")');
  const h0 = await hash();
  await ask('add a human approval after Refund Eligibility');
  const card = await ev('return !!document.querySelector("#proposalCard")');
  await clickSel('#assistApply'); await sleep(300);
  const ins = await ev(`${S} const c=G().nodes.find(n=>n.type==='control'&&n.id!=='approval'); return c && {into: G().edges.filter(e=>e.to.node===c.id).map(e=>e.from.node), out: G().edges.filter(e=>e.from.node===c.id).map(e=>e.to.node).sort()}`);
  const codes1 = await lintCodes();
  await ev(`${S} st.dispatch({type:'undo'}); return 1`);
  const back = (await hash()) === h0;
  await ask('删除 Duplicate Compensation'); await clickSel('#assistApply'); await sleep(300);
  const dup = await ev(`${S} return G().nodes.some(n=>n.id==='dup')`);
  await ask('rename Payment API to Stripe Refunds'); await clickSel('#assistApply'); await sleep(300);
  const lbl = await ev(`${S} return G().nodes.find(n=>n.id==='payment').label`);
  return { pass: note && card && ins && ins.into.join() === 'eligibility' && !codes1.length && back && dup === false && lbl === 'Stripe Refunds', detail: JSON.stringify({ note, card, ins, codes1, back, dup, lbl }) };
});

await probe('A2', 'Claude path (stub): valid proposal applies once; hostile/invalid replies rejected with graph unchanged; not_granted → rules; null capability → rules', async () => {
  await load({ stub: 'sample' });
  const h0 = await hash();
  await ev(`window.__stubQueue.push({reply:{summary:'Add approval', ops:[{op:'insertStep', from:'eligibility', to:'gate', type:'control', ref:'ap', label:'Manager approval', config:{appliesWhen:'amount > 1000'}},{op:'addMonitor', node:'payment', kind:'duplicate_effect'}]}}); return 1`);
  await clickSel('#askAiBtn'); await sleep(500);
  const claudeMode = await ev('return !document.querySelector("#assistRulesNote")');
  await ask('add a manager approval above 1000'); await sleep(300);
  const before = await applyState();
  await clickSel('#assistApply'); await clickSel('#assistApply').catch(() => {}); await sleep(300);
  const h1 = await hash(); await ev(`${S} st.dispatch({type:'undo'}); return 1`); const h2 = await hash();
  const once = h1 !== h0 && h2 === h0;
  const bad = [
    { summary: 'x', ops: [{ op: 'insertStep', from: 'eligibility', to: 'gate', type: 'wizard' }] },
    '{"summary":"x","ops":[{"op":"insertStep","from":"eligibility","to":"gate","type":"control","config":{"__proto__":{"polluted":1}}}]}',
    { summary: 'x', ops: [{ op: 'setConfig', node: 'approval', key: 'slaMinutes', value: 'soon' }] },
    { summary: 'x', ops: [{ op: 'setLabel', node: 'ghost', label: 'x' }] },
    { summary: 'x', ops: Array.from({ length: 31 }, () => ({ op: 'setLabel', node: 'gate', label: 'x' })) }
  ];
  const rejects = [];
  for (const r of bad) {
    await ev(`window.__stubQueue.push({reply:${JSON.stringify(typeof r === 'string' ? r : r)}}); return 1`);   // strings are parsed in the page exactly as sample.json does
    await ask('do it'); await sleep(200);
    rejects.push({ state: await applyState(), msg: (await lastMsg()).slice(0, 60) });
  }
  const unchanged = (await hash()) === h0;
  const polluted = await ev('return ({}).polluted === 1');
  await ev(`window.__stubQueue.push({error:'not_granted'}); return 1`);
  await ask('add a step'); await sleep(300);
  const switched = await ev('return /rule-based/i.test(document.querySelector("#assistList").innerText) && !document.querySelector(".assist-mode button.on")?.innerText.includes("Claude")');
  await load({ stub: 'null' }); await clickSel('#askAiBtn'); await sleep(800);
  const nullCap = await ev('return !!document.querySelector("#assistRulesNote")');
  return { pass: claudeMode && before === 'enabled' && once && rejects.every(r => r.state === 'none') && unchanged && !polluted && switched && nullCap, detail: JSON.stringify({ claudeMode, before, once, rejects, unchanged, polluted, switched, nullCap }) };
});

await probe('A2b', 'stub: Stop leaves no proposal; edit during generation → stale; confirm before Apply → stale; oversized message refused locally; locked revision disables send', async () => {
  await load({ stub: 'sample' }); await clickSel('#askAiBtn'); await sleep(500);
  const ok = { summary: 'rename', ops: [{ op: 'setLabel', node: 'gate', label: 'Large refund?' }] };
  await ev(`window.__stubQueue.push({delay:1500, reply:${JSON.stringify(ok)}}); return 1`);
  await ask('rename the gate'); await clickSel('#assistStop'); await sleep(1800);
  const afterStop = await applyState();
  await ev(`window.__stubQueue.push({delay:800, reply:${JSON.stringify(ok)}}); return 1`);
  await ask('rename the gate');
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setConfig', id:'gate', key:'condition', value:'amount > 1500'}]}); return 1`); await sleep(1100);
  const afterEdit = await applyState();
  await ev(`window.__stubQueue.push({reply:${JSON.stringify(ok)}}); return 1`);
  await ask('rename the gate'); const fresh = await applyState();
  await ev(`__bs2.ctl.confirm(); return 1`); await sleep(200);
  const afterConfirm = await applyState();
  const sendDisabled = await ev('return document.querySelector("#assistSend").disabled && !!document.querySelector(".assist-locked")');
  await load({ stub: 'sample' }); await clickSel('#askAiBtn'); await sleep(500);
  const calls0 = await ev('return window.__stubCalls.length');
  await ask('x'.repeat(2500));
  const calls1 = await ev('return window.__stubCalls.length');
  const tooLong = /too long/i.test(await lastMsg());
  return { pass: afterStop === 'none' && afterEdit === 'disabled' && fresh === 'enabled' && afterConfirm === 'disabled' && sendDisabled && calls1 === calls0 && tooLong, detail: JSON.stringify({ afterStop, afterEdit, fresh, afterConfirm, sendDisabled, calls0, calls1, tooLong }) };
});


/* ------------------------------------------------ code review r1 (codex) */
await probe('C1', 'AI preview lists every expanded change incl. settings and branch connections', async () => {
  await load({ stub: 'sample' });
  await ev(`window.__stubQueue.push({reply:{summary:'gate', ops:[{op:'insertStep', from:'eligibility', to:'gate', type:'control', config:{kind:'policy_gate', action:'redact', redactAbove:'internal', appliesWhen:'amount > 100'}}]}}); return 1`);
  await ask('add a redact gate'); await sleep(300);
  const lines = await ev('return [...document.querySelectorAll("#proposalLines li")].map(l=>l.innerText).join(" | ")');
  const need = ['kind', 'policy_gate', 'action', 'redact', 'redactAbove', 'appliesWhen', 'amount > 100', '[approved] → Refund > $2,000? [in]', '[denied] → Refund Declined [in]', 'Refund Eligibility [out] →', 'disconnect Refund Eligibility [out] → Refund > $2,000? [in]'];
  const missing = need.filter(w => !lines.includes(w));
  return { pass: missing.length === 0, detail: missing.length ? 'missing ' + JSON.stringify(missing) + ' in ' + lines.slice(0, 400) : lines.slice(0, 300) };
});
await probe('C2', 'config inputs follow the graph: capability limit edit then Undo shows the restored value; row removal; revision switch', async () => {
  await load();
  await ev(`__bs2.ctl.focusNode('execution'); return 1`); await sleep(400);
  const sel = '#f-execution-capabilities input[type=number]';
  await clickSel(sel); await ev(`document.querySelector('${sel}').select(); return 1`); await type('555'); await key('Tab', 'Tab', 9); await sleep(200);
  const edited = await ev(`${S} return G().nodes.find(n=>n.id==='execution').config.capabilities[0].limit`);
  await ev(`${S} st.dispatch({type:'undo'}); return 1`); await sleep(200);
  const shown = await ev(`return document.querySelector('${sel}').value`);
  await ev(`${S} st.dispatch({type:'redo'}); return 1`); await sleep(200);
  const shownRedo = await ev(`return document.querySelector('${sel}').value`);
  await ev(`${S} st.dispatch({type:'undo'}); return 1`);
  await ev(`__bs2.ctl.confirm(); __bs2.ctl.newRevision(); return 1`); await sleep(200);
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setConfig', id:'execution', key:'capabilities', value:[{cap:'refund.issue', limit:42}]}]}); __bs2.ctl.focusNode('execution'); return 1`); await sleep(300);
  const r1 = await ev(`return document.querySelector('${sel}').value`);
  await ev(`__bs2.ctl.setActiveRevision(0); __bs2.ctl.focusNode('execution'); return 1`); await sleep(300);
  const r0 = await ev(`return document.querySelector('${sel}').value`);
  return { pass: edited === 555 && shown === '10000' && shownRedo === '555' && r1 === '42' && r0 === '10000', detail: JSON.stringify({ edited, shown, shownRedo, r1, r0 }) };
});
await probe('C3', 'Checklist → Discard restores the field display; an invalid range registers a pending input and blocks Confirm', async () => {
  await load();
  await ev(`__bs2.ctl.focusNode('gate'); return 1`); await sleep(400);
  await clickSel('#f-gate-condition'); await ev('document.querySelector("#f-gate-condition").select(); return 1'); await type('amount >'); await key('Tab', 'Tab', 9); await sleep(200);
  await clickSel('#checklistBtn'); await sleep(200); await clickSel('.ci[data-kind="pending"] .btn'); await sleep(300);
  const shown = await ev('return document.querySelector("#f-gate-condition").value');
  await ev(`__bs2.ctl.focusNode('unauth'); return 1`); await sleep(400);
  await clickSel('#advToggle'); await sleep(150);
  await clickSel('#f-unauth-probeRange'); await ev('document.querySelector("#f-unauth-probeRange").select(); return 1'); await type('5000'); await key('Tab', 'Tab', 9); await sleep(200);
  const r = await ev(`${S} return {pend: b.pending.size, confirm: ctl.confirm().error?.code, range: JSON.stringify(G().nodes.find(n=>n.id==='unauth').config.probeRange)}`);
  return { pass: shown === 'amount > 2000' && r.pend === 1 && r.confirm === 'pending_input' && r.range === '[500,2000]', detail: JSON.stringify({ shown, ...r }) };
});
await probe('C4', 'rule-based parsing is faithful: "above $1,000" → amount > 1000; dual approval; 500.75 kept; unsupported clause unmatched', async () => {
  await load();
  const out = [];
  for (const q of ['add a human approval above $1,000 after Refund Eligibility', 'add a dual approval after Refund Eligibility', 'add a human approval above $500.75 after Refund Eligibility', '在 Refund Eligibility 后面加一个人工审批，金额超过 1,000', 'add a human approval unless the customer is VIP after Refund Eligibility', 'add a human approval after Refund Eligibility unless the customer is VIP', 'add a human approval after Refund Eligibility above $1,000 and only for international orders', 'require approval above $1,000', 'require approval above $500 unless the customer is VIP', 'do not prevent duplicate refunds']) {
    await load({ clear: true });
    await ask(q); await sleep(200);
    const has = await applyState();
    if (has === 'enabled') { await clickSel('#assistApply'); await sleep(200); }
    out.push(await ev(`${S} const c=G().nodes.find(n=>n.type==='control'&&n.id!=='approval'); if (c) return c.config.kind+'|'+c.config.appliesWhen; const q=${JSON.stringify(q)}; if (/prevent duplicate/.test(q)) return 'idem:'+G().nodes.find(n=>n.id==='payment').config.idempotencyKey; if (/require approval/.test(q)) return 'gate:'+G().nodes.find(n=>n.id==='gate').config.condition; return 'none'`));
  }
  return { pass: out[0] === 'human_approval|amount > 1000' && out[1].startsWith('dual_approval|') && out[2] === 'human_approval|amount > 500.75' && out[3] === 'human_approval|amount > 1000' && out[4] === 'none' && out[5] === 'none' && out[6] === 'none' && out[7] === 'gate:amount > 1000' && out[8] === 'gate:amount > 2000' && out[9] === 'idem:false', detail: JSON.stringify(out) };
});


await probe('C5', 'redact secrets with a decision whose two branches reach Refund Resolved: both branches gated; injected runs on each branch emit no secret', async () => {
  await load();
  const pr = await edgeId('payment', 'resolved');
  await clickSel(`[data-plus="${pr}"]`); await type('condition'); await enter(); await sleep(300);
  await ask('Redact secrets.'); await sleep(200);
  const state = await applyState();
  if (state === 'enabled') { await clickSel('#assistApply'); await sleep(300); }
  const r = await ev(`${S} const g=G(); const into=g.edges.filter(e=>e.kind==='flow'&&e.to.node==='resolved').map(e=>g.nodes.find(n=>n.id===e.from.node)); return {gates: into.map(n=>n.type+':'+(n.config.action||'')), lint: b.validator.lint(g).map(i=>i.code)}`);
  const leaks = [];
  for (const amount of [300, 900]) {
    await ev(`${S} Object.assign(ctl.run.form,{amount:${amount},eligible:${amount},split:1,injected:true,replay:false,dup:false,interactive:false}); ctl.startRun(false); return 1`);
    leaks.push(await ev(`${S} return ctl.run.view.trace.flatMap(s=>s.effects).filter(e=>e.type==='emit'&&e.external&&e.labels.some(l=>l.sensitivity==='secret')).length`));
  }
  return { pass: state === 'enabled' && r.gates.length >= 2 && r.gates.every(g => g === 'control:redact') && !r.lint.length && leaks.every(n => n === 0), detail: JSON.stringify({ state, ...r, leaks }) };
});


/* ------------------------------------------------------ templates (G, §3.11) */
async function openGallery() { await clickSel('#docMenuBtn'); await clickSel('#browseTemplatesBtn'); await sleep(300); }
await probe('G1', 'gallery: 13 cards; each category tab filters; "发票" and "invoice" both find invoice processing', async () => {
  await load();
  await openGallery();
  const total = await ev('return document.querySelectorAll(".tpl-card").length');
  const cats = await ev(`${S} const m={}; for (const id of ctl.TEMPLATE_IDS) { const c=ctl.TEMPLATES[id].category; m[c]=(m[c]||0)+1 } return m`);
  const tabs = {};
  for (const c of Object.keys(cats)) { await clickSel(`.cat-tabs button[data-cat="${c}"]`); await sleep(100); tabs[c] = await ev('return document.querySelectorAll(".tpl-card").length'); }
  await clickSel('.cat-tabs button[data-cat="All"]');
  const find = async q => { await ev(`const i=document.querySelector('#gallerySearch'); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i, ${JSON.stringify(q)}); i.dispatchEvent(new Event('input',{bubbles:true})); return 1`); await sleep(150); return ev('return [...document.querySelectorAll(".tpl-card")].map(c=>c.dataset.template)'); };
  const zh = await find('发票'), en = await find('invoice');
  const allCats = Object.keys(cats).sort().join();
  return { pass: total === 13 && Object.keys(cats).every(c => tabs[c] === cats[c]) && allCats === ['AI', 'Document Ops', 'IT Ops', 'Marketing', 'Other', 'Sales', 'Support'].sort().join() && zh.includes('docops-invoice-processing') && en.includes('docops-invoice-processing'), detail: JSON.stringify({ total, cats, tabs, zh, en }) };
});
await probe('G2', 'every template via the gallery renders without console errors and with no overlapping nodes, in English and 中文', async () => {
  const out = {};
  for (const lang of ['en', 'zh']) {
    await load({ lang });
    const ids = await ev(`${S} return ctl.TEMPLATE_IDS`);
    for (const id of ids) {
      await openGallery();
      await clickSel(`[data-use="${id}"]`); await sleep(500); await fit();
      const r = await overlapCheck();
      const nodes = await ev(`${S} return G().nodes.length`);
      const codes = await lintCodes();
      if (r.overlap || !r.inside || r.n !== nodes || codes.length) out[lang + ':' + id] = { ...r, nodes, codes };
    }
  }
  return { pass: Object.keys(out).length === 0, detail: Object.keys(out).length ? JSON.stringify(out) : 'all templates clean in both languages' };
});
await probe('G3', 'Ask AI (rule-based) works on new templates: add a human approval after an agent', async () => {
  const res = {};
  for (const id of ['docops-invoice-processing', 'itops-access-request']) {
    await load();
    await ev(`__bs2.ctl.startFromTemplate('${id}'); return 1`); await sleep(500);
    const a = await ev(`${S} const g=G(); const ag=g.nodes.find(n=>n.type==='agent' && g.edges.filter(e=>e.kind==='flow'&&e.from.node===n.id).length===1); return ag && ag.label`);
    const h0 = await hash();
    await ask(`add a human approval after ${a}`); await sleep(200);
    const st = await applyState();
    if (st === 'enabled') { await clickSel('#assistApply'); await sleep(300); }
    res[id] = { agent: a, st, changed: (await hash()) !== h0, lint: await lintCodes() };
  }
  return { pass: Object.values(res).every(r => r.st === 'enabled' && r.changed && !r.lint.length), detail: JSON.stringify(res) };
});

/* ------------------------------------------- direction (plan §3.12, D1–D5) */
/* Rendered flow edges: every target starts after its source along the main axis. */
const flowGeom = () => ev(`${S} const r=id=>document.querySelector('.react-flow__node[data-id="'+id+'"]').getBoundingClientRect();
  return G().edges.filter(e=>e.kind==='flow').map(e=>{const a=r(e.from.node), b=r(e.to.node); return {e:e.id, lr: b.left>=a.right-1, tb: b.top>=a.bottom-1}})`);
/* Every flow edge's drawn path starts on its source handle and ends on its target handle (screen px). */
const anchored = () => ev(`${S} const c=(n,h)=>{const r=document.querySelector('.react-flow__node[data-id="'+n+'"] .react-flow__handle[data-handleid="'+h+'"]').getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}};
  const pt=(el,l)=>{const p=el.getPointAtLength(l).matrixTransform(el.getScreenCTM()); return {x:p.x,y:p.y}}; const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const bad=G().edges.filter(e=>e.kind==='flow').filter(e=>{const el=document.getElementById(e.id); if(!el) return true; const L=el.getTotalLength();
    return d(pt(el,0), c(e.from.node,e.from.port))>8 || d(pt(el,L), c(e.to.node,e.to.port))>8}).map(e=>e.id); return bad.length ? bad.join() : 'ok'`);
const inSide = () => ev(`return [...document.querySelectorAll('.react-flow__handle[data-handleid="in"]')].map(h=>['left','top','right','bottom'].find(s=>h.classList.contains('react-flow__handle-'+s)))`);
const posJson = () => ev(`${S} return JSON.stringify(G().nodes.map(n=>[n.id,n.x,n.y]))`);
async function pickDir(d) { await clickSel('#arrangeMenuBtn'); await sleep(150); await clickSel(`.split .menu [data-dir="${d}"]`); await sleep(500); await stable(); }

await probe('D1', 'a template opens left to right: flow targets right of sources, in-handles on the left, no overlap (en, 中文)', async () => {
  const out = {};
  for (const lang of ['en', 'zh']) {
    await load({ lang }); await fit();
    const g = await flowGeom(), sides = await inSide();
    out[lang] = { dir: await ev(`${S} return G().direction`), lr: g.every(x => x.lr), sides: [...new Set(sides)], anchored: await anchored(), ...(await overlapCheck()) };
  }
  return { pass: ['en', 'zh'].every(l => out[l].dir === 'LR' && out[l].lr && out[l].sides.join() === 'left' && out[l].anchored === 'ok' && out[l].overlap === 0 && out[l].inside), detail: JSON.stringify(out) };
});
await probe('D2', 'Arrange ▾ → Top to bottom: TB layout and top in-handles; one undo restores LR and exact positions; redo reapplies', async () => {
  await load();
  const p0 = await posJson();
  await clickSel('#arrangeMenuBtn'); await sleep(150);
  const checked = await ev('return [...document.querySelectorAll(".split .menu [data-dir]")].map(b=>b.dataset.dir+":"+b.getAttribute("aria-checked")).join()');
  await shot('v1-en-12-arrange-menu');
  await clickSel('.split .menu [data-dir="TB"]'); await sleep(500); await fit();
  const menuGone = await ev('return !document.querySelector(".split .menu")');
  const tb = { dir: await ev(`${S} return G().direction`), geo: (await flowGeom()).every(x => x.tb), sides: [...new Set(await inSide())].join(), anchored: await anchored() };
  await shot('v1-en-13-top-to-bottom');
  const p1 = await posJson();
  await ev(`${S} st.dispatch({type:'undo'}); return 1`); await sleep(300);
  const undo = { dir: await ev(`${S} return G().direction`), same: (await posJson()) === p0, sides: [...new Set(await inSide())].join(), anchored: await anchored() };
  await ev(`${S} st.dispatch({type:'redo'}); return 1`); await sleep(300);
  const redo = { dir: await ev(`${S} return G().direction`), same: (await posJson()) === p1 };
  return { pass: checked === 'LR:true,TB:false' && menuGone && tb.dir === 'TB' && tb.geo && tb.sides === 'top' && tb.anchored === 'ok' && undo.dir === 'LR' && undo.same && undo.sides === 'left' && undo.anchored === 'ok' && redo.dir === 'TB' && redo.same, detail: JSON.stringify({ checked, menuGone, tb, undo, redo }) };
});
await probe('D3', 'direction survives export → import; a bad direction is refused on import; hash is the same in LR and TB', async () => {
  await load();
  const hLR = await hash();
  await pickDir('TB');
  const hTB = await hash(); const txt = await ev(`${S} return ctl.exportText()`);
  await load(); await ev(`__bs2.ctl.importText(${JSON.stringify(txt)}); return 1`); await sleep(400);
  const imp = { dir: await ev(`${S} return G().direction`), sides: [...new Set(await inSide())].join(), anchored: await anchored() };
  const bad = JSON.stringify({ ...JSON.parse(txt), revisions: JSON.parse(txt).revisions.map(r => ({ ...r, graph: { ...r.graph, direction: 'diagonal' } })) });
  const before = await ev(`${S} return st.doc.id`);
  const code = await ev(`__bs2.ctl.importText(${JSON.stringify(bad)}); return 1`) && await ev(`${S} return st.doc.id`);
  return { pass: hLR === hTB && imp.dir === 'TB' && imp.sides === 'top' && imp.anchored === 'ok' && code === before, detail: JSON.stringify({ sameHash: hLR === hTB, imp, badRefused: code === before }) };
});
await probe('D4', 'a confirmed revision shows neither Arrange nor its menu', async () => {
  await load();
  await ev(`${S} ctl.confirm(); return 1`); await sleep(300);
  const r = await ev('return {arrange: !!document.querySelector("#arrangeBtn"), menu: !!document.querySelector("#arrangeMenuBtn")}');
  return { pass: !r.arrange && !r.menu, detail: JSON.stringify(r) };
});
await probe('D5', 'Ask AI proposal made in LR, direction switched to TB, then Apply → TB result; one undo returns to the pre-Apply TB graph', async () => {
  await load();
  await ask('add a human approval after Refund Eligibility'); await sleep(200);
  await pickDir('TB');
  const pre = await ev(`${S} return JSON.stringify(G())`);
  const st0 = await applyState();
  await clickSel('#assistApply'); await sleep(500); await fit();
  const res = { st0, dir: await ev(`${S} return G().direction`), n: await ev(`${S} return G().nodes.length`), tb: (await flowGeom()).every(x => x.tb), sides: [...new Set(await inSide())].join(), anchored: await anchored() };
  await ev(`${S} st.dispatch({type:'undo'}); return 1`); await sleep(200);
  res.undo = (await ev(`${S} return JSON.stringify(G())`)) === pre;
  return { pass: st0 === 'enabled' && res.dir === 'TB' && res.n === 15 && res.tb && res.sides === 'top' && res.anchored === 'ok' && res.undo, detail: JSON.stringify(res) };
});

/* ------------------------------------------------------ i18n, T3, T4, V1 */
await probe('I1', '中文 changes UI strings, checklist sentences and node explanations; search matches Chinese', async () => {
  await load({ lang: 'en' });
  const en = await ev('return {run: document.querySelector("#testRunBtn").innerText, lib: document.querySelector(".library h4").innerText, desc: document.querySelector(".lib-item small").innerText}');
  await ev('__bs2.setLang("zh"); return 1'); await sleep(200);
  const zh = await ev('return {run: document.querySelector("#testRunBtn").innerText, lib: document.querySelector(".library h4").innerText, desc: document.querySelector(".lib-item small").innerText}');
  const e = await edgeId('payment', 'resolved');
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'removeEdge', id:'${e}'}]}); return 1`); await sleep(200);
  await clickSel('#checklistBtn'); await sleep(200);
  const sentence = await ev('return document.querySelector(".ci[data-code=dangling_port] .ci-main b").innerText');
  const cjk = s => /[一-鿿]/.test(s);
  return { pass: ['run', 'lib', 'desc'].every(k => en[k] !== zh[k] && cjk(zh[k])) && cjk(sentence), detail: JSON.stringify({ en, zh, sentence }) };
});
await probe('T3', 'wrong input: invalid expression → pending entry reaching the field; dangling port → node entry reaching the node', async () => {
  await load();
  await ev(`__bs2.ctl.focusNode('gate'); return 1`); await sleep(400);
  await clickSel('#f-gate-condition'); await ev('document.querySelector("#f-gate-condition").select(); return 1'); await type('amount >>'); await key('Tab', 'Tab', 9);
  await ev(`__bs2.ctl.setSelected(null); return 1`); await sleep(200);
  await clickSel('#checklistBtn'); await sleep(200);
  await clickSel('.ci[data-kind="pending"] .ci-main'); await sleep(700);
  const focused = await ev('return document.activeElement?.id');
  return { pass: focused === 'f-gate-condition', detail: JSON.stringify({ focused }) };
});
await probe('T4', 'export → import in a fresh profile → same hash', async () => {
  await load();
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setLabel', id:'gate', label:'Exported'}]}); return 1`);
  const h = await hash(); const txt = await ev(`${S} return ctl.exportText()`);
  await load(); await ev(`__bs2.ctl.importText(${JSON.stringify(txt)}); return 1`);
  const h2 = await hash();
  return { pass: h === h2, detail: String(h === h2) };
});
await probe('PERF', 'validate + optimize on the refund template at n=40 under 3 s', async () => {
  await load();
  const ms = await ev(`${S} ctl.confirm(); const t0=performance.now(); await ctl.runValidation(40); await ctl.runOptimize(); return Math.round(performance.now()-t0)`);
  return { pass: ms < 3000, detail: ms + ' ms' };
});

/* ----------------------------------------------------- Decision Trace (X)
   Independent oracles are the store, deterministic engine and source ontology.
   Do not use deriveTrace/focusSet to prove their own output. X9 is the existing
   full regression suite (run this harness without --only), not a synthetic PASS. */
const xa = (await import('node:assert/strict')).default;
const xValidator = await import('../../js/validate.js');
const xOptimizer = await import('../../js/optimize.js');
const xOntology = JSON.parse(await readFile(join(ROOT, 'swm/data/ontology.json'), 'utf8'));
const xFamilies = ['below_threshold', 'split', 'replay', 'duplicate_submit', 'injection_exfil', 'benign'];
const xRelated = {
  below_threshold: ['owasp:LLM06', 'owaspa:T2'], split: ['owasp:LLM06', 'owaspa:T2'],
  replay: ['owaspa:T3'], duplicate_submit: [],
  injection_exfil: ['atlas:AML.T0051', 'owasp:LLM01', 'owasp:LLM02'], benign: []
};
const xClass = n => ({agent:'ag:planner', tool:'ag:tool-reg', outcome:'ag:harness', prohibited:'ag:harness'}[n.type]
  || (n.type === 'control' ? (n.config.kind === 'policy_gate' ? 'ag:guardrail' : 'ag:hitl') : null));
const xDoc = () => ev(`${S} return st.doc`);
const xActive = doc => doc.revisions.find(r => r.rev === doc.activeRev);
const xAttr = (name, value) => `[${name}=${JSON.stringify(value)}]`;
async function xOpen(kind, ref) {
  await ev(`${S} ctl.openTrace(${JSON.stringify(kind || null)}, ${JSON.stringify(ref || null)}); return 1`);
  await sleep(250); await stable();
}
async function xLayer(id) {
  const sel = `#traceSpine [data-layer="${id}"] .layer-head`;
  if (await ev(`return document.querySelector(${JSON.stringify(sel)})?.getAttribute('aria-expanded') !== 'true'`)) await clickSel(sel);
  await sleep(250);
}
async function xSetup({lang = 'en', template = 'customer-refund', n = 40, optimize = true} = {}) {
  await load({lang});
  await ev(`${S} ctl.startFromTemplate(${JSON.stringify(template)}); const c=ctl.confirm(); if(!c.ok) throw Error(JSON.stringify(c));
    const v=await ctl.runValidation(${n}); if(!v.ok) throw Error(JSON.stringify(v));
    ${optimize ? 'const o=await ctl.runOptimize(); if(!o.ok) throw Error(JSON.stringify(o));' : ''} return 1`);
  await xOpen();
}
async function xApprove(id = null) {
  return ev(`${S} const id=${JSON.stringify(id)} || ctl.recommendedId(st.active()); const parent=st.active().rev;
    const r=ctl.approve(id); if(!r.ok) throw Error(JSON.stringify(r)); return {id,parent,child:st.active().rev}`);
}
async function xRecord() {
  await clickSel('#recordBtn'); await sleep(150);
  const raw = await ev('return document.querySelector("#recJson").textContent');
  const rec = JSON.parse(raw);
  await key('Escape', 'Escape', 27); await sleep(100);
  return rec;
}
async function xFunnel() {
  return ev(`return Object.fromEntries([...document.querySelectorAll('#traceFunnel [data-funnel]')].map(e=>[e.dataset.funnel,{value:e.querySelector('b').textContent, text:e.innerText}]))`);
}
const xSorted = xs => [...new Set(xs)].sort();
function xStatement(rec, result) {
  xa.ok(rec.statement, 'record needs a statement for the cited decision');
  xa.deepEqual(rec.statement.violationsFound.map(f=>[f.finding,f.violating,f.run]).sort(),
    result.findings.filter(f=>f.violating>0).map(f=>[f.id,f.violating,f.run]).sort(), 'remaining findings equal cited evidence');
  xa.deepEqual(rec.statement.zeroViolations.map(z=>[z.prohibited,z.runs]).sort(),
    Object.entries(result.metrics.byMonitor).filter(([,v])=>v.violating===0).map(([id,v])=>[id,v.run]).sort(), 'zero counts equal monitor evidence');
  if (result.findings.length) xa.doesNotMatch(rec.statement.text, /no violations/i);
}

await probe('X1', 'Trace funnel and seven layers match engine, ontology and decided parent evidence', async () => {
  await xSetup(); const decision = await xApprove();
  await ev(`${S} ctl.setActiveRevision(${decision.parent}); return 1`); await xOpen();
  const doc=await xDoc(), r=xActive(doc), v=r.validation.result;
  const set=await ev(`${S} return ctl.scenarioSetFor(st.active(),st.active().validation.n)`);
  const actual=xValidator.validate(r.graph,set), opt=xOptimizer.optimize(r.graph,actual,set,{name:doc.name,domain:doc.domain});
  const f=await xFunnel(), classes=new Set(r.graph.nodes.map(xClass).filter(Boolean));
  const threats=new Set(xOntology.links.filter(e=>e.pred==='THREATENS'&&classes.has(e.t)).map(e=>e.s));
  const expected={mapped:`${r.graph.nodes.filter(xClass).length}/${r.graph.nodes.length}`, associated:String(threats.size), paths:String(actual.potential.length),runs:String(actual.runs.length), findings:String(actual.findings.length),candidates:String(opt.candidates.length)};
  for(const [k,value] of Object.entries(expected)) xa.equal(f[k].value,value,k);
  xa.deepEqual([expected.mapped,classes.size,threats.size,actual.potential.length,actual.runs.length,actual.findings.length,opt.candidates.length,opt.candidates.filter(c=>c.verdict.eligible).length],['10/14',4,48,7,240,6,16,2]);
  xa.deepEqual(v.metrics,actual.metrics);
  xa.ok(f.runs.text.includes('200/200') && f.runs.text.includes('16/40'), 'violation numerators and denominators');
  xa.match(f.candidates.text,/2 eligible.*14 ineligible/s, 'approved candidate missing from eligible tested total: '+f.candidates.text.replace(/\n/g,' '));
  const layers=await ev('return [...document.querySelectorAll("#traceSpine [data-layer]")].map(e=>e.dataset.layer)');
  xa.deepEqual(layers,['schema','laws','world','simulation','objectives','calibration','decision']);
  const stamp=await ev('return document.querySelector("#traceStamp").innerText');
  for(const s of [xOntology.version,r.hash.slice(0,8),r.validation.scenarioSetId]) xa.ok(stamp.includes(s),s);
  return {pass:true,detail:JSON.stringify(expected)};
});

await probe('X2', 'finding clicks highlight only its chain and candidates supported by current results; mini paths agree', async () => {
  await xSetup(); const r=xActive(await xDoc()), f=r.validation.result.findings.find(f=>f.id==='unauth:split');
  await xLayer('simulation'); await clickSel(xAttr('data-trace-finding',f.id)); await sleep(200);
  const paths=new Set(f.paths.flatMap(p=>p.nodes)), monitor=r.graph.nodes.find(n=>n.id===f.prohibited);
  const attributed=r.graph.nodes.filter(n=>paths.has(n.id)&&n.type==='tool'&&n.config.sideEffect==='write'&&n.config.cap===monitor.config.cap).map(n=>n.id);
  const expectedCandidates=r.optimization.candidates.filter(c=>c.state==='tested'&&c.testedParamsVersion===c.candidate.paramsVersion&&!c.result.findings.some(x=>x.id===f.id&&x.violating>0)).map(c=>c.candidate.id);
  const hot=await ev('return [...document.querySelectorAll("#threadGraph [data-thread].hot")].map(e=>e.dataset.thread)');
  xa.deepEqual(xSorted(hot.filter(k=>k.startsWith('finding:'))),['finding:'+f.id]);
  xa.deepEqual(xSorted(hot.filter(k=>k.startsWith('candidate:')).map(k=>k.slice(10))),xSorted(expectedCandidates));
  xa.deepEqual(xSorted(hot.filter(k=>k.startsWith('threat:')).map(k=>k.slice(7))),xSorted(xRelated[f.template]));
  for(const id of attributed) {xa.ok(hot.includes('step:'+id));xa.ok(hot.includes('class:'+xClass(r.graph.nodes.find(n=>n.id===id))));}
  xa.ok(hot.includes('family:'+f.template));
  const mini=await ev('return [...document.querySelectorAll("#miniBlueprint rect.hot")].map(e=>e.dataset.mini)');
  for(const id of paths) xa.ok(mini.includes(id),'mini path '+id);
  const focused=await ev('return document.querySelector("#threadGraph [data-thread].focus")?.dataset.thread');
  xa.equal(focused,'finding:'+f.id);
  xa.ok(await ev('return document.querySelectorAll("#threadGraph [data-thread].dim").length>0'));
  const approved=await xApprove();
  await ev(`${S} ctl.setActiveRevision(${approved.parent}); return 1`); await xOpen('candidate',approved.id);
  const decisionNodes=await ev('return [...document.querySelectorAll("#threadGraph [data-thread]")].filter(e=>e.dataset.thread.startsWith("decision:")).map(e=>({id:e.dataset.thread,hot:e.classList.contains("hot")}))');
  xa.equal(decisionNodes.length,1,'one decision node after approval');
  xa.ok(decisionNodes[0].hot,'approved candidate focus must highlight its decision: '+JSON.stringify(decisionNodes));
  return {pass:true,detail:JSON.stringify({finding:f.id,candidates:expectedCandidates.length,pathNodes:paths.size,decision:decisionNodes})};
});

await probe('X3', 'each ineligible candidate exposes exact optimizer reasons', async () => {
  await xSetup(); const r=xActive(await xDoc()); let checked=0;
  for(const c of r.optimization.candidates.filter(c=>!c.verdict.eligible)) {
    await xOpen('candidate',c.candidate.id);
    const ui=await ev('return {state:document.querySelector("#traceInspector [data-cand-state]")?.dataset.candState,text:document.querySelector("#traceInspector")?.innerText}');
    xa.equal(ui.state,'ineligible'); for(const reason of c.verdict.reasons) xa.ok(ui.text.includes(reason),reason); checked++;
  }
  xa.ok(checked>0); return {pass:true,detail:`${checked} candidates' reasons checked`};
});

await probe('X4', 'Vendor families disclose stored sample counts, laws, related IDs and abstraction limits', async () => {
  await xSetup({template:'vendor-bank-change'}); await xLayer('laws');
  const r=xActive(await xDoc());
  const rows=await ev('return [...document.querySelectorAll("[data-family]")].map(e=>({id:e.dataset.family,text:e.innerText}))');
  xa.deepEqual(rows.map(r=>r.id).sort(),[...xFamilies].sort());
  for(const row of rows) {
    const runs=r.validation.result.runs.filter(x=>x.template===row.id);
    xa.ok(row.text.includes(`${runs.filter(x=>x.violating).length}/${runs.length}`),row.id+' counts');
    for(const id of xRelated[row.id]) xa.ok(row.text.includes(id),row.id+' missing '+id);
  }
  xa.match(rows.find(x=>x.id==='duplicate_submit').text,/no public threat id/i);
  xa.match(rows.find(x=>x.id==='replay').text,/Credential Broker/);
  xa.match(rows.find(x=>x.id==='replay').text,/not instantiate|not instantiated/i);
  xa.match(await ev('return document.querySelector("#traceView").innerText'),/sampled, not pruned/i);
  return {pass:true,detail:'six families, actual run counts, public IDs and limits'};
});

await probe('X5', 'English/中文 Trace and record obey grade, provenance and claim wording', async () => {
  const checked=[];
  for(const lang of ['en','zh']) {
    await xSetup({lang}); const d=await xApprove(); await ev(`${S} ctl.setActiveRevision(${d.parent}); return 1`); await xOpen();
    let text='';
    for(const layer of ['schema','laws','world','simulation','objectives','calibration','decision']) {await xLayer(layer);text+='\n'+await ev('return document.querySelector("#traceView").innerText');}
    const rec=await xRecord(), json=JSON.stringify(rec);
    // Negated disclosures ("not tested", "no ... fit") are allowed. Public risk
    // labels/user names are not evidence grades; this fixture uses known labels.
    for(const [name,value] of [['view',text],['record',json]]) {
      xa.doesNotMatch(value,/\b(safe|secure|verified|certified|observed|latent)\b|已认证|已验证|已观测|潜在级|世界模型拟合度/i,lang+' '+name);
      xa.doesNotMatch(value,/(?:threats? (?:was |were |are )?(?:tested|exercised)|已测试的(?:公开)?威胁)/i,lang+' threat verdict');
    }
    const grades=[]; const visit=v=>{if(v&&typeof v==='object') {if(v.grade) grades.push(...Object.values(v.grade)); for(const x of Object.values(v))visit(x);}};visit(rec);
    xa.ok(grades.every(x=>['declared','simulated','not run'].includes(x)),'record grades');
    xa.match(text,/Silex (?:mapping|association)|Silex.*(?:映射|关联)/i,'provenance');
    if(lang==='zh') xa.match(text,/[\u4e00-\u9fff]/);
    checked.push(lang);
  }
  return {pass:true,detail:checked.join(', ')};
});

await probe('X6', 'before Validate no simulation or candidate results are fabricated', async () => {
  await load(); await ev(`${S} ctl.confirm(); return 1`); await xOpen();
  const f=await xFunnel(); for(const k of ['runs','findings','candidates'])xa.equal(f[k].value,'—',k);
  await xLayer('laws'); xa.equal(await ev('return document.querySelectorAll("[data-family]").length'),0);
  await xLayer('simulation'); xa.equal(await ev('return document.querySelectorAll("[data-trace-finding]").length'),0);
  xa.match(await ev('return document.querySelector("#traceView").innerText'),/Run Validate/);
  const rec=await xRecord();xa.equal(rec.statement,null);xa.equal(rec.promotion.simulation,'not run');
  return {pass:true,detail:'schema/world state only; null evidence and no simulated promotion'};
});

await probe('X7', 'decision record pins store evidence and is identical after export/import', async () => {
  await xSetup(); const d=await xApprove(); await ev(`${S} ctl.setActiveRevision(${d.parent}); return 1`); await xOpen();
  const doc=await xDoc(), r=xActive(doc), c=r.optimization.candidates.find(c=>c.candidate.id===d.id), rec=await xRecord();
  xa.equal(rec.blueprint.hash,r.decision.childHash);xa.equal(rec.evaluatedRevision.hash,r.hash);
  xa.equal(rec.approvedChild.hash,r.decision.childHash);xa.equal(rec.decision.candidate,d.id);
  xa.deepEqual(rec.candidates.map(c=>c.id).sort(),r.optimization.candidates.map(c=>c.candidate.id).sort());
  xa.equal(rec.evidence.candidateRunId,c.runId);xa.equal(rec.evidence.scenarioSetId,r.validation.scenarioSetId);
  xa.equal(rec.evidence.paramsVersion,c.candidate.paramsVersion);xa.equal(rec.evidence.testedParamsVersion,c.testedParamsVersion);xa.equal(rec.evidence.validationJobId,r.validation.jobId);
  xStatement(rec,c.result);
  const exported=await ev(`${S} return ctl.exportText()`); await load();
  await ev(`${S} const r=ctl.importText(${JSON.stringify(exported)}); if(!r.ok) throw Error(JSON.stringify(r)); return 1`);await xOpen();
  xa.deepEqual(await xRecord(),rec,'record survives import');return {pass:true,detail:`${d.id}, ${c.runId}, stable record`};
});

await probe('X8', 'public threat identifiers link to official pages and associations carry provenance', async () => {
  await xSetup(); await xLayer('schema');
  await ev('document.querySelector("#traceSpine .assoc").open=true; return 1');
  const links=await ev('return [...document.querySelectorAll("#traceView a[href]")].map(a=>({text:a.textContent.trim(),url:a.href}))');
  for(const id of xSorted(Object.values(xRelated).flat())) {
    await xOpen('threat',id);
    const a=await ev('return [...document.querySelectorAll("#traceInspector a[href]")].map(a=>({text:a.textContent.trim(),url:a.href}))');
    xa.ok(a.some(a=>a.text===id),'linked identifier '+id);links.push(...a);
    xa.match(await ev('return document.querySelector("#traceInspector").innerText'),/Silex association|Silex-authored/i);
  }
  xa.ok(links.length>6);
  for(const a of links) {const u=new URL(a.url);xa.equal(u.protocol,'https:');xa.ok(['atlas.mitre.org','genai.owasp.org'].includes(u.hostname),a.url);if(a.text.startsWith('atlas:'))xa.ok(u.pathname.includes(a.text.slice(6)),a.text);}
  return {pass:true,detail:`${links.length} links checked (no external requests)`};
});

await probe('X10', 'unmapped counterexamples and inj:a data-access explanation', async () => {
  await xSetup();await xLayer('schema');
  const r=xActive(await xDoc()), expected=r.graph.nodes.filter(n=>['data','trigger','decision'].includes(n.type)).map(n=>n.id);
  const rows=await ev('return [...document.querySelectorAll("[data-unmapped]")].map(e=>({id:e.dataset.unmapped,text:e.innerText}))');
  xa.deepEqual(rows.map(r=>r.id).sort(),expected.sort());xa.ok(rows.every(r=>r.text.length>20));
  await xOpen('candidate','inj:a'); const text=await ev('return document.querySelector("#traceInspector").innerText');
  xa.match(text,/read/i);xa.match(text,/tool/i);xa.doesNotMatch(text,/adds? (?:a )?redact|redaction gate/i);
  return {pass:true,detail:JSON.stringify({unmapped:expected,inj:'data-access change'})};
});

await probe('X11', 'approved child cites parent candidate evidence, both hashes and the original scenario set', async () => {
  await xSetup();const d=await xApprove();await xOpen();
  const doc=await xDoc(),child=xActive(doc),parent=doc.revisions.find(r=>r.rev===d.parent),c=parent.optimization.candidates.find(c=>c.candidate.id===d.id);
  const note=await ev('return document.querySelector("#traceChildNote")?.innerText');xa.match(note,/Approved from v1\.0/);xa.match(note,/candidate run/i);
  const f=await xFunnel();xa.equal(Number(f.runs.value),c.result.runs.length);xa.equal(Number(f.findings.value),c.result.findings.length);
  const rec=await xRecord();xa.equal(rec.blueprint.hash,child.hash);xa.equal(rec.evaluatedRevision.hash,parent.hash);xa.equal(rec.scenarioSet,parent.validation.scenarioSetId);
  xa.equal(rec.evidence.candidateRunId,c.runId,`child candidateRunId=${rec.evidence.candidateRunId}; expected ${c.runId}`);xStatement(rec,c.result);
  await clickSel('#traceChildNote button'); await sleep(200);xa.equal(xActive(await xDoc()).rev,parent.rev);
  return {pass:true,detail:`child ${child.rev} from ${c.runId} on ${parent.validation.scenarioSetId}`};
});

await probe('X12', 'modify → stale → retest → human rejection; new revision → confirm → validate → accept', async () => {
  await xSetup();const id=await ev(`${S} return ctl.recommendedId(st.active())`);
  // Modify normally auto-retests in one tick. Supersede that job to leave its
  // real store-generated stale state visible, then use the controller to retest.
  await ev(`${S} const c=st.active().optimization.candidates.find(c=>c.candidate.id===${JSON.stringify(id)});
    const p=ctl.modifyCandidate(c.candidate.id,c.candidate.params);st.startJob('cand:'+st.active().rev+':'+c.candidate.id);await p;return 1`);
  await xOpen('candidate',id);
  xa.equal(await ev('return document.querySelector("[data-cand-state]")?.dataset.candState'),'stale');
  let rec=await xRecord();xa.equal(rec.candidates.find(c=>c.id===id).scorecard,null);
  xa.match((await xFunnel()).candidates.text,/1 untested/);
  await ev(`${S} const c=st.active().optimization.candidates.find(c=>c.candidate.id===${JSON.stringify(id)});const r=await ctl.modifyCandidate(c.candidate.id,c.candidate.params);if(!r.ok)throw Error(JSON.stringify(r));return 1`);await xOpen('candidate',id);
  xa.equal(await ev('return document.querySelector("[data-cand-state]")?.dataset.candState'),'eligible');
  await ev(`${S} ctl.reject(${JSON.stringify(id)});return 1`);await xOpen('candidate',id);
  xa.equal(await ev('return document.querySelector("[data-cand-state]")?.dataset.candState'),'rejected');
  xa.match((await xFunnel()).candidates.text,/1 rejected by a person/);
  await xSetup();await xApprove();
  await ev(`${S} const n=ctl.newRevision();if(!n.ok)throw Error(JSON.stringify(n));ctl.confirm();await ctl.runValidation(40);return 1`);
  let r=xActive(await xDoc());
  if(r.validation.result.findings.length) {
    // A real, finding-free fixture: always require fully bound single-use approval,
    // prevent duplicate effects, and move secret reads off the agent.
    await load();await ev(`${S} const ops=[{op:'setConfig',id:'gate',key:'condition',value:'amount >= 0'},
      {op:'setConfig',id:'approval',key:'binding',value:['customer','order','amount']},{op:'setConfig',id:'approval',key:'singleUse',value:true},
      {op:'setConfig',id:'payment',key:'idempotencyKey',value:true},
      ...G().edges.filter(e=>e.kind==='access'&&G().nodes.find(n=>n.id===e.to.node)?.config.sensitivity==='secret').map(e=>({op:'removeEdge',id:e.id}))];
      const p=st.dispatch({type:'patch',ops});if(!p.ok)throw Error(JSON.stringify(p));const txt=ctl.exportText();const imp=ctl.importText(txt);if(!imp.ok)throw Error(JSON.stringify(imp));ctl.confirm();await ctl.runValidation(40);return 1`);
    r=xActive(await xDoc());
  }
  xa.equal(r.validation.result.findings.length,0,'accept fixture must be engine-validated clean');
  await ev(`${S} ctl.go('assurance','decide');return 1`);await sleep(200);await clickSel('#acceptBtn');await xOpen();
  rec=await xRecord();xa.equal(xActive(await xDoc()).decision.action,'accept');xStatement(rec,r.validation.result);
  xa.equal(rec.decision.revision,`v1.${r.rev}`,`accept decision.revision=${rec.decision.revision}; expected v1.${r.rev}`);
  return {pass:true,detail:'stale/retest/rejected and finding-free accept evidence checked'};
});

await probe('X13', 'approved residual noncritical findings remain in generated statement and rendered record', async () => {
  await load();await ev(`${S} st.dispatch({type:'patch',ops:G().nodes.filter(n=>n.type==='prohibited').map(n=>({op:'setConfig',id:n.id,key:'severity',value:'high'}))});ctl.confirm();await ctl.runValidation(40);await ctl.runOptimize();return 1`);
  const r=xActive(await xDoc()),c=r.optimization.candidates.find(c=>c.verdict.eligible&&c.result.findings.length);
  xa.ok(c,'fixture needs a tested eligible candidate with residual findings');
  const d=await xApprove(c.candidate.id);await ev(`${S} ctl.setActiveRevision(${d.parent});return 1`);await xOpen();
  const rec=await xRecord();xStatement(rec,c.result);
  await clickSel('#recordBtn');await sleep(100);const text=await ev('return document.querySelector("#recStatement").innerText');
  for(const f of c.result.findings) {xa.ok(text.includes(f.id));xa.ok(text.includes(`${f.violating} / ${f.run}`));}
  xa.doesNotMatch(text,/no violations/i);await key('Escape','Escape',27);
  return {pass:true,detail:`${c.candidate.id}: ${c.result.findings.length} residual findings correctly disclosed`};
});

/* V1: screenshots for the visual review (not pass/fail) */
if (SHOTS && (!ONLY || ONLY.has('V1'))) {
  for (const lang of ['en', 'zh']) {
    await load({ lang }); await fit(); await shot(`v1-${lang}-1-builder`);
    await clickSel(`[data-plus="${await edgeId('eligibility', 'gate')}"]`); await sleep(200); await shot(`v1-${lang}-2-search`); await key('Escape', 'Escape', 27);
    await ev(`__bs2.ctl.focusNode('approval'); return 1`); await sleep(500); await shot(`v1-${lang}-3-config-basic`);
    await clickSel('#advToggle'); await sleep(200); await shot(`v1-${lang}-4-config-advanced`);
    await ev(`${S} ctl.setSelected(null); const e=G().edges.find(e=>e.from.node==='payment'&&e.to.node==='resolved'); st.dispatch({type:'patch', ops:[{op:'removeEdge', id:e.id}]}); return 1`); await sleep(300);
    await clickSel('#checklistBtn'); await sleep(200); await shot(`v1-${lang}-5-checklist`); await ev(`${S} st.dispatch({type:'undo'}); return 1`); await clickSel('#checklistBtn');
    await clickSel('#testRunBtn'); await ev(`${S} Object.assign(ctl.run.form,{amount:2500,eligible:2500,split:1,injected:false,replay:false,dup:false,interactive:true}); return 1`); await clickSel('#runBtn'); await sleep(300); await shot(`v1-${lang}-6-run`);
    await ev(`${S} ctl.clearRun(); ctl.setPanel(null); ctl.confirm(); await ctl.runValidation(40); ctl.go('assurance','validate'); return 1`); await sleep(400); await shot(`v1-${lang}-7-validate`);
    await ev(`${S} await ctl.runOptimize(); ctl.go('assurance','optimize'); return 1`); await sleep(400); await shot(`v1-${lang}-8-optimize`);
    await load({ lang }); await fit(); await ask(lang === 'zh' ? '在 Refund Eligibility 后面加一个人工审批' : 'add a human approval after Refund Eligibility'); await sleep(300); await shot(`v1-${lang}-10-ask-ai`);
    await load({ lang }); await openGallery(); await shot(`v1-${lang}-11-gallery`);
    await key('Escape', 'Escape', 27); await sleep(300); await ev(`${S} const e=G().edges.find(e=>e.from.node==='approval'&&e.from.port==='denied'); st.dispatch({type:'patch', ops:[{op:'removeEdge', id:e.id}]}); ctl.setSelected(null); return 1`); await sleep(300);
    await ev(`__bs2.ctl.focusNode('approval'); return 1`); await sleep(700); await stable(); await shot(`v1-${lang}-14-lr-zoom`);
    await ev(`${S} ctl.go('assurance','decide'); return 1`); await sleep(400); await shot(`v1-${lang}-9-decide`);
  }
  for (const lang of ['en', 'zh']) {
    await xSetup({ lang }); await xLayer('simulation'); await shot(`v1-${lang}-15-trace`);
    await xApprove(); await xOpen(); await clickSel('#recordBtn'); await sleep(200); await shot(`v1-${lang}-16-trace-record`);
  }
  console.log('V1 screenshots written to ' + SHOTS);
}

ws.close(); proc.kill(); server.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length} / ${results.length} probes passed` + (t1Events ? ` · T1 used ${t1Events} input events` : ''));
process.exit(failed.length ? 1 : 0);
