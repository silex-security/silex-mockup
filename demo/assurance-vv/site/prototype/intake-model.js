import {importDocument,checkGraph} from '../baseline/blueprint_studio/js/io.js';
import {STEP_CLASS} from '../baseline/blueprint_studio/web/src/trace/mapping.js';
import {lint} from '../baseline/blueprint_studio/js/validate.js';

const MAX_BYTES=1024*1024;
function graphLimits(graph){
  if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw Error('Expected a graph with nodes and edges.');
  if(graph.nodes.length>80||graph.edges.length>200)throw Error('Preview limit: 80 nodes and 200 edges per revision.');
  if(graph.nodes.some(n=>!n||typeof n.id!=='string'||!n.id.trim())||graph.edges.some(e=>!e||typeof e.id!=='string'||!e.id.trim()))throw Error('Every node and edge needs a non-empty stable ID.');
}
export function parseIntake(text){
  try{
    if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Preview file limit: 1 MB.');
    const raw=JSON.parse(text);
    if(raw?.schema!=='silex.blueprint/v1')throw Error('Expected an exported silex.blueprint/v1 document.');
    if(!Array.isArray(raw.revisions)||!raw.revisions.length||raw.revisions.length>20)throw Error('Expected 1–20 Blueprint revisions.');
    for(const rev of raw.revisions)graphLimits(rev.graph);
    const result=importDocument(text);
    if(!result.ok)throw Error(result.error.message);
    const doc=result.value;
    return {ok:true,source:{name:doc.name,owner:doc.owner,domain:doc.domain,id:doc.id,graph:doc.revisions.find(r=>r.rev===doc.activeRev).graph,provenance:'Local file · active revision '+doc.activeRev}};
  }catch(error){return {ok:false,error:error.message}}
}
export function deriveIntake(source,slice){
  graphLimits(source.graph);
  const check=checkGraph(source.graph,'Preview');if(!check.ok)throw Error(check.error.message);
  const classes=new Map(slice.classes.map(c=>[c.id,c]));
  const nodes=source.graph.nodes.map(n=>{
    const m=STEP_CLASS(n),cls=m.classId?classes.get(m.classId):null;
    return {instanceId:n.id,label:n.label,blueprintType:n.type,ontologyClassId:cls?.id??null,ontologyVersion:slice.version,definition:cls?.def??null,properties:n.config,source:source.provenance,evidenceGrade:'declared',mappingStatus:cls?'mapped':'unmapped',criterion:cls?m.criterion:m.reason||'Class is absent from the pinned bundle.',classProvenance:cls?.src??[],position:{x:n.x,y:n.y}};
  });
  const edges=source.graph.edges.map(e=>({relationId:e.id,predicateId:'bp:'+e.kind,sourceId:e.from.node,targetId:e.to.node,sourcePort:e.from.port,targetPort:e.to.port,domainRange:e.kind==='flow'?'Blueprint out port → in port':'Blueprint agent/tool access port → data access port',properties:Object.fromEntries(Object.entries(e).filter(([k])=>!['id','kind','from','to'].includes(k))),authorityContext:'Not provided',source:source.provenance,evidenceGrade:'declared',mappingStatus:'proposed local schema extension',ontologyVersion:slice.version,note:'This predicate describes Blueprint structure. It is not an existing public-ontology relation and does not establish authorization.'}));
  return {source,nodes,edges,unmapped:nodes.filter(n=>!n.ontologyClassId).length,lint:lint(source.graph),version:slice.version};
}
