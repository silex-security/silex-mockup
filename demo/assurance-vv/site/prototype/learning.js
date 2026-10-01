// Presentation only: gate verdicts and counts come from the upstream generated benchmark artifact.
export function measuredGateRows(evidence){
  return ['kev-0.8b-ft','kev-4b-ft'].map(id=>{
    const g=evidence?.gate?.[id],model=evidence?.models?.[id];
    if(!g||!model?.label||!['KEEP','NEAR-MISS','DISCARD'].includes(g.verdict)||typeof g.safetyOk!=='boolean'||typeof g.evidenceOk!=='boolean'||![g.fixed,g.broke,g.missed?.before,g.missed?.after,g.falseHolds?.before,g.falseHolds?.after].every(n=>Number.isInteger(n)&&n>=0))throw Error('Invalid benchmark gate evidence');
    const detail=g.safetyOk
      ? `Fixed ${g.fixed} · Broke ${g.broke} · ${g.evidenceOk?'evidence check passed':'needs more evidence'}`
      : g.missed.after>g.missed.before
        ? `Safety check failed: more missed cases (${g.missed.before} → ${g.missed.after})`
        : `Safety check failed: more false alarms (${g.falseHolds.before} → ${g.falseHolds.after})`;
    return {id,label:model.label,verdict:g.verdict,detail};
  });
}
export async function renderLearningGate(root){
  try{
    const response=await fetch('../baseline/jev-runtime/demo/data/learning-evidence.json');
    if(!response.ok)throw Error('Evidence unavailable');
    const rows=measuredGateRows(await response.json());
    const fragment=document.createDocumentFragment();
    for(const row of rows){
      const p=document.createElement('p');p.className='learning-gate-row';p.dataset.evidenceGate=row.id;
      const label=document.createElement('strong');label.textContent=row.label;
      const verdict=document.createElement('span');verdict.className='gate-verdict';verdict.dataset.verdict=row.verdict;verdict.textContent=row.verdict;
      const detail=document.createElement('span');detail.textContent=row.detail;
      p.append(label,verdict,detail);fragment.append(p);
    }
    root.replaceChildren(fragment);
  }catch{root.textContent='Measured benchmark evidence could not be loaded. No gate verdict is shown.'}
}
