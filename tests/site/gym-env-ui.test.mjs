// Agent Gym v2 environment screens in headless Chrome (plan 5, 13.2 path A up to Use in experiment).
// Drives the real page through tools/gym-shot.mjs. Skips with a clear message when no Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGym } from '../../tools/gym-shot.mjs';

const BUILDER = '#/environments/new?returnTo=exp-029&focus=describe';
const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';
const HELPERS = `
  const main = document.querySelector('.gym-main');
  const text = el => (el?.innerText ?? el?.textContent ?? '').replace(/\\s+/g, ' ').trim();
  const byText = (label, scope = document) => [...scope.querySelectorAll('button, a, summary')].find(b => text(b) === label || b.getAttribute('aria-label') === label);
  const press = async (label, scope) => { const b = byText(label, scope); if (!b) throw Error('no control "' + label + '"'); b.click(); ${frame} };
  const state = () => window.__gym.store.getState();
  const draft = () => state().environmentDrafts['draft-sales-ops'];
  const comp = id => draft().components.find(c => c.id === id);
  const footer = () => text(document.querySelector('.env-footer'));
  const say = async message => {
    const input = document.querySelector('[data-focus-key="env:message"]');
    input.value = message; input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit(); ${frame}
  };
  const lastTurn = () => text(document.querySelector('.env-chat__log > li:last-child'));
`;

async function withGym(t, fn) {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(1568, 1003);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}
const run = (gym, body) => gym.ev(`${HELPERS}${body}`);

test('Create environment shows the N2 draft, and the chat, undo, tabs, selection and settings work on it', async t => withGym(t, async gym => {
  await gym.go(BUILDER);
  const first = await run(gym, `return {
    h1: text(main.querySelector('h1')), crumbs: text(main.querySelector('[aria-label="Breadcrumb"]')), status: text(main.querySelector('.env-status')),
    counts: text(main.querySelector('.env-counts')), footer: footer(), focus: document.activeElement.dataset.focusKey,
    rows: [...main.querySelectorAll('.env-gen__row')].map(text), nodes: main.querySelectorAll('.env-node').length, edges: [...main.querySelectorAll('.env-edge')].map(text),
    save: [byText('Save as template').getAttribute('aria-disabled'), byText('Save as template').title], side: text(main.querySelector('.env-settings .gym-panel__title')),
    demo: text(main.querySelector('.env-demo-tag')), turns: main.querySelectorAll('.env-turn--user').length };`);
  assert.equal(first.h1, 'Create environment');
  assert.equal(first.crumbs, 'Agent Gym Environments Create environment');
  assert.equal(first.status, 'Draft');
  assert.equal(first.counts, '4 systems · 12 tools · 4 relationships');
  assert.match(first.footer, /3 components ready.*1 assumption to confirm/);
  assert.equal(first.focus, 'env:message', 'focus=describe focuses the chat input on a direct load');
  assert.deepEqual(first.rows, ['Salesforce 4 tools Ready', 'Gmail simulator 3 tools Needs review', 'Google Calendar 3 tools Ready', 'Customer DB 2 tools Ready']);
  assert.deepEqual([first.nodes, first.edges.sort()], [4, ['contact_id', 'email', 'email', 'email']]);
  assert.deepEqual(first.save, ['true', 'Validate the environment first.']);
  assert.deepEqual([first.side, first.demo, first.turns], ['Gmail simulator', 'Scripted assistant demo', 2]);

  const edge = await run(gym, `await press('contact_id'); await new Promise(r => setTimeout(r, 30));
    return { hash: location.hash, side: text(main.querySelector('.env-side')), pressed: document.querySelector('.env-edge.is-selected')?.textContent };`);
  assert.match(edge.hash, /select=edge\.rel-sf-db/);
  assert.match(edge.side, /contact_id relationship.*From Salesforce · Contact\.id.*To Customer DB · CustomerRecord\.id.*Match rule Exact match on the contact ID/);
  assert.match(edge.side, /not an execution order and not a data sync/);
  assert.equal(edge.pressed, 'contact_id');

  const row = await run(gym, `main.querySelector('[data-focus-key="env:row:customdb"]').click(); ${frame} await new Promise(r => setTimeout(r, 30));
    return { hash: location.hash, node: document.querySelector('.env-node.is-selected')?.dataset.component, side: text(main.querySelector('.env-settings .gym-panel__title')) };`);
  assert.deepEqual([/select=node\.customdb/.test(row.hash), row.node, row.side], [true, 'customdb', 'Customer DB'], 'row, node and settings stay in sync');
  await gym.go('#/environments/new?returnTo=exp-029&select=node.customdb&tab=tools');
  assert.deepEqual(await run(gym, `return [text(main.querySelector('.env-tabs [aria-selected="true"]')), text(main.querySelector('.env-settings .gym-panel__title'))]`), ['Tools', 'Customer DB'], 'a refresh restores the tab and the selection');
  await run(gym, `await press('Topology'); main.querySelector('[data-focus-key="env:node:gmail"]').click(); ${frame} await new Promise(r => setTimeout(r, 30));`);

  const chat = await run(gym, `await say('Make Customer DB read-write'); const applied = { turn: lastTurn(), permission: comp('customdb').permission };
    await press('Undo'); const undone = comp('customdb').permission;
    await press('Redo'); const redone = comp('customdb').permission;
    await press('Undo');
    const before = JSON.stringify(draft().components);
    await say('Make it production ready');
    return { applied, undone, redone, help: lastTurn(), unchanged: JSON.stringify(draft().components) === before, options: [...main.querySelectorAll('.env-options button')].map(text) };`);
  assert.match(chat.applied.turn, /Updated 1 setting\. Customer DB: read and write/);
  assert.deepEqual([chat.applied.permission, chat.undone, chat.redone], ['read_write', 'read_only', 'read_write']);
  assert.doesNotMatch(chat.help, /Updated/);
  assert.match(chat.help, /I could not apply "Make it production ready"/);
  assert.equal(chat.unchanged, true);
  assert.ok(chat.options.includes('Make Customer DB read-write') && chat.options.length >= 4, chat.options.join(' | '));

  const edits = await run(gym, `
    const box = [...main.querySelectorAll('.env-fieldset label')].find(l => text(l) === 'get_send_status').querySelector('input');
    box.click(); ${frame}
    const applyOn = byText('Apply changes').getAttribute('aria-disabled');
    main.querySelector('[data-focus-key="env:node:salesforce"]').click(); ${frame}
    const asked = text(document.querySelector('dialog.gym-dialog h2'));
    await press('Discard changes', document.querySelector('dialog.gym-dialog')); await new Promise(r => setTimeout(r, 30));
    const after = { hash: location.hash, tools: comp('gmail').enabledTools.length };
    main.querySelector('[data-focus-key="env:node:gmail"]').click(); ${frame} await new Promise(r => setTimeout(r, 30));
    [...main.querySelectorAll('.env-fieldset label')].find(l => text(l) === 'get_send_status').querySelector('input').click(); ${frame}
    await press('Apply changes');
    const applied = comp('gmail').enabledTools;
    await press('Undo');
    return { applyOn, asked, after, applied, restored: comp('gmail').enabledTools.length };`);
  assert.equal(edits.applyOn, null, 'an edit enables Apply changes');
  assert.equal(edits.asked, 'Unapplied changes to Gmail simulator');
  assert.deepEqual([/select=node\.salesforce/.test(edits.after.hash), edits.after.tools], [true, 3], 'discarding drops the edit and moves on');
  assert.deepEqual([edits.applied, edits.restored], [['search_messages', 'send_email'], 3]);

  const added = await run(gym, `await press('Add component'); await press('Add Helpdesk', document.querySelector('dialog.gym-dialog'));
    await new Promise(r => setTimeout(r, 30)); const counts = text(main.querySelector('.env-counts')); await press('Undo'); return [counts, text(main.querySelector('.env-counts'))];`);
  assert.deepEqual(added, ['5 systems · 15 tools · 4 relationships', '4 systems · 12 tools · 4 relationships']);
}));

test('path A: confirm the adapter, validate, save as template, use it in Experiment 029; env-sales@1.2 and every attempt stay unchanged', async t => withGym(t, async gym => {
  await gym.go(BUILDER);
  const before = await run(gym, `return { sales: JSON.stringify(state().environments['env-sales@1.2']), attempts: JSON.stringify(state().attempts), ref: state().experiments['exp-029'].environmentRef };`);
  assert.deepEqual(before.ref, { id: 'env-sales', rev: '1.2' });

  const flow = await run(gym, `
    const early = text(main.querySelector('.env-footer'));
    await press('Confirm behavior');
    const confirmed = { footer: footer(), status: text(main.querySelector('.env-status')), row: text(main.querySelector('[data-focus-key="env:row:gmail"]')) };
    await press('Validate environment', document.querySelector('.env-footer'));
    const validated = { status: text(main.querySelector('.env-status')), save: byText('Save as template').getAttribute('aria-disabled'), notice: text(main.querySelector('.gym-notice--success')) };
    await press('Save as template');
    const dialog = document.querySelector('dialog.gym-dialog');
    const saved = { title: text(dialog.querySelector('h2')), desc: text(dialog.querySelector('.gym-dialog__desc')) };
    await press('Use in experiment', dialog); await new Promise(r => setTimeout(r, 60));
    return { early, confirmed, validated, saved, hash: location.hash, ref: state().experiments['exp-029'].environmentRef, live: document.querySelector('[aria-live="polite"]').textContent };`);
  assert.match(flow.early, /3 components ready.*1 assumption to confirm/);
  assert.match(flow.confirmed.footer, /4 components ready.*No assumptions to confirm/);
  assert.equal(flow.confirmed.status, 'Draft', 'confirming changes behavior, so the draft needs a fresh validation');
  assert.equal(flow.confirmed.row, 'Gmail simulator 3 tools Ready');
  assert.deepEqual([flow.validated.status, flow.validated.save], ['Validated', null]);
  assert.match(flow.validated.notice, /Validated\. Report digest [0-9a-f]{8}/);
  assert.equal(flow.saved.title, 'Template saved');
  assert.match(flow.saved.desc, /Sales operations v1 is saved as an immutable revision .*Experiment 029 still uses Sales operations v1\.2/);
  assert.equal(flow.hash, '#/workbench/exp-029');
  assert.deepEqual(flow.ref, { id: 'tpl-sales-operations', rev: '1' });

  const after = await run(gym, `return { sales: JSON.stringify(state().environments['env-sales@1.2']), attempts: JSON.stringify(state().attempts), saved: state().environments['tpl-sales-operations@1'] };`);
  assert.equal(after.sales, before.sales, 'env-sales@1.2 is untouched');
  assert.equal(after.attempts, before.attempts, 'no attempt snapshot changed');
  assert.deepEqual([after.saved.validation.status, after.saved.validation.digest === after.saved.digest], ['validated', true]);

  await gym.go('#/environments');
  const card = await run(gym, `const c = [...main.querySelectorAll('.env-lib__card')].find(x => x.getAttribute('aria-label') === 'Sales operations v1');
    return { text: text(c), use: byText('Use in experiment', c).getAttribute('aria-disabled') };`);
  assert.match(card.text, /In use by Experiment 029/);
  assert.match(card.text, /Saved template/);
  assert.equal(card.use, 'true');

  const back = await run(gym, `const c = [...main.querySelectorAll('.env-lib__card')].find(x => x.getAttribute('aria-label') === 'Sales operations v1.2');
    await press('Use in experiment', c); return { result: text(main.querySelector('.env-lib__result')), ref: state().experiments['exp-029'].environmentRef };`);
  assert.match(back.result, /Dependencies matched\. Experiment 029 now uses Sales operations v1\.2/);
  assert.deepEqual(back.ref, { id: 'env-sales', rev: '1.2' });
  const refused = await run(gym, `const c = [...main.querySelectorAll('.env-lib__card')].find(x => x.getAttribute('aria-label') === 'Customer support v1.2');
    await press('Use in experiment', c); return { result: text(main.querySelector('.env-lib__result.is-bad')), ref: state().experiments['exp-029'].environmentRef };`);
  assert.match(refused.result, /Dependencies not matched: .*missing .*email\.send_email/);
  assert.deepEqual(refused.ref, { id: 'env-sales', rev: '1.2' }, 'a failed check keeps the current environment');

  await gym.go('#/environments/tpl-sales-operations/revisions/1');
  const rev = await run(gym, `return text(main);`);
  assert.match(rev, /Sales operations.*Revision 1 · immutable · 4 systems · 12 tools · 4 relationships/);
  assert.match(rev, /email\.timeout_after_send/);
  assert.match(rev, /Custom adapter/);
  assert.match(rev, /matches this revision/);
}));

test('the attach button reads a local JSON fixture, shows a parse summary, and imports it as one undoable change', async t => withGym(t, async gym => {
  const dir = mkdtempSync(join(tmpdir(), 'gym-env-'));
  const good = join(dir, 'desk.json');
  const bad = join(dir, 'live.json');
  const component = { id: 'desk', kind: 'tickets', name: 'Desk', category: 'Tickets', tools: [{ name: 'get_ticket', effect: 'read', input: { ticketId: 'string' }, output: { ticket: 'Ticket' } }] };
  writeFileSync(good, JSON.stringify({ name: 'Imported desk', components: [component] }));
  writeFileSync(bad, JSON.stringify({ name: 'Live desk', components: [{ ...component, mode: 'live' }] }));
  await gym.go(BUILDER);
  const attach = async file => {
    const { root } = await gym.page.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await gym.page.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input.env-file' });
    await gym.page.send('DOM.setFileInputFiles', { nodeId, files: [file] });
    return run(gym, `await new Promise(r => setTimeout(r, 150)); return text(document.querySelector('dialog.gym-dialog'));`);
  };
  const refused = await attach(bad);
  assert.match(refused, /Fixture not imported.*live connections are not supported/);
  await run(gym, `await press('Close', document.querySelector('dialog.gym-dialog'));`);
  const summary = await attach(good);
  assert.match(summary, /Import local fixture\?.*Nothing was uploaded.*Imported desk.*1 system · 1 tool · 0 relationships.*Simulated/);
  assert.equal(await run(gym, `return text(main.querySelector('.env-counts'))`), '4 systems · 12 tools · 4 relationships', 'nothing changes before the import is confirmed');
  const imported = await run(gym, `await press('Import fixture', document.querySelector('dialog.gym-dialog'));
    const after = [text(main.querySelector('.env-counts')), draft().name]; await press('Undo'); return [...after, text(main.querySelector('.env-counts')), draft().name];`);
  assert.deepEqual(imported, ['1 system · 1 tool · 0 relationships', 'Imported desk', '4 systems · 12 tools · 4 relationships', 'Sales operations']);
}));

test('no horizontal page scroll at 390 and 768px on the three environment screens', async t => withGym(t, async gym => {
  for (const width of [390, 768]) {
    await gym.size(width, 900);
    for (const hash of [BUILDER, '#/environments', '#/environments/env-sales/revisions/1.2']) {
      await gym.go(hash);
      const { win, doc } = await gym.overflow();
      assert.ok(doc <= win, `${hash} at ${width}px scrolls sideways: ${doc} > ${win}`);
    }
    await gym.go(BUILDER);
    assert.equal(await gym.ev(`return getComputedStyle(document.querySelector('.env-cols')).gridTemplateColumns.split(' ').length`), 1, `columns stack at ${width}px`);
  }
}));

test('leaving with unapplied component edits asks first: Keep editing stays, Apply and leave commits, Discard and leave drops; Back asks too', async t => withGym(t, async gym => {
  await gym.go('#/workbench/exp-029');
  const edit = value => `const n = main.querySelector('[data-focus-key="env:f:name"]'); n.focus(); n.value = ${JSON.stringify(value)}; n.dispatchEvent(new Event('input', { bubbles: true })); ${frame}`;
  const settle = `${frame} await new Promise(r => setTimeout(r, 120));`;
  const asked = `const d = document.querySelector('dialog.gym-dialog[open]'); return { hash: location.hash, title: text(d?.querySelector('h2')), buttons: d ? [...d.querySelectorAll('button')].map(text) : [] };`;
  const before = await run(gym, `location.hash = '#/environments/new?returnTo=exp-029'; ${settle} return comp('gmail').name;`);

  const away = await run(gym, `${edit('Mail edited')} location.hash = '#/runs?status=all'; ${settle} ${asked}`);
  assert.deepEqual(away, { hash: '#/environments/new?returnTo=exp-029', title: `Leave with unapplied changes to ${before}?`, buttons: ['Keep editing', 'Discard and leave', 'Apply and leave'] });

  const kept = await run(gym, `await press('Keep editing', document.querySelector('dialog.gym-dialog')); ${settle}
    return { hash: location.hash, dialogs: document.querySelectorAll('dialog').length, value: main.querySelector('[data-focus-key="env:f:name"]').value, name: comp('gmail').name };`);
  assert.deepEqual(kept, { hash: '#/environments/new?returnTo=exp-029', dialogs: 0, value: 'Mail edited', name: before });

  const back = await run(gym, `history.back(); ${settle} ${asked}`);
  assert.equal(back.hash, '#/environments/new?returnTo=exp-029', 'Back is held too');
  assert.deepEqual(back.buttons, ['Keep editing', 'Discard and leave', 'Apply and leave']);
  const applied = await run(gym, `await press('Apply and leave', document.querySelector('dialog.gym-dialog')); ${settle} return { hash: location.hash, name: comp('gmail').name, h1: text(main.querySelector('h1')) };`);
  assert.deepEqual(applied, { hash: '#/workbench/exp-029', name: 'Mail edited', h1: 'Agent Gym' }, 'Apply and leave commits the edit and finishes the Back');

  const dropped = await run(gym, `history.forward(); ${settle} ${edit('Mail dropped')} location.hash = '#/runs?status=all'; ${settle}
    await press('Discard and leave', document.querySelector('dialog.gym-dialog')); ${settle} return { hash: location.hash, name: comp('gmail').name };`);
  assert.deepEqual(dropped, { hash: '#/runs?status=all', name: 'Mail edited' });

  const free = await run(gym, `location.hash = '#/environments/new?returnTo=exp-029'; ${settle} location.hash = '#/workbench/exp-029'; ${settle} return { hash: location.hash, dialogs: document.querySelectorAll('dialog').length };`);
  assert.deepEqual(free, { hash: '#/workbench/exp-029', dialogs: 0 }, 'with nothing unapplied, leaving asks nothing');
}));

test('the Gmail component settings read "Gmail simulator" as in N2, while the app chips still say Gmail', async t => withGym(t, async gym => {
  await gym.go('#/environments/new?returnTo=exp-029');
  const out = await run(gym, `return { field: main.querySelector('[data-focus-key="env:f:name"]').value, id: comp('gmail').id,
    apps: [...main.querySelectorAll('.env-appselect__label')].map(text), chips: [...main.querySelectorAll('.env-turn--user .env-inline-chip')].map(text) };`);
  assert.equal(out.field, 'Gmail simulator');
  assert.equal(out.id, 'gmail');
  assert.deepEqual(out.apps, ['Salesforce', 'Gmail', 'Google Calendar']);
  assert.ok(out.chips.includes('Gmail'), out.chips.join());
}));
