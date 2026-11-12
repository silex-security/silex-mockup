#!/usr/bin/env node
// Screenshot every console view of index.html at several widths, and fail on page errors or sideways scroll.
//
//   node tools/site-shot.mjs out-dir [1280,1440,1920] [--full] [--only=<name prefix>]
//
// --full captures each view at its whole document height (up to 8000px) instead of a 900px viewport.
// The view list is read from the sidebar markup of index.html, plus `overview`, which has no sidebar entry.
// Sub-tabs of Runtime Observation, the World Model and Incidents are shot too, as <view>--<tab>.png, and so are
// the screens inside the Speedrun app, as speedrun--<route>.png. --only=speedrun shoots just the names that start so.
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

const SPEEDRUN_ROUTES = ['units/customer-service', 'units/customer-service/teams', 'teams/refund', 'teams/refund/trace', 'teams/refund/benchmarks', 'teams/refund/builder', 'teams/refund/variant'];

/** Every screen to shoot: each view, plus each sub-tab of Runtime Observation, the World Model and Incidents,
    plus the screens inside the Speedrun app. */
export async function siteScreens() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const tabs = (re, view) => [...new Set([...html.matchAll(re)].map(m => m[1]))].slice(1).map(tab => ({ name: `${view}--${tab}`, hash: `#view=${view}&tab=${tab}` }));
  return [
    ...(await siteViews()).map(view => ({ name: view, hash: `#view=${view}` })),
    ...tabs(/data-rt-tab="([^"]+)"/g, 'runtime-observation'),
    ...tabs(/data-wm-panel="([^"]+)"/g, 'security-model'),
    { name: 'incidents--decisions', hash: '#view=incidents&tab=decisions' },
    ...SPEEDRUN_ROUTES.map(r => ({ name: `speedrun--${r.replaceAll('/', '-')}`, hash: '#view=speedrun&path=' + encodeURIComponent('/speedrun/' + r) })),
  ];
}

const SETTLED = `
  if (document.readyState !== 'complete') return false;
  const frames = [...document.querySelectorAll('iframe')].filter(f => f.offsetParent !== null);
  return frames.every(f => { try { return f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.childElementCount > 0; } catch { return true; } });`;

/** Shoot every view at every width. Returns the problems found, one line each. */
export async function shootSite(outDir, widths, { full = false, only = '' } = {}) {
  const screens = (await siteScreens()).filter(s => s.name.startsWith(only));
  const session = await browser();
  const server = await serveRepo().catch(e => { session.close(); throw e; });
  const p = session.page, problems = [];
  try {
    for (const width of widths) {
      await mkdir(join(outDir, String(width)), { recursive: true });
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
      for (const { name: view, hash } of screens) {
        const seen = p.errors.length;
        await p.send('Page.navigate', { url: 'about:blank' });
        await p.send('Page.navigate', { url: `${server.origin}/index.html${hash}` });
        await until(() => p.ev(SETTLED), `${view} settled at ${width}px`, 20000);
        await p.ev('await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]); await new Promise(r => setTimeout(r, 1200));');
        if (full) {
          const height = Math.min(8000, await p.ev('return document.documentElement.scrollHeight'));
          await p.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
          await p.ev('scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));');
        }
        const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
        if (full) await p.send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
        await writeFile(join(outDir, String(width), `${view}.png`), Buffer.from(data, 'base64'));
        const { win, doc } = await p.ev('return { win: innerWidth, doc: document.documentElement.scrollWidth }');
        if (doc > win) problems.push(`${view} at ${width}px scrolls sideways: ${doc} > ${win}`);
        for (const e of p.errors.slice(seen).map(String).filter(e => !NOISE.test(e))) problems.push(`${view} at ${width}px: ${e.split('\n')[0]}`);
      }
    }
  } finally { session.close(); await server.close(); }
  return { screens, problems };
}

async function main(args) {
  const full = args.includes('--full');
  const only = args.find(a => a.startsWith('--only='))?.slice(7) || '';
  const [outDir, widthArg = '1280,1440,1920'] = args.filter(a => !a.startsWith('--'));
  const widths = widthArg.split(',').map(Number);
  if (!outDir || widths.some(w => !(w > 0))) { console.error('usage: node tools/site-shot.mjs out-dir [1280,1440,1920] [--full] [--only=<name prefix>]'); return 64; }
  let result;
  try { result = await shootSite(resolve(outDir), widths, { full, only }); } catch (e) { console.error(e.message); return /Chrome not found/.test(e.message) ? 2 : 1; }
  console.log(`${result.screens.length} screens x ${widths.length} widths -> ${outDir}`);
  for (const line of result.problems) console.error(`problem: ${line}`);
  return result.problems.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = await main(process.argv.slice(2));
