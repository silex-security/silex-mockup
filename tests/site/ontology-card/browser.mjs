import { spawn } from 'node:child_process';
import { readFile, access, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function findChrome() {
  for (const p of [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)) {
    try { await access(p); return p; } catch {}
  }
  throw Error('Chrome not found; set CHROME');
}
async function connect(url) {
  const ws = new WebSocket(url), waiting = new Map(); let seq = 0;
  const c = { ws, errors: [], requests: [], downloads: [] };
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = waiting.get(m.id); if (p) { waiting.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); } }
    if (m.method === 'Runtime.exceptionThrown') c.errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') c.errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.requestWillBeSent') c.requests.push(m.params.request.url);
    if (m.method === 'Browser.downloadWillBegin' || m.method === 'Page.downloadWillBegin') c.downloads.push(m.params);
  });
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  c.send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => { waiting.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 30000); waiting.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
  c.ev = async code => { const r = await c.send('Runtime.evaluate', { expression: `(async()=>{${code}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
  return c;
}
async function until(fn, label, timeout = 15000) { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const r = await fn(); if (r) return r; } catch (e) { last = e.message; } await sleep(100); } throw Error(`Timeout: ${label}${last ? ': ' + last : ''}`); }

export async function browser() {
  const profile = await mkdtemp(join(tmpdir(), 'ontology-card-chrome-'));
  const chrome = spawn(await findChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let browserConnection, page;
  try {
    let port;
    await until(async () => { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return port; } catch {} }, 'Chrome startup');
    const endpoint = `http://127.0.0.1:${port}`;
    browserConnection = await connect((await (await fetch(endpoint + '/json/version')).json()).webSocketDebuggerUrl);
    const target = (await (await fetch(endpoint + '/json/list')).json()).find(x => x.type === 'page');
    page = await connect(target.webSocketDebuggerUrl);
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await page.send(method);
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    return { page, close() { page.ws.close(); browserConnection.ws.close(); chrome.kill(); } };
  } catch (e) { page?.ws.close(); browserConnection?.ws.close(); chrome.kill(); throw e; }
}
export { until, sleep };
