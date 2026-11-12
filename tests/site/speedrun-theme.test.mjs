// The Speedrun app draws only with the console's tokens. speedrun/web/src/theme.css maps the app's role names to
// css/tokens.css, and no other Speedrun source writes a colour, a px font size or a px radius.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), WEB = join(ROOT, 'speedrun/web');
const read = f => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const defined = css => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const used = css => [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]))];

const tokens = defined(read(join(ROOT, 'css/tokens.css')));
const theme = read(join(WEB, 'src/theme.css'));
const sources = ['src', 'upstream/src'].flatMap(d => walk(join(WEB, d))).filter(f => /\.(css|tsx|jsx)$/.test(f));

test('every token the Speedrun theme reads is defined in css/tokens.css', () => {
  assert.deepEqual(used(theme).filter(name => !tokens.has(name)), []);
});

test('no Speedrun source writes a raw colour, a px font size or a px radius', () => {
  const RAW = [/#[0-9a-f]{3,8}\b/i, /\brgba?\(/, /\bhsla?\(/, /\btext-\[[0-9.]+px\]/, /\brounded-\[[0-9.]+px\]/, /font-size:\s*[0-9.]+px/];
  const hits = sources.flatMap(f => read(f).split('\n').flatMap((line, i) => RAW.some(re => re.test(line)) ? [`${relative(WEB, f)}:${i + 1}: ${line.trim().slice(0, 100)}`] : []));
  assert.deepEqual(hits, []);
});

test('every custom property a Speedrun source reads is a theme role or a console token', () => {
  const roles = defined(theme);
  // --tw-* belongs to css/trace-waterfall.css, and --color-* and --font-* are the Tailwind names globals.css declares.
  const known = name => roles.has(name) || tokens.has(name) || /^--(tw|color|font)-/.test(name);
  const missing = sources.flatMap(f => used(read(f)).filter(name => !known(name)).map(name => `${relative(WEB, f)}: ${name}`));
  assert.deepEqual(missing, []);
});

test('the built stylesheet carries the console tokens', () => {
  const css = walk(join(ROOT, 'speedrun/app/assets')).filter(f => f.endsWith('.css')).map(f => readFileSync(f, 'utf8')).join('\n');
  const flat = s => s.replace(/\s+/g, '').toLowerCase();
  for (const [, name, value] of readFileSync(join(ROOT, 'css/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--(?:bg|panel|ink|blue|blue2|text-base|radius)):\s*([^;]+);/g))
    assert.ok(flat(css).includes(flat(`${name}:${value}`)), `${name} in speedrun/app`);
});
