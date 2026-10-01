import {renderLearningGate} from './learning.js';
import {currentTrace,routeFromHash} from './state.js';
import {describeRun} from '../baseline/js/jev-runtime-model.js';
const $=id=>document.getElementById(id);
const store=(()=>{try{return localStorage}catch{return null}})();
let nonce=Date.now()%1e12, runtimeToken=0, runtimeDomain='ap', refToken=0;
const refs={policies:'Policy decisions',incidents:'Incident Queue','long-term':'System Validation',overview:'Overview',library:'Workflow Library'};

function refreshEvidence(){
  const s=currentTrace(store);
  $('evidenceState').textContent=s.ok?`${s.name} · ${s.rev} · ${s.findings} findings in ${s.runs} simulated runs. Declared graph; not production evidence.`:s.reason;
  $('homeBlueprintStatus').textContent=s.ok?`${s.findings} findings · ${s.runs} simulated runs · this local workspace`:'Run a check to produce evidence';
  $('studioStatus').textContent=s.ok?`${s.name} · ${s.rev} · local preview workspace`:'Existing Studio · local preview workspace';
  return s;
}
function lazy(id){const f=$(id);if(!f.getAttribute('src'))f.src=f.dataset.src;return f}
function navigate(view){const h='#view='+view;if(location.hash!==h)location.hash=h;else applyRoute(false)}
function applyRoute(focus=true){
  const r=routeFromHash(location.hash);
  if(r.legacy)history.replaceState(null,'','#view=runtime-observation');
  for(const s of document.querySelectorAll('main>section'))s.hidden=s.dataset.view!==r.view;
  for(const a of document.querySelectorAll('[data-nav]')){
    if(a.dataset.nav===r.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  $('routeNotice').hidden=!r.notice;$('routeNotice').textContent=r.notice||'';
  $('more').open=false;
  if(r.view==='blueprint')lazy('studioFrame');
  if(r.view==='runtime-observation')lazy('runtimeFrame');
  if(r.view==='reference')showReference(refs[r.reference]?r.reference:'overview');
  refreshEvidence();
  if(focus){$('main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})}
}
async function openTrace(){
  const s=refreshEvidence();
  navigate('blueprint');lazy('studioFrame');
  $('studioDetails').open=true;
  $('traceNotice').textContent=s.ok?'Opening the verified current revision in Decision Trace.':s.reason+' This is a navigation fallback, not a verified trace.';
  if(!s.ok)return;
  const q=new URLSearchParams({...s.target,rev:String(s.target.rev),n:String(++nonce)});
  // Existing Studio validates doc/rev/hash before applying this command.
  const f=$('studioFrame');
  if(f.contentWindow.__bs2)f.contentWindow.location.hash=q.toString();
  else f.src=f.dataset.src+'#'+q.toString();
}
$('traceButton').addEventListener('click',openTrace);$('ewmTrace').addEventListener('click',openTrace);
$('continueStudio').addEventListener('click',()=>{$('studioDetails').open=true;lazy('studioFrame');$('studioDetails').scrollIntoView({block:'start',behavior:'instant'})});
window.addEventListener('hashchange',()=>applyRoute());
window.addEventListener('storage',e=>{if(!e.key||e.key.startsWith('bs.'))refreshEvidence()});
window.addEventListener('focus',refreshEvidence);
$('studioFrame').addEventListener('load',refreshEvidence);

async function runtimeReady(domain,mine){
  const f=lazy('runtimeFrame');
  let api;try{api=f.contentWindow.__jevDemo}catch{}
  if(runtimeDomain!==domain||(api&&api.domain!==domain)){
    runtimeDomain=domain;f.src=`../baseline/jev-runtime/demo/index.html?embed=1&domain=${domain}&autoplay=0&nav=${mine}`;
  }
  const start=Date.now();
  while(Date.now()-start<12000){
    if(mine!==runtimeToken)throw Error('cancelled');
    try{const w=f.contentWindow,d=w.__jevDemo,q=new URLSearchParams(w.location.search);if(d?.ready&&d.domain===domain&&q.get('domain')===domain)return d}catch{}
    await new Promise(r=>setTimeout(r,80));
  }
  throw Error('The runtime did not load. Retry this action.');
}
async function run(id,button){
  const mine=++runtimeToken,domain=id.startsWith('SOC')?'soc':'ap';
  button.disabled=true;$('runtimeResult').textContent='Running '+id+' in the scripted runtime…';
  try{
    const d=await runtimeReady(domain,mine);if(mine!==runtimeToken)return;
    d.openTab('live');const envs=d.inject(id);
    $('runtimeResult').textContent=describeRun(envs,{id})+' Simulated result; no production action.';
    $('runtimeScope').textContent=(domain==='ap'?'Northwind AP':'SOC')+' · Independent example. Simulated judge, latency and tenant; no production calls or enforcement.';
  }catch(e){if(mine===runtimeToken)$('runtimeResult').textContent=e.message}
  finally{button.disabled=false}
}
document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.run,b)));
async function runtimeTab(tab,domain=runtimeDomain){
  navigate('runtime-observation');const mine=++runtimeToken;
  $('runtimeResult').textContent=tab==='learning'?'Opening the existing learning comparison. This does not train or promote a production judge.':'Opening the scripted live view.';
  try{const d=await runtimeReady(domain,mine);if(mine===runtimeToken){d.openTab(tab);if(tab==='learning')$('runtimeFrame').scrollIntoView({block:'start',behavior:'smooth'})}}catch(e){if(mine===runtimeToken)$('runtimeResult').textContent=e.message}
}
$('openLearning').addEventListener('click',()=>runtimeTab('learning'));
$('backToLive').addEventListener('click',()=>runtimeTab('live'));
document.querySelector('[data-soc]').addEventListener('click',()=>{
  $('runtimeScope').textContent='SOC · Alternate scripted example. Use SOC2 (rule) and SOC5 (judge). This does not prove cross-domain generalization.';
  runtimeTab('live','soc');
});

function tab(name,focus=false){
  for(const b of document.querySelectorAll('[data-tab]')){const selected=b.dataset.tab===name;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected&&focus)b.focus()}
  $('evidencePanel').hidden=name!=='evidence';$('referencePanel').hidden=name!=='reference';
}
document.querySelectorAll('[data-tab]').forEach(b=>{
  b.addEventListener('click',()=>tab(b.dataset.tab));
  b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();tab(e.key==='Home'?'evidence':e.key==='End'?'reference':b.dataset.tab==='evidence'?'reference':'evidence',true)}});
});
function stripReferenceShell(frame,view,panel){
  const w=frame.contentWindow,d=w.document;
  if(!w.__siteShowView)throw Error('Reference shell not ready');
  let css=d.getElementById('review-shell-style');
  if(!css){css=d.createElement('style');css.id='review-shell-style';css.textContent='.sidebar,.topbar,.nav-edge,#navToggle{display:none!important}.main{margin-left:0!important;width:100%!important}.content{padding:16px!important}.swm-head,.wm-tabs{display:none!important}body{overflow-x:hidden}';d.head.append(css)}
  w.__siteShowView(view);
  if(panel)d.querySelector(`[data-wm-panel="wm-${panel}"]`)?.click();
  w.dispatchEvent(new Event('resize'));
}
async function referenceFrame(id,view,panel){
  const f=$(id);if(!f.getAttribute('src'))f.src='../baseline/index.html';
  const start=Date.now();
  while(Date.now()-start<12000){
    try{if(f.contentWindow.__siteShowView){stripReferenceShell(f,view,panel);return}}catch{}
    await new Promise(r=>setTimeout(r,80));
  }
  throw Error('Frozen reference could not load.');
}
async function showReference(id){$('referenceTitle').textContent=refs[id];const mine=++refToken;try{await referenceFrame('referenceFrame',id);if(mine!==refToken)await referenceFrame('referenceFrame',routeFromHash(location.hash).reference||'overview')}catch(e){$('referenceTitle').textContent=e.message}}
document.querySelectorAll('[data-reference]').forEach(b=>b.addEventListener('click',()=>{location.hash='view=reference&ref='+b.dataset.reference}));
$('graphDetails').addEventListener('toggle',()=>{if($('graphDetails').open)referenceFrame('graphFrame','security-model','ontology').catch(e=>{$('routeNotice').hidden=false;$('routeNotice').textContent=e.message})});
document.querySelectorAll('[data-wm]').forEach(b=>b.addEventListener('click',()=>referenceFrame('graphFrame','security-model',b.dataset.wm).catch(e=>{$('routeNotice').hidden=false;$('routeNotice').textContent=e.message})));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('more').open){$('more').open=false;$('more').querySelector('summary').focus()}});
document.addEventListener('click',e=>{if(!$('more').contains(e.target))$('more').open=false});
applyRoute(false);

renderLearningGate($('learningGateRows'));
