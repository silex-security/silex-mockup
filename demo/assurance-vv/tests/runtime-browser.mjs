import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const clients=new Set(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=await mkdtemp(join(tmpdir(),'silex-review-qa-'));
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8768';
let chrome,page;
const checks=[];
await mkdir('runtime-sync-screenshots',{recursive:true});
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

const ev=code=>page.ev(code);
async function shot(name){const r=await page.send('Page.captureScreenshot',{format:'png'});await writeFile('runtime-sync-screenshots/'+name+'.png',Buffer.from(r.data,'base64'))}
async function click(sel){await ev(`document.querySelector(${JSON.stringify(sel)}).click()`);await sleep(180)}
async function nav(v){await ev(`location.hash='view=${v}'`);await until(()=>ev(`return !document.querySelector('[data-view="${v}"]').hidden`),v);await sleep(160)}
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name)}
try{
 chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let port;await until(async()=>{try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);return port}catch{}},'chrome');
 const endpoint='http://127.0.0.1:'+port;
 const target=(await(await fetch(endpoint+'/json/list')).json()).find(x=>x.type==='page');
 page=await connect(target.webSocketDebuggerUrl);
 for(const method of ['Page.enable','Runtime.enable','Network.enable'])await page.send(method);
 await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await page.send('Page.navigate',{url:origin+'/prototype/'});
 await until(()=>ev('return !!document.querySelector("[data-nav][aria-current]")'),'app ready');
 await check('Four primary links, Assurance default, advanced menu closed',async()=>{assert.equal(await ev('return document.querySelectorAll("[data-nav]").length'),4);assert.equal(await ev('return document.querySelector("[aria-current]").dataset.nav'),'assurance');assert.equal(await ev('return document.querySelector("#more").open'),false);await shot('01-assurance')});
 await check('Pre-release distinct illustrative source and no deployment action',async()=>{await nav('short-term');assert.match(await ev('return document.querySelector("[data-view=short-term]").innerText'),/not a test of the Blueprint/);await shot('03-pre-release')});
 await check('Studio opens standalone engine, no nested site navigation',async()=>{await nav('blueprint');await until(()=>ev('return !!document.querySelector("#studioFrame").contentWindow.__bs2?.store.doc'),'studio',30000);assert.equal(await ev('return !!document.querySelector("#studioFrame").contentDocument.querySelector(".sidebar")'),false);await shot('02-blueprint')});
 await check('Ontology intake renders all entities and relations with keyboard inspector',async()=>{
  await until(()=>ev('return document.querySelectorAll("#intakeGraph g").length>0'),'intake');
  assert.ok(await ev('const t=await(await fetch("../baseline/blueprint_studio/templates/vendor-bank-change.json")).json();return document.querySelectorAll("#intakeGraph g").length===t.graph.nodes.length&&document.querySelectorAll("#intakeGraph path[role=button]").length===t.graph.edges.length'));
  await ev('document.querySelector("#intakeGraph path[role=button]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');
  assert.match(await ev('return document.querySelector("#entityInspector").textContent'),/Not provided/);
  assert.match(await ev('return document.querySelector("#entityInspector").textContent'),/proposed local schema extension/);
  await shot('10-intake-edge');
 });
 await check('Intake imports in memory, rejects invalid file and preserves previous preview',async()=>{
  await ev('window.__qaStorage=JSON.stringify({...localStorage});window.__qaImport=async text=>{const dt=new DataTransfer();dt.items.add(new File([text],"review.json",{type:"application/json"}));const f=document.querySelector("#intakeFile");f.files=dt.files;f.dispatchEvent(new Event("change"));}');
  await ev('const {newDocument}=await import("../baseline/blueprint_studio/js/store.js");const t=await(await fetch("../baseline/blueprint_studio/templates/vendor-bank-change.json")).json();t.name="Imported <b>untrusted</b> agent";await window.__qaImport(JSON.stringify(newDocument(t)))');
  await until(()=>ev('return document.querySelector("#intakeName").textContent.includes("Imported")'),'import');
  assert.equal(await ev('return document.querySelector("#intakeName b")'),null);
  await ev('await window.__qaImport("{")');await until(()=>ev('return document.querySelector("#intakeError").textContent.includes("Import refused")'),'rejection');
  assert.match(await ev('return document.querySelector("#intakeName").textContent'),/Imported/);
  assert.equal(await ev('return window.__qaStorage===JSON.stringify({...localStorage})'),true);
  await click('#resetIntake');assert.equal(await ev('return document.querySelector("#intakeName").textContent'),'Vendor Bank-Detail Change');
 });
 await check('EWM handles missing validation without false trace',async()=>{await nav('security-model');assert.match(await ev('return document.querySelector("#evidenceState").textContent'),/no validation|unavailable|no current|refresh/i);await click('#ewmTrace');assert.match(await ev('return document.querySelector("#traceNotice").textContent'),/fallback/);await nav('security-model');await shot('05-ewm')});
 await check('Runtime S2 returns judge decision; S5 is after-call finding',async()=>{await nav('runtime-observation');await click('[data-run="S2"]');await until(()=>ev('return document.querySelector("#runtimeResult").textContent.includes("S2 ·")'),'S2',30000);assert.match(await ev('return document.querySelector("#runtimeResult").textContent'),/judge/);await click('[data-run="S5"]');await until(()=>ev('return document.querySelector("#runtimeResult").textContent.includes("S5 ·")'),'S5');assert.match(await ev('return document.querySelector("#runtimeResult").textContent'),/Finding after the call/);await shot('04-runtime')});
 await check('Runtime iframe persists across navigation; learning cancels pending run',async()=>{await ev('window.__qaRuntimeFrame=document.querySelector("#runtimeFrame").contentWindow.document');await nav('assurance');await nav('runtime-observation');assert.equal(await ev('return window.__qaRuntimeFrame===document.querySelector("#runtimeFrame").contentWindow.document'),true);await ev('document.querySelector("[data-run=S1]").click();document.querySelector("#openLearning").click()');await until(()=>ev('return !document.querySelector("[data-run=S1]").disabled'),'settled');await until(()=>ev('return !!document.querySelector("#runtimeFrame").contentDocument.querySelector("[data-evidence-model]")'),'learning evidence');await shot('06-learning')});
 await check('Reference graph uses existing view hook and hides old site navigation',async()=>{await nav('security-model');await click('[data-tab=reference]');await ev('document.querySelector("#graphDetails").open=true');await until(()=>ev('return !!document.querySelector("#graphFrame").contentDocument?.querySelector("#review-shell-style")'),'reference');assert.equal(await ev('return document.querySelector("#graphFrame").contentDocument.querySelector("#security-model").classList.contains("active")'),true);await shot('07-reference')});
 await check('Host gate verdicts match generated benchmark evidence',async()=>{
  await nav('runtime-observation');await ev('document.querySelector("#learningDetails").open=true');
  await until(()=>ev('return document.querySelectorAll("#learningGateRows [data-verdict]").length===2'),'host gates');
  assert.deepEqual(await ev('return [...document.querySelectorAll("#learningGateRows [data-verdict]")].map(n=>n.textContent)'),['KEEP','DISCARD']);
  assert.match(await ev('return document.querySelector("#learningGateRows").textContent'),/25 → 27/);
  await ev('document.querySelector("#learningDetails").scrollIntoView()');await shot('11-runtime-gates');
 });
 for(const domain of ['ap','soc'])await check(domain+' model history, selection, Reset and mobile layout',async()=>{
  if(domain==='soc')await click('[data-soc]');
  await click('#openLearning');
  await until(()=>ev('return !!document.querySelector("#runtimeFrame").contentDocument.querySelector("[data-learn-play]")'),'learning');
  await ev('document.querySelector("#runtimeFrame").contentDocument.querySelector("[data-learn-play]").click()');
  await until(()=>ev('return document.querySelector("#runtimeFrame").contentDocument.querySelectorAll("[data-learn-node]").length===4'),'three rounds',15000);
  await until(()=>ev('return !document.querySelector("#runtimeFrame").contentDocument.querySelector("[data-learn-play]").disabled'),'play settled');
  const text=await ev('return [...document.querySelector("#runtimeFrame").contentDocument.querySelectorAll("[data-learn-node]")].map(n=>n.textContent)');
  assert.match(text[1],/NEAR-MISS/);assert.match(text[2],/KEEP/);assert.match(text[2],/ACTIVE/);assert.match(text[3],/DISCARD/);assert.doesNotMatch(text[3],/ACTIVE/);
  await ev('document.querySelector("#runtimeFrame").contentDocument.querySelectorAll("[data-learn-node]")[1].click()');
  assert.match(await ev('return document.querySelector("#runtimeFrame").contentDocument.querySelector("[data-learn-gate-result]").textContent'),/NEAR-MISS/);
  await ev('document.querySelector("#runtimeFrame").scrollIntoView()');await shot('12-lineage-'+domain);
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await sleep(250);
  assert.ok(await ev('const w=document.querySelector("#runtimeFrame").contentWindow;return w.document.documentElement.scrollWidth<=w.innerWidth+1'));
  await ev('document.querySelector("#runtimeFrame").scrollIntoView();document.querySelector("#runtimeFrame").contentDocument.querySelector(".learn-history").scrollIntoView()');await sleep(200);await shot('13-lineage-mobile-'+domain);
  await ev('document.querySelector("#runtimeFrame").contentDocument.querySelector("[data-learn-reset]").click()');
  assert.equal(await ev('return document.querySelector("#runtimeFrame").contentDocument.querySelectorAll("[data-learn-node]").length'),1);
  await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 });
 await check('Legacy runtime route and unknown route fallback',async()=>{await ev('location.hash="view=long-term&tab=runtime"');await until(()=>ev('return location.hash==="#view=runtime-observation"'),'legacy');await ev('location.hash="view=unknown"');await until(()=>ev('return !document.querySelector("#routeNotice").hidden'),'fallback');assert.equal(await ev('return document.querySelector("[aria-current]").dataset.nav'),'assurance')});
 await check('390px layout keeps main document within viewport',async()=>{await nav('assurance');await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await sleep(300);assert.ok(await ev('return document.documentElement.scrollWidth<=innerWidth+1'));await shot('08-mobile');await nav('blueprint');assert.ok(await ev('return document.documentElement.scrollWidth<=innerWidth+1'));await shot('09-mobile-blueprint')});
 await check('Private planning files and directory listing are not served',async()=>{for(const p of ['/PLAN.md','/EVIDENCE.md','/claude-plan-r4-prompt.txt','/baseline/docs/'])assert.equal((await fetch(origin+p)).status,404)});
 assert.equal(page.errors.filter(e=>!e.includes('Content Security Policy')&&!e.includes('favicon')).length,0,JSON.stringify(page.errors));
 await writeFile('RUNTIME-SYNC-QA.json',JSON.stringify({checks,errors:page.errors,requests:page.requests},null,2));
 console.log('DONE',checks.length);
}catch(e){console.error(e);await writeFile('RUNTIME-SYNC-QA-failure.json',JSON.stringify({checks,error:String(e),errors:page?.errors},null,2));process.exitCode=1}
finally{for(const c of clients)c.ws.close();chrome?.kill()}
