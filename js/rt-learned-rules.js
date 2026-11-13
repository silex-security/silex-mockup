const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const FACT_LABELS = {
  invoice_paid_to_date_usd: 'money already paid on the invoice',
  amount_usd: 'this payment',
  invoice_amount_usd: 'the invoice amount',
};
const OP_SYMBOLS = { gt: '>', ge: '≥', lt: '<', le: '≤', eq: '=', ne: '≠' };
const CRITERIA = [
  'The rule is well-formed and names the failure it targets.',
  'Each part of the test set has at least 1 violation and 3 normal payments.',
  'It catches every violation in the held-back set.',
  'It flags no normal payment.',
  'It catches every known violation.',
];

function term(t) {
  if ('fact' in t) return FACT_LABELS[t.fact] ?? t.fact;
  if ('add' in t) return t.add.map(term).join(' + ');
  return String(t.const);
}

export function conditionText(c) {
  if ('all' in c) return c.all.map(conditionText).join(' and ');
  if ('any' in c) return c.any.map(conditionText).join(' or ');
  return `${term(c.left)} ${OP_SYMBOLS[c.op] ?? c.op} ${term(c.right)}`;
}

export function evidenceText({ dev, holdout }) {
  return `Caught ${dev.caught} of ${dev.violations} known violations, flagged ${dev.false_flags} of ${dev.benign} normal payments. On the held-back set: ${holdout.caught} of ${holdout.violations}, ${holdout.false_flags} of ${holdout.benign}.`;
}

export function criteriaText(n) {
  return CRITERIA[n - 1] ?? '';
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const evidenceKey = r => canonical([r.dev, r.holdout, r.failed_criteria]);
const failing = data => data.rules.filter(r => r.report.verdict === 'FAIL');

export function ruleForms(data) {
  const forms = new Map();
  for (const { ordinal, condition, verdict_on_match, report } of [...data.rules].sort((a, b) => a.ordinal - b.ordinal)) {
    const key = canonical(condition), form = forms.get(key);
    if (form) form.count += 1;
    else forms.set(key, { condition, count: 1, first: ordinal, verdict: report.verdict, verdict_on_match, dev: report.dev, holdout: report.holdout, failed_criteria: report.failed_criteria });
  }
  const rank = f => (f.verdict === 'PASS' ? 0 : 1);
  return [...forms.values()].sort((a, b) => rank(a) - rank(b) || b.count - a.count || a.first - b.first);
}

function largestSameWay(rules) {
  const sizes = new Map();
  for (const { report } of rules) sizes.set(evidenceKey(report), (sizes.get(evidenceKey(report)) ?? 0) + 1);
  return [...sizes].reduce((best, [key, size]) => (size > best.size ? { key, size } : best), { key: null, size: 0 });
}

export function summary(data) {
  const failed = failing(data).length;
  return {
    sessions: data.sessions.total,
    candidates: data.rules.length,
    passed: data.rules.filter(r => r.report.verdict === 'PASS').length,
    failed,
    forms: ruleForms(data).length,
    sameWayFailed: largestSameWay(failing(data)).size,
    testItems: data.gate.corpus.dev + data.gate.corpus.holdout,
  };
}

export function failExample(data) {
  const { key } = largestSameWay(failing(data));
  return ruleForms(data).find(f => f.verdict === 'FAIL' && evidenceKey(f) === key);
}

export function passExample(data) {
  return ruleForms(data).find(f => f.verdict === 'PASS');
}

export function mountLearnedRules(el, data) {
  if (!el || !Array.isArray(data?.rules)) return;
  const s = summary(data);
  const forms = ruleForms(data);
  const pass = passExample(data);
  const fail = failExample(data);
  const suffix = form => ` → ${form.verdict_on_match.toLowerCase()}`;
  const n = key => `<b data-rt-rules-n="${esc(key)}">${esc(s[key])}</b>`;
  const pair = part => `${part.caught} of ${part.violations}`;
  const flags = part => `${part.false_flags} of ${part.benign}`;

  const rows = forms.map(f => `<tr data-rt-rules-form>
          <td>${esc(conditionText(f.condition))}${esc(suffix(f))}</td>
          <td>${esc(f.count)}</td>
          <td>${esc(pair(f.dev))}</td>
          <td>${esc(flags(f.dev))}</td>
          <td>${esc(pair(f.holdout))}</td>
          <td>${esc(flags(f.holdout))}</td>
          <td>${f.verdict === 'PASS' ? 'Passes' : 'Fails'}</td>
          <td>${esc(f.failed_criteria.join(', ') || 'none')}</td>
        </tr>`).join('');

  const passCard = pass ? `<p class="rt-rules-condition" data-rt-rules-condition>${esc(conditionText(pass.condition))}${esc(suffix(pass))}</p>
          <p data-rt-rules-evidence>${esc(evidenceText(pass))}</p>` : '';
  const failCard = fail ? `<p class="rt-rules-condition" data-rt-rules-condition>${esc(conditionText(fail.condition))}${esc(suffix(fail))}</p>
          <p data-rt-rules-evidence>${esc(evidenceText(fail))}</p>` : '';

  el.innerHTML = `<div class="rt-rules">
      <div class="rt-rules-top">
        <p class="rt-rules-headline" data-rt-rules-headline>${n('sessions')} model sessions; ${n('candidates')} ended with a rule that passed a first gate. After harder test cases were added, the gate passes ${n('passed')} and fails ${n('failed')}.</p>
        <span class="rt-chip" data-kind="ran">Measured · offline run</span>
      </div>
      <p class="rt-ref" data-rt-rules-note>Offline experiment on a synthetic ${esc(s.testItems)}-item test set. An earlier gate passed all ${esc(s.candidates)}. After probes found some of them wrong, harder test cases were added; those cases fail the ${esc(s.failed)}. No proposed rule was put into a live policy. The test set was written by the same author as the reference rule.</p>
      <div class="rt-rules-cards">
        <article class="card rt-rules-card" data-rt-rules-card="pass">
          <h3>Passes the gate</h3>
          ${passCard}
        </article>
        <article class="card rt-rules-card" data-rt-rules-card="fail">
          <h3>Fails the gate</h3>
          <p data-rt-rules-same>${esc(s.sameWayFailed)} of the ${esc(s.failed)} failing rules fail the same way.</p>
          ${failCard}
          <p class="rt-ref">It stops a payment only after the invoice is already paid in full, so it misses a payment that goes over the amount.</p>
        </article>
      </div>
      <details class="rt-more" data-rt-rules-all><summary>All ${esc(s.forms)} conditions and the gate's criteria</summary><div>
        <table class="dt"><thead><tr><th>Condition, as written</th><th>Times written</th><th>Known violations caught</th><th>Normal payments flagged</th><th>Held-back caught</th><th>Held-back flagged</th><th>Gate</th><th>Criteria failed</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <ol data-rt-rules-criteria>${[1, 2, 3, 4, 5].map(i => `<li>${esc(criteriaText(i))}</li>`).join('')}</ol>
        <p class="rt-ref">These are recorded results. The test cases are not in this page, so the browser cannot re-run the gate. One kind of shortcut rule is known to still pass this gate and is left for later work.</p>
      </div></details>
    </div>`;
}
