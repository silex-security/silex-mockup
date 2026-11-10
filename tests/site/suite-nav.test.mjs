// The product suite as a visitor meets it: the sidebar groups, in lifecycle order, over the real index.html markup.
// readSuite takes plain entries, so the sidebar is scanned with regexes here and no browser is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSuite, groupOf, railHtml, mapHtml } from '../../js/suite-nav.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');

const text = s => s.replace(/&amp;/g, '&');
const attr = (tag, name) => tag.match(new RegExp(`\\sdata-${name}="([^"]*)"`))?.[1];
const entries = [...html.matchAll(/<div class="section-label"([^>]*)>([^<]*)<\/div>|<button[^>]*\sdata-view="([^"]+)"[^>]*>(?:<span class="ico">[^<]*<\/span>)?([^<]*)<\/button>/g)]
  .map(m => m[3] ? { type: 'view', id: m[3], label: text(m[4]).trim() }
    : { type: 'group', text: m[2].trim(), key: attr(m[1], 'suite'), stage: attr(m[1], 'stage'), status: attr(m[1], 'status'), desc: attr(m[1], 'desc') });
const sidebarViews = entries.filter(e => e.type === 'view');
const groups = readSuite(entries);
const sections = [...html.matchAll(/<section class="view[^"]*" id="([^"]+)"/g)].map(m => m[1]);
const viewNames = html.match(/const viewNames=\{([^}]*)\}/)[1];

test('the sidebar lists the suite in lifecycle order', () => {
  assert.deepEqual(groups.map(g => g.key), ['foundry', 'studio', 'gym', 'runtime', 'speedrun']);
  assert.deepEqual(groups.map(g => g.label), ['SILEX Foundry', 'Agent Studio', 'Agent Gym', 'SILEX Runtime', 'SILEX Speedrun']);
  assert.deepEqual(groups.map(g => g.status), ['Building', 'Designed', 'Building', 'Building', 'Roadmap']);
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
  assert.deepEqual(ids('runtime'), ['runtime-observation', 'policies', 'incidents', 'overview']);
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

test('Agent Gym is one app in four views: workbench, environments, scenarios, runs and results', () => {
  const gym = groups.find(g => g.key === 'gym');
  assert.deepEqual(gym.views.map(v => v.label), ['Experiment Workbench', 'Environments', 'Scenarios', 'Runs & Results']);
  for (const word of ['environment', 'scenarios', 'baseline', 'variant', 'runs', 'evidence']) assert.match(gym.desc, new RegExp(word, 'i'), `the description names ${word}`);
  assert.doesNotMatch(html, /class="nav-ext"|nav-ext\b/, 'the link out to the standalone app is gone');
  for (const id of ['short-term', 'scenario-expansion', 'long-term']) assert.ok(!sections.includes(id), `${id} has no page any more`);
  assert.equal([...html.matchAll(/<iframe|id="gymFrameWrap"/g)].length, 1, 'one frame container, shared by the four views');
});
