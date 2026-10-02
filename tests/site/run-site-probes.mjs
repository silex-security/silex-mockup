#!/usr/bin/env node
/* Studio cutover S1–S12 + Runtime Observation S13–S19 + floating navigation S20 + Learning loop S21. Run from any cwd:
 * node tests/site/run-site-probes.mjs [--only S1,S3] [--shots /tmp/site-shots]
 * --base https://silex-mockup.vercel.app runs only the approved live subset:
 * S1, S3 (recommendation), S4 (registration/persistence), S5, S13 (restored validation), S14, S17 (routes and nav order), S20 (floating navigation), S21 (learning loop). Isolated Chrome profile;
 * browser-local demo data only. No server in --base mode; no production API writes.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, access, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { recommend } from '../../blueprint_studio/js/optimize.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
function option(k) { const i = args.indexOf(k); if (i < 0) return null; if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`${k} needs a value`); return args[i + 1]; }
const BASE = option('--base'), ONLY = option('--only')?.split(','), SHOTS = option('--shots');
const LIVE = new Set(['S1', 'S3', 'S4', 'S5', 'S13', 'S14', 'S17', 'S20', 'S21']);
const wanted = id => (!ONLY || ONLY.includes(id)) && (!BASE || LIVE.has(id));
const fixture = JSON.parse(await readFile(join(ROOT, 'tests/site/fixtures/storage.sample.json'), 'utf8'));
const fixtureDocs = Object.entries(fixture).filter(([k]) => k.startsWith('bs.doc.')).map(([, v]) => JSON.parse(v));
const acceptFixture = fixtureDocs.find(d => d.revisions.some(r => r.status === 'confirmed' && !r.decision && r.origin !== 'approve' && r.validation?.result.findings.length === 0));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const Q = JSON.stringify;
let server, chrome, browser;
const results = [], clients = new Set();
const profile = await mkdtemp(join(tmpdir(), 'studio-site-probes-'));
const downloadDir = join(profile, 'downloads'); await mkdir(downloadDir);
let origin;
if (BASE || process.env.SITE_BASE) origin = (BASE || process.env.SITE_BASE).replace(/\/$/, '');
else {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  server = createServer(async (req, res) => {
    try {
      let file = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(await readFile(file));
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); origin = `http://127.0.0.1:${server.address().port}`;
}
async function findChrome() {
  for (const p of [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)) {
    try { await access(p); return p; } catch {}
  }
  throw Error('Chrome not found; set CHROME');
}
async function connect(url) {
  const ws = new WebSocket(url), waiting = new Map(); let seq = 0;
  const c = { ws, errors: [], requests: [], downloads: [] };
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = waiting.get(m.id); if (p) { waiting.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); } }
    if (m.method === 'Runtime.exceptionThrown') c.errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') c.errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.requestWillBeSent') c.requests.push(m.params.request.url);
    if (m.method === 'Browser.downloadWillBegin' || m.method === 'Page.downloadWillBegin') c.downloads.push(m.params);
  });
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  c.send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => { waiting.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 30000); waiting.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
  c.ev = async code => { const r = await c.send('Runtime.evaluate', { expression: `(async()=>{${code}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
  clients.add(c); return c;
}
async function until(fn, label, timeout = 15000) { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const r = await fn(); if (r) return r; } catch (e) { last = e.message; } await sleep(100); } throw Error(`Timeout: ${label}${last ? ': ' + last : ''}`); }
let page;
async function viewport(w = 1440, h = 900) { await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); }
async function navigate(path = '/index.html') { await page.send('Page.navigate', { url: origin + path }); await until(() => page.ev('return document.readyState === "complete" && !!document.querySelector(".nav")'), path); await sleep(200); }
async function load({ seed = false, path = '/index.html' } = {}) {
  await viewport(); await navigate();
  await page.ev(`localStorage.clear(); localStorage.setItem('bs2.lang','en'); for(const [k,v] of Object.entries(${Q(seed ? fixture : {})})) localStorage.setItem(k,v);`);
  page.requests = []; await navigate(path);
  if (path.startsWith('/index')) await until(() => page.ev('return typeof openStudio === "function"'), 'host module');
}
const ev = code => page.ev(code);
const F = 'const w=document.querySelector("#studioFrame").contentWindow; const document=w.document, window=w, localStorage=w.localStorage, __bs2=w.__bs2;';
// Avoid lexical document TDZ: the frame lookup uses globalThis.document.
const FRAME = F.replace('w=document.querySelector', 'w=globalThis.document.querySelector');
const fe = code => ev(FRAME + code);
const S = 'const b=__bs2, st=b.store, ctl=b.ctl;';
async function frameReady() { await until(() => ev('return !!document.querySelector("#studioFrame")?.contentWindow?.__bs2?.store.doc'), 'iframe ready', 30000); await sleep(150); }
async function open(cmd = 'resume', params = {}) { await ev(`openStudio(${Q(cmd)},${Q(params)});`); await frameReady(); }
async function clickSel(sel, frame = false) {
  const code = `const e=document.querySelector(${Q(sel)}); if(!e) throw Error('Missing selector '+${Q(sel)}); e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); if(!r.width||!r.height||e.disabled) throw Error('Hidden/disabled '+${Q(sel)}); const x=r.x+r.width/2,y=r.y+r.height/2; const hit=document.elementFromPoint(x,y);if(!hit||!e.contains(hit))throw Error('Not hit-testable '+${Q(sel)}); return {x,y};`;
  if(await ev('return !!window.__siteNav&&window.__siteNav.state().desktop&&window.__siteNav.state().mode==="auto"&&window.__siteNav.state().open&&!document.querySelector(".modal-backdrop.open")') && (frame || !sel.startsWith('.nav ') && !['#navToggle','#navPin'].includes(sel))){
    await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:await ev('return innerWidth-10'),y:await ev('return innerHeight-10')});
    await until(()=>ev('return !window.__siteNav.state().open&&window.__siteNav.state().settled'),'drawer leaves content accessible');
  }
  const p = frame ? await fe(code) : await ev(code);
  if (frame) { const r = await ev('const r=document.querySelector("#studioFrame").getBoundingClientRect(); return {x:r.x,y:r.y};'); p.x += r.x; p.y += r.y; }
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, ...p, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  await sleep(180);
}
async function keyEscape() { for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(100); }
async function nav(view) {
  const floating=await ev('return !!window.__siteNav&&window.__siteNav.state().desktop');
  let temporaryDock=false;
  if(floating){
    await until(()=>ev('return window.__siteNav.state().settled'),'nav settled before navigation');
    const prior=await ev('return window.__siteNav.state()');
    if(!prior.open){await clickSel('#navToggle');temporaryDock=prior.mode==='auto';}
    await until(()=>ev(`const s=window.__siteNav.state(),e=document.querySelector('.nav [data-view="${view}"]');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return s.open&&s.settled&&r.x>=0&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))`),'nav revealed '+view);
  }
  await clickSel(`.nav [data-view="${view}"]`);
  if(temporaryDock){
    await clickSel('#navPin');
    await until(()=>ev('return window.__siteNav.state().mode==="auto"&&!window.__siteNav.state().open&&window.__siteNav.state().settled'),'temporary docking restored');
  }
}
async function shot(name) { if (!SHOTS) return; await mkdir(resolve(SHOTS), { recursive: true }); const r = await page.send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(resolve(SHOTS), name + '.png'), Buffer.from(r.data, 'base64')); }
async function active() { return fe(`${S} return {id:st.doc.id,rev:st.active().rev,hash:st.active().hash,route:ctl.getRoute()};`); }
async function rows(container, attr) { return ev(`return [...document.querySelectorAll(${Q(container + ' [' + attr + ']')})].map(e=>({key:e.getAttribute(${Q(attr)}),text:e.textContent,state:e.dataset.state,disabled:!!e.querySelector('[data-studio-open]')?.disabled,replaced:e.hasAttribute('data-source-replaced')||!!e.querySelector('[data-source-replaced]')}));`); }
async function pendingRows() { return rows('#ovStudioPending', 'data-studio-pending'); }
async function libraryRows() { return rows('#libStudioGroup', 'data-studio-reg'); }
async function docs() { return ev(`return Object.keys(localStorage).filter(k=>k.startsWith('bs.doc.')).map(k=>JSON.parse(localStorage[k]));`); }
function recommended(r) { return recommend(r.optimization.candidates.filter(c => c.state === 'tested' && c.testedParamsVersion === c.candidate.paramsVersion).map(c => ({ candidate: c.candidate, result: c.result, verdict: c.verdict })), new Set(r.optimization.candidates.filter(c => c.state === 'rejected').map(c => c.candidate.id))); }
async function lifecycle(template = 'customer-refund') {
  await open(); await fe(`${S} ctl.startFromTemplate(${Q(template)}); const r=ctl.confirm(); if(!r.ok) throw Error(JSON.stringify(r)); await ctl.runValidation(40); await ctl.runOptimize();`);
  const a = await active(), d = (await docs()).find(d => d.id === a.id), r = d.revisions.find(r => r.rev === a.rev);
  assert.ok(r.optimization, 'optimization saved'); return { d, r, a, id: recommended(r) };
}
async function approveAndRegister(template) { const x = await lifecycle(template); await fe(`${S} const a=ctl.approve(${Q(x.id)}); if(!a.ok) throw Error(JSON.stringify(a)); ctl.go('assurance','register');`); await clickSel('#registerBtn', true); return active(); }
async function assertRoute(expected) { let a; try { await until(async () => { a = await active(); return Object.entries(expected).every(([k,v]) => (k === 'view' || k === 'stage' ? a.route[k] : a[k]) === v); }, 'bound route ' + JSON.stringify(expected)); } catch(e) { throw Error(e.message+'; actual='+JSON.stringify(a)); } }
async function projectionMatches(d, r, cand, state = 'awaiting') {
  const k = `${d.id}|${r.rev}|${r.hash}`;
  await until(async () => (await rows('#pcpStudioCards', 'data-studio-pcp')).some(x => x.key === k && x.state === state), 'PCP ' + state);
  const card = (await rows('#pcpStudioCards', 'data-studio-pcp')).find(x => x.key === k);
  assert.ok(card.text.includes(cand.candidate.label), 'PCP candidate label must match store');
  // Check the projection independently against stored evidence, then the visible values.
  const projected = await ev(`const m=await import('/js/studio-bridge.js'); const s=m.readSummary(localStorage); return m.projectPcp(s.summary,localStorage).find(x=>x.key===${Q(k)});`);
  for (const [field, expected] of Object.entries(cand.verdict.scorecard)) assert.deepEqual(projected.scorecard[field], expected, `PCP ${field} vs store`);
  const lines=await ev(`return [...[...document.querySelectorAll('[data-studio-pcp]')].find(e=>e.dataset.studioPcp===${Q(k)}).querySelectorAll('li')].map(e=>e.textContent);`);
  for (const [field,label] of [['violationsClosed','findings closed'],['benignCompletion','benign completion'],['friction','friction']]) { const v=cand.verdict.scorecard[field], text=(lines.find(l=>l.startsWith(label))||'').replace(/\s+/g,''); assert.ok(text.includes(`${v.num}/${v.den}`), `visible ${field}: ${card.text}`); }
  if(cand.verdict.scorecard.addedLatencyMedian != null) assert.ok(lines.some(l=>l.startsWith('added latency')&&l.includes(String(cand.verdict.scorecard.addedLatencyMedian))),'visible latency vs store');
  assert.ok(card.text.includes(r.validation.scenarioSetId), 'PCP scenario set');
}
async function probe(id, name, fn) {
  if (!wanted(id)) return;
  page.errors = []; let pass = true, detail;
  try { detail = await fn(); } catch (e) { pass = false; detail = e.stack?.split('\n').slice(0,3).join(' ') || String(e); }
  const errs = page.errors.filter(x => !/favicon|ResizeObserver|fonts\.(googleapis|gstatic)|ERR_CERT_AUTHORITY_INVALID/.test(x));
  if (errs.length) { pass = false; detail += ' | console: ' + errs.slice(0,3).join(' / '); }
  try { await shot(id); } catch (e) { pass = false; detail += ' | screenshot: '+e.message; }
  results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} — ${detail || ''}`);
}

try {
  chrome = spawn(await findChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let port; await until(async () => { try { port = Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]); return port; } catch {} }, 'Chrome startup');
  const endpoint = `http://127.0.0.1:${port}`;
  browser = await connect((await (await fetch(endpoint+'/json/version')).json()).webSocketDebuggerUrl);
  const target = (await (await fetch(endpoint+'/json/list')).json()).find(x=>x.type==='page');
  page = await connect(target.webSocketDebuggerUrl);
  for (const method of ['Page.enable','Runtime.enable','Network.enable']) await page.send(method);
  await page.send('Network.setCacheDisabled',{cacheDisabled:true});
  await browser.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir,eventsEnabled:true});
  await browser.send('Browser.grantPermissions',{origin:new URL(origin).origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});

  await probe('S1','all upstream entries and repeatable commands',async()=>{
    await load({seed:true});
    await nav('blueprint'); await frameReady();
    await nav('assurance'); await clickSel('[data-jump="blueprint"]'); await frameReady();
    // The change-log button can be hidden until its modal is opened, as in the legacy site.
    await ev(`document.querySelector('#changesModal').classList.add('open');`); await clickSel('[data-go="blueprint"]'); await frameReady();
    for(const view of ['overview','library']) { await nav(view); await clickSel(`#${view} [data-new-blueprint]`); await frameReady(); assert.equal(await fe(`${S} return ctl.getRoute().gallery`),true); await clickSel('[data-use="customer-refund"]',true); }
    await nav('library'); await ev(`const e=document.querySelector('#deployFilter'); e.value='Not registered'; e.dispatchEvent(new Event('input',{bubbles:true}));`); await clickSel('#libRows [data-new-blueprint]'); await frameReady(); assert.equal(await fe(`${S} return ctl.getRoute().gallery`),true); await clickSel('[data-use="customer-refund"]',true);
    await nav('library'); await clickSel('[data-lib-view="cards"]'); await clickSel('#libCards [data-new-blueprint]'); await frameReady(); assert.equal(await fe(`${S} return ctl.getRoute().gallery`),true); await clickSel('[data-use="customer-refund"]',true);
    const targetDoc=fixtureDocs.find(d=>d.revisions.some(r=>r.optimization&&!r.decision)); const r=targetDoc.revisions.find(r=>r.optimization&&!r.decision); const k=`${targetDoc.id}|${r.rev}|${r.hash}`;
    for(const view of ['overview','policies','overview']) { await nav(view); const sel=view==='overview'?`[data-studio-pending=${Q(k)}] [data-studio-open]`:`[data-studio-pcp=${Q(k)}] [data-studio-open]`; await clickSel(sel); await assertRoute({id:targetDoc.id,rev:r.rev,hash:r.hash,view:'assurance',stage:'decide'}); await fe(`${S} ctl.go('assurance','validate');`); }
    for(const hash of ['#studio','#studio=new']) { await navigate('/index.html'+hash); await frameReady(); assert.equal(await ev(`return document.querySelector('#blueprint').classList.contains('active')`),true); if(hash.endsWith('new')) assert.equal(await fe(`${S} return ctl.getRoute().gallery`),true); }
    return 'nav, Assurance, change log, both New actions, discovered row, Overview/PCP review and repeated/deep-link commands';
  });
  await probe('S2','iframe assets remain lazy',async()=>{await load(); await sleep(600); assert.equal(await ev(`return !!document.querySelector('#studioFrame')?.getAttribute('src')`),false); assert.equal(page.requests.filter(u=>u.includes('/blueprint_studio/app/assets/')).length,0); await nav('blueprint'); await frameReady(); assert.ok(page.requests.some(u=>u.includes('/blueprint_studio/app/assets/'))); return 'zero Studio asset requests before first visit';});
  await probe('S3','store-bound pending/PCP lifecycle',async()=>{
    await load(); const incidentCount=await ev(`return parseInt(document.querySelector('#ovPendingCount').textContent)`); const {d,r,id}=await lifecycle(); const c=r.optimization.candidates.find(x=>x.candidate.id===id);
    await nav('overview'); await until(async()=> (await pendingRows()).some(x=>x.key===`${d.id}|${r.rev}|${r.hash}`),'pending approval'); assert.equal(await ev(`return parseInt(document.querySelector('#ovPendingCount').textContent)`),incidentCount+1);
    await nav('policies'); await projectionMatches(d,r,c);
    if(BASE) return `live subset: recommendation ${id}; all scorecard fields equal saved store`;
    const other=r.optimization.candidates.find(x=>x.candidate.id!==id&&x.verdict.eligible&&x.state==='tested'); assert.ok(other,'non-recommended eligible candidate');
    await nav('blueprint'); await fe(`${S} const r=ctl.approve(${Q(other.candidate.id)}); if(!r.ok) throw Error(JSON.stringify(r));`); await nav('overview'); await until(async()=>!(await pendingRows()).some(x=>x.key.startsWith(d.id+'|')),'approval resolves pending'); assert.equal(await ev(`return parseInt(document.querySelector('#ovPendingCount').textContent)`),incidentCount); await nav('policies'); await projectionMatches(d,r,other,'approved');
    await nav('blueprint'); await fe(`${S} ctl.newRevision(); ctl.confirm(); await ctl.runValidation(40);`);
    if(await fe(`${S} return st.active().validation.result.findings.length`)) await fe(`${S} const x=ctl.importText(${Q(JSON.stringify(acceptFixture))}); if(!x.ok) throw Error(JSON.stringify(x));`);
    const a=await active(); await nav('overview'); await until(async()=> (await pendingRows()).some(x=>x.key===`${a.id}|${a.rev}|${a.hash}`&&/accept/i.test(x.text)),'accept pending');
    await nav('blueprint'); await fe(`${S} ctl.go('assurance','decide');`); await clickSel('#acceptBtn',true); await clickSel('#registerBtn',true); await nav('library'); await until(async()=>(await libraryRows()).some(x=>x.key===`${a.id}|${a.rev}|${a.hash}`),'accepted registration'); assert.ok(!(await pendingRows()).some(x=>x.key.startsWith(a.id+'|')));
    return 'recommendation independently selected; non-recommended approval; zero-finding acceptance and registration';
  });
  await probe('S4','registration identity, persistence and replaced source',async()=>{
    await load(); const a=await approveAndRegister('customer-refund'); await fe(`${S} ctl.register();`); await approveAndRegister('vendor-bank-change'); await nav('library'); await until(async()=>(await libraryRows()).length===2,'two registrations'); await navigate(); await nav('library'); assert.equal((await libraryRows()).length,2);
    if(BASE) return 'live subset: two templates, idempotent registration and reload persistence';
    const k=`${a.id}|${a.rev}|${a.hash}`; await clickSel(`[data-studio-reg=${Q(k)}] [data-studio-trace]`); await frameReady(); await assertRoute({id:a.id,rev:a.rev,hash:a.hash,view:'trace'}); await nav('library'); await clickSel(`[data-studio-reg=${Q(k)}] [data-studio-open]`); await frameReady(); await assertRoute({id:a.id,rev:a.rev,hash:a.hash});
    const pinned=await ev(`return localStorage.getItem('bs.reg.'+encodeURIComponent(${Q(k)}))`);
    const replacement=structuredClone(acceptFixture); replacement.id=a.id; await fe(`${S} const r=ctl.importText(${Q(JSON.stringify(replacement))}); if(!r.ok) throw Error(JSON.stringify(r));`); await nav('library'); await until(async()=>(await libraryRows()).some(x=>x.key===k&&x.replaced&&x.disabled),'replaced source'); assert.equal(await ev(`return localStorage.getItem('bs.reg.'+encodeURIComponent(${Q(k)}))`),pinned);
    const before=await fe(`${S} return JSON.stringify(st.doc)`); await open('open',{doc:a.id,rev:a.rev,hash:a.hash,view:'trace'}); assert.equal(await fe(`${S} return JSON.stringify(st.doc)`),before);
    return 'hash-pinned registration retained; missing old source cannot open or replace current document';
  });
  await probe('S5','no legacy Studio residue or view exceptions',async()=>{
    for(const path of ['/index.html','/assurance.html']) {
      await load({seed:true,path}); const html=await ev(`return await (await fetch(${Q(path)})).text()`);
      for(const word of ['bpState','WF-041','BP-REFUND']) assert.ok(!html.includes(word),`${path} retains ${word}`);
      const views=await ev(`return [...document.querySelectorAll('.nav [data-view]')].map(x=>x.dataset.view)`);
      for(const view of views) { await nav(view); await sleep(180); }
      const text=await ev(`return [...document.querySelectorAll('#ovStudioPending,#pcpStudioCards,#libStudioGroup,[data-review-bp]'), ...[...document.querySelectorAll('a[href*=\"index.html#studio\"]')].map(e=>e.closest('.card,.pending-row,tr')||e)].map(e=>e.textContent).join(' ')`); assert.ok(!/Candidate B|94%|2,400|1,200 scenarios|Observed/.test(text),path+' fixed Studio claims');
    } return 'both documents and all nav views checked';
  });
  await probe('S6','untrusted names stay text in all host projections',async()=>{
    await load(); await open(); const doc=structuredClone(acceptFixture); doc.id='probe-injection';
    // Fixture includes a validated HTML-looking name; changing a confirmed name would invalidate its hash.
    assert.ok(doc.name.includes('<'), 'injection fixture'); await fe(`${S} const r=ctl.importText(${Q(JSON.stringify(doc))}); if(!r.ok) throw Error(JSON.stringify(r));`);
    await nav('overview'); assert.ok((await pendingRows()).some(x=>x.text.includes(doc.name))); await nav('policies'); assert.ok((await rows('#pcpStudioCards','data-studio-pcp')).some(x=>x.text.includes(doc.name)));
    await nav('blueprint'); await fe(`${S} ctl.accept(); ctl.go('assurance','register');`); await clickSel('#registerBtn',true); await nav('library'); assert.ok((await libraryRows()).some(x=>x.text.includes(doc.name)));
    assert.equal(await ev(`return document.querySelectorAll('#ovStudioPending img,#pcpStudioCards img,#libStudioGroup img,[onerror]').length`),0); return 'HTML-looking name in Overview, PCP and registered Library remains literal text';
  });
  await probe('S7','incident approval remains independent',async()=>{
    await load({seed:true}); const count=await ev(`return parseInt(document.querySelector('#ovPendingCount').textContent)`), before=await pendingRows();
    await ev(`document.querySelector('[data-open-incident="I-1042"],[data-review-inc="I-1042"]').click()`); await clickSel('[data-inc-panel="inc-decision"]'); await clickSel('#incApproveBtn'); await clickSel('#decisionModalConfirm');
    await nav('overview'); assert.equal(await ev(`return parseInt(document.querySelector('#ovPendingCount').textContent)`),count-1); assert.deepEqual(await pendingRows(),before);
    await nav('short-term'); assert.ok(await ev(`return document.querySelector('#stRows').textContent.includes('Vendor')`)); await nav('security-model'); assert.ok(await ev(`return document.querySelector('#security-model').textContent.includes('Enterprise World Model')`)); return 'only incident count resolved; Studio rows unchanged; Pre-release and EWM usable';
  });
  await probe('S8','upstream product names in both pages and languages',async()=>{
    for(const path of ['/index.html','/assurance.html']) { await load({path}); const text=await ev('return document.body.textContent'); assert.ok(!/Security World Model|Security Ontology/.test(text),path); }
    await load(); await lifecycle(); for(const lang of ['en','zh']) { await fe(`__bs2.setLang(${Q(lang)}); __bs2.ctl.openTrace();`); await sleep(200); const text=await fe('return document.body.textContent'); assert.ok(!/Security World Model|Security Ontology|安全世界模型各层/.test(text),lang); assert.ok(text.includes(lang==='en'?'Enterprise World Model layers':'企业世界模型各层')); } return 'English and Chinese Trace plus both host documents';
  });
  await probe('S9','embedded widths, split menu and record modal',async()=>{
    await load(); await lifecycle(); await fe(`${S} ctl.newRevision();`); const draft=(await active()).rev;
    for(const w of [1440,1024,768,390]) { await viewport(w); await fe(`${S} ctl.setActiveRevision(${draft}); ctl.go('builder');`); await sleep(250); const size=await ev(`const f=document.querySelector('#studioFrame').getBoundingClientRect(); return {w:innerWidth,doc:document.documentElement.scrollWidth,x:f.x,right:f.right,height:f.height,bottom:f.bottom,viewport:innerHeight};`); assert.ok(size.doc<=w+2,JSON.stringify(size)); assert.ok(size.x>=-1&&size.right<=w+2&&size.height>250,JSON.stringify(size)); assert.ok(size.bottom<=size.viewport+2,'iframe extends below viewport; host scrolls around it: '+JSON.stringify(size));
      await clickSel('#arrangeMenuBtn',true); assert.ok(await fe(`return !!document.querySelector('[data-dir="TB"]')`)); await shot('S9-'+w+'-arrange'); await keyEscape(); await fe(`${S} ctl.setActiveRevision(0); ctl.openTrace();`); await clickSel('#recordBtn',true); const modal=await fe(`const r=document.querySelector('#recordModal').getBoundingClientRect(); return {left:r.left,right:r.right,width:window.innerWidth,top:r.top,bottom:r.bottom,height:window.innerHeight}`); assert.ok(modal.left>=-1&&modal.right<=modal.width+2&&modal.top>=-1&&modal.bottom<=modal.height+2,JSON.stringify(modal)); await shot('S9-'+w+'-record'); await keyEscape();
    } await viewport(); return '1440/1024/768/390 geometry and interactive controls';
  });
  await probe('S10','assurance retirement links and incident flow',async()=>{
    await load({path:'/assurance.html'}); await nav('blueprint'); assert.equal(await ev(`return document.querySelectorAll('#blueprintCanvas,#bpStages').length`),0); await clickSel('#blueprint a[href*="index.html#studio"]'); await frameReady(); assert.ok(await ev(`return location.pathname.endsWith('/index.html')`));
    await navigate('/assurance.html'); await ev(`document.querySelector('[data-open-incident="I-1042"],[data-review-inc="I-1042"]').click()`); await clickSel('[data-inc-panel="inc-decision"]'); await clickSel('#incApproveBtn'); await clickSel('#decisionModalConfirm');
    const links=await ev(`return [...document.querySelectorAll('a[href*="index.html#studio"]')].map(a=>a.getAttribute('href'))`); assert.ok(links.length>=3,'all retirement notices should link'); return `canonical Studio reached; ${links.length} retirement links; incident modal still works`;
  });
  await probe('S11','iframe clipboard, file import, record download and static Ask AI',async()=>{
    await load(); await lifecycle();
    await clickSel('#docMenuBtn',true); await clickSel('#copyJsonBtn',true);
    const copied=await fe('return await window.navigator.clipboard.readText()'); const doc=JSON.parse(copied); assert.equal(doc.id,(await active()).id);
    // Actual file input change, with browser File/DataTransfer; no fixture written outside this file.
    await clickSel('#docMenuBtn',true); await fe(`const input=document.querySelector('input[type=file]'); const dt=new w.DataTransfer(); dt.items.add(new w.File([${Q(copied)}],'probe.json',{type:'application/json'})); input.files=dt.files; input.dispatchEvent(new w.Event('change',{bubbles:true}));`); await sleep(500); assert.equal((await active()).id,doc.id);
    await fe(`${S} ctl.openTrace();`); await clickSel('#recordBtn',true); const start=browser.downloads.length; await clickSel('#recDownload',true); await until(()=>browser.downloads.length>start,'record download'); const dl=browser.downloads.at(-1); await until(async()=>{try{return !!JSON.parse(await readFile(join(downloadDir,dl.suggestedFilename),'utf8'));}catch{}},'downloaded JSON'); await keyEscape();
    await fe(`${S} ctl.go('builder'); ctl.setPanel('assist');`); await sleep(300); const note=await fe('return document.body.innerText'); assert.match(note,/rule.based|rules mode|pattern/i); return 'clipboard JSON, real input change, completed record file, static rules note';
  });
  await probe('S12','stale/malformed/deleted summaries and simultaneous registrations',async()=>{
    await load({seed:true}); await ev(`localStorage.setItem('bs.summary.v1','junk')`); await nav('policies'); assert.ok(await ev(`return !!document.querySelector('#pcpStudioCards [data-studio-summary="unavailable"]')`));
    await load({seed:true}); const d=fixtureDocs.find(d=>d.id.includes('awaiting')); await ev(`const d=JSON.parse(localStorage.getItem(${Q('bs.doc.'+d.id)})); d.owner+=' changed'; localStorage.setItem(${Q('bs.doc.'+d.id)},JSON.stringify(d));`); await nav('overview'); assert.ok(await ev(`return !!document.querySelector('#ovStudioPending [data-studio-stale]')`)); await ev(`localStorage.removeItem(${Q('bs.doc.'+d.id)})`); await nav('policies'); assert.ok(!(await pendingRows()).some(x=>x.key.startsWith(d.id+'|')));
    await load(); await open();
    const second=await browser.send('Target.createTarget',{url:origin+'/blueprint_studio/app/index.html'}); const targets=await (await fetch(endpoint+'/json/list')).json(); const c=await connect(targets.find(t=>t.id===second.targetId).webSocketDebuggerUrl); await c.send('Runtime.enable'); await until(()=>c.ev('return !!globalThis.__bs2?.store.doc'),'second context');
    // Two stores read the shared inventory before either registration is persisted.
    const aDoc=structuredClone(acceptFixture),bDoc=structuredClone(acceptFixture); aDoc.id='race-a'; bDoc.id='race-b';
    await fe(`${S} ctl.importText(${Q(JSON.stringify(aDoc))}); ctl.accept(); st.inventory();`);
    await c.ev(`${S} ctl.importText(${Q(JSON.stringify(bDoc))}); ctl.accept(); st.inventory();`);
    // Gate the real Storage.setItem registration writes. Both ctl.register calls run
    // against their own evidence; only their final persistence is delayed for the race.
    const gate=`const proto=Object.getPrototypeOf(localStorage), original=proto.setItem; globalThis.__regWrites=[]; globalThis.__regOriginal=original; proto.setItem=function(k,v){if(String(k).startsWith('bs.reg.')||k==='bs.inventory'){globalThis.__regWrites.push([k,v]);return;}return original.call(this,k,v)}; __bs2.ctl.register(); return globalThis.__regWrites;`;
    const aw=await fe(`return await w.eval(${Q('(async()=>{'+gate+'})()')});`),bw=await c.ev(gate); assert.ok(aw.length&&bw.length,'both actual registrations reached persistence gate');
    await fe(`for(const [k,v] of w.__regWrites) w.__regOriginal.call(localStorage,k,v);`); await c.ev(`for(const [k,v] of __regWrites) __regOriginal.call(localStorage,k,v);`); await browser.send('Target.closeTarget',{targetId:second.targetId}); page.errors.push(...c.errors); c.ws.close(); clients.delete(c);
    await navigate(); await nav('library'); const list=await libraryRows(); assert.ok(list.some(x=>x.key.startsWith('race-a|'))&&list.some(x=>x.key.startsWith('race-b|')),JSON.stringify(list));
    const saved=await ev(`return Object.keys(localStorage).filter(k=>k.startsWith('bs.reg.')).map(k=>JSON.parse(localStorage[k]).docId)`); assert.ok(saved.includes('race-a')&&saved.includes('race-b')); return 'invalid/stale claims suppressed, deleted source removed; gated concurrent registrations survive immediate target closure + reload';
  });
  async function rtClick(sel){
    // Run scrolls smoothly to the frame; stop that transition before computing
    // pointer coordinates for a control higher on the host page.
    await ev(`const e=document.querySelector(${Q(sel)});if(!e)throw Error('Missing '+${Q(sel)});e.scrollIntoView({block:'center',behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);
    await sleep(150);await clickSel(sel);
  }
  const rt = code => ev('const w=globalThis.document.querySelector("#rtFrame").contentWindow;const document=w.document,window=w;'+code);
  async function rtReady(){await until(()=>ev('return !!document.querySelector("#rtFrame")?.contentWindow?.__jevDemo?.ready'),'runtime iframe ready');}
  async function rtOpen(){await load();await until(()=>ev('return !!window.__jevRuntime?.ready'),'runtime host ready');await nav('runtime-observation');await rtReady();}
  async function rtRun(id,checkSelection=true){await rtClick(`[data-rt-scenario="${id}"] [data-rt-run]`);await until(()=>ev(`return document.querySelector('#rtStatus').textContent==='Complete'&&document.querySelector('#rtResult').textContent.startsWith('${id} ·')`),'runtime '+id+' complete');await rtReady();if(checkSelection)await until(()=>rt(`const last=window.__jevDemo.log().filter(e=>e.scenario==='${id}').at(-1);return !!last&&document.querySelector('.run-card[data-selected]')?.dataset.runId===last.trace_id`),'selected latest '+id);}
  async function rtResult(id){
    const state=await rt(`const all=window.__jevDemo.log();const last=all.filter(e=>e.scenario==='${id}').at(-1);if(!last)throw Error('no injected envelopes');return all.filter(e=>e.trace_id===last.trace_id);`);
    assert.ok(state.length,'nonempty injected envelopes');
    const expected=await ev(`const {describeRun}=await import('/js/jev-runtime-model.js');return describeRun(${Q(state)},{id:${Q(id)}});`);
    assert.equal(await ev('return document.querySelector("#rtResult").textContent'),expected,'result from actual injected envelopes');
    const pre=state.filter(e=>e.boundary==='pre_tool');assert.ok(pre.length);
    const stopped=pre.filter(e=>['hold_for_review','hold_for_approval','deny','stop_and_handover'].includes(e.action));
    if(stopped.length)assert.ok(expected.includes(`${pre.length-stopped.length} ran.`));
    else if(pre.some(e=>e.mode==='monitor'&&e.would_have==='BLOCK'))assert.match(expected,/ran in monitor mode \(would have been blocked\)/);
    return state;
  }
  function claims(text){assert.doesNotMatch(text,/\b(sent to|exported to|delivered to|forwarded to)\b|OTLP/i);assert.match(text,/preview only/);}
  await probe('S13','periodic validation and independent World Model tabs',async()=>{
    await load();await nav('security-model');const before=await ev(`return [...document.querySelectorAll('#security-model .wm-tab.active')].map(e=>e.id)`);assert.equal(before.length,1);
    await nav('long-term');await until(()=>ev('return !!window.__jevRuntime?.ready'),'runtime host');
    const old=await ev(`return {ids:['ltCadence','runEnvBtn','ltStatus','ltSteps','ltResult','ltHistory'].map(id=>!!document.getElementById(id)),steps:document.querySelectorAll('#ltSteps .run-step').length,history:document.querySelector('#ltHistory').textContent}`);
    assert.deepEqual(old.ids,[true,true,true,true,true,true]);assert.equal(old.steps,6);assert.match(old.history,/Jul/);assert.match(old.history,/Aug/);
    assert.equal(await ev('return document.querySelectorAll("#rtFrame").length'),0,'no iframe before first visit');
    assert.equal(await ev('return document.querySelectorAll(".lt-tabs,.lt-tab,#ltPeriodic,#ltRuntime,#ltSub,#ltControls").length'),0,'tab markup and wrappers removed');
    await nav('runtime-observation');await rtReady();
    assert.equal(await ev('return document.querySelectorAll("#rtFrame").length'),1,'one lazily created iframe');
    await nav('long-term');
    assert.equal(await ev(`return ['ltCadence','runEnvBtn'].every(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'})`),true,'periodic controls visible after Runtime Observation');
    await rtClick('#runEnvBtn');await until(()=>ev('return document.querySelector("#ltStatus").textContent==="Complete"'),'periodic complete');
    assert.equal(await ev('return document.querySelectorAll("#ltHistory [data-sep]").length'),1);
    assert.match(await ev('return document.querySelector("#ltHistory [data-sep]").textContent'),/Sep.*24 workflows.*53 agents.*2,700.*3.*1/s);
    await nav('security-model');assert.deepEqual(await ev(`return [...document.querySelectorAll('#security-model .wm-tab.active')].map(e=>e.id)`),before);
    const next=await ev(`const tabs=[...document.querySelectorAll('#security-model .wm-tab')];const i=tabs.findIndex(e=>e.classList.contains('active'));return tabs[(i+1)%tabs.length].id`);
    await ev(`document.querySelector('#security-model .wm-tab.active').focus()`);await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
    assert.equal(await ev('return document.querySelector("#security-model .wm-tab.active").id'),next);
    assert.equal(await ev(`const t=document.querySelector('#security-model .wm-tab.active');return document.getElementById(t.dataset.wmPanel).classList.contains('active')`),true);
    return 'periodic ids, six steps, Sep history and visible controls preserved; no tabs/wrappers; lazy iframe; World Model selection and keyboard group independent';
  });
  await probe('S14','computed reference metrics and scenario chips',async()=>{
    await rtOpen();const expected=await ev(`const {scenariosFor,TENANT}=await import('/jev-runtime/demo/js/engine/scenarios.js');const {runStream}=await import('/jev-runtime/demo/js/engine/router.js');const {DEFAULT_POLICY}=await import('/jev-runtime/demo/js/engine/types.js');const all=[...scenariosFor('ap'),...scenariosFor('soc')];const pre=all.flatMap(t=>runStream(t.spans,{tenant:TENANT,policy:DEFAULT_POLICY,seed:7})).filter(e=>e.boundary==='pre_tool');return {scenarios:all.length,checked:pre.length,stopped:pre.filter(e=>['hold_for_review','hold_for_approval','deny','stop_and_handover'].includes(e.action)).length,rule:pre.filter(e=>e.decided_by==='rule').length};`);
    assert.equal(expected.scenarios,12);
    assert.deepEqual(await ev('return window.__jevRuntime.summary().metrics'),expected);
    for(const [k,v] of Object.entries(expected))assert.equal(await ev(`return Number(document.querySelector('#rtMetrics [data-rt-metric="${k}"] .metric-value').textContent)`),v,k);
    const table={S1:'all ran',S2:'review · judge',S3:'blocked · rule',S4:'held · rule',S5:'ran · flagged',S6:'blocked · rule',F1:'blocked · fallback',SOC1:'all ran',SOC2:'held · rule',SOC3:'held · rule',SOC4:'blocked · rule',SOC5:'review · judge'};
    for(const [id,label] of Object.entries(table))assert.equal(await ev(`return document.querySelector('[data-rt-scenario="${id}"] [data-rt-outcome]').textContent`),label,id);
    assert.match(await ev('return document.querySelector("#rtReference").textContent'),/seed 7.*policy-v1 reference set/);
    return '12 pinned outcome chips; four metrics independently recomputed from default-policy pre_tool envelopes';
  });
  await probe('S15','SOC injection, actual results and latest-request-wins',async()=>{
    await rtOpen();await rtClick('[data-rt-scenario="SOC2"] [data-rt-run]');await until(()=>ev('return !!document.querySelector("#rtSteps .running")'),'animation visible');
    await until(()=>ev('return document.querySelector("#rtStatus").textContent==="Complete"'),'SOC2 complete');await rtReady();
    assert.equal(await rt('return window.__jevDemo.domain'),'soc');await until(()=>rt('return !!document.querySelector(".run-card[data-selected][data-scenario=SOC2]")'),'SOC2 selected');await rtResult('SOC2');
    assert.ok((await rt('return document.querySelector(".run-card[data-selected]").textContent')).includes('Held for approval · did not run'));
    await rt('window.__probeIdentity=123;return true');await rtRun('SOC3',false);await sleep(200);const socSelection=await rt(`const last=window.__jevDemo.log().filter(e=>e.scenario==='SOC3').at(-1);return {actual:document.querySelector('.run-card[data-selected]')?.dataset.runId,expected:last?.trace_id}`);assert.equal(await rt('return window.__probeIdentity'),123,'same-agent run did not reload');await rtResult('SOC3');
    await rtClick('[data-rt-scenario="SOC2"] [data-rt-run]');await sleep(100);await rtClick('[data-rt-scenario="S3"] [data-rt-run]');
    await until(()=>ev('return document.querySelector("#rtStatus").textContent==="Complete"&&document.querySelector("#rtResult").textContent.startsWith("S3 ·")'),'latest S3 complete');await sleep(700);
    assert.equal(await rt('return window.__jevDemo.domain'),'ap');await rtResult('S3');
    assert.equal(await ev('return document.querySelectorAll("#rtSteps .done").length'),6);assert.equal(await ev('return document.querySelectorAll("#rtSteps .running").length'),0);
    const abandoned=await ev('return document.querySelectorAll("#rtScenarios [data-rt-run]:disabled").length');
    await rt(`document.querySelector('[data-tab=studio]').click();const e=document.querySelector('[data-tool-mode="payments.execute"]');e.value='monitor';e.dispatchEvent(new window.Event('change',{bubbles:true}));document.querySelector('[data-tab=live]').click();`);await rtRun('S3',false);await rtResult('S3');await sleep(200);const monitorSelection=await rt(`const last=window.__jevDemo.log().filter(e=>e.scenario==='S3').at(-1);return {actual:document.querySelector('.run-card[data-selected]')?.dataset.runId,expected:last?.trace_id}`);
    assert.match(await ev('return document.querySelector("#rtResult").textContent'),/ran in monitor mode \(would have been blocked\)/);
    assert.equal(await ev('return document.querySelector("[data-rt-scenario=S3] [data-rt-outcome]").textContent'),'blocked · rule');
    assert.match(await ev('return document.querySelector("[data-rt-scenario=S3] [data-rt-outcome]").title'),/reference/i);
    claims(await ev('return document.querySelector("#rtSteps").textContent+document.querySelector("#rtResult").textContent'));
    const retained=await ev(`window.__probeRuntimeDocument=document.querySelector('#rtFrame').contentDocument;return {result:document.querySelector('#rtResult').textContent,steps:[...document.querySelectorAll('#rtSteps .run-step')].map(e=>e.className)}`);
    const selected=await rt('return document.querySelector(".run-card[data-selected]").dataset.runId');
    await nav('long-term');await nav('runtime-observation');await rtReady();
    assert.equal(await ev('return document.querySelector("#rtFrame").contentDocument===window.__probeRuntimeDocument'),true,'frame document preserved on return');
    assert.equal(await ev('return document.querySelectorAll("#rtFrame").length'),1,'return reuses single iframe');
    assert.equal(await rt('return window.__jevDemo.policy().tools["payments.execute"].mode'),'monitor');
    assert.equal(await rt('return document.querySelector(".run-card[data-selected]").dataset.runId'),selected,'selected run preserved');
    assert.deepEqual(await ev(`return {result:document.querySelector('#rtResult').textContent,steps:[...document.querySelectorAll('#rtSteps .run-step')].map(e=>e.className)}`),retained,'result and steps preserved');
    assert.equal(abandoned,0,'no abandoned Run buttons');
    assert.equal(socSelection.actual,socSelection.expected,'same-agent Run selects newly injected SOC3');
    assert.equal(monitorSelection.actual,monitorSelection.expected,'monitor Run selects newly injected S3');
    return 'animation, SOC2 hold, same-agent reuse, rapid switch, six step states/button cleanup, monitor result from actual envelopes, reference unchanged, return state preserved';
  });
  await probe('S16','AP switch and blocked run',async()=>{
    await rtOpen();await rtRun('SOC2');await rtRun('S3');assert.equal(await rt('return window.__jevDemo.domain'),'ap');await rtResult('S3');
    assert.ok((await rt('return document.querySelector(".run-card[data-selected][data-scenario=S3]").textContent')).includes('Blocked · did not run'));return 'SOC→AP switch, selected S3, hard-rule non-execution';
  });
  await probe('S17','Runtime deep link and full-page/back round trip',async()=>{
    async function viewIs(id){await until(()=>ev(`return document.querySelector('.view.active')?.id===${Q(id)}`),'active '+id);assert.equal(await ev('return document.querySelector(".nav button.active")?.dataset.view'),id);assert.equal(await ev('return document.querySelector("#crumb").textContent'),id==='runtime-observation'?'Runtime Observation':id==='long-term'?'System Validation':'Agentic Blueprint Studio');}
    await load({path:'/index.html#view=runtime-observation'});await rtReady();await viewIs('runtime-observation');
    const order=await ev(`return [...document.querySelectorAll('.nav button[data-view]')].map(e=>({id:e.dataset.view,label:e.textContent.trim()}))`);
    const world=order.findIndex(e=>e.id==='security-model');assert.ok(world>=0);
    assert.deepEqual(order.slice(world,world+3).map(e=>e.id),['security-model','runtime-observation','long-term']);
    assert.ok(order[world].label.includes('Enterprise World Model'));assert.ok(order[world+1].label.includes('Runtime Observation'));assert.ok(order[world+2].label.includes('System Validation'));
    await load({path:'/index.html#view=long-term&tab=runtime'});await rtReady();await viewIs('runtime-observation');
    assert.equal(await ev('return location.hash'),'#view=runtime-observation','cold legacy redirect');
    await ev("location.hash='view=long-term&tab=periodic'");await viewIs('long-term');
    await ev("location.hash='view=long-term&tab=runtime'");await viewIs('runtime-observation');
    await until(()=>ev("return location.hash==='#view=runtime-observation'"),'loaded legacy hash rewritten');
    await ev("location.hash='view=long-term'");await viewIs('long-term');
    await ev("location.hash='view=runtime-observation'");await viewIs('runtime-observation');await rtReady();
    for(const [id,domain] of [['S3','ap'],['SOC2','soc']]){
      await rtRun(id);const seed=await rt('return window.__jevDemo.seed');
      await ev(`document.querySelector('#rtOpenFull').addEventListener('click',e=>e.preventDefault(),{once:true})`);await rtClick('#rtOpenFull');
      const href=await ev('return document.querySelector("#rtOpenFull").href');const u=new URL(href);
      assert.equal(u.searchParams.get('domain'),domain);assert.equal(u.searchParams.get('seed'),String(seed));assert.ok(!u.searchParams.has('embed'));assert.equal(u.searchParams.get('back'),'../../index.html#view=runtime-observation');
      await page.send('Page.navigate',{url:href});await until(()=>ev('return !!window.__jevDemo?.ready'),'full demo');
      assert.equal(await ev('return document.querySelector(".jv-back").textContent.trim()'),'← Back');await rtClick('.jv-back');
      await until(()=>ev('return !!window.__jevRuntime?.ready&&document.querySelector("#runtime-observation").classList.contains("active")'),'Back to runtime');await rtReady();
    }
    await navigate('/index.html#studio');await frameReady();await viewIs('blueprint');
    await ev("location.hash='view=long-term&tab=periodic'");await viewIs('long-term');
    await ev("location.hash='studio'");await viewIs('blueprint');await frameReady();
    await ev("location.hash='view=long-term'");await viewIs('long-term');
    await ev("location.hash='studio=new'");await viewIs('blueprint');await frameReady();
    await until(()=>fe(`${S} return ctl.getRoute().gallery===true`),'Studio new opens template gallery');
    return 'new and legacy cold/loaded routes; periodic route; nav order, active nav and breadcrumb; AP/SOC full-page domain+seed and Back; Studio resume/new routes';
  });
  await probe('S18','Runtime/iframe claims, visible simulated labels and responsive layout',async()=>{
    await rtOpen();await rtRun('SOC5');await rtResult('SOC5');
    claims(await ev('return document.querySelector("#rtSteps").textContent+document.querySelector("#rtResult").textContent'));
    for(const width of [1440,390]){
      await viewport(width);await sleep(250);
      assert.equal(await ev('return document.documentElement.scrollWidth<=innerWidth+1'),true,'host '+width+'px overflow');
      assert.equal(await ev(`return document.querySelector('.view.active')?.id==='runtime-observation'&&document.querySelectorAll('.view.active').length===1&&document.querySelector('.nav button.active')?.dataset.view==='runtime-observation'`),true,'nav and view hygiene '+width+'px');
      assert.equal(await ev(`const e=document.querySelector(innerWidth>760&&window.__siteNav.state().mode==='auto'?'#navToggle':'.nav [data-view="runtime-observation"]'),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'`),true,'runtime nav reachable '+width+'px');
      assert.equal(await rt('return document.documentElement.scrollWidth<=innerWidth+1'),true,'frame '+width+'px overflow');
      assert.equal(await ev(`return [...document.querySelectorAll('#runtime-observation .rt-lead .pill')].some(e=>e.getBoundingClientRect().width>0&&/simulated/i.test(e.textContent))`),true,'host simulation label visible');
      assert.equal(await rt(`const e=document.querySelector('[data-simulated-badge]');const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&/SIMULATED/.test(e.textContent)`),true,'frame badge visible');
    }
    return 'host/iframe responsive at 1440/390, visible simulation labels, no affirmative delivery claim or JS errors';
  });

  await probe('S19','manual selection handoff and delayed navigation supersession',async()=>{
    await rtOpen();await rtRun('SOC2');await rtRun('SOC3');
    const older=await rt(`return window.__jevDemo.log().find(e=>e.scenario==='SOC2').trace_id`);
    await rt(`document.querySelector('.run-row[data-run-row="${older}"]').click()`);
    assert.equal(await rt('return document.querySelector(".run-card[data-selected]").dataset.runId'),older);
    await rtRun('SOC1');await rtResult('SOC1');
    assert.notEqual(await rt('return document.querySelector(".run-card[data-selected]").dataset.runId'),older,'Run overrides manual pin');
    await rtRun('S3');const gateRun=await rt('return window.__jevDemo.log().at(-1).trace_id');await rtRun('S1');
    await rt(`document.querySelector('.run-row[data-run-row="${gateRun}"]').click();document.querySelector('[data-tab=studio]').click();const e=document.querySelector('[data-tool-mode="payments.execute"]');e.value='monitor';e.dispatchEvent(new window.Event('change',{bubbles:true}));document.querySelector('[data-tab=live]').click()`);
    await rtRun('S3');await rtResult('S3');
    assert.notEqual(await rt('return document.querySelector(".run-card[data-selected]").dataset.runId'),gateRun,'repeated Run selects new trace, not old gate receipt');
    assert.match(await rt('return document.querySelector(".run-card[data-selected]").textContent'),/Would block · ran/);
    // Keep an outgoing AP document alive while its SOC navigation is paused.
    // A new AP Run must replace that pending navigation, not inject into the
    // outgoing AP API object and subsequently display the old SOC request.
    await rtOpen();assert.equal(await rt('return window.__jevDemo.domain'),'ap');
    let paused=null;
    const onPause=e=>{const m=JSON.parse(e.data);if(m.method==='Fetch.requestPaused')paused=m.params;};
    page.ws.addEventListener('message',onPause);
    try{
      await page.send('Fetch.enable',{patterns:[{urlPattern:'*domain=soc*',requestStage:'Request'}]});
      await rtClick('[data-rt-scenario="SOC2"] [data-rt-run]');await until(()=>paused,'SOC navigation held');
      assert.equal(await rt('return window.__jevDemo.domain'),'ap','outgoing AP document remains during delayed SOC navigation');
      await rtClick('[data-rt-scenario="S3"] [data-rt-run]');
      try{await page.send('Fetch.continueRequest',{requestId:paused.requestId});}
      catch(e){if(!/Invalid InterceptionId|Invalid interception|Invalid RequestId|Invalid request/i.test(e.message))throw e;}
      await page.send('Fetch.disable');
      await until(()=>ev('return document.querySelector("#rtStatus").textContent==="Complete"&&document.querySelector("#rtResult").textContent.startsWith("S3 ·")'),'superseding AP Run completes');
      await until(()=>rt('const last=window.__jevDemo.log().filter(e=>e.scenario==="S3").at(-1);return window.__jevDemo.domain==="ap"&&last&&document.querySelector(".run-card[data-selected]")?.dataset.runId===last.trace_id'),'latest AP document and selected S3');
      await sleep(500);assert.equal(await rt('return window.__jevDemo.domain'),'ap','released old navigation cannot replace AP');await rtResult('S3');
      assert.equal(await rt('return window.__jevDemo.log().some(e=>e.scenario==="SOC2")'),false,'superseded scenario was not injected');
      assert.equal(await ev('return document.querySelectorAll("#rtScenarios [data-rt-run]:disabled").length'),0);
      assert.equal(await ev('return document.querySelectorAll("#rtSteps .done").length'),6);
      assert.equal(await ev('return document.querySelectorAll("#rtSteps .running").length'),0);
    }finally{await page.send('Fetch.disable');page.ws.removeEventListener('message',onPause);}
    return 'older-card pin overridden by Run; repeated monitor injection shows new receipt; delayed AP→SOC→AP ends with AP result/card, no stale injection or abandoned buttons';
  });

  await probe('S21','Learning loop evidence and tab handoff',async()=>{
    await rtOpen();
    await until(()=>ev('return !!document.querySelector("#rtLearning [data-evidence-value]")'),'measured JSON rendered');
    const evidence=await ev(`return await (await fetch('/jev-runtime/demo/data/learning-evidence.json')).json()`);
    const values=await ev(`return [...document.querySelectorAll('#rtLearning [data-evidence-value]')].map(e=>({path:e.dataset.evidenceValue,digits:Number(e.dataset.digits),text:e.textContent}))`);
    assert.ok(values.length>=17,'thresholds, sample sizes and confidence intervals included');
    for(const v of values)assert.equal(v.text,Number(v.path.split('/').reduce((o,k)=>o[k],evidence)).toFixed(v.digits),v.path);
    const text=await ev('return document.querySelector("#rtLearning").textContent');
    assert.match(text,/The judge learns from your reviewers/);
    assert.equal(await ev(`return document.querySelector('#rtLearning').previousElementSibling.querySelector('#rtSteps')!==null`),true,'after orchestration');
    assert.match(text,/each model's own calibrated threshold/);assert.match(text,/question-level/);assert.match(text,/no fitted threshold/);assert.match(text,/similar local judge HTTP p50 in this run/);
    assert.match(text,/Training on reviewer labels and production promotion are future work/);assert.match(text,/Calibrations not activated/);
    assert.equal(await ev(`return [...document.querySelectorAll('#rtLearning .rt-learning-tiles .metric')].filter(e=>e.textContent.includes('measured on an open benchmark (AgentDojo held-out); benchmark labels, not yet customer reviewers')).length`),3);
    const rows=await ev(`return [...document.querySelectorAll('#rtLearningGate [data-evidence-gate]')].map(e=>({id:e.dataset.evidenceGate,verdict:e.querySelector('[data-evidence-verdict]').textContent,text:e.textContent}))`);
    assert.deepEqual(rows.map(r=>r.id),Object.keys(evidence.gate),'all JSON gate rows');
    for(const row of rows){
      const g=evidence.gate[row.id];
      const detail=g.safetyOk?`Fixed ${g.fixed} · Broke ${g.broke} · ${g.evidenceOk?'evidence check passed':'needs more evidence'}`:g.missed.after>g.missed.before?`Safety check failed: more missed cases (${g.missed.before} → ${g.missed.after})`:`Safety check failed: more false alarms (${g.falseHolds.before} → ${g.falseHolds.after})`;
      assert.equal(row.verdict,g.verdict,row.id+' verdict');
      assert.equal(row.text,`${evidence.models[row.id].label}: ${g.verdict} · ${detail}`,row.id+' JSON row');
    }
    assert.match(text,/Question-level errors at each model’s own threshold, on one benchmark split; a retrospective check, not gateway outcomes/);
    assert.doesNotMatch(text,/Fine-tuned with the same recipe|recall-first gate would reject|chance of luck/i);
    for(const caveat of evidence.caveats)assert.ok(text.includes(caveat),'JSON caveat');
    await ev('window.__learningDocument=document.querySelector("#rtFrame").contentDocument');
    await rtClick('#rtTryLoop');
    await until(()=>rt(`return document.querySelector('[data-tab=learning]').getAttribute('aria-selected')==='true'`),'Learning tab');
    assert.equal(await ev('return window.__learningDocument===document.querySelector("#rtFrame").contentDocument'),true,'ready frame uses openTab');
    await until(()=>ev('const r=document.querySelector("#rtFrameWrap").getBoundingClientRect();return scrollY>0&&r.top>=-1&&r.top<innerHeight/3'),'scroll to demo');
    await ev(`document.querySelector('#rtOpenFull').dispatchEvent(new Event('pointerenter'))`);
    assert.equal(new URL(await ev('return document.querySelector("#rtOpenFull").href')).searchParams.get('tab'),'learning');
    for(const width of [1440,390]){
      await viewport(width);await sleep(250);
      assert.equal(await ev('return document.documentElement.scrollWidth<=innerWidth+1'),true,'host overflow '+width);
      assert.equal(await rt('return document.documentElement.scrollWidth<=innerWidth+1'),true,'learning frame overflow '+width);
      assert.equal(await ev('return document.querySelectorAll(".rt-learning-loop li").length'),6);
      if(width===390)assert.equal(await ev(`const a=[...document.querySelectorAll('.rt-learning-loop li')].map(e=>e.getBoundingClientRect().top);return new Set(a).size`),2,'two rows of three');
    }
    // A not-yet-ready navigation must carry the deep link itself.
    await viewport();await ev(`const f=document.querySelector('#rtFrame');f.contentWindow.__jevDemo.ready=false;document.querySelector('#rtTryLoop').click()`);
    await until(()=>rt(`return window.__jevDemo?.ready&&document.querySelector('[data-tab=learning]').getAttribute('aria-selected')==='true'`),'cold Learning tab');
    assert.equal(await ev(`return new URL(document.querySelector('#rtFrame').src).searchParams.get('tab')`),'learning');
    await ev(`document.querySelector('#rtOpenFull').dispatchEvent(new Event('focus'))`);
    assert.equal(new URL(await ev('return document.querySelector("#rtOpenFull").href')).searchParams.get('tab'),'learning');
    // Try the loop during a Run cancels it and settles the orchestration (code gate r1, Codex reproduction).
    await ev(`window.__tryRun=window.__jevRuntime.run('S1');`);
    await sleep(350);
    await ev(`document.querySelector('#rtTryLoop').click();await window.__tryRun;`);
    await sleep(1800);
    const cancelled=await ev(`return {status:document.querySelector('#rtStatus').textContent,running:document.querySelectorAll('#rtSteps .running').length,disabled:document.querySelectorAll('#rtScenarios [data-rt-run]:disabled').length,tab:document.querySelector('#rtFrame').contentDocument.querySelector('[data-tab=learning]').getAttribute('aria-selected')}`);
    assert.deepEqual(cancelled,{status:'Ready',running:0,disabled:0,tab:'true'},'Try the loop settles a cancelled Run: '+JSON.stringify(cancelled));
    return 'JSON-derived measurements, exact claims and caveats; ready/cold Learning tab, full-page link and scroll; 1440/390 layout no JS errors; Try during a Run settles it';
  });

  await probe('S20','click sidebar toggle, hover peek and responsive docking',async()=>{
    const move=(x,y)=>page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    async function tap(x,y){await move(x,y);for(const type of ['mousePressed','mouseReleased'])await page.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
    async function key(key,shift=false){for(const type of ['keyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key,code:key===' '?'Space':key,modifiers:shift?8:0,text:type==='keyDown'?(key==='Enter'?'\r':key===' '?' ':''):'',windowsVirtualKeyCode:key==='Tab'?9:key==='Escape'?27:key==='Enter'?13:32});}
    let phase='initial';const st=()=>ev('return window.__siteNav.state()');
    async function waitState(mode,open){
      try{await until(async()=>{const s=await st();return s.mode===mode&&s.open===open&&s.settled},phase+' '+mode+' open='+open);}
      catch(e){throw Error(e.message+' '+JSON.stringify(await ev('return {state:window.__siteNav.state(),focus:document.activeElement.id,view:document.activeElement.dataset.view}')));}
    }
    const closed=()=>waitState('auto',false),docked=()=>waitState('pinned',true);
    async function peek(){await move(600,450);await move(2,450);await waitState('auto',true);}
    async function show(){await clickSel('#navToggle');await docked();}
    async function hide(){await clickSel('#navPin');await closed();}
    async function geometry(left){const g=await ev('const r=document.querySelector(".main").getBoundingClientRect();return {x:r.x,w:r.width,v:innerWidth}');assert.ok(Math.abs(g.x-left)<2,phase+' expected left '+left+' '+JSON.stringify(g));assert.ok(Math.abs(g.w-(g.v-left))<2,phase+' width '+JSON.stringify(g));}
    async function aria(mode,open){
      const a=await ev(`const t=document.querySelector('#navToggle'),p=document.querySelector('#navPin');return {show:t.getAttribute('aria-label'),showTitle:t.title,header:p.getAttribute('aria-label'),headerTitle:p.title,expanded:[t,p].map(e=>e.getAttribute('aria-expanded')),controls:[t,p].map(e=>e.getAttribute('aria-controls')),pressed:p.hasAttribute('aria-pressed'),visible:getComputedStyle(t).display!=='none',inert:document.querySelector('#sidebar').inert}`);
      assert.equal(a.show,'Show sidebar');assert.equal(a.showTitle,a.show);assert.equal(a.header,mode==='pinned'?'Hide sidebar':'Keep sidebar open');assert.equal(a.headerTitle,a.header);
      assert.deepEqual(a.expanded,[String(open),String(open)]);assert.deepEqual(a.controls,['sidebar','sidebar']);assert.equal(a.pressed,false);assert.equal(a.visible,!open);assert.equal(a.inert,!open);
    }
    try{
      await load();await closed();await geometry(0);await aria('auto',false);
      assert.ok(await ev('return document.querySelector("#sidebar").getBoundingClientRect().right<=1'));
      assert.equal(await ev('return document.querySelector("#navToggle svg").outerHTML===document.querySelector("#navPin svg").outerHTML'),true,'same sidebar glyph');
      phase='edge timers';
      await move(2,450);await sleep(40);await move(600,450);await sleep(300);await closed();
      await move(2,450);await sleep(40);await key('Escape');await sleep(300);await closed();
      await peek();await geometry(0);await aria('auto',true);
      await move(600,450);await sleep(100);await move(150,450);await sleep(450);assert.equal((await st()).open,true,'re-entry cancels hide');
      await nav('overview');await move(600,450);await closed();assert.equal(await ev('return document.querySelector(".view.active").id'),'overview');
      await peek();await tap(700,80);await closed();
      phase='click show/hide';
      for(let i=0;i<2;i++){
        await show();await geometry(244);await aria('pinned',true);
        await move(900,700);await key('Escape');await tap(900,80);assert.equal((await st()).mode,'pinned','dock ignores leave/Esc/outside');
        await nav('overview');assert.equal((await st()).mode,'pinned','nav helper preserves prior dock');
        await hide();await geometry(0);await aria('auto',false);assert.equal(await ev('return document.activeElement.id'),'navToggle');
      }
      await nav('overview');await closed();assert.equal(await ev('return localStorage.getItem("silex.nav.pinned")'),'false','nav helper restores temporary dock');
      phase='keyboard icons';
      await ev('document.querySelector("#navToggle").focus()');await key('Tab');assert.equal(await ev('return document.querySelector("#sidebar").contains(document.activeElement)'),false,'hidden nav omitted from tab order');
      for(const activation of ['Enter',' ']){
        await ev('document.querySelector("#navToggle").focus()');await key(activation);await docked();
        assert.equal(await ev('return document.activeElement===document.querySelector(".nav button.active")'),true,'keyboard docking focuses active nav');await aria('pinned',true);
        await key('Escape');await docked();
        await ev('document.querySelector("#navPin").focus()');await key(activation);await closed();assert.equal(await ev('return document.activeElement.id'),'navToggle','keyboard hiding restores focus');await aria('auto',false);
      }
      phase='peek keyboard focus';
      await peek();await ev('document.querySelector(".nav button.active").focus()');await key('Tab');await move(600,450);await sleep(450);await waitState('auto',true);
      await key('Escape');await closed();assert.equal(await ev('return document.activeElement.id'),'navToggle','peek Esc restores visible toggle');
      await peek();await ev('document.querySelector(".nav [data-view=library]").focus()');await key('Tab');await closed();
      await peek();await ev('document.querySelector("#navPin").focus()');await key('Tab',true);await closed();
      await ev('document.querySelector("#main").focus()');await key('Escape');assert.equal(await ev('return document.activeElement.id'),'main','outside focus not stolen');
      phase='peek docks';
      await peek();await clickSel('#navPin');await docked();await geometry(244);await aria('pinned',true);await hide();
      phase='Studio';
      await nav('blueprint');await frameReady();await closed();await peek();await move(900,700);await closed();
      await clickSel('#arrangeMenuBtn',true);await keyEscape();assert.equal(await fe('return !!document.querySelector("[data-dir=TB]")'),false,'Studio Esc remains local');
      const frameBefore=await ev('window.__navFrameDocument=document.querySelector("#studioFrame").contentDocument;return document.querySelector("#studioFrame").getBoundingClientRect().width');
      await show();await sleep(450);await geometry(244);
      assert.ok(await ev('return document.querySelector("#studioFrame").getBoundingClientRect().width')<frameBefore-200);
      assert.equal(await ev('return document.querySelector("#studioFrame").contentDocument===window.__navFrameDocument'),true);
      assert.equal(await ev(`const w=document.querySelector('#studioFrameWrap'),top=w.getBoundingClientRect().top+scrollY;return Math.abs(w.getBoundingClientRect().height-Math.max(560,420,innerHeight-top-16))<2`),true,'Studio height remeasured');
      assert.equal(await ev('return localStorage.getItem("silex.nav.pinned")'),'true');
      await navigate();await docked();await geometry(244);
      await viewport(390);assert.equal((await st()).desktop,false);assert.equal(await ev('return document.querySelector("#sidebar").inert'),false);
      await viewport();await docked();await geometry(244);
      await hide();await geometry(0);await navigate();await closed();await geometry(0);await aria('auto',false);
      phase='rapid peek dock/hide';
      await peek();await ev(`window.__navResizeCount=0;window.addEventListener('resize',()=>window.__navResizeCount++)`);
      const pinPoint=await ev(`const r=document.querySelector('#navPin').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}`);
      await tap(pinPoint.x,pinPoint.y);await tap(pinPoint.x,pinPoint.y);await closed();await sleep(350);await geometry(0);
      assert.equal(await ev('return window.__navResizeCount'),1,'rapid changes notify only settled layout');
      phase='Runtime';
      await nav('runtime-observation');await rtReady();await closed();await ev(`document.querySelector('#rtFrame').scrollIntoView({block:'center',behavior:'instant'})`);
      await peek();await move(900,700);await closed();
      await ev(`document.querySelector('#rtFrame').scrollIntoView({block:'center',behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const replayPoint=await rt(`const r=document.querySelector('[data-tab=replay]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}`);
      const runtimeRect=await ev(`const r=document.querySelector('#rtFrame').getBoundingClientRect();return {x:r.x,y:r.y}`);
      await tap(runtimeRect.x+replayPoint.x,runtimeRect.y+replayPoint.y);assert.equal(await rt('return document.querySelector("[data-tab=replay]").getAttribute("aria-selected")'),'true','Runtime control works');
      phase='breakpoints';
      await viewport(760);assert.equal((await st()).desktop,false);
      for(const id of ['navToggle','navPin','navEdge'])assert.equal(await ev(`return getComputedStyle(document.querySelector('#${id}')).display`),'none');
      await viewport(761);await closed();await geometry(0);
      await viewport();await move(2,450);await sleep(40);await viewport(390);await sleep(250);assert.equal(await ev('return document.querySelector("#sidebar").inert'),false);
      await viewport();await closed();
      phase='World Model';
      await nav('security-model');await closed();await sleep(350);await until(()=>ev('return !!document.querySelector("#swmSvg")?.getAttribute("viewBox")'),'World Model rendered');
      const worldBefore=await ev('return document.querySelector("#swmSvg").getAttribute("viewBox")');
      await show();await sleep(500);const worldAfter=await ev('return document.querySelector("#swmSvg").getAttribute("viewBox")');
      assert.ok(Number(worldBefore.split(' ')[2])>Number(worldAfter.split(' ')[2]),'World Model remeasures');await hide();await sleep(500);
      phase='short viewport';
      await viewport(1440,600);await show();
      for(const id of ['assurance','blueprint','short-term','policies','incidents','security-model','runtime-observation','long-term','overview','library']){await nav(id);assert.equal((await st()).mode,'pinned');}
      await hide();await viewport();
      phase='host modal';
      await peek();await ev('document.querySelector("#defsModal").classList.add("open")');await key('Escape');await waitState('auto',true);
      assert.equal(await ev('return !!document.elementFromPoint(100,100).closest(".modal-backdrop")'),true,'modal above drawer');
      await clickSel('[data-close="defsModal"]');await move(100,450);await move(900,700);await closed();
      phase='reduced motion';
      await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await show();assert.equal(await ev('return getComputedStyle(document.querySelector("#sidebar")).transitionDuration'),'0s');await geometry(244);await hide();
      phase='narrow geometry';
      for(const w of [761,768,1024,1440]){await viewport(w);await closed();assert.equal(await ev('return document.documentElement.scrollWidth<=innerWidth+1'),true,'hidden overflow '+w);await show();await geometry(244);assert.equal(await ev('return document.documentElement.scrollWidth<=innerWidth+1'),true,'docked overflow '+w);await hide();}
      return 'repeatable click dock/hide, Enter/Space and focus, labels/expanded, persistent choices, hover timers/peek, frame controls and identity, resize coalescing, breakpoints, short-screen reach, modal priority and reduced motion';
    }finally{await page.send('Emulation.setEmulatedMedia',{features:[]});await ev('localStorage.removeItem("silex.nav.pinned")');await viewport();await navigate();}
  });

  /* ---- T2 (logs/2026-10-02_JEV_LEARNINGS_PLAN.md item F): local-only World Model deep-link probes.
     These are NOT in the LIVE --base set; each runs alone with --only Sxx. ---- */
  const wmActive = () => ev('return (document.querySelector(".view.active")||{}).id==="security-model"');
  const wmPanel = () => ev('return (document.querySelector("#security-model .wm-panel.active")||{}).id');
  const wmTab = () => ev('return (document.querySelector("#security-model .wm-tab.active")||{}).id');
  const wmNode = () => ev('return (window.SWM&&typeof SWM.currentNode==="function")?SWM.currentNode():null');
  const wmBooted = id => ev(`return !!(window.SWM&&SWM._booted&&SWM._booted[${Q(id)}])`);
  const toastSeen = () => ev('return !!window.__toastSeen');
  async function withNoticeObserver(fn) {
    const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
      'window.__toastSeen=false;(function w(){var t=document.getElementById("toast");if(!t){setTimeout(w,0);return}' +
      'new MutationObserver(function(){if(t.classList.contains("show"))window.__toastSeen=true;}).observe(t,{attributes:true,attributeFilter:["class"]});' +
      'if(t.classList.contains("show"))window.__toastSeen=true;})();' });
    try { return await fn(); } finally { await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }); }
  }
  async function holdBundle(match) {
    await page.send('Fetch.enable', { patterns: [{ urlPattern: match, requestStage: 'Request' }] });
    const state = { held: [], onPause: null };
    state.onPause = e => { const m = JSON.parse(e.data); if (m.method === 'Fetch.requestPaused') state.held.push(m.params); };
    page.ws.addEventListener('message', state.onPause);
    const drain = async () => { while (state.held.length) { try { await page.send('Fetch.continueRequest', { requestId: state.held.shift().requestId }); } catch {} } };
    return { held: () => state.held, release: drain,
      async disable() { await drain(); page.ws.removeEventListener('message', state.onPause); try { await page.send('Fetch.disable'); } catch {} } };
  }
  const waitHeld = (h, label, timeout = 15000) => until(() => h.held().length > 0, label, timeout);
  const setDeepLink = route => ev(`history.replaceState(null,'','#view=overview'); location.hash=${Q(route)}; true`);

  await probe('S22','cold World Model deep link focuses the node (loader-not-ready path)',async()=>{
    await load({ path: '/index.html#view=security-model&node=owasp:LLM01' });
    await until(wmActive,'security-model active',12000);
    assert.equal(await wmTab(),'wmtab-ontology','node= selects the Ontology Graph sub-tab');
    await until(async()=> (await wmNode()) === 'owasp:LLM01','node focused',15000);
    assert.equal(await wmNode(),'owasp:LLM01','SWM.currentNode()');
    return `active ${await ev('return (document.querySelector(".view.active")||{}).id')} · tab ${await wmTab()} · node ${await wmNode()}`;
  });

  await probe('S23','tab routes: default and explicit sub-tabs',async()=>{
    await load({ path: '/index.html#view=security-model' });
    await until(wmActive,'World Model active',12000);
    assert.equal(await wmTab(),'wmtab-architecture','#view=security-model defaults to Ontology Layers');
    assert.equal(await wmPanel(),'wm-architecture','default panel');
    await load({ path: '/index.html#view=security-model&tab=wm-overview' });
    await until(async()=> (await wmPanel()) === 'wm-overview','wm-overview',12000);
    assert.equal(await wmTab(),'wmtab-overview','explicit wm-overview');
    await load({ path: '/index.html#view=security-model&tab=wm-gaps' });
    await until(async()=> (await wmPanel()) === 'wm-gaps','wm-gaps',12000);
    return 'default wm-architecture; explicit wm-overview; static wm-gaps';
  });

  await probe('S24','cold node= with the default tab and with a static tab',async()=>{
    await load({ path: '/index.html#view=security-model&node=owasp:LLM01' });
    await until(async()=> (await wmNode()) === 'owasp:LLM01','default-tab node',15000);
    assert.equal(await wmTab(),'wmtab-ontology','node= implies wm-ontology');
    await withNoticeObserver(async()=>{
      await load({ path: '/index.html#view=security-model&tab=wm-gaps&node=owasp:LLM01' });
      await until(async()=> (await wmNode()) === 'owasp:LLM01','static-tab node',15000);
      assert.equal(await wmTab(),'wmtab-ontology','node= overrides an incompatible tab');
      assert.ok(await toastSeen(),'notice for node= with an incompatible tab');
    });
    return 'default tab and static tab both focus through wm-ontology; the static tab also shows the notice';
  });

  await probe('S25','unknown tab/node and a malformed hash fall back with the notice',async()=>{
    await withNoticeObserver(async()=>{
      await load({ path: '/index.html#view=security-model&tab=nope' });
      await until(async()=> (await wmPanel()) === 'wm-architecture','unknown tab fallback',12000);
      assert.ok(await toastSeen(),'notice for an unknown tab');
      await load({ path: '/index.html#view=security-model&node=no:such:node' });
      await until(async()=> (await wmPanel()) === 'wm-architecture','unknown node fallback',12000);
      assert.ok(await toastSeen(),'notice for an unknown node');
      await load({ path: '/index.html#view=security-model&tab' });
      await until(wmActive,'malformed hash still opens the World Model',12000);
      assert.ok(await toastSeen(),'notice for a malformed hash');
    });
    return 'unknown tab, unknown node and malformed hash all fall back with the notice';
  });

  await probe('S26','Back while the bundle is loading: no mount, no focus',async()=>{
    const h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/index.html' });
      await setDeepLink('view=security-model&node=owasp:LLM01');
      await waitHeld(h,'bundle held');
      await ev('history.back(); true');
      await sleep(300);
      await h.release();
      await sleep(3500);
      assert.ok(!(await wmNode()),'no stale focus after Back');
      assert.equal(await wmBooted('wm-ontology'),false,'no hidden mount after Back');
    } finally { await h.disable(); }
    return 'Back during a delayed load leaves no mount and no focus';
  });

  await probe('S27','navigating to another view during a delayed load cancels mount and focus',async()=>{
    const h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/index.html' });
      await setDeepLink('view=security-model&node=owasp:LLM01');
      await waitHeld(h,'bundle held');
      await nav('overview');
      await h.release();
      await sleep(3500);
      assert.ok(!(await wmNode()),'no focus after navigating away');
      assert.equal(await wmBooted('wm-ontology'),false,'no hidden mount after navigating away');
    } finally { await h.disable(); }
    return 'nav-away during a delayed load cancels the mount and the focus';
  });

  await probe('S28','switching World Model sub-tab during a delayed load cancels the focus',async()=>{
    const h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/index.html' });
      await setDeepLink('view=security-model&node=owasp:LLM01');
      await waitHeld(h,'bundle held');
      await clickSel('[data-wm-panel="wm-overview"]');
      await h.release();
      await sleep(3500);
      assert.ok(!(await wmNode()),'no focus after the sub-tab switch');
      assert.equal(await wmBooted('wm-ontology'),false,'the abandoned panel is not mounted');
      assert.equal(await wmPanel(),'wm-overview','the switched-to panel is active');
    } finally { await h.disable(); }
    return 'sub-tab switch during a delayed load cancels the abandoned focus';
  });

  await probe('S29','cancellation: leave then return, before and after the load finishes',async()=>{
    let h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/index.html' });
      await setDeepLink('view=security-model&node=owasp:LLM01');
      await waitHeld(h,'bundle held (before)');
      await nav('overview'); await nav('security-model');
      await h.release();
      await sleep(3500);
      assert.ok(!(await wmNode()),'no focus after leave -> return before the load finished');
    } finally { await h.disable(); }
    h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/index.html' });
      await setDeepLink('view=security-model&node=owasp:LLM01');
      await waitHeld(h,'bundle held (after)');
      await nav('overview');
      await h.release();
      await sleep(3500);
      await nav('security-model');
      await sleep(1500);
      assert.ok(!(await wmNode()),'no focus after the load finished while away');
    } finally { await h.disable(); }
    return 'leave/return cancels the pending focus both before and after the delayed load';
  });

  await probe('S30','a late loader-ready or load event after cancellation does not focus',async()=>{
    const h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/index.html' });
      await setDeepLink('view=security-model&node=owasp:LLM01');
      await waitHeld(h,'bundle held');
      await nav('overview');
      await ev("window.dispatchEvent(new Event('swm:loader-ready')); window.dispatchEvent(new Event('load')); true");
      await h.release();
      await sleep(3000);
      await ev("window.dispatchEvent(new Event('swm:loader-ready')); window.dispatchEvent(new Event('load')); true");
      await sleep(1200);
      assert.ok(!(await wmNode()),'a synthetic late event after cancellation does not focus');
    } finally { await h.disable(); }
    return 'late swm:loader-ready/load after cancellation does not focus';
  });

  await probe('S31','a newer route landing on #studio cancels the pending focus',async()=>{
    const h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/index.html' });
      await setDeepLink('view=security-model&node=owasp:LLM01');
      await waitHeld(h,'bundle held');
      await ev("location.hash='studio'; true");
      await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="blueprint"'),'#studio route',12000);
      await h.release();
      await sleep(3000);
      assert.ok(!(await wmNode()),'no focus after a newer #studio route');
      assert.equal(await wmBooted('wm-ontology'),false,'no hidden mount after a newer #studio route');
    } finally { await h.disable(); }
    return 'a newer #studio route cancels the focus and the hidden mount';
  });

  await probe('S32','blank-hash origin -> chip -> Back -> Forward',async()=>{
    await load({ path: '/index.html' });
    await nav('incidents');
    await clickSel('#incidentCards [data-incident="I-1042"]');
    await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="incident"'),'incident view',8000);
    await clickSel('#incOntology [data-wm-route]');
    await until(async()=> (await wmNode()) !== null,'chip focused a node',15000);
    const node = await wmNode();
    await ev('history.back(); true');
    await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="incident"'),'back to the incident',10000);
    assert.equal(await ev('return document.getElementById("incId").textContent'),'I-1042','Back restored the incident');
    await ev('history.forward(); true');
    await until(wmActive,'forward to the World Model',10000);
    assert.equal(await wmNode(),node,'Forward restores the focused node');
    return `blank origin restored I-1042; Forward restored ${node}`;
  });

  await probe('S33','Back/Forward across incident and node routes',async()=>{
    await load({ path: '/index.html#view=incident&incident=I-1042' });
    await until(()=>ev('return document.getElementById("incId").textContent==="I-1042"'),'I-1042',10000);
    await ev("location.hash='view=security-model&node=owasp:LLM01'");
    await until(async()=> (await wmNode()) === 'owasp:LLM01','node',15000);
    await ev('history.back(); true');
    await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="incident" && document.getElementById("incId").textContent==="I-1042"'),'back to I-1042',10000);
    await ev("location.hash='view=incident&incident=I-1038'");
    await until(()=>ev('return document.getElementById("incId").textContent==="I-1038"'),'I-1038',10000);
    await ev("location.hash='view=security-model&node=owasp:LLM06'");
    await until(async()=> (await wmNode()) === 'owasp:LLM06','LLM06',15000);
    await ev('history.back(); true');
    await until(()=>ev('return document.getElementById("incId").textContent==="I-1038"'),'back to I-1038',10000);
    await ev("location.hash='view=security-model&node=owasp:LLM01'");
    await until(async()=> (await wmNode()) === 'owasp:LLM01','node A',15000);
    await ev("location.hash='view=security-model&node=owasp:LLM02'");
    await until(async()=> (await wmNode()) === 'owasp:LLM02','node B',15000);
    await ev('history.back(); true');
    await until(async()=> (await wmNode()) === 'owasp:LLM01','back to node A',10000);
    await ev('history.forward(); true');
    await until(async()=> (await wmNode()) === 'owasp:LLM02','forward to node B',10000);
    return 'Back/Forward from I-1042, from I-1038 and node -> node';
  });

  await probe('S34','#studio and #studio=new as return destinations',async()=>{
    await load({ path: '/index.html#view=security-model&node=owasp:LLM01' });
    await until(async()=> (await wmNode()) === 'owasp:LLM01','node',15000);
    await ev("location.hash='studio'");
    await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="blueprint"'),'#studio',10000);
    await ev('history.back(); true');
    await until(wmActive,'back to the node',10000);
    assert.equal(await wmNode(),'owasp:LLM01','Back returns to the focused node (studio)');
    await load({ path: '/index.html#view=security-model&node=owasp:LLM01' });
    await until(async()=> (await wmNode()) === 'owasp:LLM01','node after a fresh load',15000);
    await ev("location.hash='studio=new'");
    await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="blueprint"'),'#studio=new',10000);
    await ev('history.back(); true');
    await until(wmActive,'back to the node again',10000);
    assert.equal(await wmNode(),'owasp:LLM01','Back returns to the focused node (studio=new)');
    return '#studio and #studio=new return to the focused node route';
  });

  await probe('S35','I-1042 Ontology row matches the bundle; I-1038 gap; others hidden',async()=>{
    const onto = JSON.parse(await readFile(join(ROOT, 'swm/data/ontology.json'), 'utf8'));
    const byId = new Map(onto.nodes.map(n => [n.id, n]));
    const order = ['hz:haz-proc-bank-detail-unverified','atlas:AML.T0052','core:core-control-dual-approval'];
    await load({ path: '/index.html#view=incident&incident=I-1042' });
    await until(()=>ev('return document.getElementById("incId").textContent==="I-1042"'),'I-1042',10000);
    const row = await ev(`return (() => { const c=document.getElementById('incOntology'); if(!c) return {missing:true};
      const chips=[...c.querySelectorAll('[data-wm-route]')];
      return { hidden:c.offsetParent===null, ids:chips.map(b=>b.getAttribute('data-node-id')), text:chips.map(b=>b.textContent),
               grades:chips.map(b=>{const g=b.querySelector('.swm-review,[class*="review"],.grade,[data-grade]');return g?g.textContent:b.textContent;}) }; })()`);
    assert.ok(!row.missing,'#incOntology exists');
    assert.equal(row.hidden,false,'the I-1042 row is visible');
    assert.deepEqual(row.ids,order,'chip ids and order');
    order.forEach((id,i)=>{ const n=byId.get(id); assert.ok(n,'node '+id+' exists in the bundle');
      assert.ok(row.text[i].includes(n.label),'chip '+id+' shows its label');
      assert.match(row.grades[i],/published|curated|heuristic|illustrative/i,'chip '+id+' shows a review grade'); });
    await load({ path: '/index.html#view=incident&incident=I-1038' });
    await until(()=>ev('return document.getElementById("incId").textContent==="I-1038"'),'I-1038',10000);
    const gap = await ev(`return (() => { const c=document.getElementById('incOntology'); return { hidden:c?c.offsetParent===null:true, gap:!!document.querySelector('.inc-onto-gap'), chips:c?c.querySelectorAll('[data-wm-route]').length:0 }; })()`);
    assert.equal(gap.hidden,false,'the I-1038 row is visible');
    assert.equal(gap.gap,true,'I-1038 shows the blind-spot element');
    assert.equal(gap.chips,0,'I-1038 has no chips');
    await load({ path: '/index.html#view=incident&incident=I-1031' });
    await until(()=>ev('return document.getElementById("incId").textContent==="I-1031"'),'I-1031',10000);
    assert.equal(await ev('return (()=>{const c=document.getElementById("incOntology");return c?c.offsetParent===null:true})()'),true,'other incidents hide the row');
    return 'I-1042 chips match the bundle (order/labels/grades); I-1038 gap; other incidents hidden';
  });

  await probe('S36','an unknown incident= falls back to the queue with the notice',async()=>{
    await withNoticeObserver(async()=>{
      await load({ path: '/index.html#view=incident&incident=I-9999' });
      await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="incidents"'),'Incident Queue fallback',12000);
      assert.ok(await toastSeen(),'notice for an unknown incident');
    });
    return 'unknown incident= shows the notice and the Incident Queue';
  });

  await probe('S37','assurance.html World Model renders after a hidden late load, no not-booted warning',async()=>{
    const warns = [];
    const onMsg = e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'warning')
      warns.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ')); };
    page.ws.addEventListener('message', onMsg);
    const h = await holdBundle('*swm/data/ontology.js*');
    try {
      await load({ path: '/assurance.html' });
      await nav('security-model');
      await clickSel('[data-wm-panel="wm-ontology"]');
      await waitHeld(h,'assurance bundle held');
      await nav('overview');
      await h.release();
      await sleep(3500);
      await nav('security-model');
      await until(()=>ev('return document.querySelector("#swmOntology #swmSvg")!==null'),'assurance ontology panel rendered',12000);
      await clickSel('[data-wm-panel="wm-architecture"]');
      await until(()=>ev('return document.querySelector("#swmLayers") && !document.querySelector("#swmLayers .swm-loading")'),'assurance Layers panel rendered',12000);
      const bad = warns.filter(w => /\[SWM\].*not booted/.test(w));
      assert.equal(bad.length,0,'no [SWM] ... not booted warning for the deferred panel: '+JSON.stringify(bad));
    } finally { page.ws.removeEventListener('message', onMsg); await h.disable(); }
    return 'assurance.html wm-ontology and wm-architecture render after a hidden late load; no not-booted warning';
  });

  await probe('S38','the Assurance explorer button opens the Ontology Graph and Back returns',async()=>{
    await load({ path: '/index.html' });
    await nav('assurance');
    await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="assurance"'),'Assurance view',10000);
    await clickSel('#assurance [data-wm-route]');
    await until(wmActive,'World Model active',12000);
    assert.equal(await wmTab(),'wmtab-ontology','the button opens the Ontology Graph');
    assert.equal(await wmPanel(),'wm-ontology','wm-ontology panel active');
    await ev('history.back(); true');
    await until(()=>ev('return (document.querySelector(".view.active")||{}).id==="assurance"'),'Back to Assurance',10000);
    await ev('history.forward(); true');
    await until(wmActive,'Forward to the World Model',10000);
    assert.equal(await wmPanel(),'wm-ontology','Forward restores the Ontology Graph');
    return 'Assurance button -> Ontology Graph; Back -> Assurance; Forward -> Ontology Graph';
  });

} finally {
  for(const c of clients) c.ws.close(); chrome?.kill(); if(server) await new Promise(r=>server.close(r));
}
console.log(`\n${results.filter(r=>r.pass).length}/${results.length} PASS${BASE?' (live read-back subset)':''}`);
process.exitCode=results.some(r=>!r.pass)||!results.length?1:0;
