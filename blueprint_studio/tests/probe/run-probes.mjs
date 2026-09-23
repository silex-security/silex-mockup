#!/usr/bin/env node
/* Acceptance probes for Blueprint Studio (plan §7), in headless Chrome over
   the DevTools protocol — same pattern as swm/skills/swm-data-rebuild/scripts/preview-panels.mjs.
   Real mouse and keyboard input goes through Input.dispatch*; state is read
   back from the page. Prints PASS/FAIL per probe; exit 1 on any failure.

     node blueprint_studio/tests/probe/run-probes.mjs [--only 1,2,11] [--shots dir]

   Requires node >= 22 (global WebSocket) and Chrome/Chromium (CHROME=/path). */

import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..', '..'));             /* repo root */
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
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const URL0 = ORIGIN + '/blueprint_studio/index.html';

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'])
    try { execSync(`test -x ${JSON.stringify(c)}`); return c; } catch {}
  return null;
}
const chrome = findChrome();
if (!chrome) { console.error('No Chrome found (set CHROME=)'); process.exit(2); }
const dport = 9100 + Math.floor(Math.random() * 800);
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${dport}`, `--user-data-dir=${join(tmpdir(), 'bs-probe-' + dport)}`, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${dport}/json/version`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const target = (await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0; const pending = new Map(); let errors = []; let requests = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || 'exception');
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
});
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise(res => { const i = ++seq; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
async function viewport(width, height) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); }
await viewport(1600, 1000);

async function load({ clear = true } = {}) {
  if (clear) { await send('Page.navigate', { url: URL0 }); await waitReady(); await ev('localStorage.clear(); return 1'); }
  await send('Page.navigate', { url: URL0 }); await waitReady();
}
async function waitReady() { for (let i = 0; i < 80; i++) { await sleep(100); try { if (await ev('return document.documentElement.dataset.ready === "1"')) return; } catch {} } throw new Error('page not ready'); }

/* input */
const MOD = { ctrl: 2, shift: 8 };
async function mouse(type, x, y, { buttons = 1, modifiers = 0 } = {}) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, modifiers }); }
async function drag(x1, y1, x2, y2, { modifiers = 0, steps = 8 } = {}) {
  await mouse('mouseMoved', x1, y1, { buttons: 0 }); await mouse('mousePressed', x1, y1, { modifiers });
  for (let i = 1; i <= steps; i++) await mouse('mouseMoved', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, { modifiers });
  await mouse('mouseReleased', x2, y2, { buttons: 0, modifiers }); await sleep(60);
}
async function click(x, y, modifiers = 0) { await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y, { modifiers }); await mouse('mouseReleased', x, y, { buttons: 0, modifiers }); await sleep(40); }
async function key(k, code, vk, modifiers = 0) {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers }); await sleep(40);
}
async function focusCanvas() { await ev('document.getElementById("canvasWrap").focus(); return 1'); }
const center = sel => ev(`const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}`);
const graphJSON = () => ev('return JSON.stringify(__bs.store.active().graph)');
const hash = () => ev('return __bs.store.hashOf(__bs.store.active())');
const S = 'const bs=__bs, st=bs.store, M=bs.modules;';

/* ------------------------------------------------------------------ probes */
const results = [];
async function probe(id, name, fn) {
  if (ONLY && !ONLY.has(String(id))) return;
  errors = []; requests = [];
  let pass = false, detail = '';
  try { const r = await fn(); pass = r.pass; detail = r.detail || ''; }
  catch (e) { detail = 'threw: ' + String(e.message || e).split('\n')[0]; }
  const errs = errors.filter(e => !/favicon/.test(e));
  if (errs.length) { pass = false; detail += ' | console: ' + errs.slice(0, 2).join(' / ').slice(0, 300); }
  if (SHOTS) { await mkdir(SHOTS, { recursive: true }); const s = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(SHOTS, `p${String(id).padStart(2, '0')}.png`), Buffer.from(s.result.data, 'base64')); }
  results.push({ id, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${String(id).padEnd(4)} ${name}${detail ? '  — ' + detail : ''}`);
}

const confirmActive = () => ev(`${S} return st.dispatch({type:'confirm'}).ok`);
const validateN = (n = 20) => ev(`${S} const r = await bs.runValidation(${n}); return r.ok`);
const optimize = () => ev(`${S} const r = await bs.runOptimize(); return r.ok`);

await probe(1, 'load: refund template, counts, no errors, same-origin + fonts only', async () => {
  await load();
  const c = await ev('return {nodes: document.querySelectorAll(".node").length, flow: document.querySelectorAll("#edges path.flow").length, access: document.querySelectorAll("#edges path.access").length}');
  const foreign = requests.filter(u => !u.startsWith(ORIGIN + '/blueprint_studio/') && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u) && !u.startsWith('data:'));
  return { pass: c.nodes === 14 && c.flow === 9 && c.access === 2 && !foreign.length, detail: JSON.stringify(c) + (foreign.length ? ' foreign: ' + foreign.join(',') : '') };
});

await probe(2, 'palette drop under zoom+pan; connect out→in; refuse out→acc and out→out; delete + reconnect', async () => {
  await load();
  await ev('__bs.canvas.setView(-200, -80, 1.5); return 1');
  const pal = await center('.pal-item[data-type="agent"]');
  const wrap = await ev('const r=document.getElementById("canvasWrap").getBoundingClientRect(); return {x:r.left+r.width*0.55, y:r.top+r.height*0.45}');
  await drag(pal.x, pal.y, wrap.x, wrap.y);
  const added = await ev(`${S} const n = st.active().graph.nodes.find(n=>n.id==='agent-1'); const w = bs.canvas.screenToWorld(${wrap.x}, ${wrap.y}); return n && {x:n.x, y:n.y, ex: Math.round((w.x-92)/10)*10, ey: Math.round((w.y-20)/10)*10}`);
  const posOk = added && added.x === added.ex && added.y === added.ey;
  const e0 = await ev('return __bs.store.active().graph.edges.length');
  const out = await center('.node[data-node="agent-1"] .port[data-port="out"]');
  const inn = await center('.node[data-node="eligibility"] .port[data-port="in"]');
  const visible = await ev(`const W=document.getElementById('canvasWrap').getBoundingClientRect(); return [${out.x}, ${inn.x}].every(x=>x>W.left && x<W.right)`);
  await drag(out.x, out.y, inn.x, inn.y);
  const e1 = await ev('return __bs.store.active().graph.edges.length');
  await ev('__bs.canvas.setView(-100, 40, 1); return 1');
  const out2 = await center('.node[data-node="triage"] .port[data-port="out"]');
  const acc = await center('.node[data-node="credentials"] .port[data-port="acc"]');
  await drag(out2.x, out2.y, acc.x, acc.y);
  const o3 = await center('.node[data-node="gate"] .port[data-port="true"]');
  const o4 = await center('.node[data-node="eligibility"] .port[data-port="out"]');
  await drag(o3.x, o3.y, o4.x, o4.y);
  const e2 = await ev('return __bs.store.active().graph.edges.length');
  const newEdge = await ev(`${S} return st.active().graph.edges.find(e=>e.from.node==='agent-1')?.id`);
  await ev(`__bs.canvas.select([], {edge: ${JSON.stringify(newEdge)}}); return 1`); await focusCanvas(); await key('Delete', 'Delete', 46);
  const e3 = await ev('return __bs.store.active().graph.edges.length');
  const outB = await center('.node[data-node="agent-1"] .port[data-port="out"]'), inB = await center('.node[data-node="eligibility"] .port[data-port="in"]');
  await drag(outB.x, outB.y, inB.x, inB.y);
  const e4 = await ev('return __bs.store.active().graph.edges.length');
  return { pass: visible && posOk && e1 === e0 + 1 && e2 === e1 && e3 === e1 - 1 && e4 === e1, detail: JSON.stringify({ visible, added, e0, e1, e2, e3, e4 }) };
});

await probe(3, 'inspector: condition edit applies; invalid expression is shown and not applied', async () => {
  await load();
  const g = await center('.node[data-node="gate"] strong'); await click(g.x, g.y);
  const set = async v => ev(`const i=document.querySelector('#inspector input[data-expr="condition"]'); i.value=${JSON.stringify(v)}; i.dispatchEvent(new Event('change')); return 1`);
  await set('amount > 500');
  const c1 = await ev(`${S} return st.active().graph.nodes.find(n=>n.id==='gate').config.condition`);
  await set('amount >');
  const c2 = await ev(`${S} return st.active().graph.nodes.find(n=>n.id==='gate').config.condition`);
  const err = await ev(`return [...document.querySelectorAll('#inspector .err')].some(e=>!e.hidden && e.textContent.length>0)`);
  return { pass: c1 === 'amount > 500' && c2 === 'amount > 500' && err, detail: JSON.stringify({ c1, c2, err }) };
});

await probe(4, 'marquee 3 nodes → copy → paste; undo×3 to load hash; redo×3 to the same hash', async () => {
  await load();
  const h0 = await hash();
  const box = await ev(`const rs=['request','triage','eligibility'].map(id=>document.querySelector('.node[data-node="'+id+'"]').getBoundingClientRect()); return {x1:Math.min(...rs.map(r=>r.left))-12, y1:Math.min(...rs.map(r=>r.top))-12, x2:Math.max(...rs.map(r=>r.right))+12, y2:Math.max(...rs.map(r=>r.bottom))+12}`);
  await drag(box.x1, box.y1, box.x2, box.y2, { modifiers: MOD.shift });
  const selected = await ev('return __bs.canvas.selection.nodes.slice().sort().join(",")');
  await focusCanvas(); await key('c', 'KeyC', 67, MOD.ctrl); await key('v', 'KeyV', 86, MOD.ctrl);
  const after = await ev(`${S} const g=st.active().graph; return {nodes:g.nodes.length, edges:g.edges.length}`);
  const t = await center('.node[data-node="gate"] .head'); await drag(t.x, t.y, t.x + 60, t.y + 40);
  const d = await center('.node[data-node="dup"] strong'); await click(d.x, d.y); await focusCanvas(); await key('Delete', 'Delete', 46);
  const h3 = await hash(); const g3 = await graphJSON();
  for (let i = 0; i < 3; i++) await key('z', 'KeyZ', 90, MOD.ctrl);
  const back = await hash();
  for (let i = 0; i < 3; i++) await key('z', 'KeyZ', 90, MOD.ctrl | MOD.shift);
  const fwd = await hash(), g3b = await graphJSON();
  return { pass: selected === 'eligibility,request,triage' && after.nodes === 17 && after.edges === 13 && back === h0 && fwd === h3 && g3 === g3b, detail: JSON.stringify({ selected, after }) };
});

await probe(5, 'auto-layout: no overlaps; fit contains all nodes; minimap click recentres', async () => {
  await load();
  await ev('document.getElementById("layoutBtn").click(); return 1'); await sleep(300);
  const r = await ev(`const W=document.getElementById('canvasWrap').getBoundingClientRect(); const rs=[...document.querySelectorAll('.node')].map(n=>n.getBoundingClientRect());
    let overlap=0; for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const a=rs[i],b=rs[j]; if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1) overlap++}
    const inside=rs.every(a=>a.left>=W.left-1&&a.right<=W.right+1&&a.top>=W.top-1&&a.bottom<=W.bottom+1); return {overlap, inside}`);
  const v0 = await ev('return JSON.stringify(__bs.canvas.view)');
  const mm = await ev('const r=document.getElementById("minimap").getBoundingClientRect(); return {x:r.left+8, y:r.top+8}');
  await click(mm.x, mm.y);
  const v1 = await ev('return JSON.stringify(__bs.canvas.view)');
  return { pass: r.overlap === 0 && r.inside && v0 !== v1, detail: JSON.stringify(r) };
});

await probe(6, 'autosave restore; export→import in a cleared profile keeps the hash; malformed import leaves the document untouched', async () => {
  await load();
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setLabel', id:'gate', label:'Big refund?'}]}); return 1`);
  const h1 = await hash();
  await load({ clear: false });
  const h2 = await hash();
  const text = await ev(`${S} return M.io.exportDocument(st.doc)`);
  await load();
  await ev(`__bs.importText(${JSON.stringify(text)}); return 1`);
  const h3 = await hash();
  await ev(`__bs.importText('{"schema":"nope"'); return 1`);
  const h4 = await hash();
  const toast = await ev('return document.getElementById("toast").textContent');
  return { pass: h1 === h2 && h2 === h3 && h3 === h4 && /Import failed/.test(toast), detail: toast };
});

await probe(7, 'confirmed revision refuses every mutation route (palette, connect, delete, drag, inspector, paste, layout, NL, undo)', async () => {
  await load();
  await ev(`${S} st.dispatch({type:'patch', ops:[{op:'setLabel', id:'gate', label:'x'}]}); return 1`);
  await confirmActive();
  const g0 = await graphJSON();
  const pal = await center('.pal-item[data-type="tool"]'), w = await center('#canvasWrap'); await drag(pal.x, pal.y, w.x, w.y);
  const o = await center('.node[data-node="triage"] .port[data-port="out"]'), i = await center('.node[data-node="declined"] .port[data-port="in"]'); await drag(o.x, o.y, i.x, i.y);
  const d = await center('.node[data-node="dup"] strong'); await click(d.x, d.y); await focusCanvas(); await key('Delete', 'Delete', 46);
  const hd = await center('.node[data-node="gate"] .head'); await drag(hd.x, hd.y, hd.x + 80, hd.y + 50);
  const inspectorDisabled = await ev(`return [...document.querySelectorAll('#inspector input, #inspector select')].every(e=>e.disabled)`);
  const inspectorDirect = await ev(`${S} return st.dispatch({type:'patch', ops:[{op:'setConfig', id:'gate', key:'condition', value:'amount > 1'}]}).error?.code`);
  await focusCanvas(); await key('c', 'KeyC', 67, MOD.ctrl); await key('v', 'KeyV', 86, MOD.ctrl);
  await ev('document.getElementById("layoutBtn").click(); return 1');
  await ev('const i=document.getElementById("nlInput"); i.value="Prevent duplicate refunds."; document.getElementById("nlApply").click(); return 1');
  await focusCanvas(); await key('z', 'KeyZ', 90, MOD.ctrl);
  const g1 = await graphJSON();
  return { pass: g0 === g1 && inspectorDisabled && inspectorDirect === 'locked', detail: JSON.stringify({ same: g0 === g1, inspectorDisabled, inspectorDirect }) };
});

await probe(8, 'stage guards: draft disables Validate/Optimize/Decide/Register; confirmed without decision keeps Register disabled', async () => {
  await load();
  const d = await ev(`return ['validate','optimize','decide','register'].map(s=>document.querySelector('.stage[data-stage="'+s+'"]').disabled)`);
  await confirmActive();
  const c = await ev(`return ['validate','register'].map(s=>document.querySelector('.stage[data-stage="'+s+'"]').disabled)`);
  return { pass: d.every(Boolean) && c[0] === false && c[1] === true, detail: JSON.stringify({ d, c }) };
});

await probe(9, 'new revision from v1.1 → v1.2 with parent 1; v1.1 hash and results unchanged', async () => {
  await load();
  await confirmActive();
  await ev(`${S} st.dispatch({type:'newRevision'}); st.dispatch({type:'patch', ops:[{op:'setLabel', id:'gate', label:'Gate v1.1'}]}); st.dispatch({type:'confirm'}); return 1`);
  await validateN(20);
  const before = await ev(`${S} const r=st.revision(1); return JSON.stringify({h:r.hash, v:r.validation.scenarioSetId, f:r.validation.result.findings.length})`);
  await ev('document.getElementById("newRevBtn")?.click() || __bs.store.dispatch({type:"newRevision"}); return 1');
  const r2 = await ev(`${S} const a=st.active(); return {rev:a.rev, parent:a.parent, status:a.status}`);
  await ev(`${S} st.dispatch({type:'setActive', rev:1}); bs.go('validate'); return 1`);
  const after = await ev(`${S} const r=st.revision(1); return JSON.stringify({h:r.hash, v:r.validation.scenarioSetId, f:r.validation.result.findings.length})`);
  const shown = await ev('return !!document.querySelector("#findingsCard")');
  return { pass: r2.rev === 2 && r2.parent === 1 && r2.status === 'draft' && before === after && shown, detail: JSON.stringify(r2) };
});

await probe(10, 'late result: switching revision during Optimize discards its result', async () => {
  await load();
  await confirmActive(); await validateN(20);
  const r = await ev(`${S} const p = bs.runOptimize(); st.dispatch({type:'newRevision'}); const res = await p; return {res: res.ok ? 'ok' : res.error.code, opt: st.revision(0).optimization}`);
  return { pass: r.res === 'stale_job' && r.opt === null, detail: JSON.stringify(r) };
});

const EXPECTED = ['dup:duplicate_submit', 'exposure:injection_exfil', 'unauth:below_threshold', 'unauth:benign', 'unauth:replay', 'unauth:split'];
await probe(11, 'validate baseline: exactly the plan §4.6 findings; every path chip Declared; potential panel labelled', async () => {
  await load(); await confirmActive(); await validateN(40); await ev('__bs.go("validate"); return 1');
  const f = await ev(`${S} return st.active().validation.result.findings.map(f=>f.prohibited+':'+f.template).sort()`);
  const chips = await ev(`return [...document.querySelectorAll('#findingsCard .grade')].map(e=>e.textContent)`);
  const pot = await ev(`return [...document.querySelectorAll('.grade')].some(e=>e.textContent==='potential')`);
  return { pass: JSON.stringify(f) === JSON.stringify(EXPECTED) && chips.length > 0 && chips.every(c => c === 'Declared') && pot, detail: f.join(' ') };
});

await probe(12, 'graph → results: dayTotal>500 + full single-use binding clears Unauthorized Refund; duplicate and exposure remain', async () => {
  await load(); await confirmActive();
  await ev(`${S} st.dispatch({type:'newRevision'}); st.dispatch({type:'patch', ops:[{op:'setConfig', id:'gate', key:'condition', value:'dayTotal > 500'},{op:'setConfig', id:'approval', key:'binding', value:['customer','order','amount']},{op:'setConfig', id:'approval', key:'singleUse', value:true}]}); st.dispatch({type:'confirm'}); return 1`);
  await validateN(40);
  const f = await ev(`${S} return st.active().validation.result.findings.map(f=>f.prohibited+':'+f.template).sort()`);
  return { pass: JSON.stringify(f) === JSON.stringify(['dup:duplicate_submit', 'exposure:injection_exfil']), detail: f.join(' ') };
});

await probe(13, 'structural break: deleting Payment API → Refund Resolved is a lint error and Confirm stays disabled', async () => {
  await load();
  await ev(`${S} const e=st.active().graph.edges.find(e=>e.from.node==='payment' && e.to.node==='resolved'); st.dispatch({type:'patch', ops:[{op:'removeEdge', id:e.id}]}); bs.go('confirm'); return 1`);
  const codes = await ev(`${S} return M.validator.lint(st.active().graph).filter(i=>i.severity==='error').map(i=>i.code)`);
  await ev('const a=document.getElementById("confirmAck"); a.checked=true; a.dispatchEvent(new Event("change")); return 1');
  const disabled = await ev('return document.getElementById("confirmBtn").disabled');
  const direct = await ev(`${S} return st.dispatch({type:'confirm'}).error?.code`);
  return { pass: codes.length > 0 && disabled && direct === 'lint_errors', detail: codes.join(',') };
});

await probe(14, 'optimize: the recommended scorecard equals a direct runCandidate + score on the same scenario set', async () => {
  await load(); await confirmActive(); await validateN(40); await optimize();
  const r = await ev(`${S} const rev=st.active(); const id=bs.recommendedId(rev); const c=rev.optimization.candidates.find(c=>c.candidate.id===id);
    const set=M.adversary.generateScenarioSet(rev.graph,{n:rev.validation.n, baseHash:rev.hash});
    const direct=M.optimizer.runCandidate(rev.graph, c.candidate, set, st.meta()); const v=M.optimizer.score(rev.validation.result, direct.value);
    return {id, same: JSON.stringify(v.scorecard)===JSON.stringify(c.verdict.scorecard), setSame: set.id===rev.optimization.scenarioSetId}`);
  return { pass: !!r.id && r.same && r.setSame && /dayTotal/.test(r.id), detail: JSON.stringify(r) };
});

/* Snapshot of a validated + optimized document, reused by the three independent histories. */
let snapshot = null;
async function toSnapshot() {
  if (!snapshot) { await load(); await confirmActive(); await validateN(40); await optimize(); snapshot = await ev(`${S} return M.io.exportDocument(st.doc)`); }
  await load(); await ev(`__bs.importText(${JSON.stringify(snapshot)}); return 1`);
}

await probe(15, 'three histories: Approve → confirmed child with the tested hash; Modify → stale, then re-run changes the scorecard; Reject → no Recommended label left', async () => {
  await toSnapshot();
  const a = await ev(`${S} const rev=st.active(); const id=bs.recommendedId(rev); const c=rev.optimization.candidates.find(c=>c.candidate.id===id); bs.ui.decideId=id; bs.go('decide');
    document.getElementById('approveBtn').click(); const ch=st.active(); return {child: ch.rev, parent: ch.parent, status: ch.status, origin: ch.origin, hashOk: ch.hash===c.result.patchedHash}`);
  await toSnapshot();
  const m = await ev(`${S} const rev=st.active(); const id=bs.recommendedId(rev); const c=rev.optimization.candidates.find(c=>c.candidate.id===id);
    const opts=c.candidate.paramOptions||{}; const k=Object.keys(opts)[0]; if(!k) return {noParams:true};
    const other=opts[k].find(o=>JSON.stringify(o)!==JSON.stringify(c.candidate.params[k])); const before=JSON.stringify(c.verdict.scorecard);
    const p=bs.modifyCandidate(id, {...c.candidate.params, [k]: other}); const mid=st.active().optimization.candidates.find(x=>x.candidate.id===id).state;
    bs.ui.decideId=id; bs.go('decide'); const approveDisabledWhileStale=document.getElementById('approveBtn')?.disabled ?? true;
    await p; const after=st.active().optimization.candidates.find(x=>x.candidate.id===id); return {k, other, mid, approveDisabledWhileStale, state: after.state, changed: JSON.stringify(after.verdict.scorecard)!==before}`);
  await toSnapshot();
  const r = await ev(`${S} const rev=st.active(); const id=bs.recommendedId(rev); st.dispatch({type:'reject', rev: rev.rev, candidateId: id}); bs.go('optimize');
    const card=document.querySelector('.cand[data-cand="'+CSS.escape(id)+'"]'); const next=bs.recommendedId(st.active());
    return {rejected: id, next, labelGone: !card.querySelector('.tag').textContent.includes('Recommended'), recCards: document.querySelectorAll('.cand.recommended').length}`);
  const pass = a.status === 'confirmed' && a.origin === 'approve' && a.parent === 0 && a.hashOk
    && m.mid === 'stale' && m.approveDisabledWhileStale && m.state === 'tested' && m.changed
    && r.labelGone && r.next !== r.rejected && r.recCards === (r.next ? 1 : 0);
  return { pass, detail: JSON.stringify({ a, m, r }) };
});

await probe('15b', 'approve guard: ineligible refused in UI and dispatch; double Modify keeps only the second; decided parent refuses re-validation', async () => {
  await toSnapshot();
  const g = await ev(`${S} const rev=st.active(); const bad=rev.optimization.candidates.find(c=>!c.verdict.eligible); if(!bad) return {noIneligible:true};
    bs.ui.decideId=bad.candidate.id; bs.go('decide'); const uiDisabled=document.getElementById('approveBtn').disabled; const d=st.dispatch({type:'approve', rev: rev.rev, candidateId: bad.candidate.id});
    return {uiDisabled, dispatch: d.ok, code: d.error?.code}`);
  const m = await ev(`${S} const rev=st.active(); const id=bs.recommendedId(rev); const c=rev.optimization.candidates.find(c=>c.candidate.id===id); const opts=c.candidate.paramOptions||{}; const k=Object.keys(opts)[0]; if(!k) return {noParams:true};
    const vals=opts[k]; const a=vals.find(o=>JSON.stringify(o)!==JSON.stringify(c.candidate.params[k])); const b=c.candidate.params[k];
    const p1=bs.modifyCandidate(id, {...c.candidate.params, [k]: a}); const p2=bs.modifyCandidate(id, {...c.candidate.params, [k]: b}); const r1=await p1, r2=await p2;
    const after=st.active().optimization.candidates.find(x=>x.candidate.id===id); return {first: r1.ok ? 'ok' : r1.error.code, second: r2.ok, pv: after.candidate.paramsVersion, param: JSON.stringify(after.candidate.params[k])===JSON.stringify(b), state: after.state}`);
  const d = await ev(`${S} const rev=st.active(); const id=bs.recommendedId(rev); const ev0=JSON.stringify(rev.optimization.candidates.find(c=>c.candidate.id===id).verdict);
    const ap=st.dispatch({type:'approve', rev: rev.rev, candidateId: id}); st.dispatch({type:'setActive', rev: 0}); const again=await bs.runValidation(20);
    return {approved: ap.ok, revalidate: again.ok ? 'ok' : again.error.code, evidenceKept: JSON.stringify(st.revision(0).decision.evidence.scorecard)===JSON.stringify(JSON.parse(ev0).scorecard)}`);
  const pass = g.uiDisabled && g.dispatch === false && m.first === 'stale_job' && m.second && m.param && m.state === 'tested' && d.approved && d.revalidate === 'decided' && d.evidenceKept;
  return { pass, detail: JSON.stringify({ g, m, d }) };
});

await probe(16, 'register twice → one inventory entry; survives reload; never claims deployment', async () => {
  await toSnapshot();
  await ev(`${S} const rev=st.active(); st.dispatch({type:'approve', rev: rev.rev, candidateId: bs.recommendedId(rev)}); bs.go('register'); document.getElementById('registerBtn').click(); st.dispatch({type:'register', rev: st.active().rev}); return 1`);
  const n1 = await ev('return __bs.store.inventory().length');
  await load({ clear: false }); await ev('__bs.go("register"); return 1');
  const n2 = await ev('return __bs.store.inventory().length');
  const text = await ev('return document.body.innerText');
  const claims = (text.match(/[^\n]*\bdeployed\b[^\n]*/gi) || []).filter(l => !/not deployed|does not deploy|nothing is deployed/i.test(l));
  return { pass: n1 === 1 && n2 === 1 && !claims.length, detail: JSON.stringify({ n1, n2, claims }) };
});

await probe(17, 'interactive run: $2,500 pauses at Approval; Deny ends at Refund Declined; step mode is one node per click', async () => {
  await load();
  await ev(`const f=__bs.ui.form; f.amount=2500; f.eligible=2500; f.interactive=true; document.getElementById('runBtn').click(); return 1`);
  const w = await ev(`return document.getElementById('denyRunBtn') ? __bs.ui.run.waiting : null`);
  await ev('document.getElementById("denyRunBtn").click(); return 1');
  const end = await ev(`return __bs.ui.runView.activations.map(a=>a.end+':'+a.status)`);
  const steps = await ev('return document.querySelectorAll("#traceList .st").length');
  const hasPayload = await ev('return /"req"/.test(document.getElementById("stepJson").textContent)');
  await ev(`const f=__bs.ui.form; f.amount=300; f.eligible=300; [...document.querySelectorAll('#runpanel button')].find(b=>b.textContent==='Clear').click(); return 1`);
  await ev(`document.getElementById('stepBtn').click(); return 1`);
  const s1 = await ev('return __bs.ui.runView.trace.length');
  await ev(`document.getElementById('stepBtn').click(); return 1`);
  const s2 = await ev('return __bs.ui.runView.trace.length');
  return { pass: w && w.node === 'approval' && end.join() === 'declined:failure' && steps > 3 && hasPayload && s2 === s1 + 1, detail: JSON.stringify({ w, end, steps, s1, s2 }) };
});

await probe(18, 'vendor template: its own finding, with vendor.update writes in the traces', async () => {
  await load();
  await ev('await __bs.startFromTemplate("vendor-bank-change"); return 1'); await sleep(200);
  await confirmActive(); await validateN(20);
  const r = await ev(`${S} const rev=st.active(); const f=rev.validation.result.findings; const set=M.adversary.generateScenarioSet(rev.graph,{n:20, baseHash:rev.hash});
    const v=M.validator.validate(rev.graph, set); const caps=new Set(v.runs.flatMap(r=>r.session.ledger.writes.map(w=>w.cap)));
    return {findings: f.map(x=>x.prohibited+':'+x.template), caps:[...caps]}`);
  return { pass: r.findings.length > 0 && r.findings.every(f => f.startsWith('vunauth:')) && r.caps.join() === 'vendor.update', detail: JSON.stringify(r) };
});

await probe(19, 'at 390 px: desktop-editor notice, no horizontal scroll', async () => {
  await viewport(390, 844); await load({ clear: false });
  const r = await ev('return {note: getComputedStyle(document.getElementById("narrowNote")).display !== "none", scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth}');
  await viewport(1600, 1000);
  return { pass: r.note && r.scroll, detail: JSON.stringify(r) };
});

await probe(20, 'performance: validate + optimize on the refund template at n=40 under 3 s', async () => {
  await load(); await confirmActive();
  const ms = await ev(`${S} const t0=performance.now(); await bs.runValidation(40); await bs.runOptimize(); return Math.round(performance.now()-t0)`);
  return { pass: ms < 3000, detail: ms + ' ms' };
});

/* Not a pass/fail probe: with --shots, captures every stage for reviewers. */
if (SHOTS && (!ONLY || ONLY.has('tour'))) {
  await load(); await confirmActive(); await validateN(40); await optimize();
  for (const st of ['confirm', 'validate', 'optimize', 'decide']) {
    await ev(`__bs.go('${st}'); window.scrollTo(0,0); document.querySelector('#stage-${st}').scrollTop = 0; return 1`); await sleep(150);
    const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(SHOTS, `tour-${st}.png`), Buffer.from(s.result.data, 'base64'));
  }
  await ev(`${S} const rev=st.active(); st.dispatch({type:'approve', rev: rev.rev, candidateId: bs.recommendedId(rev)}); bs.go('register'); document.getElementById('registerBtn').click(); return 1`); await sleep(150);
  let s = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(SHOTS, 'tour-register.png'), Buffer.from(s.result.data, 'base64'));
  await ev(`__bs.go('build'); const f=__bs.ui.form; f.amount=1800; f.eligible=1800; f.split=4; document.getElementById('runBtn').click(); return 1`); await sleep(150);
  s = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(SHOTS, 'tour-build-run.png'), Buffer.from(s.result.data, 'base64'));
  console.log('tour screenshots written to ' + SHOTS);
}

ws.close(); proc.kill(); server.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length} / ${results.length} probes passed`);
process.exit(failed.length ? 1 : 0);
