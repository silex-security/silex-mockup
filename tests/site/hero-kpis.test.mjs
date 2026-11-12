// The Platform hero shows four measured figures. Each is derived here from the data file the page it links to
// reads, so the hero cannot drift from the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = async p => readFile(resolve(ROOT, p), 'utf8');
const json = async p => JSON.parse(await read(p));
const html = await read('index.html');

const latency = await json('data/judge-latency.json');
const learning = await json('jev-runtime/demo/data/learning-evidence.json');
const s1 = await json('data/onto-s1.json');

const judge = label => latency.judges.find(j => j.label === label);
const kev = judge('kev-0.8b-ft'), hosted = judge('gpt-4o-mini');
const ms = x => `${Math.round(x)} ms`;
const share = x => `${x >= 0.995 || x < 0.005 ? (100 * x).toFixed(1).replace(/\.0$/, '') : Math.round(100 * x)}%`;
const auroc = key => learning.models[key].instruction_override.auroc.toFixed(2);

const tiles = [...html.matchAll(/<a class="as-kpi" href="([^"]+)" data-wm-route="([^"]+)"><div class="v">([^<]*)<\/div><div class="l">([^<]*)<\/div><div class="d flat">([^<]*)<\/div><\/a>/g)]
  .map(m => ({ href: m[1].replaceAll('&amp;', '&'), route: m[2].replaceAll('&amp;', '&'), v: m[3], l: m[4], d: m[5] }));

test('the hero strip has four measured tiles under a Measured today label', () => {
  assert.equal(tiles.length, 4);
  assert.match(html, /class="as-kpis-tag">Measured today</);
  for (const t of tiles) assert.equal(t.href, t.route, 'the href is the same route, so the link works without script');
});

test('judge latency tile matches data/judge-latency.json', () => {
  assert.equal(tiles[0].v, ms(kev.rtt_ms.p50));
  assert.equal(tiles[0].d, `vs ${ms(hosted.rtt_ms.p50)} hosted API · ${kev.items} held-out items`);
  assert.equal(kev.items, hosted.items, 'both judges ran the same items');
  assert.equal(tiles[0].route, '#view=runtime-observation&tab=latency');
});

test('gate budget tile matches the within_budget share of both judges', () => {
  assert.equal(kev.within_budget.budget_ms, 400);
  assert.equal(hosted.within_budget.budget_ms, 400);
  assert.equal(tiles[1].v, share(kev.within_budget.share));
  assert.equal(tiles[1].d, `vs ${share(hosted.within_budget.share)} hosted API`);
  assert.equal(tiles[1].route, '#view=runtime-observation&tab=latency');
});

test('AUROC tile matches jev-runtime/demo/data/learning-evidence.json', () => {
  assert.equal(tiles[2].v, `${auroc('kev-0.8b')} → ${auroc('kev-0.8b-ft')}`);
  assert.equal(tiles[2].d, `Kev-0.8B, instruction override · ${learning.test.benchmark}, ${learning.test.items} held-out items`);
  assert.equal(tiles[2].route, '#view=runtime-observation&tab=learning');
});

test('alert precision tile matches the S1 result in data/onto-s1.json', () => {
  const { prov, s1: stage1 } = s1.observed;
  assert.equal(tiles[3].v, `${prov.precision.toFixed(2)} → ${stage1.precision.toFixed(2)}`);
  assert.equal(tiles[3].d, `AgentDojo, ${s1.counts.runs.toLocaleString('en-US')} held-out runs`);
  assert.equal(tiles[3].route, '#view=runtime-observation&tab=ontology');
});

test('the old illustrative tiles are gone from the hero', () => {
  for (const gone of ['Weighted coverage', 'Entities understood', 'World-model fit']) assert.ok(!tiles.some(t => t.l === gone), gone);
});
