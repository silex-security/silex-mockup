#!/usr/bin/env node
// How much a visitor has to read on each console screen of index.html.
//
//   node tools/density-audit.mjs [width=1440] [--only=<name prefix>] [--json]
//
// For each screen (the same list tools/site-shot.mjs shoots) it prints the words visible in the first 900px
// viewport, the words on the whole screen, the height in viewports, and the longest single text block.
// Text inside same-origin frames counts. Sorted by total words, heaviest first.
import { pathToFileURL } from 'node:url';
import { browser, until } from '../tests/site/ontology-card/browser.mjs';
import { serveRepo } from './gym-shot.mjs';
import { siteScreens } from './site-shot.mjs';

const HEIGHT = 900;
const SETTLED = `
  if (document.readyState !== 'complete') return false;
  const frames = [...document.querySelectorAll('iframe')].filter(f => f.offsetParent !== null);
  return frames.every(f => { try { return f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.childElementCount > 0; } catch { return true; } });`;

const MEASURE = `
  const words = s => (s.trim().match(/\\S+/g) || []).length;
  const out = { fold: 0, total: 0, longest: 0, longestText: '' };
  const blocks = new Map();
  const walk = (doc, offX, offY, clipBottom) => {
    const view = doc.defaultView;
    const tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) {
      const w = words(n.data); if (!w) continue;
      const el = n.parentElement; if (!el || el.closest('script,style,noscript,template,aside,header.topbar,nav')) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = doc.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const top = b.top + offY + (doc === document ? scrollY : 0);
      if (top > clipBottom) continue;
      out.total += w; if (top < ${HEIGHT}) out.fold += w;
      const block = el.closest('p,li,td,th,h1,h2,h3,h4,figcaption,summary,dd,dt,button,label') || el;
      blocks.set(block, (blocks.get(block) || 0) + w);
    }
    for (const f of doc.querySelectorAll('iframe')) {
      if (!f.checkVisibility()) continue;
      let inner; try { inner = f.contentDocument; } catch {} if (!inner?.body) continue;
      const fb = f.getBoundingClientRect();
      walk(inner, fb.left + offX, fb.top + offY + (doc === document ? scrollY : 0) - inner.defaultView.scrollY, fb.bottom + offY + (doc === document ? scrollY : 0));
    }
  };
  walk(document, 0, 0, Infinity);
  for (const [el, w] of blocks) if (w > out.longest) { out.longest = w; out.longestText = el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 70); }
  out.viewports = +(document.documentElement.scrollHeight / ${HEIGHT}).toFixed(1);
  return out;`;

export async function auditDensity(width, only = '') {
  const screens = (await siteScreens()).filter(s => s.name.startsWith(only));
  const session = await browser();
  const server = await serveRepo().catch(e => { session.close(); throw e; });
  const p = session.page, rows = [];
  try {
    await p.send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    for (const { name, hash } of screens) {
      await p.send('Page.navigate', { url: 'about:blank' });
      await p.send('Page.navigate', { url: `${server.origin}/index.html${hash}` });
      await until(() => p.ev(SETTLED), `${name} settled`, 20000);
      await p.ev('await new Promise(r => setTimeout(r, 1200));');
      rows.push({ name, ...(await p.ev(MEASURE)) });
    }
  } finally { session.close(); await server.close(); }
  return rows.sort((a, b) => b.total - a.total);
}

async function main(args) {
  const only = args.find(a => a.startsWith('--only='))?.slice(7) || '';
  const width = Number(args.find(a => !a.startsWith('--')) || 1440);
  const rows = await auditDensity(width, only);
  if (args.includes('--json')) { console.log(JSON.stringify(rows, null, 1)); return 0; }
  console.log('screen'.padEnd(44) + 'fold'.padStart(6) + 'total'.padStart(7) + 'vh'.padStart(6) + 'block'.padStart(7) + '  longest block');
  for (const r of rows) console.log(r.name.padEnd(44) + String(r.fold).padStart(6) + String(r.total).padStart(7) + String(r.viewports).padStart(6) + String(r.longest).padStart(7) + '  ' + r.longestText);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = await main(process.argv.slice(2));
