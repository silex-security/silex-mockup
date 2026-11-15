#!/usr/bin/env node
// Drives the console the way a visitor does: serves this checkout on a free loopback port, opens it in a headless
// Chrome it owns, runs one journey, and writes screenshots and report.json to an evidence directory.
//
//   node skills/verify/scripts/drive.mjs doctor
//   node skills/verify/scripts/drive.mjs run <journey.mjs> [--out <dir>] [--width <px>]
//
// Exit 0: every check passed and the page logged no error. Exit 1: a check, a step or the page failed.
// Exit 2: Chrome is missing (set CHROME). Exit 64: bad usage.
import { execFileSync } from 'node:child_process';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { browser, until } = await import(pathToFileURL(join(ROOT, 'tests/site/ontology-card/browser.mjs')).href);
const { serveRepo } = await import(pathToFileURL(join(ROOT, 'tools/gym-shot.mjs')).href);

const NOISE = /favicon|fonts\.(googleapis|gstatic)|ERR_CERT|net::ERR_(INTERNET|NAME)/i;
const PROFILE_PREFIXES = ['ontology-card-chrome-', 'studio-site-probes-'];
const HEIGHT = 1000;

const git = (...args) => { try { return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const checkout = () => ({ root: ROOT, head: git('rev-parse', '--short', 'HEAD'), branch: git('branch', '--show-current'), dirty: git('status', '--porcelain') !== '' });
const leftovers = async () => (await readdir(tmpdir())).filter(n => PROFILE_PREFIXES.some(p => n.startsWith(p)));
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

// The document a selector is looked up in: the page, or a same-origin iframe of it.
const scope = frame => `const fr = ${JSON.stringify(frame ?? null)} && document.querySelector(${JSON.stringify(frame ?? null)});
  if (${JSON.stringify(frame ?? null)} && !fr) throw Error('no frame ' + ${JSON.stringify(frame ?? null)});
  const d = fr ? fr.contentDocument : document;`;

async function open(width) {
  const session = await browser();
  const server = await serveRepo().catch(async e => { await session.close(); throw e; });
  const p = session.page;
  await p.send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  return { p, origin: server.origin, close: async () => { await session.close(); await server.close(); } };
}

function pageApi({ p, origin }, outDir, report) {
  let shots = 0;
  const step = (kind, detail) => report.steps.push({ at: new Date().toISOString(), kind, ...detail });
  const errors = () => p.errors.map(String).filter(e => !NOISE.test(e));
  const api = {
    origin,
    ev: code => p.ev(code),
    errors,
    async go(hash = '#view=assurance') {
      await p.send('Page.navigate', { url: 'about:blank' });
      await p.send('Page.navigate', { url: `${origin}/index.html${hash}` });
      await until(() => p.ev('return document.readyState === "complete" && !!window.__gymHost'), 'page ' + hash, 30000);
      step('go', { hash });
    },
    async waitFor(code, label, timeout = 15000) {
      const value = await until(() => p.ev(code), label, timeout);
      step('waitFor', { label });
      return value;
    },
    async text(selector, { frame } = {}) {
      return p.ev(`${scope(frame)} const el = d.querySelector(${JSON.stringify(selector)}); return el ? el.innerText.trim() : null;`);
    },
    async count(selector, { frame } = {}) {
      return p.ev(`${scope(frame)} return d.querySelectorAll(${JSON.stringify(selector)}).length;`);
    },
    // A real pointer click at the element's centre. It fails when the element is missing, has no size or is
    // covered by something else, which is what a visitor would hit too.
    async click(selector, { frame } = {}) {
      const at = await p.ev(`${scope(frame)}
        const el = d.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = el.getBoundingClientRect(), o = fr ? fr.getBoundingClientRect() : { left: 0, top: 0 };
        const hit = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const outer = fr ? document.elementFromPoint(o.left + r.left + r.width / 2, o.top + r.top + r.height / 2) : hit;
        return { x: o.left + r.left + r.width / 2, y: o.top + r.top + r.height / 2, size: r.width * r.height,
          reachable: !!hit && (el === hit || el.contains(hit) || hit.contains(el)) && (!fr || outer === fr),
          hit: hit ? hit.tagName.toLowerCase() + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.trim().split(/\\s+/).join('.') : '') : null };`);
      if (!at) throw Error(`click: no element ${selector}${frame ? ' in ' + frame : ''}`);
      if (!at.size) throw Error(`click: ${selector} has no size (hidden?)`);
      if (!at.reachable) throw Error(`click: ${selector} is covered by ${at.hit}`);
      const mouse = (type, extra = {}) => p.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', ...extra });
      await mouse('mouseMoved', { button: 'none' });
      await mouse('mousePressed', { clickCount: 1 });
      await mouse('mouseReleased', { clickCount: 1 });
      step('click', { selector, ...(frame ? { frame } : {}) });
    },
    // A native <select> opens an OS popup that is not in the page, so the option is set and the change event sent.
    async choose(selector, value, { frame } = {}) {
      const ok = await p.ev(`${scope(frame)} const el = d.querySelector(${JSON.stringify(selector)});
        if (!el || ![...el.options].some(o => o.value === ${JSON.stringify(value)})) return false;
        el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
      if (!ok) throw Error(`choose: ${selector} has no option ${value}`);
      step('choose', { selector, value });
    },
    async reload() {
      await p.send('Page.reload');
      await until(() => p.ev('return document.readyState === "complete" && !!window.__gymHost'), 'reload', 30000);
      step('reload', {});
    },
    async shot(name) {
      const file = `${String(++shots).padStart(2, '0')}-${name}.png`;
      const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(outDir, file), Buffer.from(data, 'base64'));
      step('shot', { file });
      return file;
    },
    check(label, ok, detail) {
      report.checks.push({ label, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : '  ' + JSON.stringify(detail)}`);
    },
  };
  return api;
}

async function run(journeyPath, { out, width }) {
  const journey = (await import(pathToFileURL(resolve(journeyPath)).href)).default;
  if (typeof journey !== 'function') throw Error(`${journeyPath} has no default export function`);
  const name = basename(journeyPath).replace(/\.mjs$/, '');
  const outDir = resolve(out || join(ROOT, '.verify', `${stamp()}-${name}`));
  await mkdir(outDir, { recursive: true });
  const report = { journey: relative(ROOT, resolve(journeyPath)), checkout: checkout(), width, started: new Date().toISOString(), steps: [], checks: [], pageErrors: [], failure: null };
  const site = await open(width);
  const api = pageApi(site, outDir, report);
  try {
    await journey(api);
  } catch (e) {
    report.failure = e.message;
    await api.shot('failure').catch(() => {});
  } finally {
    report.pageErrors = api.errors();
    await site.close();
  }
  report.finished = new Date().toISOString();
  report.passed = !report.failure && !report.pageErrors.length && report.checks.length > 0 && report.checks.every(c => c.ok);
  await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.failure) console.log(`FAIL step: ${report.failure}`);
  for (const e of report.pageErrors) console.log(`FAIL page error: ${e.split('\n')[0]}`);
  if (!report.checks.length) console.log('FAIL the journey made no check');
  console.log(`${report.passed ? 'PASSED' : 'FAILED'} ${report.checks.filter(c => c.ok).length}/${report.checks.length} checks, evidence in ${outDir}`);
  return report.passed ? 0 : 1;
}

async function doctor() {
  const lines = [];
  let bad = false;
  const say = (ok, text) => { lines.push(`${ok ? 'ok  ' : 'FAIL'} ${text}`); bad ||= !ok; };
  const c = checkout();
  say(Number(process.versions.node.split('.')[0]) >= 22, `node ${process.versions.node} (needs 22 or later for the built-in WebSocket)`);
  say(!!c.head, `checkout ${c.root} at ${c.head || 'unknown'}${c.branch ? ' on ' + c.branch : ''}${c.dirty ? ', with uncommitted changes' : ''}`);
  for (const f of ['index.html', 'agent-gym/index.html', 'speedrun/app/index.html', 'blueprint_studio/app/index.html']) {
    say(await access(join(ROOT, f)).then(() => true, () => false), `${f} exists`);
  }
  const before = await leftovers();
  let site;
  try {
    site = await open(1440);
    const api = pageApi(site, ROOT, { steps: [], checks: [] });
    await api.go('#view=assurance');
    const views = await api.count('aside .nav button[data-view]');
    say(views > 0, `the console loads from ${site.origin} and its sidebar lists ${views} views`);
    say(api.errors().length === 0, `the home view logs no page error${api.errors().length ? ': ' + api.errors()[0].split('\n')[0] : ''}`);
  } catch (e) {
    say(false, /Chrome not found/.test(e.message) ? 'Chrome not found; set CHROME to a Chrome or Chromium binary' : `the console does not load: ${e.message}`);
    if (/Chrome not found/.test(e.message)) { console.log(lines.join('\n')); return 2; }
  } finally { await site?.close(); }
  const after = (await leftovers()).filter(n => !before.includes(n));
  say(after.length === 0, `this check left ${after.length} Chrome profile(s) in ${tmpdir()}`);
  if (before.length) lines.push(`note ${before.length} Chrome profile(s) were already in ${tmpdir()} (another run in progress, or an earlier run that was killed): ${before.slice(0, 3).join(', ')}`);
  console.log(lines.join('\n'));
  return bad ? 1 : 0;
}

function parse(args) {
  const opts = { out: '', width: 1440 }, rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') opts.out = args[++i] || '';
    else if (args[i] === '--width') opts.width = Number(args[++i]);
    else rest.push(args[i]);
  }
  return { opts, rest };
}

async function main(args) {
  const { opts, rest: [command, journey, ...extra] } = parse(args);
  const usage = 'usage: drive.mjs doctor | drive.mjs run <journey.mjs> [--out <dir>] [--width <px>]';
  if (command === 'doctor' && !journey) return doctor();
  if (command !== 'run' || !journey || extra.length || !(opts.width > 0)) { console.error(usage); return 64; }
  try { return await run(journey, opts); } catch (e) { console.error(e.message); return /Chrome not found/.test(e.message) ? 2 : 1; }
}

process.exitCode = await main(process.argv.slice(2));
