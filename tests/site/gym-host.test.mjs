// The console's four Agent Gym views over one embedded app (js/gym-host.js), the parts that need no browser:
// which view owns each app route, the site hash for a route, and reading a route back from a site hash.
// Probe S47 in run-site-probes.mjs drives the real frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES } from '../../agent-gym/js/router.js';
import { SECTIONS, sectionOf } from '../../agent-gym/js/sections.js';
import { VIEWS, viewOf, rootOf, hashFor, requested } from '../../js/gym-host.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('every app route belongs to exactly one section, except the UI kit', () => {
  for (const { name } of ROUTES) {
    const owners = SECTIONS.filter(s => s.routes.includes(name)).map(s => s.id);
    assert.deepEqual(owners.length, name === 'kit' ? 0 : 1, `${name}: ${owners}`);
  }
  assert.equal(sectionOf('not-found'), null);
});

test('each app route opens the console view that owns it', () => {
  const cases = [
    ['/experiments', 'gym'], ['/experiments?status=running&q=sales', 'gym'], ['/workbench/exp-029', 'gym'], ['/workbench/exp-031?tab=compare', 'gym'],
    ['/environments', 'gym-environments'], ['/environments/new?returnTo=exp-029&focus=describe', 'gym-environments'], ['/environments/env-sales/revisions/1.2', 'gym-environments'],
    ['/scenarios', 'gym-scenarios'], ['/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up', 'gym-scenarios'], ['/scenario-sets/set-follow-up-resilience/revisions/1', 'gym-scenarios'],
    ['/runs?status=all', 'gym-runs'], ['/runs?status=running', 'gym-runs'], ['/experiments/exp-029/attempts/attempt-001', 'gym-runs'], ['/experiments/exp-029/attempts/attempt-001/results', 'gym-runs'],
    ['/kit', null], ['/nope', null],
  ];
  assert.deepEqual(cases.map(([path]) => [path, viewOf(path)]), cases);
});

test('a section root is the plain view link; any other route rides along as path and reads back unchanged', () => {
  assert.deepEqual(Object.values(VIEWS).map(v => [v, rootOf(v), hashFor(v, rootOf(v))]), [
    ['gym', '/experiments', '#view=gym'], ['gym-environments', '/environments', '#view=gym-environments'],
    ['gym-scenarios', '/scenarios', '#view=gym-scenarios'], ['gym-runs', '/runs?status=all', '#view=gym-runs']]);
  for (const v of Object.values(VIEWS)) assert.equal(viewOf(rootOf(v)), v, `${v} owns its own root`);
  const path = '/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&source=chat';
  const hash = hashFor('gym-scenarios', path);
  assert.equal(hash, '#view=gym-scenarios&path=%2Fscenarios%2Fnew%3Fenvironment%3Denv-sales%401.2%26workflow%3Dwf-sales-follow-up%26source%3Dchat');
  assert.equal(requested(hash, 'gym-scenarios'), path);
  assert.equal(requested(hash.slice(1), 'gym-scenarios'), path, 'with or without the leading #');
});

test('a path is read only for the view the hash names, and only as an app route', () => {
  assert.equal(requested('#view=gym-runs&path=%2Fruns%3Fstatus%3Drunning', 'gym'), null);
  assert.equal(requested('#view=gym-runs', 'gym-runs'), null);
  assert.equal(requested('#view=gym-runs&path=https%3A%2F%2Fevil.example', 'gym-runs'), null);
  assert.equal(requested('#view=gym-runs&path=runs', 'gym-runs'), null);
});

test('the sidebar lists the four views in section order, and each has a title row but no frame of its own', async () => {
  const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  const gymButtons = [...html.matchAll(/data-view="(gym[^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(gymButtons, SECTIONS.map(s => VIEWS[s.id]));
  for (const id of Object.values(VIEWS)) {
    const section = html.match(new RegExp(`<section class="view gym-view" id="${id}">([\\s\\S]*?)</section>`))?.[1];
    assert.ok(section, `${id} has a section`);
    assert.match(section, /class="title-row"/);
    assert.doesNotMatch(section, /<iframe|frame-wrap/, `${id} holds only its title row`);
  }
});
