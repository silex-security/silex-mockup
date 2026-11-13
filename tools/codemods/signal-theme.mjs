#!/usr/bin/env node
// Signal theme: charcoal surfaces, one green accent, a faint terminal grid. After the Signal dark dashboard in
// https://adminlte.io/blog/dark-dashboard-templates/.
//
//   node tools/codemods/signal-theme.mjs          apply
//   node tools/codemods/signal-theme.mjs --check  exit 1 if a run would change a file
//
// 1. Renames the accent tokens (--blue*, --lav*) to --accent* everywhere a source reads them, since the accent is
//    no longer blue. 2. Rewrites the token values in css/tokens.css. 3. Moves the literal colours the embedded apps
//    and chart code still carry onto the new palette. Chart category palettes (World Model stage, layer and coverage
//    ramps, Blueprint node kinds) are data colours and stay. Running it twice changes nothing.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const RENAME = {
  'blue-line-soft': 'accent-line-soft', 'blue-line': 'accent-line', 'blue-fill-2': 'accent-fill-2', 'blue-fill': 'accent-fill',
  'blue-soft': 'accent-bg', 'blue-ring': 'accent-ring', 'blue-2': 'accent-2', blue2: 'accent-2', blue3: 'accent-3', blue: 'accent',
  'lav-2': 'accent-soft', lav: 'accent-bg',
};
const RENAME_RE = new RegExp(`--(${Object.keys(RENAME).join('|')})(?![\\w-])`, 'g');
const rename = s => s.replace(RENAME_RE, (_, name) => `--${RENAME[name]}`);

const SIGNAL = {
  ink: '#e7e9ea', 'ink-2': '#c6cacd', muted: '#959ba1', faint: '#5d636a',
  bg: '#0c0d0f', panel: '#15171a', soft: '#1d2024', 'soft-2': '#191b1f', line: '#262a2f', 'line-strong': '#393e45',
  nav: '#101114', 'nav-2': '#1f2226', 'nav-deep': '#0a0b0d', 'nav-text': '#aab0b5', 'nav-muted': '#8d9399',
  'nav-green': '#4ade80',
  accent: '#22c55e', 'accent-2': '#4ade80', 'accent-3': '#86efac', 'accent-line': '#1e6b3c', 'accent-line-soft': '#163f27',
  'accent-bg': '#0f2a1a', 'accent-soft': '#0c1e14', 'accent-fill': '#22c55e', 'accent-fill-2': '#4ade80',
  green: '#5fd8c8', 'green-dot': '#2bb8a6', 'green-line': '#1e5550', 'green-bg': '#0f2d2a', 'green-soft': '#0d211f',
  glass: 'rgba(21, 23, 26, .8)', 'glass-bar': 'rgba(12, 13, 15, .84)',
  fog: `radial-gradient(900px 520px at 88% -4%, rgba(34, 197, 94, .10), transparent 62%),
         radial-gradient(700px 460px at 2% 100%, rgba(45, 212, 191, .05), transparent 70%),
         linear-gradient(180deg, #0c0d0f, #0f1113)`,
  'r-md': '10px', radius: '12px',
  ring: '0 0 0 3px rgba(34, 197, 94, .3)',
};
const GRID = `
  --grid: linear-gradient(rgba(255, 255, 255, .022) 1px, transparent 1px) 0 0 / 28px 28px,
          linear-gradient(90deg, rgba(255, 255, 255, .022) 1px, transparent 1px) 0 0 / 28px 28px;`;

function tokens(css) {
  for (const [name, value] of Object.entries(SIGNAL)) {
    const re = new RegExp(`(\\n\\s*--${name}:\\s*)[^;]+;`);
    if (!re.test(css)) throw new Error(`token --${name} not found`);
    css = css.replace(re, `$1${value};`);
  }
  css = css.replace('--accent: #22c55e;            /* borders, focus and marks */', '--accent: #22c55e;          /* borders, focus, marks and fills that carry var(--bg) text */')
    .replace('--accent-2: #4ade80;           /* text, links and fills that carry text */', '--accent-2: #4ade80;        /* text and links */')
    .replace('--accent-fill: #22c55e;       /* fills that carry white text */', '--accent-fill: #22c55e;       /* fills that carry var(--bg) text */');
  return css.includes('--grid:') ? css : css.replace(/(\n\s*--fog:[^;]+;)/, `$1${GRID}`);
}

// Surface and text literals that mirror the old tokens, in the embedded apps and chart code.
const NEUTRAL = {
  '#121318': '#0c0d0f', '#191b22': '#0f1113', '#1d1f26': '#15171a', '#262932': '#1d2024', '#21232b': '#191b1f',
  '#30333d': '#262a2f', '#454956': '#393e45', '#1a1b21': '#101114', '#2a2d36': '#1f2226', '#15161b': '#0a0b0d',
  '#ececf1': '#e7e9ea', '#cfd3dc': '#c6cacd', '#9aa1ad': '#959ba1', '#646a77': '#5d636a',
};
const neutral = s => s.replace(/#[0-9a-f]{6}\b/gi, h => NEUTRAL[h.toLowerCase()] ?? h);

const ACCENT_RGBA = s => s.replace(/rgba\(113, ?138, ?255, ?([.\d]+)\)/g, (_, a) => `rgba(34, 197, 94, ${a})`)
  .replace(/rgba\(154, ?114, ?212, ?([.\d]+)\)/g, (_, a) => `rgba(45, 212, 191, ${Math.min(Number(a), .07)})`);

// Light text on an accent fill becomes dark text: white on #22c55e is 2.3:1.
const ON_ACCENT = s => s.replace(/\{[^{}]*\}/g, rule =>
  /background(?:-color)?:\s*var\(--(?:accent(?:-2|-fill)?|gym-primary)\)/.test(rule) ? rule.replace(/([;{\s])color:\s*#fff\b/g, '$1color: var(--bg)') : rule);

// The World Model chart stage goes from navy to charcoal; its lavender marks keep their colours and gain contrast.
const STAGE = ['#0e1013', '#1a1d22'];
const STAGE_VEIL = s => s.replace(/rgba\(16, ?22, ?43,/g, 'rgba(14,16,19,').replace('#1a2246 45%', '#13161a 45%');

const EXTRA = {
  'index.html': s => s.replace(/(<marker id="arrowBlue"[^>]*><path[^>]*fill=")#718aff"/, '$1#22c55e"')
    .replace("{background:'#e9edff'},{background:'#fff'}", "{background:'#0f2a1a'},{background:'transparent'}"),
  'jev-runtime/demo/css/app.css': s => s.replace('--accent: #718aff; --accent-2: #8fa2ff; --accent-bg: #262c4d;', '--accent: #22c55e; --accent-2: #4ade80; --accent-bg: #0f2a1a;')
    .replace('.note.info { background: var(--accent-bg); color: #a3b2ff; }', '.note.info { background: var(--accent-bg); color: var(--accent-2); }')
    .replace('--panel: #15171a; --nav', '--panel: #15171a; --bg: #0c0d0f; --nav'),
  'swm/css/swm.css': s => STAGE_VEIL(s).replace('--swm-stage-0:#10162b; --swm-stage-1:#26305a;', `--swm-stage-0:${STAGE[0]}; --swm-stage-1:${STAGE[1]};`),
  'swm/css/swm-vowl.css': s => STAGE_VEIL(s).replaceAll('#26305a', STAGE[1]),
  'swm/js/swm-vowl.js': s => s.replace("'#1b2247'", "'#16191d'"),
  'swm/js/swm-core.js': s => s.replace('Charts draw on a dark STAGE (#10162b→#26305a)', `Charts draw on a dark STAGE (${STAGE[0]}→${STAGE[1]})`)
    .replace('Contrast is measured against #26305a or #ffffff (notes per ramp).', `Contrast is measured against ${STAGE[1]} (notes per ramp).`)
    .replace("['#10162b', '#26305a']", `['${STAGE[0]}', '${STAGE[1]}']`).replace("soft:'#1b2344'", "soft:'#1d2024'")
    .replace('10.4 / 7.4 / 5.1 / 4.1 vs #26305a', `13.9 / 9.8 / 6.8 / 5.5 vs ${STAGE[1]}`)
    .replace('top stop = --accent-bg: 3.1 / 4.5 / 6.2 / 8.4 / 10.9 vs #26305a', `top stop = --stage-ink: 4.1 / 5.9 / 8.3 / 11.2 / 14.5 vs ${STAGE[1]}`)
    .replace('3.1 / 5.9 / 9.4 vs #26305a', `4.1 / 7.8 / 12.5 vs ${STAGE[1]}`)
    .replace('ink 11.2, ink2 7.7, ink3 6.0, faint 4.8 (decorative)', 'ink 14.9, ink2 10.3, ink3 8.0, faint 6.3 (decorative)'),
  'blueprint_studio/web/src/styles/tokens.css': s => s.replace('--accent:#6f86f5; --accent-2:#8fa2ff; --accent-bg:#262c4d;', '--accent:#22c55e; --accent-2:#4ade80; --accent-bg:#0f2a1a;')
    .replace('--canvas:#0a0b0d; --nav', '--canvas:#0a0b0d; --bg:#0c0d0f; --nav').replace('.btn.primary:hover:not(:disabled){background:#4659c4}', '.btn.primary:hover:not(:disabled){background:var(--accent-2)}'),
  'speedrun/web/src/theme.css': s => s.replace('--acc: var(--accent-fill);           /* fills that carry white text */', '--acc: var(--accent-fill);           /* fills that carry --on-acc text */\n  --on-acc: var(--bg);'),
  'speedrun/web/upstream/src/app/globals.css': s => s.includes('--color-on-acc') ? s : s.replace('  --color-acc: var(--acc);\n', '  --color-acc: var(--acc);\n  --color-on-acc: var(--on-acc);\n'),
};

const ON_ACC_TW = s => s.replace(/\bbg-acc(2?) text-white\b/g, 'bg-acc$1 text-on-acc');

const SKIP = /(^|\/)(node_modules|app\/assets|logs|codemods)(\/|$)|^jev-observability\/|^assurance\.html$/;
async function walk(dir) {
  const out = [];
  for (const name of await readdir(join(ROOT, dir))) {
    const rel = dir ? `${dir}/${name}` : name;
    if (SKIP.test(rel) || name.startsWith('.')) continue;
    if ((await stat(join(ROOT, rel))).isDirectory()) out.push(...await walk(rel));
    else if (/\.(css|html|js|mjs|jsx|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

const SOURCES = ['index.html', 'css', 'js', 'swm/css', 'swm/js', 'agent-gym', 'blueprint_studio/web/src', 'speedrun/web/src',
  'speedrun/web/upstream/src', 'jev-runtime', 'tests/site', 'tools'];
const LITERALS = /^(css\/|swm\/(css|js)\/|agent-gym\/css\/|jev-runtime\/|blueprint_studio\/web\/src\/|index\.html$)/;

const files = [];
for (const src of SOURCES) files.push(...((await stat(join(ROOT, src))).isDirectory() ? await walk(src) : [src]));

let changed = 0;
for (const rel of files) {
  const before = await readFile(join(ROOT, rel), 'utf8');
  let after = rename(before);
  if (rel === 'css/tokens.css') after = tokens(after);
  else if (LITERALS.test(rel)) after = ON_ACCENT(ACCENT_RGBA(neutral(after)));
  if (/\.tsx$/.test(rel)) after = ON_ACC_TW(after);
  if (EXTRA[rel]) after = EXTRA[rel](after);
  if (after === before) continue;
  changed++;
  console.log(`${process.argv.includes('--check') ? 'would change' : 'changed'} ${relative(ROOT, join(ROOT, rel))}`);
  if (!process.argv.includes('--check')) await writeFile(join(ROOT, rel), after);
}
if (process.argv.includes('--check') && changed) process.exitCode = 1;
