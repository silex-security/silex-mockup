import {parseIntake,deriveIntake} from './intake-model.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let model,slice,template,chosen,loadToken=0;
$("intakeFile").disabled=true;$("resetIntake").disabled=true;
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
const svgEl=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e};
function row(label,value){const r=el('div'),dt=el('dt',label),dd=el('dd',typeof value==='string'?value:JSON.stringify(value,null,2));r.append(dt,dd);return r}
function inspect(kind,id){
  chosen={kind,id};
  const data=kind==='node'?model.nodes.find(n=>n.instanceId===id):model.edges.find(e=>e.relationId===id);
  const root=$('entityInspector');root.replaceChildren();
  if(!data){root.textContent='No entity selected. Add declared entities in Studio before validation.';return}
  root.append(el('span',kind==='node'?'ENTITY / DECLARED':'RELATION / DECLARED','eyebrow'),el('h3',kind==='node'?data.label:data.sourceId+' → '+data.targetId));
  const dl=el('dl');
  if(kind==='node'){
    for(const [k,v]of [['Instance ID',data.instanceId],['Blueprint type',data.blueprintType],['Ontology class',data.ontologyClassId||'Unmapped — needs definition'],['Mapping status',data.mappingStatus],['Definition',data.definition||'Not provided'],['Mapping criterion',data.criterion],['Bundle',data.ontologyVersion+' · fe51c44'],['Provenance',data.source],['Class provenance',data.classProvenance],['Properties',data.properties]])dl.append(row(k,v));
  }else{
    for(const [k,v]of [['Relation ID',data.relationId],['Predicate',data.predicateId],['Mapping status',data.mappingStatus],['Direction',data.sourceId+'.'+data.sourcePort+' → '+data.targetId+'.'+data.targetPort],['Domain / range',data.domainRange],['Authority context',data.authorityContext],['Evidence grade',data.evidenceGrade],['Provenance',data.source],['Properties',data.properties]])dl.append(row(k,v));
    root.append(el('p',data.note,'small muted'));
  }
  root.append(dl);
  for(const b of document.querySelectorAll('[data-intake-kind]'))b.setAttribute('aria-pressed',String(b.dataset.intakeKind===kind&&b.dataset.intakeId===id));
}
function wire(e,kind,id){e.dataset.intakeKind=kind;e.dataset.intakeId=id;e.setAttribute('aria-pressed','false');e.addEventListener('click',()=>inspect(kind,id));if(e.namespaceURI===NS)e.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();inspect(kind,id)}})}
function draw(){
  const svg=$('intakeGraph');svg.replaceChildren();
  const xs=model.nodes.map(n=>n.position.x),ys=model.nodes.map(n=>n.position.y);
  const minX=Math.min(0,...xs),minY=Math.min(0,...ys),dx=Math.max(1,Math.max(...xs)-minX),dy=Math.max(1,Math.max(...ys)-minY);
  const positions=new Map(model.nodes.map(n=>[n.instanceId,{x:70+(n.position.x-minX)/dx*860,y:55+(n.position.y-minY)/dy*250}]));
  svg.setAttribute('viewBox','0 0 1070 370');
  const defs=svgEl('defs'),marker=svgEl('marker',{id:'intakeArrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});marker.append(svgEl('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#8faaa0'}));defs.append(marker);svg.append(defs);
  for(const e of model.edges){
    const a=positions.get(e.sourceId),b=positions.get(e.targetId),path=svgEl('path',{d:`M${a.x+52},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x-56},${b.y}`,fill:'none',stroke:'#a0b8aa','stroke-width':4,'marker-end':'url(#intakeArrow)',tabindex:0,role:'button','aria-label':`${e.relationId}: ${e.predicateId}, ${e.sourceId} to ${e.targetId}`});
    if(e.predicateId==='bp:access')path.setAttribute('stroke-dasharray','7 5');wire(path,'edge',e.relationId);svg.append(path);
  }
  for(const n of model.nodes){
    const p=positions.get(n.instanceId),g=svgEl('g',{transform:`translate(${p.x},${p.y})`,tabindex:0,role:'button','aria-label':`${n.label}, ${n.blueprintType}, ${n.mappingStatus}`});
    const rect=svgEl('rect',{x:-58,y:-24,width:116,height:48,rx:6,fill:n.ontologyClassId?'#edf5eb':'#fbf0df',stroke:n.ontologyClassId?'#b0c9b5':'#d7ba87'});
    const title=svgEl('text',{x:0,y:-3,'text-anchor':'middle','font-size':10,fill:'#244535'});title.textContent=n.label.length>19?n.label.slice(0,17)+'…':n.label;
    const sub=svgEl('text',{x:0,y:13,'text-anchor':'middle','font-size':8,fill:'#71846e'});sub.textContent=n.ontologyClassId||n.blueprintType+' · unmapped';
    g.append(rect,title,sub);wire(g,'node',n.instanceId);svg.append(g);
  }
  const list=$('intakeItemList');list.replaceChildren();
  for(const n of model.nodes){const b=el('button',n.label+' · '+(n.ontologyClassId||'unmapped'));wire(b,'node',n.instanceId);list.append(b)}
  for(const e of model.edges){const b=el('button',`${e.relationId}: ${e.sourceId} → ${e.targetId} · ${e.predicateId}`);wire(b,'edge',e.relationId);list.append(b)}
}
function render(source){
  const next=deriveIntake(source,slice);model=next;
  $('intakeName').textContent=source.name;
  $('intakeSource').textContent=source.provenance+' · '+model.nodes.length+' entities / '+model.edges.length+' relations · read-only preview';
  $('intakeChecks').textContent=`Blueprint structure accepted. Ontology mapping needs review: ${model.unmapped} unmapped entities; ${model.edges.length} relations use a proposed local schema. No release approval.`;
  $('intakeLint').textContent=model.lint.length?model.lint.map(x=>x.message||x.code||JSON.stringify(x)).join(' · '):'No Blueprint lint findings. This does not establish ontology completeness or validate business outcomes.';
  draw();inspect('node',model.nodes.find(n=>n.blueprintType==='agent')?.instanceId||model.nodes[0]?.instanceId);
}
async function start(){
  const [t,s]=await Promise.all([fetch('../baseline/blueprint_studio/templates/vendor-bank-change.json'),fetch('../baseline/blueprint_studio/ontology/slice.json')]);
  if(!t.ok||!s.ok)throw Error('Intake source unavailable. No substitute graph is shown.');
  template=await t.json();slice=await s.json();template.provenance='Vendor Bank-Detail Change template · baseline fe51c44';render(template);$('intakeFile').disabled=false;$('resetIntake').disabled=false;
}
$('intakeFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;const token=++loadToken;
  if(file.size>1024*1024){$('intakeError').textContent='Import refused: file exceeds 1 MB. Current preview is unchanged.';e.target.value='';return}
  let text;try{text=await file.text()}catch(error){if(token===loadToken)$('intakeError').textContent='Import refused: file could not be read. Current preview is unchanged.';return}
  if(token!==loadToken)return;
  const res=parseIntake(text);
  if(!res.ok)$('intakeError').textContent='Import refused: '+res.error+' Current preview is unchanged.';
  else try{render(res.source);$('intakeError').textContent='Imported into memory only. To run this document, use Studio → File → Import with the same file. The preview and Studio are not automatically connected.'}catch(error){$('intakeError').textContent='Import refused: '+error.message+' Current preview is unchanged.'}
  e.target.value='';
});
$('resetIntake').addEventListener('click',()=>{if(template){++loadToken;render(template);$('intakeError').textContent='Template preview restored. Studio documents are unchanged.'}});
start().catch(e=>{$('intakeError').textContent=e.message});
