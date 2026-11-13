// Every KPI tile carries a tone and a decorative trend line. Both come from attributes and CSS alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../../' + file, import.meta.url), 'utf8');
const html = await read('index.html');
const css = await read('css/console.css');

import { TRENDS, VARIANTS, applySparks } from '../../tools/kpi-sparks.mjs';

const TONES = ['accent', 'green', 'amber', 'red', 'violet'];
const sparkOf = attrs => `${attrs.match(/data-trend="([^"]+)"/)?.[1]}-${attrs.match(/data-spark="([^"]+)"/)?.[1]}`;

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

test('console.css defines a rule for every tone and a line for every trend variant', () => {
  for (const t of TONES) assert.match(css, new RegExp(`\\.kpi-strip \\.metric\\[data-tone="${t}"\\]\\{--tone:var\\(--[\\w-]+\\)\\}`), t);
  for (const t of TRENDS) for (const v of VARIANTS) assert.ok(css.includes(`.kpi-strip .metric[data-trend="${t}"][data-spark="${v}"]{--spark:url("data:image/svg+xml,`), `${t}-${v}`);
  assert.equal(applySparks(css), css, 'run: node tools/kpi-sparks.mjs');
});

test('no two KPI tiles share a trend line', () => {
  const lines = tiles.map(sparkOf);
  for (const line of lines) assert.match(line, new RegExp(`^(${TRENDS.join('|')})-(${VARIANTS.join('|')})$`));
  assert.equal(new Set(lines).size, lines.length, lines.join(' '));
  const drawn = lines.map(line => css.match(new RegExp(`data-trend="${line.split('-')[0]}"\\]\\[data-spark="${line.split('-')[1]}"\\]\\{--spark:([^}]+)`))[1]);
  assert.equal(new Set(drawn).size, drawn.length);
});

test('the trend line is drawn by ::after, so no markup, number or svg sits in a KPI strip', () => {
  assert.match(css, /\.kpi-strip \.metric\[data-trend\]::after\{[^}]*mask:var\(--spark\)/);
  for (const body of strips) assert.doesNotMatch(body, /<svg|<canvas|<img/);
});
