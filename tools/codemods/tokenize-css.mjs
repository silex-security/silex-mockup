#!/usr/bin/env node
// Replace raw colour, font-size, radius and shadow values with the tokens of css/tokens.css.
//
//   node tools/codemods/tokenize-css.mjs css/console.css index.html     rewrite in place
//   node tools/codemods/tokenize-css.mjs --check css/console.css        exit 1 when a rewrite would change the file
//
// A .css file is rewritten whole. An .html file is rewritten only inside style="..." attributes.
// Running it twice changes nothing the second time. White (#fff) stays raw: it is both a surface and a text colour.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const group = (token, hexes) => hexes.split(' ').map(h => [h, token]);
export const COLORS = new Map([
  ...group('ink', '#000 #17191d'),
  ...group('muted', '#4e5661 #4f5864 #545862 #555e69 #5a6270 #606975 #68707c #525b70 #4f5870 #46537a #737b85 #7a828d #8a919c #a0a6af #8b7773 #947b76'),
  ...group('faint', '#979da6 #89909a #afb5be #a2a8b0 #a3a9b3 #aab0ba #9aa1ad'),
  ...group('bg', '#eceef2 #eef0f2 #eef0f3 #f0f2f4'),
  ...group('soft', '#f5f6f8 #f7f8fa #f8f9fb #f8f9fc'),
  ...group('soft-2', '#fafbfc #fbfcfd #f8f8fa #fbfbfe #fcfcff'),
  ...group('line', '#dfe3e8 #e1e4e8 #e3e6ea #e8eaf0 #e9ebef #eaecf0'),
  ...group('line-strong', '#b9c0ca #bdc5d0 #c9ced6 #cfd4db #d6dae1 #d7c4c0'),
  ...group('nav', '#26282d'),
  ...group('nav-2', '#34373f #343740 #3a3d44'),
  ...group('nav-deep', '#1f2227'),
  ...group('nav-text', '#aeb4bf #bac0c9'),
  ...group('nav-muted', '#898f99 #9197a3'),
  ...group('blue', '#718aff #879aff #98a9ff'),
  ...group('blue2', '#536bdb'),
  ...group('blue-line', '#aebaff #b9c4ff #bfc8f7'),
  ...group('blue-line-soft', '#ccd4ff #cdd5ff #cfd6ff'),
  ...group('lav', '#e9edff'),
  ...group('lav-2', '#f5f7ff #f7f8ff #f8f9ff #fafbff'),
  ...group('green', '#22603e #377456'),
  ...group('green-dot', '#2b8766 #499777 #4bc28b'),
  ...group('green-line', '#b9decf'),
  ...group('green-bg', '#e5f4ee #eaf3ee'),
  ...group('green-soft', '#f8fcfa #f9fdfb'),
  ...group('amber', '#a66a14'),
  ...group('amber-dot', '#e2a04e #d58a3f'),
  ...group('amber-line', '#ffe08a #efd6aa #efba86'),
  ...group('amber-bg', '#fff3d8'),
  ...group('amber-soft', '#fffaf2 #fffaf3 #fffdf7'),
  ...group('red', '#6c3a3a #74433d #8d3636'),
  ...group('red-dot', '#c54545'),
  ...group('red-line', '#efbaba #f0c1bf #d7a59e'),
  ...group('red-bg', '#fcebea'),
  ...group('red-soft', '#fff6f5 #fff8f8 #fff9f8 #fffafa'),
  ...group('violet', '#3f2787 #50339c #5d4a86 #6f50c9'),
  ...group('violet-dot', '#9a72d4 #9b79ef'),
  ...group('violet-line', '#c9c2ee'),
  ...group('violet-bg', '#e4def8 #f1ecfb #f2edfd #f6f3ff'),
]);

const TEXT_STEPS = [[10, '2xs'], [11, 'xs'], [12, 'sm'], [13, 'base'], [14, 'md'], [16, 'lg'], [18, 'xl'], [20, '2xl'], [26, '3xl'], [30, '4xl']];
/** The largest step at or below the size, so text never grows inside a fixed box. Sizes under the floor rise to it. */
export const textToken = px => `var(--text-${(TEXT_STEPS.findLast(([step]) => step <= px) ?? TEXT_STEPS[0])[1]})`;

export function radiusToken(px) {
  if (px === 0) return '0';
  if (px <= 5) return 'var(--r-xs)';
  if (px <= 9) return 'var(--r-sm)';
  if (px <= 14) return 'var(--r-md)';
  if (px <= 24) return 'var(--radius)';
  return 'var(--r-pill)';
}

const SHADOWS = new Map(Object.entries({
  '0 1px 4px rgba(0,0,0,.08)': 'var(--shadow-sm)',
  '0 1px 3px rgba(22,28,45,.1)': 'var(--shadow-sm)',
  '0 4px 12px rgba(25,31,48,.06)': 'var(--shadow-md)',
  '0 5px 15px rgba(29,35,52,.06)': 'var(--shadow-md)',
  '0 5px 15px rgba(29,35,52,.07)': 'var(--shadow-md)',
  '0 7px 20px rgba(83,107,219,.11)': 'var(--shadow-md)',
  '0 24px 80px rgba(0,0,0,.3)': 'var(--shadow-pop)',
  '0 10px 35px rgba(0,0,0,.3)': 'var(--shadow-pop)',
  '0 10px 30px rgba(0,0,0,.25)': 'var(--shadow-pop)',
  '0 0 0 3px rgba(113,138,255,.12)': 'var(--ring)',
  '0 0 0 3px rgba(113,138,255,.18),0 7px 18px rgba(29,35,52,.08)': 'var(--ring),var(--shadow-md)',
  '0 0 0 3px rgba(113,138,255,.15),0 7px 18px rgba(29,35,52,.09)': 'var(--ring),var(--shadow-md)',
  'inset 0 0 0 1px #879aff,0 7px 20px rgba(83,107,219,.09)': 'inset 0 0 0 1px var(--blue),var(--shadow-md)',
}));

export function tokenize(css) {
  return css
    .replace(/(box-shadow:\s*)([^;}"]+)/gi, (all, head, value) => head + (SHADOWS.get(value.trim().replace(/,\s+/g, ',')) ?? value))
    .replace(/(font-size:\s*)([0-9.]+)px/gi, (all, head, px) => head + textToken(Number(px)))
    .replace(/(border-radius:\s*)([^;}"]+)/gi, (all, head, value) => head + value.replace(/([0-9.]+)px/g, (m, px) => radiusToken(Number(px))))
    .replace(/#[0-9a-f]{3,8}\b/gi, hex => COLORS.has(hex.toLowerCase()) ? `var(--${COLORS.get(hex.toLowerCase())})` : hex);
}

export const tokenizeHtml = html => html.replace(/(\sstyle=")([^"]*)(")/g, (all, open, body, close) => open + tokenize(body) + close);

async function main(args) {
  const check = args.includes('--check');
  let stale = 0;
  for (const file of args.filter(a => a !== '--check')) {
    const before = await readFile(file, 'utf8');
    const after = file.endsWith('.html') ? tokenizeHtml(before) : tokenize(before);
    if (after === before) continue;
    stale++;
    if (check) console.error(`${file} holds raw values the codemod would replace`); else { await writeFile(file, after); console.log(`rewrote ${file}`); }
  }
  return check && stale ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = await main(process.argv.slice(2));
