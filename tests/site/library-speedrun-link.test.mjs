// The Workflow Library (index.html) and Speedrun (speedrun/web/upstream) show the same entity, a multi-agent workflow run
// by an agent team. The relation is stored once per app: `team` on a workflowData or UNREGISTERED entry, `workflow` on a
// fixtures.ts team. Both source files are read as text. These tests fail when the two sides disagree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const fixtures = readFileSync(join(ROOT, 'speedrun/web/upstream/src/lib/data/fixtures.ts'), 'utf8');

const between = (s, from, to) => { const a = s.indexOf(from), b = s.indexOf(to, a); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return s.slice(a, b); };

const registered = Object.fromEntries(between(html, 'const workflowData={', '// Known in the environment').split(/\n\s*'(?=WF-\d+':\{)/).slice(1).map(chunk => {
  const id = chunk.slice(0, chunk.indexOf("'"));
  return [id, { name: chunk.match(/name:'([^']*)'/)[1], agents: Number(chunk.match(/agents:(\d+)/)[1]), team: chunk.match(/\bteam:'([^']*)'/)?.[1] }];
}));
const unregistered = [...between(html, 'const UNREGISTERED=', '\n').matchAll(/\['([^']*)','([^']*)','([^']*)'(?:,'([^']*)')?\]/g)].map(m => ({ name: m[1], team: m[4] }));

const teams = between(fixtures, 'export const teams: AgentTeam[] = [', '\n];').split(/\n  \{\n/).slice(1).map(chunk => {
  const w = chunk.match(/workflow: \{ status: "(registered|unregistered)",(?: id: "([^"]+)",)? name: "([^"]+)" \}/);
  return { id: chunk.match(/\bid: "([^"]+)"/)[1], members: chunk.match(/members: \[(.*)\],/)[1].split('m("').length - 1, workflow: w && { status: w[1], id: w[2], name: w[3] } };
});
const teamIds = new Set(teams.map(t => t.id));

test('the parsers found the data', () => {
  assert.ok(Object.keys(registered).length >= 6 && unregistered.length >= 3 && teams.length >= 6);
});
test('every team named in the Library is a Speedrun team, once', () => {
  const named = [...Object.values(registered), ...unregistered].map(w => w.team).filter(Boolean);
  for (const t of named) assert.ok(teamIds.has(t), `unknown Speedrun team ${t}`);
  assert.deepEqual(named, [...new Set(named)], 'a team is linked from two Library entries');
});
test('every Speedrun team says whether its workflow is in the Library', () => {
  for (const t of teams) assert.ok(t.workflow, `team ${t.id} has no workflow`);
});
test('a registered Speedrun workflow exists in the Library, points back, and agrees on name and agent count', () => {
  for (const t of teams.filter(t => t.workflow?.status === 'registered')) {
    const w = registered[t.workflow.id];
    assert.ok(w, `${t.id}: ${t.workflow.id} is not in workflowData`);
    assert.equal(w.team, t.id, `${t.workflow.id} does not point back to ${t.id}`);
    assert.equal(w.name, t.workflow.name, `${t.id}: workflow name`);
    assert.equal(w.agents, t.members, `${t.id}: agents vs members`);
  }
});
test('an unregistered Speedrun workflow is the Library entry that names the team, with the same name', () => {
  for (const t of teams.filter(t => t.workflow?.status === 'unregistered')) {
    const u = unregistered.find(u => u.team === t.id);
    assert.ok(u, `${t.id}: no UNREGISTERED entry names it`);
    assert.equal(u.name, t.workflow.name, `${t.id}: workflow name`);
  }
});
test('every Library entry with a team is the one that team names', () => {
  for (const [id, w] of Object.entries(registered).filter(([, w]) => w.team))
    assert.deepEqual(teams.find(t => t.id === w.team).workflow, { status: 'registered', id, name: w.name }, id);
  for (const u of unregistered.filter(u => u.team))
    assert.equal(teams.find(t => t.id === u.team).workflow?.status, 'unregistered', u.name);
});
