#!/usr/bin/env node
// Turn the console dark: rewrite the colour tokens in css/tokens.css and move raw white surfaces onto tokens.
//
//   node tools/codemods/dark-fog.mjs          apply
//   node tools/codemods/dark-fog.mjs --check  exit 1 if a run would change a file
//
// Running it twice changes nothing. Text that sits on a coloured fill keeps its literal #fff.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CSS_DIRS = ['css', 'swm/css', 'agent-gym/css'];

const DARK = {
  ink: '#ececf1', 'ink-2': '#cfd3dc', muted: '#9aa1ad', faint: '#646a77',
  bg: '#121318', panel: '#1d1f26', soft: '#262932', 'soft-2': '#21232b', line: '#30333d', 'line-strong': '#454956',
  nav: '#1a1b21', 'nav-2': '#2a2d36', 'nav-deep': '#15161b',
  blue2: '#a3b2ff', blue3: '#bcc7ff', 'blue-line': '#4b5aa9', 'blue-line-soft': '#353e74', lav: '#262c4d', 'lav-2': '#1e2238',
  green: '#7fd6b0', 'green-dot': '#3fb98a', 'green-line': '#2b5a49', 'green-bg': '#16302a', 'green-soft': '#16251f',
  amber: '#f0c36a', 'amber-dot': '#e0aa3e', 'amber-line': '#5a4a22', 'amber-bg': '#33290f', 'amber-soft': '#272114',
  red: '#f4a0a0', 'red-dot': '#ef6b6b', 'red-line': '#6a3232', 'red-bg': '#3a1c1c', 'red-soft': '#2a1a1b',
  violet: '#c6b3f7', 'violet-dot': '#a47cf0', 'violet-line': '#4b3f7a', 'violet-bg': '#2a2444',
  'shadow-sm': '0 1px 3px rgba(0, 0, 0, .35)', 'shadow-md': '0 5px 15px rgba(0, 0, 0, .35)',
  shadow: '0 10px 30px rgba(0, 0, 0, .4)', 'shadow-pop': '0 24px 80px rgba(0, 0, 0, .6)',
  ring: '0 0 0 3px rgba(113, 138, 255, .28)',
};

const ADDED = `
  /* Dark surfaces. --fog paints the page; --glass is a surface the fog shows through. */
  --blue-fill: #4a61d2;       /* fills that carry white text */
  --blue-fill-2: #5a70e0;
  --stage-ink: #e9edff;       /* light marks on the World Model chart stage */
  --stage-ink-2: #cdd5ff;
  --glass: rgba(29, 31, 38, .72);
  --glass-bar: rgba(18, 19, 24, .78);
  --fog: radial-gradient(900px 520px at 88% -4%, rgba(113, 138, 255, .22), transparent 62%),
         radial-gradient(700px 460px at 2% 100%, rgba(154, 114, 212, .13), transparent 70%),
         radial-gradient(600px 400px at 46% 44%, rgba(113, 138, 255, .05), transparent 70%),
         linear-gradient(135deg, #121318, #191b22);
`;

function tokens(css) {
  for (const [name, value] of Object.entries(DARK)) {
    const re = new RegExp(`(\\n\\s*--${name}:\\s*)[^;]+;`);
    if (!re.test(css)) throw new Error(`token --${name} not found`);
    css = css.replace(re, `$1${value};`);
  }
  if (!css.includes('--fog:')) css = css.replace(/\n(\s*--text-2xs:)/, `${ADDED}\n$1`);
  return css.replace(/:root \{/, m => css.includes('color-scheme: dark') ? m : `${m}\n  color-scheme: dark;`);
}

const INK_FILL = /background(?:-color)?:\s*var\(--(?:gym-)?ink(?:-2)?\)/;
const GYM = { 'gym-primary-softer': 'var(--lav-2)', 'gym-primary-line': 'var(--blue-line)', 'gym-gray': 'var(--muted)', 'gym-gray-soft': 'var(--soft)', 'gym-faint': 'var(--faint)' };

const surfaces = css => css
  .replace(/\{[^{}]*\}/g, rule => INK_FILL.test(rule) ? rule.replace(/([;{\s])color:\s*#fff\b/g, '$1color:var(--bg)') : rule)
  .replace(/(--(gym-[a-z-]+):\s*)#[0-9a-f]{3,8}\b/gi, (m, head, name) => GYM[name] ? head + GYM[name] : m)
  .replace(/background(-color)?:\s*#fff\b/g, 'background$1:var(--panel)')
  .replace(/(\.btn\.blue\{background:)var\(--blue2\)/g, '$1var(--blue-fill)')
  .replace(/(\.btn\.blue:hover\{background:)var\(--blue3\)/g, '$1var(--blue-fill-2)')
  .replace(/(\.topbar\{[^}]*?background:)rgba\(255,255,255,\.94\)/, '$1var(--glass-bar)');

const files = [['css/tokens.css', tokens], ['index.html', surfaces]];
for (const dir of CSS_DIRS) {
  for (const f of (await readdir(join(ROOT, dir))).filter(f => f.endsWith('.css')).sort()) {
    if (`${dir}/${f}` !== 'css/tokens.css') files.push([`${dir}/${f}`, surfaces]);
  }
}

let changed = 0;
for (const [rel, fn] of files) {
  const before = await readFile(join(ROOT, rel), 'utf8');
  const after = fn(before);
  if (after === before) continue;
  changed++;
  console.log(`${process.argv.includes('--check') ? 'would change' : 'changed'} ${rel}`);
  if (!process.argv.includes('--check')) await writeFile(join(ROOT, rel), after);
}
if (process.argv.includes('--check') && changed) process.exitCode = 1;
