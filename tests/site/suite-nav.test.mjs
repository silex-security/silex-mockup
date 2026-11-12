// The product suite as a visitor meets it: the sidebar groups, in lifecycle order, over the real index.html markup.
// readSuite takes plain entries, so the sidebar is scanned with regexes here and no browser is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSuite, readCaps, groupOf, railHtml, mapHtml, CAP_ICONS } from '../../js/suite-nav.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');

const text = s => s.replace(/&amp;/g, '&');
const attr = (tag, name) => tag.match(new RegExp(`\\sdata-${name}="([^"]*)"`))?.[1];
const entries = [...html.matchAll(/<div class="section-label"([^>]*)>([^<]*)<\/div>|<button[^>]*\sdata-view="([^"]+)"[^>]*>(?:<span class="ico">[^<]*<\/span>)?([^<]*)<\/button>/g)]
  .map(m => m[3] ? { type: 'view', id: m[3], label: text(m[4]).trim() }
    : { type: 'group', text: m[2].trim(), key: attr(m[1], 'suite'), stage: attr(m[1], 'stage'), status: attr(m[1], 'status'), desc: attr(m[1], 'desc'), caps: text(attr(m[1], 'caps') ?? '') || undefined });
const sidebarViews = entries.filter(e => e.type === 'view');
const groups = readSuite(entries);
const sections = [...html.matchAll(/<section class="view[^"]*" id="([^"]+)"/g)].map(m => m[1]);
const viewNames = html.match(/const viewNames=\{([^}]*)\}/)[1];

test('the sidebar lists the suite in lifecycle order', () => {
  assert.deepEqual(groups.map(g => g.key), ['foundry', 'studio', 'gym', 'runtime', 'speedrun']);
  assert.deepEqual(groups.map(g => g.label), ['SILEX Foundry', 'Agent Studio', 'Agent Gym', 'SILEX Runtime', 'SILEX Speedrun']);
  for (const g of groups) assert.ok(g.stage && g.desc && g.views.length, `${g.key} has a stage, a description and views`);
});

test('the three views the owner asked for keep their labels', () => {
  const label = id => sidebarViews.find(v => v.id === id)?.label;
  assert.equal(label('security-model'), 'Enterprise World Model');
  assert.equal(label('runtime-observation'), 'Runtime Observation');
  assert.equal(label('blueprint'), 'Blueprint Studio');
});

test('every nav destination appears in exactly one place', () => {
  const ids = sidebarViews.map(v => v.id);
  assert.equal(new Set(ids).size, ids.length, 'no view is listed twice');
  const inGroups = groups.flatMap(g => g.views.map(v => v.id));
  assert.deepEqual(ids.filter(id => !inGroups.includes(id)), ['assurance'], 'only the home view sits outside the suite');
});

test('each product holds the views its stage promises', () => {
  const ids = key => groups.find(g => g.key === key).views.map(v => v.id);
  assert.deepEqual(ids('foundry'), ['security-model']);
  assert.deepEqual(ids('studio'), ['blueprint', 'library']);
  assert.deepEqual(ids('gym'), ['gym', 'gym-environments', 'gym-scenarios', 'gym-runs']);
  assert.deepEqual(ids('runtime'), ['runtime-observation', 'incidents']);
  assert.deepEqual(ids('speedrun'), ['speedrun']);
});

test('every sidebar view has a page and a breadcrumb name', () => {
  for (const v of sidebarViews) {
    assert.ok(sections.includes(v.id), `${v.id} has a <section class="view">`);
    assert.match(viewNames, new RegExp(`(^|[,{'])'?${v.id}'?:`), `${v.id} is in viewNames`);
  }
});

test('detail views belong to the group of the list they open from', () => {
  assert.equal(groupOf(groups, 'incidents').key, 'runtime');
  assert.equal(groupOf(groups, 'library').key, 'studio');
  assert.equal(groupOf(groups, 'assurance'), undefined);
});

test('the rail and the map are rendered from the groups', () => {
  const rail = railHtml(groups, 'gym');
  assert.equal([...rail.matchAll(/data-suite-chip="/g)].length, 5);
  assert.equal([...rail.matchAll(/aria-current="true"/g)].length, 1);
  assert.match(rail, /data-suite-chip="gym"[^>]*data-jump="gym"[^>]*aria-current="true"/);
  assert.equal([...railHtml(groups, undefined).matchAll(/aria-current/g)].length, 0, 'the home view highlights no chip');
  const map = mapHtml(groups);
  for (const v of sidebarViews.filter(v => v.id !== 'assurance')) assert.match(map, new RegExp(`data-jump="${v.id}"`), `${v.id} has a button on the map`);
  assert.equal([...map.matchAll(/class="suite-card"/g)].length, 4);
  assert.match(map, /Execution evidence → Validate → Reusable knowledge/);
});

const sectionHtml = id => html.match(new RegExp(`<section class="view[^"]*" id="${id}">([\\s\\S]*?)\\n</section>`))[1];

test('the Runtime group offers Runtime Observation and Incidents & Decisions only', () => {
  const runtime = groups.find(g => g.key === 'runtime').views;
  assert.deepEqual(runtime.map(v => v.label), ['Runtime Observation', 'Incidents & Decisions']);
  for (const gone of ['overview', 'policies']) assert.ok(!sidebarViews.some(v => v.id === gone), `no sidebar button opens ${gone}`);
});

test('Operations Overview stays reachable by #view=overview and keeps the bridge targets', () => {
  assert.ok(sections.includes('overview'));
  assert.match(sectionHtml('overview'), /id="ovStudioPending"/);
  assert.match(sectionHtml('overview'), /id="ovPendingCount"/);
});

test('the PCP panel lives inside the Incidents & Decisions page with its bridge target', () => {
  assert.ok(!sections.includes('policies'), 'policies is a panel, not a view');
  const page = sectionHtml('incidents');
  assert.match(page, /<h1>Incidents &amp; Decisions<\/h1>/);
  assert.equal([...page.matchAll(/<h1[ >]/g)].length, 1, 'one h1 per view');
  assert.match(page, /<div id="policies"[^>]*>[\s\S]*id="pcpStudioCards"/);
  assert.match(page, /data-inc-switch="incidents"[\s\S]*data-inc-switch="decisions"/);
  assert.doesNotMatch(viewNames, /policies:/, 'the retired view has no breadcrumb name');
});

test('Agent Gym is one app in four views: workbench, environments, scenarios, runs and results', () => {
  const gym = groups.find(g => g.key === 'gym');
  assert.deepEqual(gym.views.map(v => v.label), ['Experiment Workbench', 'Environments', 'Scenarios', 'Runs & Results']);
  assert.match(gym.desc, /private simulation/i);
  assert.doesNotMatch(html, /class="nav-ext"|nav-ext\b/, 'the link out to the standalone app is gone');
  for (const id of ['short-term', 'scenario-expansion', 'long-term']) assert.ok(!sections.includes(id), `${id} has no page any more`);
  assert.equal([...html.matchAll(/<iframe|id="gymFrameWrap"/g)].length, 1, 'one frame container, shared by the four views');
});

const STAGES = { foundry: 'Shared knowledge', studio: 'Pre-deployment', gym: 'Verification · Validation · Assurance', runtime: 'Production', speedrun: 'Performance enhancement' };
const CAPS = {
  studio: ['Blueprint check', 'Context & knowledge configuration', 'Reusable workflows'],
  gym: ['Private simulation environment', 'Normal, boundary & adversarial testing', 'Outcome validation & regression replay'],
  runtime: ['Security', 'Safety', 'Observability'],
  speedrun: ['Quality & task success', 'Cost & inference efficiency', 'Latency & execution paths'],
};

test('each product states its lifecycle stage and three capabilities', () => {
  assert.deepEqual(Object.fromEntries(groups.map(g => [g.key, g.stage])), STAGES);
  assert.deepEqual(groups.find(g => g.key === 'foundry').caps, []);
  for (const [key, titles] of Object.entries(CAPS)) {
    const caps = groups.find(g => g.key === key).caps;
    assert.equal(caps.length, 3, `${key} has three capabilities`);
    assert.deepEqual(caps.map(c => c.title), titles);
  }
  const runtime = groups.find(g => g.key === 'runtime').caps;
  assert.equal(runtime[0].detail, 'attacks, misuse & unauthorized actions');
  assert.equal(runtime[2].detail, 'trajectories, state changes & evidence');
});

test('readCaps reads an optional icon prefix before the title and detail', () => {
  assert.deepEqual(readCaps('lock~Security: attacks, misuse|Plain|eye~Observability'), [
    { icon: 'lock', title: 'Security', detail: 'attacks, misuse' },
    { title: 'Plain' },
    { icon: 'eye', title: 'Observability' },
  ]);
});

test('every capability in the sidebar names an icon the registry draws', () => {
  for (const g of groups) for (const c of g.caps) {
    assert.ok(c.icon, `${g.key} / ${c.title} names an icon`);
    assert.ok(CAP_ICONS[c.icon], `${c.icon} is in the registry`);
  }
  for (const [name, svg] of Object.entries(CAP_ICONS)) {
    assert.match(svg, /^<svg [^>]*viewBox="0 0 24 24"[^>]*fill="none"[^>]*stroke="currentColor"[^>]*stroke-width="1.8"[^>]*aria-hidden="true"/, name);
    assert.ok(groups.some(g => g.caps.some(c => c.icon === name)), `${name} is used`);
  }
});

test('the map draws one icon per capability and keeps the dot for one without', () => {
  const map = mapHtml(groups);
  assert.equal([...map.matchAll(/<svg /g)].length, 12);
  const list = mapHtml([{ key: 'x', label: 'X', short: 'X', stage: '', desc: '', views: [], caps: [{ title: 'A' }, { icon: 'nope', title: 'B' }, { icon: 'lock', title: 'C' }] }, { key: 'y', label: 'Y', short: 'Y', stage: '', desc: '', views: [], caps: [] }]);
  assert.equal([...list.matchAll(/<svg /g)].length, 1, 'only the known icon draws');
});

test('the map lists every capability in a suite-caps list on its card', () => {
  const map = mapHtml(groups);
  for (const [key, titles] of Object.entries(CAPS)) {
    const card = map.match(new RegExp(`<article class="suite-card" data-suite-card="${key}">[\\s\\S]*?</article>`))[0];
    const list = card.match(/<ul class="suite-caps">[\s\S]*?<\/ul>/)[0];
    assert.equal([...list.matchAll(/<li[ >]/g)].length, 3);
    for (const t of titles) assert.ok(list.includes(`<b>${t.replace(/&/g, '&amp;')}</b>`), `${key} lists ${t}`);
  }
});

test('the map draws the three loops of the suite diagram', () => {
  const map = mapHtml(groups);
  for (const s of ['Test optimizations', 'Performance improvement spans design, testing, and production', 'Execution evidence → Validate → Reusable knowledge']) assert.ok(map.includes(s), s);
  assert.match(map, /Agent Gym ⇄ SILEX Speedrun/);
  assert.equal([...map.matchAll(/class="suite-next"/g)].length, 3, 'an arrow between each adjacent pair of cards');
  const order = [...map.matchAll(/class="suite-(top|row|span|band)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['top', 'row', 'span', 'band'], 'the optimization loop sits above the cards, the span band below them, the foundation last');
});

test('the optimization bracket ends in arrowheads on the two cards and hides with the bracket', async () => {
  const css = await readFile(resolve(ROOT, 'css/console.css'), 'utf8');
  assert.match(css, /\.suite-test::after\{[^}]*bottom:/, 'an arrowhead layer sits at the bracket feet');
  const narrow = css.match(/@media\(max-width:1100px\)\{[^\n]*\.suite-test::before[^\n]*/)?.[0] ?? '';
  assert.match(narrow, /\.suite-test::after/, 'hidden below 1100px with the bracket');
});

test('the assurance case has its own view, and the home page only links to it', () => {
  const home = sectionHtml('assurance'), kase = sectionHtml('assurance-case');
  for (const s of ['The Correspondence Problem', 'The autonomy flywheel', 'KNOWN BLIND SPOTS']) {
    assert.doesNotMatch(home, new RegExp(s), `home no longer holds ${s}`);
    assert.match(kase, new RegExp(s), `the assurance case holds ${s}`);
  }
  assert.equal([...kase.matchAll(/<h1[ >]/g)].length, 1, 'one h1 per view');
  assert.match(kase, /<h1>Assurance case<\/h1>/);
  assert.match(viewNames, /'assurance-case':'Assurance case'/);
  assert.match(home, /data-wm-route="#view=assurance-case"/);
  assert.ok(!sidebarViews.some(v => v.id === 'assurance-case'), 'no sidebar button');
});

test('no product carries a maturity chip, on the map or in a view title', () => {
  assert.doesNotMatch(html.slice(html.indexOf('<aside'), html.indexOf('</aside>')), /data-status=/);
  assert.doesNotMatch(mapHtml(groups), /rx-stt|Building|Designed|Roadmap/);
  for (const id of ['gym', 'gym-environments', 'gym-scenarios', 'gym-runs']) assert.doesNotMatch(sectionHtml(id), /rx-stt/, id);
});
