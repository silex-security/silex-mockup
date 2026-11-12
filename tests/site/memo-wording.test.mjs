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

test('the World Model bundle carries the memo layer names', async () => {
  const bundle = JSON.parse(await read('swm/data/ontology.json'));
  const memo = ['General concepts and rules', 'Domain and enterprise knowledge', 'Agent execution knowledge', 'Runtime knowledge graph'];
  assert.deepEqual(bundle.layers.map(l => l.name), memo);
  assert.deepEqual(bundle.chain.layers.map(l => l.name), memo);
  assert.match(await read('swm/data/ontology.js'), /Runtime knowledge graph/);
});
