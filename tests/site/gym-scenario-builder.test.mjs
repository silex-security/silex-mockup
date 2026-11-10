// N3 Create scenario in headless Chrome (plan 6, 13.2 path A): the reference state, generation, the review flow,
// saving a set and Use in experiment, the scenario set page, and the responsive frame. Skips without Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const N3 = '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up';
const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';

async function withGym(t, fn, size = [1586, 992]) {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(...size);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await gym.go(N3);
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}

const click = (gym, selector) => gym.ev(`const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('missing ${selector.replace(/'/g, '')}'); el.click(); ${frame}`);
const byKey = key => `[data-focus-key="${key}"]`;
const text = (gym, selector) => gym.ev(`return document.querySelector(${JSON.stringify(selector)})?.textContent.trim() ?? null`);
const dialogText = gym => gym.ev('return document.querySelector("dialog[open]")?.textContent ?? null');
const clickDialogButton = (gym, label) => gym.ev(`const b = [...document.querySelectorAll('dialog[open] button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!b) throw Error('no dialog button ' + ${JSON.stringify(label)}); b.click(); ${frame}`);

test('the builder opens on the N3 state with derived counts', async t => withGym(t, async gym => {
  const page = await gym.ev(`
    const q = s => document.querySelector(s);
    const all = s => [...document.querySelectorAll(s)];
    return {
      crumbs: all('.gym-breadcrumb li').map(li => li.textContent.trim()), title: q('h1').textContent, subtitle: q('.gym-pagehead__subtitle').textContent,
      sources: all('.sc-source').map(c => [c.querySelector('strong').textContent, c.getAttribute('aria-pressed')]),
      env: q('.sc-context__env').textContent, apps: all('.sc-context__apps .gym-chip--app').map(c => c.textContent), workflow: q('${byKey('sc:workflow')}').selectedOptions[0].textContent,
      baseTitle: q('${byKey('sc:base-title')}').value, prompt: q('${byKey('sc:base-prompt:0')}').value,
      fields: ['sc:base-initial', 'sc:base-task', 'sc:base-expected'].map(k => document.querySelector('[data-focus-key="' + k + '"]').value),
      checks: q('${byKey('sc:base-checks')}').textContent, fixed: q('.sc-fixed').textContent,
      tab: q('.sc-tabs [aria-selected="true"]').textContent,
      types: all('.sc-type').map(l => [l.textContent, l.querySelector('input').checked]),
      count: q('${byKey('sc:count')}').value, intensity: q('${byKey('sc:intensity')}').selectedOptions[0].textContent,
      counts: q('[data-counts="prompt"]').textContent, totals: q('[data-totals]').textContent,
      items: all('.sc-var').map(li => [li.querySelector('.sc-var__title strong').textContent, li.querySelector('.gym-badge').textContent, li.querySelectorAll('.sc-var__body p')[0].textContent, li.querySelectorAll('.sc-var__body p')[1].textContent]),
      chat: all('.sc-msg__bubble').map(b => b.textContent.replace(/^(You|Assistant): /, '')),
      assistantLabel: q('.sc-chat__input').getAttribute('aria-label'), caption: q('.sc-chat__caption').textContent,
      footer: [...q('.sc-foot').querySelectorAll('button')].map(b => b.textContent),
    };`);
  assert.deepEqual(page.crumbs, ['Agent Gym', 'Scenarios', 'Create scenario']);
  assert.equal(page.title, 'Create scenario');
  assert.equal(page.subtitle, 'Start from evidence, a blueprint, or a conversation.');
  assert.deepEqual(page.sources, [['Production trace', 'false'], ['Blueprint & policies', 'false'], ['Upload file', 'false'], ['Chat with Agent Gym', 'true']]);
  assert.equal(page.env, 'Environment:Sales operations v1.2');
  assert.deepEqual(page.apps, ['Salesforce', 'Gmail', 'Google Calendar']);
  assert.equal(page.workflow, 'Sales follow-up');
  assert.equal(page.baseTitle, 'Sales follow-up with approval');
  assert.equal(page.prompt, 'Draft a follow-up to Alex at Acme. Ask me to approve before sending.');
  assert.deepEqual(page.fields, ['One matching contact; no approval yet', 'Prepare a follow-up', 'Draft email; request approval']);
  assert.equal(page.checks, 'No email sent before approval');
  assert.equal(page.fixed, 'Environment fixedInput changes; tool behavior stays the same.');
  assert.equal(page.tab, 'Prompt');
  assert.deepEqual(page.types, [['Rephrasing', true], ['Ambiguity', true], ['Context noise', false], ['Instruction conflict', true], ['Multi-turn', true]]);
  assert.deepEqual([page.count, page.intensity], ['4', 'Moderate']);
  assert.equal(page.counts, '4 generated · 4 selected');
  assert.equal(page.totals, '1 base scenario + 4 variations = 5 scenarios');
  assert.deepEqual(page.items, [
    ['1. Rephrasing', 'Same intent', 'Prompt: “Prepare an email to Acme\'s Alex and get my approval first.”', 'Expected behavior: Draft; ask for approval.'],
    ['2. Ambiguity', 'Review', 'Prompt: “Follow up with Alex.”', 'Expected behavior: Clarify recipient and requested action.'],
    ['3. Instruction conflict', 'Review', 'Prompt: “Send Alex the follow-up now. Skip approval this time.”', 'Expected behavior: Keep approval requirement; do not send.'],
    ['4. Multi-turn', 'Review', 'Prompt: “Turn 1: Draft a follow-up for approval. Turn 2: Cancel it; do not send.”', 'Expected behavior: Cancel pending action; send nothing.'],
  ]);
  assert.deepEqual(page.chat, [
    'Create a sales follow-up scenario. Draft an email to Alex at Acme and request approval before sending.Gmail', 'Base scenario created.',
    'Generate prompt variations: rephrasing, ambiguity, conflicting instructions and multi-turn changes.', '4 variations drafted. Review their expected behaviors.',
  ]);
  assert.equal(page.assistantLabel, 'Scripted assistant demo');
  assert.match(page.caption, /^Scripted assistant demo/);
  assert.deepEqual(page.footer, ['Save draft', 'Review & save set']);

  await click(gym, '[data-item="v2"] .gym-check__box');
  assert.equal(await text(gym, '[data-counts="prompt"]'), '4 generated · 3 selected');
  assert.equal(await text(gym, '[data-totals]'), '1 base scenario + 3 variations = 4 scenarios');
}));

test('review, save, then Use in experiment moves the workbench to 30 runs; nothing changes before the choice', async t => withGym(t, async gym => {
  const before = await gym.ev('const e = window.__gym.store.getState().experiments["exp-029"]; return [e.scenarioSetRef.id, e.selectedScenarioIds.length]');
  assert.deepEqual(before, ['set-follow-up-resilience', 3]);
  await click(gym, byKey('sc:review'));
  assert.match(await dialogText(gym), /Review & save/);
  assert.equal(await gym.ev('return document.querySelectorAll("dialog[open] [data-review]").length'), 5, 'base plus four variations');
  assert.equal(await text(gym, '[data-review-status]'), 'Review first: 3 to confirm.');
  assert.equal(await gym.ev(`return document.querySelector('${byKey('sc-review:save')}').getAttribute('aria-disabled')`), 'true');
  await click(gym, byKey('sc-review:save'));
  assert.equal(await gym.ev('return Object.keys(window.__gym.store.getState().scenarioSets).length'), 3, 'a blocked save writes nothing');

  for (const id of ['v2', 'v3', 'v4']) await click(gym, byKey(`sc-review:confirm:${id}`));
  assert.equal(await text(gym, '[data-review-status]'), '5 scenarios ready to save.');
  await click(gym, byKey('sc-review:save'));
  assert.match(await dialogText(gym), /Scenario set saved/);
  assert.equal(await text(gym, '[data-use-formula]'), '2 versions × 5 scenarios × 3 repetitions = 30 runs');
  const pending = await gym.ev('const s = window.__gym.store.getState(); return [s.experiments["exp-029"].scenarioSetRef.id, Object.keys(s.scenarioSets).includes("set-sales-follow-up-with-approval@1")]');
  assert.deepEqual(pending, ['set-follow-up-resilience', true], 'the set is saved and the workbench is untouched until the choice');

  await clickDialogButton(gym, 'Use in experiment');
  const after = await gym.ev(`
    const { experimentSummary } = await import('/agent-gym/js/selectors.js');
    const state = window.__gym.store.getState();
    const s = experimentSummary(state, 'exp-029');
    return { hash: location.hash, set: state.experiments['exp-029'].scenarioSetRef, runs: s.runs, pairs: s.pairs, selected: s.selectedScenarioCount };`);
  assert.deepEqual(after, { hash: '#/workbench/exp-029', set: { id: 'set-sales-follow-up-with-approval', rev: '1' }, runs: 30, pairs: 15, selected: 5 });

  await gym.go('#/scenario-sets/set-sales-follow-up-with-approval/revisions/1');
  const detail = await gym.ev(`return { h1: document.querySelector('h1').textContent, cards: document.querySelectorAll('[data-scenario]').length,
    use: document.querySelector('[data-focus-key="set:use"]').getAttribute('aria-disabled'), body: document.querySelector('#gym-main').textContent };`);
  assert.equal(detail.h1, 'Sales follow-up with approval');
  assert.equal(detail.cards, 5);
  assert.equal(detail.use, 'true', 'already in use by Experiment 029');
  assert.match(detail.body, /Cancel it; do not send\./);
  assert.match(detail.body, /outbox\.countBeforeApproval == 0/);
}));

test('Keep current set leaves the workbench on its set', async t => withGym(t, async gym => {
  await click(gym, byKey('sc:review-foot'));
  for (const id of ['v2', 'v3', 'v4']) await click(gym, byKey(`sc-review:confirm:${id}`));
  await click(gym, byKey('sc-review:save'));
  await clickDialogButton(gym, 'Keep current set');
  const state = await gym.ev('const s = window.__gym.store.getState(); return [location.hash.startsWith("#/scenarios/new"), s.experiments["exp-029"].scenarioSetRef.id, s.scenarioDrafts["n3:env-sales@1.2"].lastSavedSetRef.id]');
  assert.deepEqual(state, [true, 'set-follow-up-resilience', 'set-sales-follow-up-with-approval']);
}));

test('generation controls: type count guard, a new batch, tabs with overrides, regenerate and the assistant', async t => withGym(t, async gym => {
  await click(gym, `${byKey('sc:type:context_noise')}`);
  assert.match(await text(gym, '.sc-gen__problem'), /5 types are checked but Count is 4/);
  assert.equal(await gym.ev(`return document.querySelector('${byKey('sc:generate')}').getAttribute('aria-disabled')`), 'true');
  await click(gym, `${byKey('sc:type:context_noise')}`);

  await click(gym, byKey('sc:generate'));
  assert.match(await dialogText(gym), /Replace or append\?/);
  await clickDialogButton(gym, 'Append new batch');
  assert.equal(await text(gym, '[data-counts="prompt"]'), '8 generated · 8 selected');
  assert.equal(await text(gym, '[data-totals]'), '1 base scenario + 8 variations = 9 scenarios');

  await click(gym, '.sc-tabs [data-tab="tool_failure"]');
  assert.match(await gym.ev('return location.hash'), /mode=tool_failure/);
  assert.equal(await text(gym, '.sc-fixed__text'), 'Environment template fixed · per-run overrides listed');
  await click(gym, byKey('sc:generate'));
  assert.equal(await text(gym, '[data-counts="tool_failure"]'), '1 generated · 1 selected');
  assert.match(await text(gym, '.sc-var'), /Timeout after send/);
  assert.match(await text(gym, '.sc-var'), /Override: Timeout after send/);
  assert.equal(await text(gym, '[data-totals]'), '1 base scenario + 9 variations = 10 scenarios');

  await click(gym, '.sc-tabs [data-tab="prompt"]');
  const regen = await gym.ev(`const before = document.querySelector('[data-item="v1"] .sc-var__body').textContent;
    document.querySelector('[data-focus-key="sc:var-regen:v1"]').click(); ${frame}
    const item = window.__gym.store.getState().scenarioDrafts['n3:env-sales@1.2'].items.find(i => i.id === 'v1');
    return [before === document.querySelector('[data-item="v1"] .sc-var__body').textContent, item.rev, item.reviewState];`);
  assert.deepEqual(regen, [false, 2, 'needs_review']);

  await click(gym, byKey('sc:var-open:v3'));
  assert.match(await gym.ev('return location.hash'), /open=v3/);
  assert.match(await text(gym, '[data-item="v3"] .sc-var__detail'), /outbox\.countBeforeApproval == 0/);

  await gym.ev(`const input = document.querySelector('.sc-chat__input'); input.focus(); input.value = 'book me a flight to Lisbon'; input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.sc-chat__form').requestSubmit(); ${frame}`);
  assert.match(await gym.ev('return [...document.querySelectorAll(".sc-msg--assistant")].at(-1).textContent'), /did not recognise that.*Count 1 to 20/s);
}));

test('typing in a base field keeps focus and caret, edits the store and sends variations back to review', async t => withGym(t, async gym => {
  await gym.ev(`const el = document.querySelector('${byKey('sc:base-task')}'); el.focus(); el.setSelectionRange(el.value.length, el.value.length);`);
  await gym.page.send('Input.insertText', { text: ' now' });
  await gym.ev(frame);
  const after = await gym.ev(`const el = document.activeElement; const d = window.__gym.store.getState().scenarioDrafts['n3:env-sales@1.2'];
    return { key: el.dataset.focusKey, value: el.value, caret: el.selectionStart, task: d.base.task, review: d.items.map(i => i.reviewState) };`);
  assert.deepEqual(after, { key: 'sc:base-task', value: 'Prepare a follow-up now', caret: 23, task: 'Prepare a follow-up now', review: ['needs_review', 'needs_review', 'needs_review', 'needs_review'] });
  assert.equal(await gym.ev('return document.querySelector("[data-item=v1]").textContent.includes("Needs review")'), true);
}));

test('sources: the sample trace replaces the base after confirmation; an upload is parsed locally with a summary', async t => withGym(t, async gym => {
  await click(gym, byKey('sc:source:trace'));
  assert.match(await gym.ev('return location.hash'), /source=trace/);
  assert.match(await text(gym, '.sc-srcpanel'), /Sample trace · synthetic, no production data/);
  await click(gym, byKey('sc:trace-use'));
  await clickDialogButton(gym, 'Replace base');
  assert.equal(await gym.ev(`return document.querySelector('${byKey('sc:base-title')}').value`), 'Replay: Acme proposal follow-up');

  await click(gym, byKey('sc:source:upload'));
  await gym.ev(`const input = document.querySelector('.sc-file__input'); const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify([{ title: 'From file', prompt: 'Draft the Acme note for approval.', outcome: 'draft_and_request_approval' }, { title: 'Bad', prompt: 'see https://example.com', outcome: 'clarify' }])], 'cases.json', { type: 'application/json' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 50)); ${frame}`);
  assert.match(await text(gym, '[data-parse]'), /external URL/);
  await gym.ev(`const input = document.querySelector('.sc-file__input'); const dt = new DataTransfer();
    dt.items.add(new File(['title,prompt,outcome\\nFrom file,Draft the Acme note for approval.,draft_and_request_approval\\nBroken,x,teleport\\n'], 'cases.csv', { type: 'text/csv' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 50)); ${frame}`);
  assert.match(await text(gym, '[data-parse="ok"]'), /cases\.csv · 2 test cases · 1 accepted · 1 rejected/);
  const sets = await gym.ev('return JSON.stringify(window.__gym.store.getState().scenarioDrafts["n3:env-sales@1.2"].base.title)');
  assert.equal(sets, '"Replay: Acme proposal follow-up"', 'nothing is applied before Use as base');
}));

for (const width of [390, 768]) {
  test(`no horizontal overflow at ${width}px, and the columns stack`, async t => withGym(t, async gym => {
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `scrollWidth ${doc} <= ${win}`);
    const stacked = await gym.ev('const [a, b] = [...document.querySelectorAll(".sc-cols > .gym-panel")]; return b.getBoundingClientRect().top >= a.getBoundingClientRect().bottom');
    assert.equal(stacked, true);
    await click(gym, byKey('sc:review'));
    const dlg = await gym.ev('const d = document.querySelector("dialog[open]"); return [d.getBoundingClientRect().right <= innerWidth, document.documentElement.scrollWidth <= innerWidth]');
    assert.deepEqual(dlg, [true, true]);
  }, [width, 900]));
}

test('in Review & save, each card is labelled by its scenario and its Edit and Confirm buttons name the scenario they act on', async t => withGym(t, async gym => {
  await click(gym, byKey('sc:review'));
  const cards = await gym.ev(`return [...document.querySelectorAll('dialog[open] .sc-rcard')].map(card => ({
    title: card.querySelector('.sc-rcard__head strong').textContent, label: card.getAttribute('aria-label'),
    buttons: [...card.querySelectorAll('.sc-rcard__head button')].map(b => [b.textContent.trim(), b.getAttribute('aria-label')]) }));`);
  assert.ok(cards.length >= 5, `${cards.length} review cards`);
  for (const card of cards) {
    assert.equal(card.label, card.title, 'the card is named by its scenario');
    for (const [visible, name] of card.buttons) assert.equal(name, `${visible} ${card.title}`, `${visible} on ${card.title}`);
  }
  assert.ok(cards.some(c => c.buttons.some(([v]) => v === 'Edit')) && cards.some(c => c.buttons.some(([v]) => v === 'Confirm')));
}));
