#!/usr/bin/env node
/* Studio cutover S1–S12. Run from any cwd:
 * node tests/site/run-site-probes.mjs [--only S1,S3] [--shots /tmp/site-shots]
 * --base https://silex-mockup.vercel.app runs only the approved live subset:
 * S1, S3 (recommendation), S4 (registration/persistence), S5. Isolated Chrome profile;
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
const LIVE = new Set(['S1', 'S3', 'S4', 'S5']);
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
if (BASE) origin = BASE.replace(/\/$/, '');
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
  const code = `const e=document.querySelector(${Q(sel)}); if(!e) throw Error('Missing selector '+${Q(sel)}); e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); if(!r.width||!r.height||e.disabled) throw Error('Hidden/disabled '+${Q(sel)}); return {x:r.x+r.width/2,y:r.y+r.height/2};`;
  const p = frame ? await fe(code) : await ev(code);
  if (frame) { const r = await ev('const r=document.querySelector("#studioFrame").getBoundingClientRect(); return {x:r.x,y:r.y};'); p.x += r.x; p.y += r.y; }
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, ...p, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  await sleep(180);
}
async function keyEscape() { for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(100); }
async function nav(view) { await clickSel(`.nav [data-view="${view}"]`); }
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
} finally {
  for(const c of clients) c.ws.close(); chrome?.kill(); if(server) await new Promise(r=>server.close(r));
}
console.log(`\n${results.filter(r=>r.pass).length}/${results.length} PASS${BASE?' (live read-back subset)':''}`);
process.exitCode=results.some(r=>!r.pass)||!results.length?1:0;
