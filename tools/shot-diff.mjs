#!/usr/bin/env node
// Compare two screenshot sets from tools/site-shot.mjs and print the share of pixels that differ per image.
//
//   node tools/shot-diff.mjs before-dir after-dir [max-percent]
//
// Decodes the PNGs in headless Chrome, so the repo needs no image library. Views that animate (the ontology
// network, the runtime pipeline, Speedrun) differ between two runs of the same code, so compare against a
// second baseline run to learn the noise before reading a number. With max-percent, exits 1 when any image
// differs by more. Exits 2 when Chrome is missing.
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { browser } from '../tests/site/ontology-card/browser.mjs';

async function pngs(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...await pngs(join(dir, e.name), base));
    else if (e.name.endsWith('.png')) out.push(relative(base, join(dir, e.name)));
  }
  return out.sort();
}

const DIFF = `
  const load = async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); return i; };
  const [a, b] = await Promise.all([load(A), load(B)]);
  if (a.width !== b.width) return { percent: 100, grew: 0 };
  const h = Math.min(a.height, b.height);
  const px = img => { const c = new OffscreenCanvas(img.width, h).getContext('2d'); c.drawImage(img, 0, 0); return c.getImageData(0, 0, img.width, h).data; };
  const pa = px(a), pb = px(b); let n = 0;
  for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 12) n++;
  return { percent: 100 * n / (pa.length / 4), grew: b.height - a.height };`;

/** Compares the area both images share, top aligned. `grew` is the height change in px.
 * @returns {Promise<Array<{ file: string, percent: number | null, grew: number }>>} percent is null when the file is missing from after. */
export async function diffShots(before, after) {
  const session = await browser();
  try {
    const rows = [];
    for (const file of await pngs(before)) {
      const b = await readFile(join(after, file)).catch(() => null);
      if (!b) { rows.push({ file, percent: null, grew: 0 }); continue; }
      const a = await readFile(join(before, file));
      rows.push({ file, ...await session.page.ev(`const A=${JSON.stringify(a.toString('base64'))},B=${JSON.stringify(b.toString('base64'))};${DIFF}`) });
    }
    return rows;
  } finally { session.close(); }
}

async function main([before, after, max]) {
  if (!before || !after) { console.error('usage: node tools/shot-diff.mjs before-dir after-dir [max-percent]'); return 64; }
  let rows;
  try { rows = await diffShots(resolve(before), resolve(after)); } catch (e) { console.error(e.message); return /Chrome not found/.test(e.message) ? 2 : 1; }
  for (const r of rows) console.log(`${r.percent === null ? 'missing' : r.percent.toFixed(2).padStart(6) + '%'}  ${r.file}${r.grew ? `  height ${r.grew > 0 ? '+' : ''}${r.grew}px` : ''}`);
  return max !== undefined && rows.some(r => r.percent === null || r.percent > Number(max)) ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = await main(process.argv.slice(2));
