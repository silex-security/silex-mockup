import {readSummary, docStatus} from '../baseline/js/studio-bridge.js';
import {checkOpen} from '../baseline/blueprint_studio/web/src/embed.js';

export function currentTrace(storage) {
  try {
    if (!storage) return {ok:false, reason:'Storage unavailable. Open Studio to work in its temporary workspace.'};
    const id=storage.getItem('bs.current');
    if (!id) return {ok:false, reason:'Run a blueprint check first. No current evidence is available.'};
    const res=readSummary(storage);
    if (!res.ok) return {ok:false, reason:'Current evidence is unavailable. Open Studio and run a check.'};
    if (docStatus(res.summary,storage).get(id)!=='fresh') return {ok:false, reason:'The workspace changed. Open Studio to refresh or rerun its evidence.'};
    const raw=storage.getItem('bs.doc.'+id), doc=JSON.parse(raw);
    const d=res.summary.docs.find(x=>x.docId===id), rev=d?.revs.find(x=>x.rev===doc.activeRev);
    if (!rev?.hash || !rev.validation) return {ok:false, reason:'This revision has no validation evidence. Confirm and validate it in Studio first.'};
    const target={cmd:'open',doc:id,rev:rev.rev,hash:rev.hash,view:'trace'};
    if (!checkOpen(storage,target).ok) return {ok:false,reason:'The saved revision could not be verified. Open Studio to inspect it.'};
    return {ok:true,target,name:d.name,rev:rev.label,findings:rev.validation.findings.length,runs:rev.validation.runs};
  } catch {return {ok:false,reason:'The saved workspace could not be read. No substitute results are shown.'};}
}

export function routeFromHash(hash) {
  const raw=hash.replace(/^#/,'');
  if(raw==='studio'||raw==='studio=new') return {view:'blueprint',notice:raw==='studio=new'?'Open File → Browse templates to create a new copy. Existing documents are preserved.':''};
  const q=new URLSearchParams(raw), v=q.get('view')||'assurance';
  if(v==='long-term'&&q.get('tab')==='runtime')return {view:'runtime-observation',legacy:true};
  if(['assurance','blueprint','short-term','runtime-observation','security-model','reference'].includes(v))return {view:v,reference:q.get('ref')};
  return {view:'assurance',notice:'That link is not available in this focused prototype. Choose an entry below.'};
}
