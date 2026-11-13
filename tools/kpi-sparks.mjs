#!/usr/bin/env node
// The decorative trend lines of the console's KPI tiles. Each tile names a direction and a variant
// (data-trend="up" data-spark="2"), and this tool draws one seeded random walk per pair into css/console.css.
// The lines are ornament: they come from a seed, not from data.
//
//   node tools/kpi-sparks.mjs          rewrite the block between the kpi-sparks markers
//   node tools/kpi-sparks.mjs --check  exit 1 if a run would change the file
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TRENDS = ['up', 'down', 'flat', 'wave', 'step'];
export const VARIANTS = [1, 2, 3, 4];
const W = 200, H = 36, PAD = 3, POINTS = 26;
const START = '/* kpi-sparks:start (node tools/kpi-sparks.mjs) */', END = '/* kpi-sparks:end */';

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = text => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const BASE = {
  up: () => t => 0.15 + 0.7 * t,
  down: () => t => 0.85 - 0.7 * t,
  flat: () => () => 0.5,
  wave: rnd => { const f = 1.1 + 1.4 * rnd(), p = rnd(), amp = 0.2 + 0.12 * rnd(); return t => 0.5 + amp * Math.sin(2 * Math.PI * (f * t + p)); },
  step: rnd => { const cuts = [0.15 + 0.2 * rnd(), 0.45 + 0.15 * rnd(), 0.7 + 0.2 * rnd()]; return t => 0.18 + 0.22 * cuts.filter(c => t >= c).length; },
};
const NOISE = { up: 0.3, down: 0.3, flat: 0.34, wave: 0.2, step: 0.1 };

/** Heights in 0..1 for one line: the trend's base curve plus a random walk that is pulled back to it. */
export function sparkValues(trend, variant) {
  const rnd = prng(hash(`${trend}-${variant}`)), base = BASE[trend](rnd);
  let drift = 0;
  return Array.from({ length: POINTS }, (_, i) => {
    drift = drift * 0.55 + (rnd() - 0.5) * NOISE[trend];
    return Math.min(1, Math.max(0, base(i / (POINTS - 1)) + drift));
  });
}

function sparkUrl(trend, variant) {
  const pts = sparkValues(trend, variant).map((v, i) => `${(PAD + i / (POINTS - 1) * (W - 2 * PAD)).toFixed(1)},${(PAD + (1 - v) * (H - 2 * PAD)).toFixed(1)}`);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'>`
    + `<polygon points='${pts.join(' ')} ${W - PAD},${H} ${PAD},${H}' fill='black' fill-opacity='.16'/>`
    + `<polyline points='${pts.join(' ')}' fill='none' stroke='black' stroke-width='1.6' stroke-linejoin='round' stroke-linecap='round' vector-effect='non-scaling-stroke'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}

export const sparkCss = () => [START, ...TRENDS.flatMap(t => VARIANTS.map(v => `.kpi-strip .metric[data-trend="${t}"][data-spark="${v}"]{--spark:${sparkUrl(t, v)}}`)), END].join('\n');

export function applySparks(css) {
  const a = css.indexOf(START), b = css.indexOf(END);
  if (a < 0 || b < a) throw Error('css/console.css has no kpi-sparks markers');
  return css.slice(0, a) + sparkCss() + css.slice(b + END.length);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = fileURLToPath(new URL('../css/console.css', import.meta.url));
  const css = await readFile(file, 'utf8'), next = applySparks(css);
  if (process.argv.includes('--check')) process.exitCode = next === css ? 0 : 1;
  else if (next !== css) await writeFile(file, next);
}
