// Every KPI tile carries a tone and a decorative trend line. Both come from attributes and CSS alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../../' + file, import.meta.url), 'utf8');
const html = await read('index.html');
const css = await read('css/console.css');

const TONES = ['accent', 'green', 'amber', 'red', 'violet'];
const TRENDS = ['up', 'down', 'flat', 'wave', 'step'];

const strips = [...html.matchAll(/<div class="card kpi-strip[^>]*>\n([\s\S]*?)\n<\/div>\n/g)].map(m => m[1]);
const tiles = strips.flatMap(body => [...body.matchAll(/<div class="metric"([^>]*)>/g)].map(m => m[1]));

test('index.html has the four KPI strips of four tiles', () => {
  assert.equal(strips.length, 4);
  assert.equal(tiles.length, 16);
});

test('every KPI tile has a data-tone and a data-trend from the allowed sets', () => {
  for (const attrs of tiles) {
    assert.ok(TONES.includes(attrs.match(/data-tone="([^"]+)"/)?.[1]), `tone on ${attrs}`);
    assert.ok(TRENDS.includes(attrs.match(/data-trend="([^"]+)"/)?.[1]), `trend on ${attrs}`);
  }
});

test('console.css defines a rule for every tone and every trend', () => {
  for (const t of TONES) assert.match(css, new RegExp(`\\.kpi-strip \\.metric\\[data-tone="${t}"\\]\\{--tone:var\\(--[\\w-]+\\)\\}`), t);
  for (const t of TRENDS) assert.match(css, new RegExp(`\\.kpi-strip \\.metric\\[data-trend="${t}"\\]\\{--spark:url\\("data:image/svg\\+xml,`), t);
});

test('the trend line is drawn by ::after, so no markup, number or svg sits in a KPI strip', () => {
  assert.match(css, /\.kpi-strip \.metric\[data-trend\]::after\{[^}]*mask:var\(--spark\)/);
  for (const body of strips) assert.doesNotMatch(body, /<svg|<canvas|<img/);
});
