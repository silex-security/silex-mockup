#!/usr/bin/env node
// Screenshot every console view of index.html at several widths, and fail on page errors or sideways scroll.
//
//   node tools/site-shot.mjs out-dir [1280,1440,1920]
//
// The view list is read from the sidebar markup of index.html, plus `overview`, which has no sidebar entry.
// Writes out-dir/<width>/<view>.png. Exits 1 when a page threw, logged a console error, or scrolls sideways.
// Exits 2 when Chrome is missing.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browser, until } from '../tests/site/ontology-card/browser.mjs';
import { serveRepo } from './gym-shot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NOISE = /favicon|fonts\.(googleapis|gstatic)|ERR_CERT|net::ERR_(INTERNET|NAME)/i;
const HEIGHT = 900;

export async function siteViews() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const sidebar = html.slice(html.indexOf('<aside'), html.indexOf('</aside>'));
  return [...new Set([...sidebar.matchAll(/data-view="([^"]+)"/g)].map(m => m[1])), 'overview'];
}

const SETTLED = `
  if (document.readyState !== 'complete') return false;
  const frames = [...document.querySelectorAll('iframe')].filter(f => f.offsetParent !== null);
  return frames.every(f => { try { return f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.childElementCount > 0; } catch { return true; } });`;

/** Shoot every view at every width. Returns the problems found, one line each. */
export async function shootSite(outDir, widths) {
  const views = await siteViews();
  const session = await browser();
  const server = await serveRepo().catch(e => { session.close(); throw e; });
  const p = session.page, problems = [];
  try {
    for (const width of widths) {
      await mkdir(join(outDir, String(width)), { recursive: true });
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
      for (const view of views) {
        const seen = p.errors.length;
        await p.send('Page.navigate', { url: 'about:blank' });
        await p.send('Page.navigate', { url: `${server.origin}/index.html#view=${view}` });
        await until(() => p.ev(SETTLED), `${view} settled at ${width}px`, 20000);
        await p.ev('await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]); await new Promise(r => setTimeout(r, 1200));');
        const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(outDir, String(width), `${view}.png`), Buffer.from(data, 'base64'));
        const { win, doc } = await p.ev('return { win: innerWidth, doc: document.documentElement.scrollWidth }');
        if (doc > win) problems.push(`${view} at ${width}px scrolls sideways: ${doc} > ${win}`);
        for (const e of p.errors.slice(seen).map(String).filter(e => !NOISE.test(e))) problems.push(`${view} at ${width}px: ${e.split('\n')[0]}`);
      }
    }
  } finally { session.close(); await server.close(); }
  return { views, problems };
}

async function main([outDir, widthArg = '1280,1440,1920']) {
  const widths = widthArg.split(',').map(Number);
  if (!outDir || widths.some(w => !(w > 0))) { console.error('usage: node tools/site-shot.mjs out-dir [1280,1440,1920]'); return 64; }
  let result;
  try { result = await shootSite(resolve(outDir), widths); } catch (e) { console.error(e.message); return /Chrome not found/.test(e.message) ? 2 : 1; }
  console.log(`${result.views.length} views x ${widths.length} widths -> ${outDir}`);
  for (const line of result.problems) console.error(`problem: ${line}`);
  return result.problems.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = await main(process.argv.slice(2));
