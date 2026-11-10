// N1 experiment workbench in headless Chrome (plan 4, 7.2, 13.2 path B and C). Drives the real page through
// tools/gym-shot.mjs and asserts on visible text and on window.__gym.store. Skips cleanly without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const WB = '#/workbench/exp-029';
const P = `
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const txt = el => {
    if (!el) return '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), parts = [];
    while (w.nextNode()) parts.push(w.currentNode.nodeValue);
    return parts.join(' ').replace(/\\s+/g, ' ').replace(/ ([,.])/g, '$1').trim();
  };
  const find = (sel, t) => $$(sel).find(e => txt(e) === t) ?? $$(sel).find(e => txt(e).includes(t));
  const click = (sel, t) => { const el = t == null ? $(sel) : find(sel, t); if (!el) throw Error('no ' + sel + ' ' + (t ?? '')); el.click(); return el; };
  const S = () => window.__gym.store.getState(), E = () => S().experiments['exp-029'], Q = () => window.__gym.router.current().query;
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const node = id => $('.wb-node[data-node="' + id + '"]');
`;

async function withGym(t, fn, { width = 1585, height = 992 } = {}) {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(width, height);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await gym.go(WB);
    const page = code => gym.ev(P + code);
    await fn(gym, page);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}

test('N1 renders from the store: three columns, the draft, the blueprint, scenarios and the queue', async t => withGym(t, async (gym, page) => {
  const v = await page(`
    const cols = $$('.wb-cols > *').map(c => c.getBoundingClientRect().width);
    const total = cols.reduce((a, b) => a + b, 0);
    return {
      h1: txt($('.gym-main h1')), sub: txt($('.gym-pagehead__subtitle')), runs: $('.wb-head a').getAttribute('href'),
      share: cols.map(w => Math.round(w / total * 100)),
      envs: $$('.wb-env').map(e => txt(e.querySelector('.wb-env__name'))), selected: txt($('.wb-env.is-selected .wb-env__name')),
      chips: $$('.wb-env.is-selected .wb-capchip').map(txt), notes: txt($('.wb-env.is-selected .wb-env__notes')),
      title: $('.wb-title__input').value, draft: txt($('.wb-exp__head .gym-badge')), rev: txt($('.wb-revnote')),
      workflow: txt($('.wb-workflow__name')), source: txt($('.wb-workflow__source')),
      pressed: $$('.wb-versions__group .gym-btn').map(b => [txt(b), b.getAttribute('aria-pressed')]),
      nodes: $$('.wb-node').map(n => txt(n.querySelector('.wb-node__label'))),
      changed: $$('.wb-node.is-changed').map(n => n.dataset.node), fault: txt(node('send-email').querySelector('.wb-node__tag')),
      selectedNode: $$('.wb-node[aria-pressed="true"]').map(n => n.dataset.node),
      strip: txt($('.wb-strip__text')), envCard: txt($('[data-summary="environment"]')), setCard: txt($('[data-summary="scenario-set"]')),
      dep: txt($('.wb-dep')), formula: txt($('.wb-formula')).replace(/\\..*$/, ''), sandbox: txt($('.wb-sandbox')),
      runDisabled: $('.wb-run__go').getAttribute('aria-disabled'),
      selCount: txt($('.wb-selbar__count')), scenarios: $$('.wb-scenario__title').map(txt), checked: $$('.wb-scenario input:checked').length,
      opened: txt($('.wb-scenario.is-open .wb-scenario__body')),
      counts: $$('.wb-qcount').map(txt), rows: $$('.wb-qrow').map(r => [...r.cells].map(txt)),
      progress: $('.wb-qrow .gym-progress__track').getAttribute('aria-valuenow') + '/' + $('.wb-qrow .gym-progress__track').getAttribute('aria-valuemax'),
      replay: $('[data-tab="replay"]').getAttribute('aria-disabled'),
    };`);
  assert.equal(v.h1, 'Experiment Workbench');
  assert.equal(v.sub, 'Assemble an experiment. Test what changes.');
  assert.equal(v.runs, '#/runs?status=all');
  assert.ok(Math.abs(v.share[0] - 24) <= 2 && Math.abs(v.share[1] - 51) <= 2 && Math.abs(v.share[2] - 24) <= 2, `columns ${v.share}`);
  assert.deepEqual(v.envs, ['Sales operations', 'Customer support', 'IT operations']);
  assert.equal(v.selected, 'Sales operations');
  assert.deepEqual(v.chips, ['CRM', 'Email', 'Calendar']);
  assert.equal(v.notes, 'Shared contacts · Permissions · Tool behavior');
  assert.deepEqual([v.title, v.draft], ['Experiment 029', 'Draft']);
  assert.equal(v.rev, 'rev 3 · attempt 1 is running in the queue', 'the queue runs the previous frozen revision');
  assert.deepEqual([v.workflow, v.source], ['Sales follow-up', 'From Speedrun · fixture']);
  assert.deepEqual(v.pressed, [['Baseline', 'false'], ['Variant A', 'true']], 'the version being viewed is visibly selected');
  assert.deepEqual(v.nodes, ['Find opportunity', 'Draft email', 'Contact allowed?', 'Send email', 'Update CRM', 'Log skipped contact']);
  assert.deepEqual(v.changed, ['draft-email']);
  assert.equal(v.fault, 'Timeout injection');
  assert.deepEqual(v.selectedNode, ['draft-email']);
  assert.equal(v.strip, 'Draft email · Variant A Change: model configuration');
  assert.equal(v.envCard, 'Environment Sales operations v1.2 CRM · Email · Calendar Change');
  assert.equal(v.setCard, 'Scenario set Follow-up resilience 3 scenarios Manage');
  assert.equal(v.dep, 'Dependencies matched');
  assert.equal(v.formula, '2 versions × 3 scenarios × 3 repetitions = 18 runs');
  assert.equal(v.sandbox, 'Each run starts in an isolated sandbox Simulated sandbox · isolated in-memory state');
  assert.equal(v.runDisabled, null);
  assert.deepEqual([v.selCount, v.checked], ['3 selected', 3]);
  assert.deepEqual(v.scenarios, ['Base case', 'Timeout after send', 'Contact opted out']);
  assert.equal(v.opened, 'Initial state: opted out Expected: skip email; log reason');
  assert.deepEqual(v.counts, ['1 running', '1 queued', '1 completed']);
  assert.deepEqual(v.rows, [
    ['Sales follow-up · Variant A, rev 3 · attempt 1', 'Sales operations', '3', 'Running', '12/18'],
    ['Support triage comparison, rev 1 · attempt 1', 'Customer support', '8', 'Queued', '–'],
    ['Meeting scheduling, rev 2 · attempt 1', 'Sales operations', '6', 'Completed, every run finished; open results to see which checks passed', 'View results'],
  ]);
  assert.equal(v.progress, '12/18');
  assert.equal(v.replay, null, 'a recorded execution exists, so Run replay is available');
}));

test('versions: Baseline drops the Changed mark, Variant A comes back from the query, a second variant is refused', async t => withGym(t, async (gym, page) => {
  const base = await page(`click('.wb-versions__group .gym-btn', 'Baseline'); await frame();
    return { q: Q().version, changed: $$('.wb-node.is-changed').length, strip: txt($('.wb-strip__text strong')), pressed: $('[data-focus-key="wb:v:baseline"]').getAttribute('aria-pressed') };`);
  assert.deepEqual(base, { q: 'baseline', changed: 0, strip: 'Draft email · Baseline', pressed: 'true' });
  await gym.go(WB.replace('exp-029', 'exp-029?version=baseline'));
  assert.equal(await page(`return txt($('.wb-strip__text strong'))`), 'Draft email · Baseline', 'the viewed version survives a reload');
  const variant = await page(`const before = Object.keys(S().variants).length, rev = E().draftRevision;
    click('[data-focus-key="wb:v:variant"]'); await frame();
    const first = { q: Q().version, changed: $$('.wb-node.is-changed').map(n => n.dataset.node) };
    click('[data-focus-key="wb:v:variant"]'); await frame();
    return { first, note: txt($('.wb-versions__note')), variants: Object.keys(S().variants).length - before, rev: E().draftRevision - rev };`);
  assert.deepEqual(variant.first, { q: 'variant', changed: ['draft-email'] });
  assert.equal(variant.note, 'This demo compares the baseline with one variant. Variant A is selected.');
  assert.deepEqual([variant.variants, variant.rev], [0, 0], 'no duplicate variant and no draft change');

  const created = await page(`
    window.__gym.store.dispatch(s => ({ state: { ...s, experiments: { ...s.experiments, 'exp-029': { ...s.experiments['exp-029'], variantId: null } } } }), {});
    await frame();
    const before = { compare: $('.wb-compare-btn').getAttribute('aria-disabled'), dep: txt($('.wb-errors')) };
    click('[data-focus-key="wb:v:variant"]'); await frame();
    return { before, variantId: E().variantId, q: Q().version, changed: $$('.wb-node.is-changed').length };`);
  assert.equal(created.before.compare, 'true', 'Compare changes waits for a variant');
  assert.match(created.before.dep, /No variant to compare against the baseline/);
  assert.deepEqual([created.variantId, created.q, created.changed], ['variant-a', 'variant', 1], '+ Variant A selects the workflow variant when the draft has none');
}));

test('selecting a node updates the strip, Inspect step and Compare changes open from the query and close back', async t => withGym(t, async (gym, page) => {
  const send = await page(`click('.wb-node[data-node="send-email"]'); await frame();
    return { q: Q().node, pressed: $$('.wb-node[aria-pressed="true"]').map(n => n.dataset.node), strip: txt($('.wb-strip__text')) };`);
  assert.equal(send.q, 'send-email');
  assert.deepEqual(send.pressed, ['send-email']);
  assert.match(send.strip, /^Send email · Variant A Needs email\.send_email ✓, email\.get_send_status ✓ · In: Email draft, approval · Out: Message id Checks: .*Exactly one email sent/);
  assert.doesNotMatch(send.strip, /model configuration/, 'another node never shows the Draft email content');

  const inspect = await page(`$('[data-focus-key="wb:inspect"]').focus(); click('[data-focus-key="wb:inspect"]'); await frame();
    const d = $('dialog.gym-dialog'); return { q: Q().dialog, title: txt(d.querySelector('h2')), body: txt(d.querySelector('.wb-dialog')) };`);
  assert.equal(inspect.q, 'inspect');
  assert.equal(inspect.title, 'Send email · Variant A');
  assert.match(inspect.body, /Fault injected Timeout after send in Timeout after send/);
  await gym.key('Escape');
  assert.deepEqual(await page(`await frame(); return [document.querySelectorAll('dialog').length, Q().dialog ?? null, document.activeElement.dataset.focusKey]`), [0, null, 'wb:inspect']);

  await gym.go(`${WB}?node=draft-email&dialog=inspect`);
  const draft = await page(`const d = $('dialog.gym-dialog'); return { title: txt(d.querySelector('h2')), rows: [...d.querySelectorAll('.wb-diff tbody tr')].map(r => [...r.cells].map(txt)) }`);
  assert.equal(draft.title, 'Draft email · Variant A', 'a deep link reopens the inspector');
  assert.deepEqual(draft.rows[0], ['model', 'simulated-model-baseline', 'simulated-model-variant-a (changed)']);
  await gym.key('Escape');

  const compare = await page(`await frame(); click('[data-focus-key="wb:compare"]'); await frame();
    const d = $('dialog.gym-dialog'); const items = [...d.querySelectorAll('.wb-compare > li')];
    const out = { q: Q().dialog, steps: items.length, changed: items.filter(i => i.classList.contains('is-changed')).map(i => i.dataset.node), summary: txt(d.querySelector('.wb-dialog p')) };
    click('dialog .wb-compare .gym-btn--link', 'Inspect step'); await frame();
    out.next = [Q().dialog, txt($('dialog.gym-dialog h2')), document.querySelectorAll('dialog').length];
    return out;`);
  assert.deepEqual([compare.q, compare.steps, compare.changed], ['compare', 6, ['draft-email']]);
  assert.equal(compare.summary, 'Sales follow-up: 1 of 6 steps change in Variant A. Variant A changes model configuration only.');
  assert.deepEqual(compare.next, ['inspect', 'Draft email · Variant A', 1]);
}));

test('a node is reachable and selectable from the keyboard', async t => withGym(t, async (gym, page) => {
  await page(`$('[data-focus-key="wb:mode:blueprint"]').focus()`);
  await gym.key('Tab');
  assert.equal(await page(`return document.activeElement.dataset.node`), 'find-opportunity');
  await gym.key('Tab');
  await gym.key('Tab');
  await gym.key('Enter');
  assert.deepEqual(await page(`await frame(); return [Q().node, document.activeElement.dataset.node, txt($('.wb-strip__text strong'))]`), ['contact-allowed', 'contact-allowed', 'Contact allowed? · Variant A']);
}));

test('scenarios: checkboxes recompute everything, search hides rows only, zero selected blocks Run with a fix', async t => withGym(t, async (gym, page) => {
  const two = await page(`$('.wb-scenario[data-scenario="sc-timeout-after-send"] input').click(); await frame();
    return { ids: E().selectedScenarioIds, count: txt($('.wb-selbar__count')), formula: txt($('.wb-formula')).replace(/\\..*$/, ''), fault: !!node('send-email').querySelector('.wb-node__tag'), set: txt($('[data-summary="scenario-set"] .wb-sumcard__sub')) };`);
  assert.deepEqual(two.ids, ['sc-base-case', 'sc-contact-opted-out']);
  assert.equal(two.count, '2 selected');
  assert.equal(two.formula, '2 versions × 2 scenarios × 3 repetitions = 12 runs');
  assert.equal(two.fault, false, 'no selected scenario injects a fault, so the marker is gone');
  assert.equal(two.set, '2 scenarios');

  const search = await page(`const input = $('[data-focus-key="wb:sc-search"]'); input.focus(); input.value = 'opt'; input.dispatchEvent(new Event('input', { bubbles: true })); await frame();
    const out = { rows: $$('.wb-scenario__title').map(txt), count: txt($('.wb-selbar__count')), focus: document.activeElement.dataset.focusKey, value: document.activeElement.value };
    input.value = ''; document.activeElement.value = ''; document.activeElement.dispatchEvent(new Event('input', { bubbles: true })); await frame();
    return out;`);
  assert.deepEqual(search, { rows: ['Contact opted out'], count: '2 selected', focus: 'wb:sc-search', value: 'opt' });

  const toggled = await page(`click('.wb-scenario[data-scenario="sc-base-case"] .wb-scenario__toggle'); await frame();
    const open = txt($('.wb-scenario[data-scenario="sc-base-case"] .wb-scenario__body'));
    click('.wb-scenario[data-scenario="sc-contact-opted-out"] .wb-scenario__toggle'); await frame();
    return { open, closed: !$('.wb-scenario[data-scenario="sc-contact-opted-out"] .wb-scenario__body'), expanded: $('.wb-scenario[data-scenario="sc-contact-opted-out"] .wb-scenario__toggle').getAttribute('aria-expanded') };`);
  assert.match(toggled.open, /^Initial state: One matching contact; contact allowed; no approval yet Expected: Request approval/);
  assert.deepEqual([toggled.closed, toggled.expanded], [true, 'false']);

  const zero = await page(`click('[data-focus-key="wb:sc-clear"]'); await frame();
    const run = $('.wb-run__go');
    const out = { ids: E().selectedScenarioIds, count: txt($('.wb-selbar__count')), disabled: run.getAttribute('aria-disabled'), reason: run.title, errors: $$('.wb-errors li').map(txt), attempts: S().attemptOrder.length, hint: txt($('.wb-hint--warn')) };
    run.click(); await frame(); out.after = S().attemptOrder.length;
    click('.wb-errors .gym-btn--link', 'Select scenarios'); out.focus = document.activeElement.dataset.focusKey;
    return out;`);
  assert.deepEqual([zero.ids, zero.count, zero.disabled], [[], '0 selected', 'true']);
  assert.equal(zero.reason, 'Select at least one scenario. Fix: Select scenarios.');
  assert.deepEqual(zero.errors, ['Select at least one scenario Select scenarios']);
  assert.equal(zero.after, zero.attempts, 'a disabled Run enqueues nothing');
  assert.equal(zero.hint, 'Select at least one scenario to run this experiment.');
  assert.equal(zero.focus, 'wb:sc:sc-base-case', 'the fix entry point focuses the first scenario checkbox');
}));

test('environments: search keeps the selection, an incompatible choice lists what is missing and says the draft now uses it', async t => withGym(t, async (gym, page) => {
  const search = await page(`const input = $('[data-focus-key="wb:env-search"]'); input.value = 'logs'; input.dispatchEvent(new Event('input', { bubbles: true })); await frame();
    const out = { cards: $$('.wb-env .wb-env__name').map(txt), env: E().environmentRef.id, hint: txt($('.wb-col--env .wb-hint')) };
    const i2 = $('[data-focus-key="wb:env-search"]'); i2.value = 'calendar'; i2.dispatchEvent(new Event('input', { bubbles: true })); await frame();
    out.calendar = $$('.wb-env .wb-env__name').map(txt);
    const i3 = $('[data-focus-key="wb:env-search"]'); i3.value = ''; i3.dispatchEvent(new Event('input', { bubbles: true })); await frame();
    return out;`);
  assert.deepEqual(search.cards, ['IT operations'], 'search matches capabilities');
  assert.equal(search.env, 'env-sales');
  assert.equal(search.hint, 'Sales operations v1.2 stays selected; the search only hides it.');
  assert.deepEqual(search.calendar, ['Sales operations']);

  const it = await page(`const before = { workflow: E().workflowRef.id, ids: E().selectedScenarioIds.join(), rev: E().draftRevision };
    click('.wb-env', 'IT operations'); await frame();
    return { before, env: E().environmentRef, workflow: E().workflowRef.id, ids: E().selectedScenarioIds.join(), rev: E().draftRevision,
      selected: txt($('.wb-env.is-selected .wb-env__name')), warn: txt($('.wb-env__warn')), dep: txt($('.wb-dep')), missing: $$('.wb-missing__group').map(txt), fix: txt($('.wb-missing .gym-btn--link')),
      title: txt($('.wb-missing .gym-notice__title')), says: txt($('.wb-missing .gym-notice__body > span')),
      run: $('.wb-run__go').getAttribute('aria-disabled'), card: txt($('[data-summary="environment"] strong')), dupe: !!$('.wb-errors li[data-code="dependency_unmatched"]'), override: txt($('.wb-errors li[data-code="unknown_override"]')) };`);
  assert.deepEqual(it.env, { id: 'env-it', rev: '1.1' });
  assert.deepEqual([it.workflow, it.ids, it.rev], [it.before.workflow, it.before.ids, it.before.rev + 1], 'the workflow and scenarios stay as they were');
  assert.equal(it.selected, 'IT operations');
  assert.equal(it.warn, 'Not compatible with this workflow');
  assert.match(it.dep, /^Dependencies missing \(\d+\)$/);
  assert.deepEqual(it.missing, [
    'Tools the workflow calls: crm.find_opportunity db.lookup_contact email.send_email email.get_send_status crm.update_opportunity crm.log_activity',
    'Fault hooks selected scenarios inject: email.timeout_after_send',
  ]);
  assert.equal(it.fix, 'Change environment');
  assert.equal(it.title, 'IT operations v1.1 lacks what this experiment needs.');
  assert.equal(it.says, `The draft now uses it at rev ${it.rev}. Nothing else was changed to fit it. Run stays blocked until the items below are resolved or another environment is chosen.`);
  assert.doesNotMatch(it.title + it.says, /unchanged/, 'the draft did change, so the copy never says it did not');
  assert.equal(it.run, 'true');
  assert.equal(it.card, 'IT operations v1.1');
  assert.equal(it.dupe, false, 'the missing list is shown once');
  assert.equal(it.override, 'Timeout after send: unknown tool gmail.send_email Review scenario', 'a fault the new environment cannot inject is a blocking error too');

  const back = await page(`click('.wb-env', 'Sales operations'); await frame(); return [E().environmentRef.id, txt($('.wb-dep')), $('.wb-run__go').getAttribute('aria-disabled')]`);
  assert.deepEqual(back, ['env-sales', 'Dependencies matched', null]);

  const gone = await page(`window.__gym.store.dispatch(s => ({ state: { ...s, experiments: { ...s.experiments, 'exp-029': { ...s.experiments['exp-029'], environmentRef: { id: 'env-gone', rev: '9' } } } } }), {}); await frame();
    return { dep: txt($('.wb-dep')), notice: !!$('.wb-missing'), errors: $$('.wb-errors li').map(li => li.dataset.code) };`);
  assert.equal(gone.dep, 'Dependencies not checked', 'no environment record means nothing was checked, not zero missing');
  assert.equal(gone.notice, false);
  assert.ok(gone.errors.includes('environment_missing'), gone.errors.join());
}));

test('Run validates, saves, freezes and enqueues once per draft revision; Save only saves', async t => withGym(t, async (gym, page) => {
  const save = await page(`const before = { attempts: S().attemptOrder.length, dirty: txt($('.wb-save-state')) };
    click('[data-focus-key="wb:save"]'); await frame();
    return { before, after: S().attemptOrder.length, saved: E().savedRevision === E().draftRevision, state: txt($('.wb-save-state')), save: $('.wb-run__save').getAttribute('aria-disabled'), flash: txt($('.wb-flash')) };`);
  assert.deepEqual(save.before.dirty, 'Unsaved changes · rev 4');
  assert.equal(save.after, save.before.attempts, 'Save never runs anything');
  assert.deepEqual([save.saved, save.state, save.save], [true, 'Saved · rev 4', 'true']);
  assert.equal(save.flash, 'Saved rev 4. Saving does not run anything.');

  const rename = await page(`const input = $('.wb-title__input'); input.focus(); input.value = 'Experiment 029 · retry'; input.dispatchEvent(new Event('change', { bubbles: true })); await frame();
    return { title: E().title, rev: E().draftRevision, state: txt($('.wb-save-state')) };`);
  assert.deepEqual(rename, { title: 'Experiment 029 · retry', rev: 5, state: 'Unsaved changes · rev 5' });

  const run = await page(`const before = S().attemptOrder.length; const go = $('.wb-run__go');
    go.click(); go.click(); await frame();
    const order = S().attemptOrder; const a = S().attempts[order.at(-1)];
    $('.wb-run__go').click(); await frame();
    return { added: order.length - before, again: S().attemptOrder.length - before, key: a.idempotencyKey, label: a.label, status: a.status, plan: a.plan.length, title: a.inputSnapshot.experiment.title,
      saved: E().savedRevision, flash: txt($('.wb-flash')), row: [...$$('.wb-qrow').find(r => r.dataset.attempt === a.id).cells].map(txt), counts: $$('.wb-qcount').map(txt) };`);
  assert.equal(run.added, 1, 'a double click creates exactly one attempt');
  assert.equal(run.again, 1, 'a third click on the same revision is still one attempt');
  assert.deepEqual([run.key, run.label, run.status, run.plan, run.title, run.saved], ['wb-exp-029-r5', 'rev 5 · attempt 2', 'queued', 18, 'Experiment 029 · retry', 5]);
  assert.equal(run.flash, 'rev 5 · attempt 2 is already in the queue for this revision. It can run again once that attempt finishes or is cancelled. Open run');
  assert.deepEqual(run.row, ['Experiment 029 · retry, rev 5 · attempt 2', 'Sales operations', '3', 'Queued', '–']);
  assert.deepEqual(run.counts, ['1 running', '2 queued', '1 completed']);

  const edit = await page(`$('.wb-scenario[data-scenario="sc-base-case"] input').click(); await frame();
    const frozen = S().attempts[S().attemptOrder.at(-1)].inputSnapshot.scenarios.length; return [E().selectedScenarioIds.length, frozen, E().draftRevision];`);
  assert.deepEqual(edit, [2, 3, 6], 'editing the draft never changes the frozen attempt');
}));

test('the formula opens Run settings; repetitions 1 to 10 recompute runs and pairs', async t => withGym(t, async (gym, page) => {
  const v = await page(`click('.wb-formula'); await frame();
    const d = $('dialog.gym-dialog'); const sel = d.querySelector('select');
    const out = { q: Q().dialog, options: [...sel.options].map(o => o.value).join(','), desc: txt(d.querySelector('.gym-dialog__desc')), facts: txt(d.querySelector('.wb-facts')) };
    sel.value = '5'; sel.dispatchEvent(new Event('change', { bubbles: true })); await frame();
    out.formula = txt($('dialog [data-formula]')); out.reps = E().repetitions; out.page = txt($('.wb-formula')).replace(/\\..*$/, '');
    out.focusKept = document.activeElement.dataset.focusKey;
    return out;`);
  assert.equal(v.q, 'settings');
  assert.equal(v.options, '1,2,3,4,5,6,7,8,9,10');
  assert.equal(v.desc, 'Runs = versions × selected scenarios × repetitions.');
  assert.match(v.facts, /^Runs 18: one run is one version on one scenario for one repetition.*Pairs 9: a pair is the baseline and Variant A on the same scenario and repetition/);
  assert.deepEqual([v.formula, v.reps, v.page], ['2 versions × 3 scenarios × 5 repetitions = 30 runs', 5, '2 versions × 3 scenarios × 5 repetitions = 30 runs']);
  await gym.key('Escape');
  assert.equal(await page(`await frame(); return document.querySelectorAll('dialog').length + ':' + (Q().dialog ?? '')`), '0:');
}));

test('a five-scenario set put on the experiment elsewhere recomputes to 30 runs', async t => withGym(t, async (gym, page) => {
  const v = await page(`
    const { setScenarioSet } = await import('/agent-gym/js/simulation/attempts.js');
    const refs = ['sc-base-case', 'sc-timeout-after-send', 'sc-contact-opted-out', 'sc-sup-rephrased', 'sc-sup-ambiguous'].map(id => ({ id, rev: '1' }));
    const set = { id: 'set-test-five', rev: '1', name: 'Five in the test', environmentRef: { id: 'env-sales', rev: '1.2' }, workflowRef: { id: 'wf-sales-follow-up', rev: '1' }, scenarioRefs: refs, digest: 'test' };
    const store = window.__gym.store;
    store.dispatch(s => ({ state: { ...s, scenarioSets: { ...s.scenarioSets, 'set-test-five@1': set } } }), {});
    const r = store.dispatch(setScenarioSet, { experimentId: 'exp-029', scenarioSetRef: { id: 'set-test-five', rev: '1' } });
    await frame();
    return { ok: r.ok, formula: txt($('.wb-formula')).replace(/\\..*$/, ''), count: txt($('.wb-selbar__count')), rows: $$('.wb-scenario').length,
      set: txt($('[data-summary="scenario-set"] .wb-sumcard__text')), manage: $('[data-focus-key="wb:set-manage"]').getAttribute('href') };`);
  assert.equal(v.ok, true);
  assert.equal(v.formula, '2 versions × 5 scenarios × 3 repetitions = 30 runs');
  assert.deepEqual([v.count, v.rows], ['5 selected', 5]);
  assert.equal(v.set, 'Scenario set Five in the test 5 scenarios');
  assert.equal(v.manage, '#/scenario-sets/set-test-five/revisions/1');
}));

test('Run replay plays a recorded execution and is disabled until one exists', async t => withGym(t, async (gym, page) => {
  const v = await page(`click('[data-tab="replay"]'); await frame();
    const out = { q: Q().view, head: txt($('#wb-blueprint-title')), events: $$('.wb-trace li').length, current: $$('.wb-node.is-current').map(n => n.dataset.node),
      dim: $$('.wb-node.is-dim').map(n => n.dataset.node), count: txt($('.wb-replay__count')), link: $('.wb-replay__link').getAttribute('href'),
      prev: $('[data-focus-key="wb:rp:prev"]').getAttribute('aria-disabled') };
    out.node1 = Q().node;
    click('[data-focus-key="wb:rp:next"]'); await frame();
    out.step2 = [Q().step, $$('.wb-node.is-current').map(n => n.dataset.node).join(), txt($('.wb-trace li.is-current'))];
    out.node2 = Q().node;
    const sc = $('[data-focus-key="wb:rp:scenario"]'); sc.value = 'sc-timeout-after-send'; sc.dispatchEvent(new Event('change', { bubbles: true })); await frame();
    out.timeout = [txt($('#wb-blueprint-title')), txt(node('send-email').querySelector('.wb-node__tag'))];
    out.node3 = [Q().node ?? '', $$('.wb-node.is-current').map(n => n.dataset.node).join()];
    out.notRun = [...$('[data-focus-key="wb:rp:scenario"]').options].filter(o => o.disabled).map(o => o.textContent);
    return out;`);
  assert.equal(v.q, 'replay');
  assert.equal(v.head, 'Run replay · Base case · Variant A #1');
  assert.ok(v.events >= 6, `trace events listed: ${v.events}`);
  assert.deepEqual(v.current, ['find-opportunity']);
  assert.deepEqual(v.dim, ['log-skipped'], 'the No branch was not visited');
  assert.match(v.count, /^Event 1 of \d+: crm\.find_opportunity → ok$/);
  assert.equal(v.link, '#/experiments/exp-029/attempts/attempt-002');
  assert.equal(v.prev, 'true');
  assert.deepEqual(v.step2, ['2', 'draft-email', '2 model simulated-model-variant-a: drafted']);
  assert.deepEqual([v.node1, v.node2], ['find-opportunity', 'draft-email'], 'the node in the address follows the replay step');
  assert.equal(v.node3[0], v.node3[1], 'after a scenario change the address names the highlighted node');
  assert.deepEqual(v.timeout, ['Run replay · Timeout after send · Variant A #1', 'Timeout injection']);
  assert.deepEqual(v.notRun, ['Contact opted out (not run yet)']);

  const none = await page(`
    window.__gym.store.dispatch(s => ({ state: { ...s, executions: { ...s.executions, 'attempt-002': [] } } }), {}); await frame();
    const tab = $('[data-tab="replay"]'); tab.click(); await frame();
    return { disabled: tab.getAttribute('aria-disabled'), title: $('[data-tab="replay"]').title, head: txt($('#wb-blueprint-title')), strip: !!$('.wb-strip') };`);
  assert.deepEqual(none, { disabled: 'true', title: 'Run a simulation first', head: 'Workflow blueprint', strip: true });
}));

test('entry points carry their context to the other screens', async t => withGym(t, async (gym, page) => {
  const links = await page(`const href = k => $('[data-focus-key="' + k + '"]').getAttribute('href');
    return { create: href('wb:env-create'), describe: href('wb:env-describe'), browse: href('wb:env-browse'), scCreate: href('wb:sc-create'),
      entries: $$('.wb-entry').map(a => [txt(a), a.getAttribute('href')]), results: $('.wb-qresult').getAttribute('href') };`);
  assert.equal(links.create, '#/environments/new?returnTo=exp-029');
  assert.equal(links.describe, '#/environments/new?returnTo=exp-029&focus=describe');
  assert.equal(links.browse, '#/environments?returnTo=exp-029');
  assert.equal(links.scCreate, '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up');
  assert.deepEqual(links.entries, [
    ['Production trace', '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&source=trace'],
    ['Blueprint & policies', '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&source=blueprint'],
    ['Describe scenario', '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&source=chat'],
    ['Generate variations', '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&mode=prompt'],
  ]);
  assert.equal(links.results, '#/experiments/exp-027/attempts/attempt-001/results');
  await page(`$$('.wb-qrow')[1].cells[2].click(); await frame();`);
  assert.equal(await page(`return location.hash`), '#/experiments/exp-028/attempts/attempt-003', 'a row click opens that attempt');
  await gym.ev(`history.back(); await new Promise(r => setTimeout(r, 150));`);
  assert.equal(await page(`return [location.hash, !!$('.wb-qtable')].join()`), `${WB},true`);
}));

test('the workflow selector lists fixture workflows and switching keeps the draft honest', async t => withGym(t, async (gym, page) => {
  const v = await page(`const sel = $('.wb-workflow__select');
    const options = [...sel.options].map(o => o.textContent);
    sel.value = 'wf-support-triage@1'; sel.dispatchEvent(new Event('change', { bubbles: true })); await frame();
    return { options, wf: E().workflowRef.id, variant: E().variantId, name: txt($('.wb-workflow__name')), nodes: $$('.wb-node .wb-node__label').map(txt), selected: $$('.wb-node[aria-pressed="true"]').map(n => n.dataset.node) };`);
  assert.deepEqual(v.options, ['Sales follow-up · From Speedrun · fixture', 'Support triage · From Speedrun · fixture', 'Meeting scheduling · From Speedrun · fixture']);
  assert.deepEqual([v.wf, v.variant, v.name], ['wf-support-triage', 'variant-support-a', 'Support triage']);
  assert.deepEqual(v.nodes, ['Read ticket', 'Draft reply', 'Refund eligible?', 'Issue refund', 'Reply to customer', 'Tag not eligible']);
  assert.deepEqual(v.selected, ['draft-reply']);
}));

test('no horizontal page scroll at 390 and 768px; the diagram and queue scroll inside their own boxes', async t => withGym(t, async (gym, page) => {
  for (const width of [390, 768]) {
    await gym.size(width, 900);
    await gym.go(WB);
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `${width}px scrolls sideways: ${doc} > ${win}`);
    const cols = await page(`return getComputedStyle($('.wb-cols')).gridTemplateColumns.split(' ').length`);
    assert.equal(cols, 1, `${width}px stacks the columns`);
    if (width === 390) assert.ok(await page(`const s = $('.wb-diagram-scroll'); return s.scrollWidth > s.clientWidth`), 'the diagram scrolls inside its container at 390px');
  }
}));

test('with the live clock the queue advances while typing keeps its value and caret', async t => withGym(t, async (gym, page) => {
  await gym.ev('localStorage.clear()');
  await gym.go(WB, { search: '' });
  const v = await page(`const input = $('[data-focus-key="wb:sc-search"]');
    input.focus(); input.value = 'tim'; input.setSelectionRange(2, 2); input.dispatchEvent(new Event('input', { bubbles: true }));
    const before = S().executions['attempt-002'].length;
    await new Promise(r => setTimeout(r, 2200));
    const a = document.activeElement;
    return { advanced: S().executions['attempt-002'].length - before, shown: txt($('.wb-qrow .gym-progress__text')), total: S().executions['attempt-002'].length, focus: a.dataset.focusKey, value: a.value, caret: a.selectionStart };`);
  assert.ok(v.advanced >= 1, 'the scheduler ticked at least once');
  assert.equal(v.shown, `${v.total}/18`, 'the queue row reads the store');
  assert.deepEqual([v.focus, v.value, v.caret], ['wb:sc-search', 'tim', 2]);
}));

test('a replay link with a stale node puts the highlighted step\'s node in the address', async t => withGym(t, async (gym, page) => {
  await gym.go(`${WB}?view=replay&node=log-skipped&step=2`);
  const v = await page(`await frame(); return { node: Q().node, current: $$('.wb-node.is-current').map(n => n.dataset.node).join(), step: Q().step };`);
  assert.deepEqual(v, { node: 'draft-email', current: 'draft-email', step: '2' });
}));
