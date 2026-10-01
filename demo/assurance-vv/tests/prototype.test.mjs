import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentTrace,routeFromHash} from '../site/prototype/state.js';
const fixture=JSON.parse(await readFile(new URL('../site/baseline/tests/site/fixtures/storage.sample.json',import.meta.url),'utf8'));
function storage(seed){const m=new Map(Object.entries(seed));return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
test('trace targets only the current validated revision',()=>{const st=storage({...fixture,'bs.current':'bp-fixture-awaiting'}),r=currentTrace(st);assert.equal(r.ok,true);assert.equal(r.target.doc,'bp-fixture-awaiting');assert.equal(r.target.view,'trace');assert.ok(r.runs>0)});
test('stale, missing and unavailable evidence never exposes a target',()=>{assert.equal(currentTrace(null).ok,false);const st=storage({...fixture,'bs.current':'bp-fixture-awaiting'});st.setItem('bs.doc.bp-fixture-awaiting',st.getItem('bs.doc.bp-fixture-awaiting')+' ');assert.equal(currentTrace(st).ok,false);st.removeItem('bs.doc.bp-fixture-awaiting');assert.equal(currentTrace(st).ok,false)});
test('malformed storage and arbitrary routes fail to a visible safe fallback',()=>{const st=storage({'bs.current':'x','bs.doc.x':'oops','bs.summary.v1':'oops'});assert.equal(currentTrace(st).ok,false);assert.equal(routeFromHash('#view=arbitrary').view,'assurance');assert.ok(routeFromHash('#view=arbitrary').notice)});
test('runtime and Studio legacy aliases remain available without creating a document',()=>{assert.deepEqual(routeFromHash('#view=long-term&tab=runtime'),{view:'runtime-observation',legacy:true});assert.equal(routeFromHash('#studio=new').view,'blueprint');assert.match(routeFromHash('#studio=new').notice,/preserved/)});

import {parseIntake,deriveIntake} from '../site/prototype/intake-model.js';
import {newDocument} from '../site/baseline/blueprint_studio/js/store.js';
const template=JSON.parse(await readFile(new URL('../site/baseline/blueprint_studio/templates/vendor-bank-change.json',import.meta.url),'utf8'));
const slice=JSON.parse(await readFile(new URL('../site/baseline/blueprint_studio/ontology/slice.json',import.meta.url),'utf8'));
const fresh=()=>newDocument(structuredClone(template));
test('Intake preserves every source entity/relation, never invents ontology or authority',()=>{
 const doc=fresh(),raw=JSON.stringify(doc),res=parseIntake(raw);assert.ok(res.ok,res.error);
 const m=deriveIntake(res.source,slice);assert.equal(m.nodes.length,template.graph.nodes.length);assert.equal(m.edges.length,template.graph.edges.length);assert.ok(m.unmapped>0);
 for(const n of m.nodes)assert.ok(n.ontologyClassId===null||slice.classes.some(c=>c.id===n.ontologyClassId));
 for(const e of m.edges){const original=template.graph.edges.find(x=>x.id===e.relationId);assert.equal(e.sourceId,original.from.node);assert.equal(e.targetId,original.to.node);assert.equal(e.authorityContext,'Not provided');assert.equal(e.mappingStatus,'proposed local schema extension')}
 assert.equal(JSON.stringify(doc),raw);
});
test('Intake rejects corrupted shape, duplicate IDs, missing nodes/ports and unknown types atomically',()=>{
 assert.equal(parseIntake('{').ok,false);
 for(const mutate of [d=>delete d.schema,d=>d.schema='unknown',d=>d.revisions[0].graph.nodes.push(d.revisions[0].graph.nodes[0]),d=>d.revisions[0].graph.edges.push(d.revisions[0].graph.edges[0]),d=>d.revisions[0].graph.edges[0].to.node='absent',d=>d.revisions[0].graph.edges[0].to.port='absent',d=>d.revisions[0].graph.nodes[0].type='unrecognized',d=>d.revisions[0].graph.nodes[0].config={}]){
  const doc=fresh();mutate(doc);const res=parseIntake(JSON.stringify(doc));assert.equal(res.ok,false);assert.equal(res.source,undefined);
 }
});
test('Intake caps file and graph size before processing',()=>{
 assert.equal(parseIntake(' '.repeat(1024*1024+1)).ok,false);
 const doc=fresh();doc.revisions[0].graph.nodes=Array.from({length:81},(_,i)=>({...doc.revisions[0].graph.nodes[0],id:'n'+i}));assert.equal(parseIntake(JSON.stringify(doc)).ok,false);
});

import {measuredGateRows} from '../site/prototype/learning.js';
const measured=JSON.parse(await readFile(new URL('../site/baseline/jev-runtime/demo/data/learning-evidence.json',import.meta.url),'utf8'));
test('Measured gate presentation preserves both benchmark outcomes and safety regression',()=>{
 const rows=measuredGateRows(measured);assert.deepEqual(rows.map(r=>r.verdict),['KEEP','DISCARD']);
 assert.match(rows[0].detail,/Fixed 17 · Broke 2/);assert.match(rows[1].detail,/more missed cases \(25 → 27\)/);
 const changed=structuredClone(measured);changed.gate['kev-0.8b-ft'].fixed=19;assert.match(measuredGateRows(changed)[0].detail,/Fixed 19/);
 assert.throws(()=>measuredGateRows({}));delete changed.gate['kev-4b-ft'];assert.throws(()=>measuredGateRows(changed));
});

import {createLearningSession} from '../site/baseline/jev-runtime/demo/js/learning/session.js';
import {DEFAULT_POLICY} from '../site/baseline/jev-runtime/demo/js/engine/types.js';
for(const domain of ['ap','soc'])test(`Synced ${domain} lineage promotes only KEEP and resets to v1`,()=>{
 const session=createLearningSession(domain,()=>DEFAULT_POLICY,7);session.startScript();
 const expected=['NEAR-MISS','KEEP','DISCARD'];
 for(let round=1;round<=3;round++){
  session.scriptRound(round);const s=session.state();assert.equal(s.history.at(-1).gate.verdict,expected[round-1]);assert.equal(s.champion.id,round===1?'v1':'v2');
 }
 const s=session.state();assert.equal(s.history[2].championBefore,'v2');assert.equal(s.history[2].gate.safetyOk,false);
 session.reset();assert.equal(session.state().history.length,0);assert.equal(session.state().champion.id,'v1');
});
