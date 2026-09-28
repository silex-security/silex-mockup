#!/usr/bin/env node
/* Jev observability acceptance probes. Run from jev-observability/:
 *   node tests/probe/run-probes.js [--only P1,P3] [--shots /tmp/jev-shots]
 * Local static server, isolated Chrome profile, CDP, stdout PASS/FAIL lines.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = (key) => {
  const index = args.indexOf(key);
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw Error(`${key} needs a value`);
  return args[index + 1];
};
const ONLY = option('--only')?.split(',').map((item) => item.trim()).filter(Boolean);
const SHOTS = option('--shots');
const wanted = (id) => !ONLY || ONLY.includes(id);
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const quote = JSON.stringify;

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

let server;
let chrome;
let browser;
let page;
let origin;
const clients = new Set();
const results = [];
const profile = await mkdtemp(join(tmpdir(), 'jev-probes-'));
const downloadDir = join(profile, 'downloads');
await mkdir(downloadDir);

async function until(fn, label, timeout = 8000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(80);
  }
  throw Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

async function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw Error('Chrome not found; set CHROME');
}

async function connect(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl);
  const waiting = new Map();
  let sequence = 0;
  const client = { ws, errors: [], requests: [], downloads: [] };
  clients.add(client);

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = waiting.get(message.id);
      if (pending) {
        waiting.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(Error(message.error.message));
        else pending.resolve(message.result);
      }
    }
    if (message.method === 'Runtime.exceptionThrown') {
      client.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      client.errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
    if (message.method === 'Network.requestWillBeSent') client.requests.push(message.params.request.url);
    if (message.method === 'Browser.downloadWillBegin' || message.method === 'Page.downloadWillBegin') client.downloads.push(message.params);
  });

  await new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', rejectOpen, { once: true });
  });

  client.send = (method, params = {}) => new Promise((resolveSend, rejectSend) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      waiting.delete(id);
      rejectSend(Error(`CDP timeout: ${method}`));
    }, 30000);
    waiting.set(id, { resolve: resolveSend, reject: rejectSend, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });

  client.ev = async (expression, timeout = 30000) => {
    const result = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout,
    });
    if (result.exceptionDetails) {
      throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  return client;
}

async function startServer() {
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
      let file = resolve(ROOT, `.${pathname}`);
      if (file !== ROOT && !file.startsWith(`${ROOT}${sep}`)) {
        response.writeHead(403).end('forbidden');
        return;
      }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      response.writeHead(200, {
        'content-type': mime[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end('not found');
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  origin = `http://127.0.0.1:${server.address().port}`;
}

async function startChrome() {
  chrome = spawn(await findChrome(), [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let port;
  await until(async () => {
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      return port;
    } catch {
      return false;
    }
  }, 'Chrome startup', 10000);
  const endpoint = `http://127.0.0.1:${port}`;
  browser = await connect((await (await fetch(`${endpoint}/json/version`)).json()).webSocketDebuggerUrl);
  const target = (await (await fetch(`${endpoint}/json/list`)).json()).find((item) => item.type === 'page');
  page = await connect(target.webSocketDebuggerUrl);
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await page.send(method);
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
}

async function evaluate(expression, timeout) {
  return page.ev(expression, timeout);
}

async function setViewport(width = 1280, height = 900) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
}

async function navigate(width = 1280) {
  page.errors = [];
  await setViewport(width, width < 700 ? 900 : 900);
  await page.send('Page.navigate', { url: `${origin}/?autoplay=0&seed=7` });
  await until(() => evaluate('document.readyState === "complete"'), 'document ready', 10000);
}

async function shot(id) {
  if (!SHOTS) return;
  await mkdir(SHOTS, { recursive: true });
  const result = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(join(SHOTS, `${id}.png`), Buffer.from(result.data, 'base64'));
}

async function waitForDemo() {
  await until(() => evaluate('!!window.__jevDemo && window.__jevDemo.ready === true'), 'window.__jevDemo.ready', 10000);
}

async function click(selector) {
  const ok = await evaluate(`(() => {
    const el = document.querySelector(${quote(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  assert.ok(ok, `missing clickable ${selector}`);
}

async function selectValue(selector, value) {
  const ok = await evaluate(`(() => {
    const el = document.querySelector(${quote(selector)});
    if (!el) return false;
    el.value = ${quote(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.ok(ok, `missing input ${selector}`);
}

async function openTab(name) {
  await click(`[data-tab="${name}"]`);
  await until(() => evaluate(`(() => {
    const panel = document.querySelector('[data-panel=${quote(name)}]');
    if (!panel) return false;
    const style = getComputedStyle(panel);
    return style.display !== 'none' && style.visibility !== 'hidden' && !panel.hidden && panel.getAttribute('aria-hidden') !== 'true';
  })()`), `visible ${name} panel`);
}

async function injectScenario(id, { fault = null } = {}) {
  await waitForDemo();
  return evaluate(`(async () => {
    const demo = window.__jevDemo;
    if (${quote(fault)} !== null) demo.setFault(${quote(fault)});
    const envelopes = await demo.inject(${quote(id)});
    await demo.flush();
    if (${quote(fault)} !== null) demo.setFault(null);
    return envelopes;
  })()`);
}

async function demoLog() {
  await waitForDemo();
  return evaluate('window.__jevDemo.log()');
}

function findEnvelope(log, scenario, predicate = () => true) {
  const envelope = [...log].reverse().find((item) => item.scenario === scenario && predicate(item));
  assert.ok(envelope, `missing envelope for ${scenario}`);
  return envelope;
}

function decisionOf(envelope) {
  return String(envelope.decision ?? envelope.verdict ?? envelope.action?.decision ?? '').toUpperCase();
}

function actionOf(envelope) {
  return String(envelope.action?.type ?? envelope.action ?? envelope.final_action ?? '').toLowerCase();
}

function toolOf(envelope) {
  return envelope.tool ?? envelope.tool_name ?? envelope.state?.tool ?? envelope.span?.tool ?? envelope.event?.tool;
}

function jevAnswer(envelope, id) {
  const answers = envelope.jev?.answers ?? envelope.answers ?? envelope.judgment?.answers ?? [];
  if (Array.isArray(answers)) return answers.find((answer) => answer.id === id || answer.qid === id || answer.question_id === id);
  return answers[id];
}

function probability(answer, label = true) {
  if (!answer) return undefined;
  const distribution = answer.dist ?? answer.distribution ?? answer.probs ?? answer.probabilities ?? answer.raw_distribution;
  if (distribution && !Array.isArray(distribution)) {
    if (distribution[label] != null) return Number(distribution[label]);
    if (distribution[String(label)] != null) return Number(distribution[String(label)]);
    if (label === true && distribution.true != null) return Number(distribution.true);
    if (label === true && distribution.yes != null) return Number(distribution.yes);
  }
  if (Array.isArray(distribution)) {
    const item = distribution.find((entry) => entry.label === label || entry.value === label || entry.option === label || entry.label === String(label));
    if (item) return Number(item.p ?? item.probability ?? item.score);
  }
  if (answer.p != null) return Number(answer.p);
  if (answer.probability != null) return Number(answer.probability);
  return undefined;
}

function policyVersionOf(envelope) {
  return envelope.policy_version ?? envelope.policy?.version ?? envelope.policyVersion;
}

function hasNoAnswers(envelope) {
  const answers = envelope.answers ?? envelope.jev?.answers ?? {};
  if (Array.isArray(answers)) return answers.length === 0;
  return !answers || Object.keys(answers).length === 0;
}

async function selectSpan(spanId) {
  await waitForDemo();
  const selected = await evaluate(`(async () => {
    const row = document.querySelector('[data-span-id=${quote(spanId)}]');
    if (row) row.click();
    if (window.__jevDemo?.select) await window.__jevDemo.select(${quote(spanId)});
    await window.__jevDemo?.flush?.();
    return !!document.querySelector('[data-inspector][data-span-id=${quote(spanId)}]') || !!row;
  })()`);
  assert.ok(selected, `could not select span ${spanId}`);
}

async function selectReplaySpan(spanId) {
  await openTab('replay');
  const ok = await evaluate(`(() => {
    const select = document.querySelector('[data-replay-span]');
    if (!select) return false;
    select.value = ${quote(spanId)};
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.ok(ok, 'missing [data-replay-span]');
}

async function runReplay() {
  await click('[data-replay-run]');
  await until(() => evaluate('!!document.querySelector("[data-replay-after]")?.dataset.decision'), 'replay result');
}

async function replayDecision() {
  return evaluate('document.querySelector("[data-replay-after]")?.dataset.decision?.toUpperCase() || ""');
}

async function setThreshold(selector, value) {
  await selectValue(selector, String(value));
  await sleep(20);
}

async function assertNoJsErrors(fn) {
  page.errors = [];
  const result = await fn();
  const errors = page.errors.filter((error) => !/favicon|ResizeObserver|ERR_CERT_AUTHORITY_INVALID/.test(error));
  assert.deepEqual(errors, [], `console/runtime errors: ${errors.join(' / ')}`);
  return result;
}

async function probe(id, name, fn) {
  if (!wanted(id)) return;
  page.errors = [];
  let pass = true;
  let detail = '';
  try {
    detail = await fn() || '';
  } catch (error) {
    pass = false;
    detail = error.stack?.split('\n').slice(0, 3).join(' ') || String(error);
  }
  const errors = page.errors.filter((error) => !/favicon|ResizeObserver|ERR_CERT_AUTHORITY_INVALID/.test(error));
  if (errors.length) {
    pass = false;
    detail = `${detail}${detail ? ' | ' : ''}console: ${errors.slice(0, 3).join(' / ')}`;
  }
  try {
    await shot(id);
  } catch (error) {
    pass = false;
    detail = `${detail}${detail ? ' | ' : ''}screenshot: ${error.message}`;
  }
  results.push({ id, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} — ${detail}`);
}

try {
  await startServer();
  await startChrome();

  await probe('P1', 'every tab/panel renders with no JS error', async () => {
    await navigate();
    await assertNoJsErrors(async () => {
      await waitForDemo();
      for (const tab of ['live', 'replay', 'studio', 'about']) {
        assert.ok(await evaluate(`!!document.querySelector('[data-tab=${quote(tab)}]')`), `missing tab ${tab}`);
        assert.ok(await evaluate(`!!document.querySelector('[data-panel=${quote(tab)}]')`), `missing panel ${tab}`);
        await openTab(tab);
      }
    });
    return 'live/replay/studio/about tabs and panels rendered';
  });

  await probe('P2', 'S3 hard veto survives threshold sweep and Jev is non-overriding', async () => {
    await navigate();
    const [envelope] = await injectScenario('S3');
    const log = await demoLog();
    const s3 = envelope ?? findEnvelope(log, 'S3');
    const spanId = s3.span_id ?? s3.spanId ?? s3.id;
    assert.equal(decisionOf(s3), 'BLOCK');
    await selectSpan(spanId);
    assert.ok(await evaluate('!!document.querySelector("[data-override-note]")'), 'missing [data-override-note]');
    await selectReplaySpan(spanId);
    const thresholds = await evaluate('[...document.querySelectorAll("[data-threshold]")].map(el => el.dataset.threshold)');
    assert.ok(thresholds.length, 'missing replay threshold controls');
    for (const threshold of thresholds) {
      for (const value of Array.from({ length: 19 }, (_, index) => ((index + 1) * 0.05).toFixed(2))) {
        await setThreshold(`[data-threshold="${threshold}"]`, value);
        await runReplay();
        assert.equal(await replayDecision(), 'BLOCK', `${threshold}=${value} changed S3`);
      }
    }
    return `S3 ${spanId} stayed BLOCK across ${thresholds.length} threshold controls`;
  });

  await probe('P3', 'S4 HOLD even when attack safe probability is >= 0.9', async () => {
    await navigate();
    const [envelope] = await injectScenario('S4');
    const log = await demoLog();
    const s4 = envelope ?? findEnvelope(log, 'S4');
    assert.equal(decisionOf(s4), 'HOLD');
    const attack = jevAnswer(s4, 'attack');
    const safe = probability(attack, 'safe');
    assert.ok(safe >= 0.9, `attack.safe probability ${safe} < 0.9`);
    return `S4 HOLD with attack.safe=${safe}`;
  });

  await probe('P4', 'S2 REVIEW flips to ALLOW when payee review threshold is raised and policy version changes', async () => {
    await navigate();
    const [envelope] = await injectScenario('S2');
    const log = await demoLog();
    const s2 = envelope ?? findEnvelope(log, 'S2');
    const spanId = s2.span_id ?? s2.spanId ?? s2.id;
    assert.equal(decisionOf(s2), 'REVIEW');
    const beforeVersion = policyVersionOf(s2);
    const payee = jevAnswer(s2, 'payee_mismatch');
    const payeeProbability = probability(payee, true);
    assert.ok(Number.isFinite(payeeProbability), 'missing payee_mismatch probability');
    assert.ok(payeeProbability < 0.99, `payee_mismatch probability too high to raise threshold: ${payeeProbability}`);
    await selectReplaySpan(spanId);
    await setThreshold('[data-threshold="payee_mismatch.review_threshold"]', Math.min(0.99, payeeProbability + 0.01).toFixed(2));
    await runReplay();
    assert.equal(await replayDecision(), 'ALLOW');
    const after = await evaluate(`window.__jevDemo.replay(${quote(spanId)}, window.__jevDemo.policy()).after`);
    const afterVersion = policyVersionOf(after);
    assert.ok(beforeVersion, 'missing original policy_version');
    assert.ok(afterVersion, 'missing replay policy_version');
    assert.notEqual(afterVersion, beforeVersion, 'policy version did not change');
    return `S2 REVIEW -> ALLOW; policy ${beforeVersion} -> ${afterVersion}`;
  });

  await probe('P5', 'F1 timeout fails closed for payment, lookup allows with alert, no stale verdict reused', async () => {
    await navigate();
    await injectScenario('F1', { fault: 'timeout' });
    const f1 = (await demoLog()).filter((item) => item.scenario === 'F1');
    assert.ok(f1.length >= 2, 'F1 should emit payment and lookup envelopes');
    const payment = f1.find((item) => /payment|payments\.execute/i.test(String(toolOf(item)))) ?? f1.find((item) => decisionOf(item) === 'BLOCK');
    const lookup = f1.find((item) => /lookup|vendor\.lookup|read/i.test(String(toolOf(item)))) ?? f1.find((item) => decisionOf(item) === 'ALLOW');
    assert.ok(payment, 'missing F1 payment envelope');
    assert.ok(lookup, 'missing F1 lookup envelope');
    assert.equal(decisionOf(payment), 'BLOCK');
    assert.equal(decisionOf(lookup), 'ALLOW');
    assert.equal(lookup.alert, true, 'lookup missing boolean alert');
    for (const item of [payment, lookup]) {
      assert.equal(item.jev_status, 'timeout', `${toolOf(item)} jev_status should be timeout`);
      assert.ok(hasNoAnswers(item), `${toolOf(item)} should have empty answers on timeout`);
      assert.equal(item.fallback_level, 'L2', `${toolOf(item)} fallback_level should be L2`);
    }
    return 'payment BLOCK by L2 timeout fallback; lookup ALLOW+alert; no answers reused';
  });

  await probe('P6', 'Monitor mode on payments.execute logs would_have BLOCK with action ALLOW', async () => {
    await navigate();
    await waitForDemo();
    await openTab('studio');
    await selectValue('[data-tool-mode="payments.execute"]', 'monitor');
    const [envelope] = await injectScenario('S3');
    const log = await demoLog();
    const s3 = envelope ?? findEnvelope(log, 'S3');
    assert.equal(String(s3.would_have ?? s3.wouldHave ?? s3.monitor?.would_have ?? '').toUpperCase(), 'BLOCK');
    assert.equal(actionOf(s3), 'allow');
    return 'Monitor mode preserves action ALLOW while logging would_have BLOCK';
  });

  await probe('P7', 'claim discipline labels and forbidden strings', async () => {
    await navigate();
    await injectScenario('S2');
    await waitForDemo();
    const result = await evaluate(`(() => {
      const answers = [...document.querySelectorAll('[data-jev-answer]')];
      return {
        answerCount: answers.length,
        unsimulated: answers.filter(el => el.dataset.simulated !== 'true').map(el => el.getAttribute('data-jev-answer')),
        hasBadge: !!document.querySelector('[data-simulated-badge]'),
        hasForbiddenVersion: document.body.innerText.includes('typesafe/jev-1.13.0'),
        badKpis: [...document.querySelectorAll('[data-kpi]')].filter(el => /(^|[^0-9])(141|87%)([^0-9]|$)/.test(el.textContent)).map(el => el.dataset.kpi),
      };
    })()`);
    assert.ok(result.answerCount > 0, 'no [data-jev-answer] nodes');
    assert.deepEqual(result.unsimulated, [], 'some Jev answers lack data-simulated=true');
    assert.ok(result.hasBadge, 'missing [data-simulated-badge]');
    assert.equal(result.hasForbiddenVersion, false, 'forbidden real Jev version string present');
    assert.deepEqual(result.badKpis, [], 'KPI tile contains 141 or 87%');
    return `${result.answerCount} simulated answer nodes checked`;
  });

  await probe('P8', '390px viewport has no horizontal page scroll', async () => {
    await navigate(390);
    await waitForDemo();
    const dimensions = await evaluate(`(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }))()`);
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `document scroll ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.bodyScrollWidth <= dimensions.clientWidth + 1, `body scroll ${JSON.stringify(dimensions)}`);
    return `scrollWidth=${dimensions.scrollWidth}, clientWidth=${dimensions.clientWidth}`;
  });
} finally {
  for (const client of clients) client.ws.close();
  chrome?.kill();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(`\n${results.filter((result) => result.pass).length}/${results.length} PASS`);
process.exitCode = results.some((result) => !result.pass) || !results.length ? 1 : 0;
