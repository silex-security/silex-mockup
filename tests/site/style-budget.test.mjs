// The console's styles stay on the tokens of css/tokens.css, and the text tokens stay readable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { tokenize, tokenizeHtml } from '../../tools/codemods/tokenize-css.mjs';
import { auditCss } from '../../tools/style-audit.mjs';

const read = file => readFile(new URL('../../' + file, import.meta.url), 'utf8');
const tokens = Object.fromEntries([...(await read('css/tokens.css')).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

function luminance(hex) {
  const h = hex.slice(1), full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [hi, lo] = [luminance(tokens[a]), luminance(tokens[b])].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('console.css and the style attributes of index.html hold no raw value the codemod knows', async () => {
  const css = await read('css/console.css'), html = await read('index.html');
  assert.equal(tokenize(css), css, 'run: node tools/codemods/tokenize-css.mjs css/console.css');
  assert.equal(tokenizeHtml(html), html, 'run: node tools/codemods/tokenize-css.mjs index.html');
});

test('the Runtime and World Model stylesheets hold no raw value the codemod knows', async () => {
  const files = [...(await readdir(new URL('../../css/', import.meta.url))).filter(f => f.startsWith('rt-')).map(f => 'css/' + f), 'swm/css/swm.css', 'swm/css/swm-vowl.css'];
  const stale = [];
  for (const file of files) { const css = await read(file); if (tokenize(css) !== css) stale.push(file); }
  assert.deepEqual(stale, [], 'run: node tools/codemods/tokenize-css.mjs <file>');
});

test('console.css writes no raw colour except white and no font size in px', async () => {
  const css = (await read('css/console.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual([...new Set(css.match(/#[0-9a-f]{3,8}\b/gi))], ['#fff']);
  assert.deepEqual(css.match(/font-size:\s*[0-9.]+px/gi), null);
});

test('every token console.css uses is defined in css/tokens.css', async () => {
  const css = await read('css/console.css');
  const local = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const missing = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]))].filter(name => !(name in tokens) && !local.has(name));
  assert.deepEqual(missing, []);
});

test('text under 12px in console.css does not grow in number', async () => {
  // 202 when the tokens landed on 2026-11-10, 121 once --text-xs became 12px. What is left is 11px.
  // Lower this as views move to the 12px floor. Never raise it.
  assert.ok(auditCss(await read('css/console.css')).under12px <= 121);
});

test('text tokens reach 4.5:1 on the surfaces they sit on', () => {
  const pairs = [
    ...['--ink', '--ink-2', '--muted', '--accent-2', '--accent-3', '--green', '--amber', '--red', '--violet'].flatMap(t => [[t, '--panel'], [t, '--bg']]),
    ['--green', '--green-bg'], ['--amber', '--amber-bg'], ['--red', '--red-bg'], ['--violet', '--violet-bg'], ['--accent-2', '--accent-bg'],
    ['--nav-text', '--nav'], ['--nav-muted', '--nav'],
  ];
  const low = pairs.map(([text, surface]) => [text, surface, Number(contrast(text, surface).toFixed(2))]).filter(([, , ratio]) => ratio < 4.5);
  assert.deepEqual(low, []);
});
