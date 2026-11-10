#!/usr/bin/env node
// Count the distinct raw style values in the console's stylesheets: colours, font sizes, radii and shadows.
//
//   node tools/style-audit.mjs            a table
//   node tools/style-audit.mjs --json     the same counts as JSON
//
// Covers the inline <style> blocks of index.html, css/, swm/css/ and agent-gym/css/. Embedded apps that are
// built or vendored (speedrun/app, blueprint_studio/app, jev-runtime) are not the console's styles and are left out.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIRS = ['css', 'swm/css', 'agent-gym/css'];

const distinct = (css, re, pick = m => m[1]) => new Set([...css.matchAll(re)].map(m => pick(m).toLowerCase().replace(/\s+/g, ' ').trim()));

export function auditCss(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return {
    colors: distinct(body, /(#[0-9a-f]{3,8})\b/gi).size,
    fontSizes: distinct(body, /font-size:\s*([^;}]+)/gi).size,
    under12px: [...body.matchAll(/font-size:\s*([0-9.]+)px/gi)].filter(m => Number(m[1]) < 12).length,
    radii: distinct(body, /border-radius:\s*([^;}]+)/gi).size,
    shadows: distinct(body, /box-shadow:\s*([^;}]+)/gi).size,
  };
}

export async function auditSite() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const rows = { 'index.html <style>': auditCss([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')) };
  rows['index.html <style>'].inlineStyleAttrs = (html.match(/\sstyle="/g) || []).length;
  for (const dir of CSS_DIRS) {
    for (const file of (await readdir(join(ROOT, dir))).filter(f => f.endsWith('.css')).sort()) {
      rows[`${dir}/${file}`] = auditCss(await readFile(join(ROOT, dir, file), 'utf8'));
    }
  }
  return rows;
}

async function main(args) {
  const rows = await auditSite();
  if (args.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); return 0; }
  const cols = ['colors', 'fontSizes', 'under12px', 'radii', 'shadows', 'inlineStyleAttrs'];
  console.log(['| stylesheet', ...cols].join(' | ') + ' |');
  console.log('|' + ' --- |'.repeat(cols.length + 1));
  for (const [name, r] of Object.entries(rows)) console.log(`| ${name} | ${cols.map(c => r[c] ?? '').join(' | ')} |`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = await main(process.argv.slice(2));
