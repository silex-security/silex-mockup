// Wording of the console page follows the investor memo (logs/2026-11-11_HOME_MEMO_V3_ALIGNMENT.md, findings 6 to 10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFile(resolve(ROOT, p), 'utf8');
const html = await read('index.html');

const view = id => {
  const start = html.lastIndexOf('<section class="view', html.indexOf(`id="${id}"`));
  const end = html.indexOf('<section class="view', start + 1);
  return html.slice(start, end);
};

test('the layers card in the assurance case view uses the memo layer names', () => {
  const card = view('assurance-case');
  for (const name of ['General concepts and rules', 'Domain and enterprise knowledge', 'Agent execution knowledge', 'Runtime knowledge graph'])
    assert.ok(card.includes(name), name);
});

test('the old layer names are gone from the page and the World Model scripts', async () => {
  const names = (await readdir(resolve(ROOT, 'swm/js'))).filter(f => f.endsWith('.js'));
  const files = [['index.html', html], ...await Promise.all(names.map(async f => [`swm/js/${f}`, await read(`swm/js/${f}`)]))];
  for (const [file, text] of files)
    for (const old of ['agent-security semantics', 'Agentic-system', 'L4 · Runtime graph'])
      assert.ok(!text.includes(old), `${file} still has "${old}"`);
});

test('the Ontology Layers panel opens with the two ontologies, outside the container the script renders into', () => {
  const panel = view('security-model').split('id="wm-architecture"')[1].split('id="swmLayers"')[0];
  for (const text of ['SILEX pairs a Business Ontology with an Agent Execution Ontology.', 'Business Ontology', 'Agent Execution Ontology',
    'What the enterprise wants to achieve, and the definitions, relationships, rules and permissions that govern the work.',
    'How agents carry out that intent in practice: how they decompose tasks, coordinate across workflows, sequence tool calls, and decide when to delegate or escalate.',
    'Four layers evolve at different speeds, shaped by top-down business requirements and bottom-up execution evidence.'])
    assert.ok(panel.includes(text), text);
});

test('the hero states the thesis and leads with the world model button', () => {
  const hero = view('assurance');
  assert.ok(hero.includes('forward-deployed engineers translate business intent into agent workflows, one deployment at a time. SILEX makes that execution knowledge transferable, so a new deployment starts from practices that earlier ones validated.'));
  assert.ok(hero.indexOf('class="as-lede"') > hero.indexOf('</h1>') && hero.indexOf('class="as-lede"') < hero.indexOf('class="as-actions"'));
  const [primary, secondary] = [...hero.match(/<div class="as-actions">(.*?)<\/div>/s)[1].matchAll(/<button class="([^"]*)"([^>]*)>([^<]*)<\/button>/g)];
  assert.match(primary[1], /\bbtn blue\b/);
  assert.match(primary[2], /data-jump="security-model"/);
  assert.equal(primary[3], 'Explore the world model →');
  assert.match(secondary[1], /\bbtn ghost\b.*\brx-entry\b|\brx-entry\b.*\bbtn ghost\b/);
  assert.match(secondary[2], /data-open-incident="I-1042"/);
  assert.equal(secondary[3], 'Follow one blocked attack →');
});

test('each Agent Gym view note carries one point of the memo', () => {
  const note = id => view(id).match(/<p class="hover-note">(.*?)<\/p>/s)[1];
  assert.match(note('gym'), /^A flight simulator for agents\./);
  assert.match(note('gym'), /baseline against the variant in a private simulation/);
  assert.match(note('gym-environments'), /private simulation of task-relevant enterprise conditions, built from simulated components, tools, relations and permissions/);
  assert.ok(note('gym-scenarios').includes('Normal, edge-case and attack scenarios. The ontology connects business rules with agents, tools and permissions, which helps generate paths not seen in past logs. Red teams use that map to explore risky paths. Blue teams use it to trace alerts back to rules and intervention points.'));
  assert.match(note('gym-runs'), /evaluated against business intent, not task completion alone/);
  assert.match(note('gym-runs'), /regression tests for future changes/);
});

test('the World Model bundle carries the memo layer names', async () => {
  const bundle = JSON.parse(await read('swm/data/ontology.json'));
  const memo = ['General concepts and rules', 'Domain and enterprise knowledge', 'Agent execution knowledge', 'Runtime knowledge graph'];
  assert.deepEqual(bundle.layers.map(l => l.name), memo);
  assert.deepEqual(bundle.chain.layers.map(l => l.name), memo);
  assert.match(await read('swm/data/ontology.js'), /Runtime knowledge graph/);
});
