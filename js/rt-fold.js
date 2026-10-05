// Runtime Observation: the scenario, learning and ontology cards start collapsed; their title block toggles the body.
function setOpen(card, open) {
  card.dataset.fold = open ? 'open' : 'collapsed';
  card.querySelector('.rt-fold-toggle')?.setAttribute('aria-expanded', String(open));
}
for (const card of document.querySelectorAll('.rt-fold')) {
  const t = card.querySelector('.rt-fold-toggle');
  t.addEventListener('click', () => setOpen(card, card.dataset.fold === 'collapsed'));
  t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } });
}
// A link or script that targets something inside a collapsed card (e.g. #rtSeeRun) opens it first.
document.addEventListener('focusin', e => { const c = e.target.closest?.('.rt-fold[data-fold="collapsed"]'); if (c) setOpen(c, true); });
window.__rtFold = { open: id => { const c = document.getElementById(id); if (c) setOpen(c, true); } };
