// Scenario Expansion: coverage of one illustrative rule, computed from the shared model.
import { WANT, variantId } from './sx-model.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function mountCoverage(el, model, opts = {}) {
  const tip = opts.tip ?? (() => '');
  const axis = key => model.AXES.find(a => a.key === key);
  const roles = axis('role').values, permissions = axis('permission').values;
  const approvals = axis('approval').values, sensitivities = axis('sensitivity').values;
  const logs = axis('logs');
  const entries = new Map(model.all.map(x => [x.id, x]));
  const outcome = key => model.OUTCOMES.find(o => o.key === key);
  let destroyed = false;

  el.innerHTML = `<section class="sx-coverage card" data-sx="coverage">
    <div class="sx-coverage-head"><h2>Where the rule holds ${tip(esc(model.RULE.id + ': ' + model.RULE.text))}</h2>
      <span class="rt-chip" data-kind="sim">${esc(model.GRADE)}</span></div>
    <fieldset class="sx-coverage-switch" role="radiogroup" aria-label="${esc(logs.label)}"><legend>${esc(logs.label)}</legend>
      ${logs.values.map(v => `<label><input type="radio" name="sx-coverage-logs" value="${esc(v.value)}"> ${esc(v.label)}</label>`).join('')}
    </fieldset>
    <p class="sx-coverage-summary" aria-live="polite"></p>
    <div class="sx-coverage-scroll" tabindex="0" role="region" aria-label="Coverage matrix; scroll to see all columns"><table class="sx-coverage-matrix">
      <caption>Rule outcomes by account role and permission, across approval and data sensitivity</caption>
      <thead><tr><th rowspan="2" scope="col">${esc(axis('role').label)}</th><th rowspan="2" scope="col">${esc(axis('permission').label)}</th>
        ${approvals.map(v => `<th scope="colgroup" colspan="${sensitivities.length}">${esc(v.label)}</th>`).join('')}</tr>
      <tr>${approvals.map(() => sensitivities.map(v => `<th scope="col">${esc(v.label)}</th>`).join('')).join('')}</tr></thead><tbody></tbody>
    </table></div>
    <div class="sx-coverage-legend" aria-label="Outcome legend">
      ${model.OUTCOMES.map(o => `<span data-sx-legend="${esc(o.key)}"><i class="sx-coverage-swatch" data-outcome="${esc(o.key)}" aria-hidden="true"></i>${esc(o.label)} ${tip(esc(o.hint))}</span>`).join('')}
      <span><i class="sx-coverage-swatch sx-coverage-pruned" aria-hidden="true"></i>Ruled out by an ontology constraint ${tip(model.CONSTRAINTS.map(c => esc(c.id + ': ' + c.text)).join('<br>'))}</span>
      <p>Compared with proposed expected outcomes, pending expert review</p>
      <p>Evidence grade: ${esc(model.GRADE)} · Ontology: ${esc(model.ONTOLOGY_VERSION)}</p>
    </div>
    <section class="sx-coverage-findings"><h3>Candidate findings — experts must confirm; must reproduce in a lab</h3>
      <ul>${model.findings.map(f => `<li data-sx-finding="${esc(f.id)}"><div><strong>${esc(outcome(f.kind).label)}</strong><p>${esc(f.text)}</p>
        <small>${f.variants.length} variants · grade: ${esc(f.grade)} · ontology: ${esc(f.ontology)} · review: ${esc(f.review)}</small></div>
        <button class="btn secondary" type="button" data-sx-replay="${esc(f.example)}" aria-label="Replay candidate: ${esc(f.text)}">Replay ▶</button></li>`).join('')}</ul>
    </section></section>`;
  const root = el.querySelector('[data-sx="coverage"]');
  const body = root.querySelector('tbody');
  function setLogs(level) {
    if (destroyed || !logs.values.some(v => v.value === level)) return;
    root.dataset.logs = level;
    for (const input of root.querySelectorAll('input[type="radio"]')) input.checked = input.value === level;
    const valid = model.all.filter(x => x.values.logs === level && !x.violates.length);
    root.querySelector('.sx-coverage-summary').textContent = `${logs.values.find(v => v.value === level).label}: ${valid.length} valid variants · ` +
      model.OUTCOMES.map(o => `${o.label}: ${valid.filter(x => x.outcome === o.key).length}`).join(' · ');
    body.innerHTML = roles.map(role => permissions.map((permission, i) => `<tr>${i === 0 ? `<th scope="rowgroup" rowspan="${permissions.length}">${esc(role.label)}</th>` : ''}<th scope="row">${esc(permission.label)}</th>` +
      approvals.map(approval => sensitivities.map(sensitivity => {
        const values = { role: role.value, permission: permission.value, approval: approval.value, sensitivity: sensitivity.value, logs: level };
        const x = entries.get(variantId(values));
        const names = model.AXES.map(a => `${a.label}: ${a.values.find(v => v.value === values[a.key]).label}`).join('; ');
        if (x.violates.length) {
          const constraints = x.violates.map(id => { const c = model.CONSTRAINTS.find(c => c.id === id); return `${c.id}: ${c.text}`; }).join('; ');
          return `<td class="sx-coverage-pruned" data-sx-cell="${esc(x.id)}" data-violates="${esc(x.violates.join(' '))}" aria-label="${esc(names + '; ruled out by constraints: ' + constraints)}">${esc(x.violates.join(' · '))}</td>`;
        }
        const label = outcome(x.outcome).label;
        return `<td data-outcome="${esc(x.outcome)}"><button type="button" data-sx-cell="${esc(x.id)}" data-outcome="${esc(x.outcome)}" data-sx-replay="${esc(x.id)}" aria-label="${esc(names + '; ' + label + '; proposed: ' + WANT[x.expected.want])}">${esc(label)}</button></td>`;
      }).join('')).join('') + '</tr>').join('')).join('');
  }
  function change(e) { if (e.target.matches('input[type="radio"]')) setLogs(e.target.value); }
  function click(e) {
    const button = e.target.closest('[data-sx-replay]');
    if (button && root.contains(button)) document.dispatchEvent(new CustomEvent('sx:replay', { detail: { id: button.dataset.sxReplay } }));
  }
  root.addEventListener('change', change);
  root.addEventListener('click', click);
  setLogs('complete');
  return { setLogs, destroy() { destroyed = true; root.removeEventListener('change', change); root.removeEventListener('click', click); el.innerHTML = ''; } };
}
