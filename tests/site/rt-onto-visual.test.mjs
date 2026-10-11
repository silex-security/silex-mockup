import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mountOntoHow, mountOntoS1, VERDICT } from '../../js/rt-onto-visual.js';
import { browser, until } from './ontology-card/browser.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const data=JSON.parse(await readFile(join(ROOT,'data/onto-observability.json'),'utf8'));
const s1=JSON.parse(await readFile(join(ROOT,'data/onto-s1.json'),'utf8'));
test('ontology pictures import and provide complete null-mount handles without DOM',()=>{
  assert.equal(VERDICT.supported[0],'ran');
  for(const mount of [mountOntoHow,mountOntoS1])for(const fn of ['play','pause','reset','destroy']) assert.doesNotThrow(()=>mount(null,{})[fn]());
});
test('ontology pictures match data, lifecycle, reduced motion and mobile', {timeout:120000},async t=>{
  let session;
  try{session=await browser();}catch(e){if(/Chrome not found/.test(e.message))return t.skip('no Chrome binary (set CHROME)');throw e;}
  const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
  const server=createServer(async(req,res)=>{try{
    let file=resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(file!==ROOT&&!file.startsWith(ROOT+sep)){res.writeHead(403).end();return;}
    if((await stat(file)).isDirectory())file=join(file,'index.html');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
  }catch{res.writeHead(404).end();}});
  try{
    await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
    const p=session.page;
    let navigation=0;
    const navigate=async sub=>{
      await p.ev('window.__ontoTestOld=true');
      await p.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/index.html?ontoVisual=${++navigation}#view=runtime-observation&tab=ontology&sub=${sub}`});
      await until(()=>p.ev(`return !window.__ontoTestOld && !!window.__rtSubnav?.ontology && !!document.querySelector('.rt-ov-s1')`),'ontology ready');
    };
    await p.send('Emulation.setDeviceMetricsOverride',{width:1400,height:1100,deviceScaleFactor:1,mobile:false});
    await navigate('how');
    // Leave both panels before their first 650 ms beat; subnav must settle them.
    const interrupted=await p.ev(`
      const how=document.querySelector('.rt-ov-how'), s1=document.querySelector('.rt-ov-s1');
      const startingBeat=how.dataset.beat;
      const started=performance.now();
      window.__rtSubnav.ontology.open('s1');
      const s1StartingBeat=s1.dataset.beat;
      window.__rtSubnav.ontology.open('ex');
      const elapsed=performance.now()-started;
      window.__rtSubnav.ontology.open('how');
      const decisions=[...how.querySelectorAll('.rt-ov-decision')].map(e=>{
        const r=e.getBoundingClientRect();return getComputedStyle(e).visibility==='visible'&&r.width>0&&r.height>0;
      });
      window.__rtSubnav.ontology.open('s1');
      const realFill=getComputedStyle(s1.querySelector('[data-rt-ov-alert] .rt-ov-real')).fill;
      const waffles=[...s1.querySelectorAll('[data-rt-ov-waffle]')].map(e=>({
        key:e.dataset.rtOvWaffle,
        lit:[...e.querySelectorAll('.rt-ov-lit')].filter(r=>getComputedStyle(r).fill===realFill).length
      }));
      const bars=[...s1.querySelectorAll('.rt-ov-grow')].map(e=>{
        const transform=getComputedStyle(e).transform;
        const scale=transform==='none'?1:new DOMMatrixReadOnly(transform).a;
        const svg=e.closest('svg');
        const expected=e.getBBox().width*Math.abs(svg.getScreenCTM().a);
        return {scale,expected,actual:e.getBoundingClientRect().width};
      });
      const neutral=getComputedStyle(s1.querySelector('.rt-ov-track')).fill!==getComputedStyle(s1.querySelector('.rt-ov-false')).fill;
      const states=[how.dataset.state,s1.dataset.state];
      s1.querySelector('[data-rt-ov-control="play"]').click();
      const restarted=s1.dataset.state==='playing'&&s1.dataset.beat==='0';
      s1.querySelector('[data-rt-ov-control="pause"]').click();
      const buttonPaused=s1.dataset.state==='paused';
      window.__rtSubnav.ontology.open('how');
      return {startingBeat,s1StartingBeat,elapsed,states,decisions,waffles,bars,neutral,restarted,buttonPaused};
    `);
    assert.equal(interrupted.startingBeat,'0','how was interrupted before its first beat');
    assert.equal(interrupted.s1StartingBeat,'0','s1 was interrupted before its first beat');
    assert.ok(interrupted.elapsed<650,'rapid navigation takes less than one beat');
    assert.deepEqual(interrupted.states,['done','done']);
    assert.ok(interrupted.decisions.length>0&&interrupted.decisions.every(Boolean),'every how decision is visible on return');
    for(const waffle of interrupted.waffles)assert.equal(waffle.lit,Math.round(100*s1.observed[waffle.key].precision),'lit cells have their actual final fill');
    assert.ok(interrupted.bars.length>0&&interrupted.bars.every(b=>b.scale===1&&Math.abs(b.actual-b.expected)<.1),'every alert and recall bar renders its full data width: '+JSON.stringify(interrupted.bars));
    assert.equal(interrupted.neutral,true,'recall track differs from false-alarm encoding');
    assert.equal(interrupted.restarted,true,'Play restarts a completed picture');
    assert.equal(interrupted.buttonPaused,true,'on-screen Pause can freeze an animation');
    await until(()=>p.ev(`return document.querySelector('.rt-ov-how').dataset.state==='done'`),'how completed');
    for(const cell of ['both','saved','lost']){
      await p.ev(`document.querySelector('[data-rt-ov-example="${cell}"]').click()`);
      await until(()=>p.ev(`return document.querySelector('.rt-ov-how').dataset.state==='done'`),`${cell} completed`);
      const ex=data.examples.find(x=>x.cell===cell);
      const actual=await p.ev(`return [...document.querySelectorAll('[data-rt-ov-rule]')].map(col=>({mode:col.dataset.rtOvRule, flagged:[...col.querySelectorAll('[data-rt-ov-flagged="true"]')].map(x=>Number(x.dataset.rtOvCall)),why:[...col.querySelectorAll('.rt-ov-why')].map(x=>x.textContent), effects:[...col.querySelectorAll('[data-rt-ov-effect]')].map(x=>x.textContent),classes:[...col.querySelectorAll('[data-rt-ov-class]')].map(x=>x.textContent)}));`);
      for(const col of actual){
        const x=ex[col.mode];
        assert.deepEqual(col.flagged,x.call_index==null?[]:[x.call_index]);
        assert.deepEqual(col.why,ex.run.calls.filter(c=>c.index!==x.call_index).map(c=>ex.why_not[col.mode][c.index]));
        assert.deepEqual(col.effects,col.mode==='otp'&&x.explanation?[`may cause → ${x.explanation.effects.join(', ')}`]:[]);
        assert.deepEqual(col.classes,col.mode==='otp'&&x.explanation?[`argument denotes → ${x.explanation.class}`]:[]);
      }
    }
    await p.ev(`document.querySelector('[data-rt-ov-example="both"]').click();document.querySelector('[data-onto-how-lost]').click()`);
    assert.equal(await p.ev(`return document.querySelector('.rt-ov-how').dataset.example`),'lost');
    await p.ev(`window.__rtSubnav.ontology.open('s1')`);
    assert.notEqual(await p.ev(`return document.querySelector('.rt-ov-how').dataset.state`),'playing');
    await until(()=>p.ev(`return document.querySelector('.rt-ov-s1').dataset.state==='done'`),'S1 completed');
    const measured=await p.ev(`return {bars:[...document.querySelectorAll('[data-rt-ov-alert]')].map(e=>({key:e.dataset.rtOvAlert,F:Number(e.dataset.total),TP:Number(e.dataset.tp),widths:[...e.querySelectorAll('rect')].map(r=>Number(r.getAttribute('width')))})),waffles:[...document.querySelectorAll('[data-rt-ov-waffle]')].map(e=>({key:e.dataset.rtOvWaffle,total:e.querySelectorAll('rect').length,lit:e.querySelectorAll('.rt-ov-lit').length})),parts:[...document.querySelectorAll('[data-onto-s1-part]')].map(e=>[e.dataset.ontoS1Part,e.dataset.ontoS1PartOk,e.querySelector('.rt-chip').textContent])};`);
    for(const bar of measured.bars){const x=s1.observed[bar.key];assert.equal(bar.F,x.F);assert.equal(bar.TP,x.TP);assert.ok(Math.abs(bar.widths.reduce((a,b)=>a+b)-600*x.F/Math.max(s1.observed.prov.F,s1.observed.s1.F))<1e-8);}
    for(const waffle of measured.waffles){assert.equal(waffle.total,100);assert.equal(waffle.lit,Math.round(100*s1.observed[waffle.key].precision));}
    assert.deepEqual(measured.parts,['a','b','c'].map(k=>{const ok=k==='b'?s1.constraint.holds:s1.p[k]<=.05;return[k,String(ok),ok?'held':'not established'];}));
    // Reduced motion reloads render finished pictures without autoplay, including replay.
    await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    for(const sub of ['how','s1'])for(const width of [1400,390]){
      await p.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      await navigate(sub);
      const result=await p.ev(`const root=document.querySelector('.rt-ov-${sub}'); const visible=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.closest('details:not([open]),.rt-tip-body')};return {state:root.dataset.state,overflow:document.documentElement.scrollWidth>innerWidth,visible:${sub==='how'?"visible('[data-onto-how-claim]')&&visible('[data-onto-how-lost]')":"visible('[data-onto-s1-observed]')&&visible('[data-onto-s1-scope]')"},svg:[...root.querySelectorAll('svg')].every(e=>e.getAttribute('role')==='img'&&!!e.getAttribute('aria-label'))};`);
      assert.deepEqual(result,{state:'done',overflow:false,visible:true,svg:true});
      await p.ev(`document.querySelector('.rt-ov-${sub} [data-rt-ov-control="replay"]').click();window.scrollTo({top:0,behavior:'instant'})`);
      assert.equal(await p.ev(`return document.querySelector('.rt-ov-${sub}').dataset.state`),'done');
      const shot=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      const path=join(tmpdir(),`sol-taskT2-a1-${sub}-${width}.png`);await writeFile(path,Buffer.from(shot.data,'base64'));console.log('screenshot: '+path);
    }
    // A standalone mount stays idle; destroy removes its callbacks and cancels motion.
    assert.deepEqual(await p.ev(`const {mountOntoHow}=await import('./js/rt-onto-visual.js');const data=await (await fetch('data/onto-observability.json')).json();const el=document.createElement('div');document.body.append(el);const h=mountOntoHow(el,data);const initial=el.dataset.state;h.play();h.pause();const paused=el.dataset.state;h.reset();const reset=el.dataset.state;h.destroy();el.remove();return [initial,paused,reset];`),['idle','done','idle']);
    assert.deepEqual(p.errors.filter(e=>!/favicon|fonts\.g|ERR_CERT|net::ERR_(INTERNET|NAME)/i.test(String(e))),[],'no page errors');
  }finally{session.close();await new Promise(r=>server.close(r));}
});
