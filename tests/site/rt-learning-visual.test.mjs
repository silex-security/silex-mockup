// logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, T1: the Learning loop ring and the measured-results pictures.
// Pure checks under Node, then headless Chrome against a local static server (like rt-fleet-map.test.mjs): the ring's six
// nodes and legend, the card stopping at Gate, the lifecycle (plays once when shown, pauses when hidden, never replays,
// finished at once under reduced motion), every number equal to the JSON, the gate rows verbatim, the reality check's two
// AUROCs with their units, no horizontal scroll at 1400 and 390 px, and no page errors. Skips when no Chrome binary exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mountLoop, mountLearningResults, loopFrame, LOOP_MS, LOOP_STEPS, niceCeil } from '../../js/rt-learning-visual.js';
import { browser, until, sleep } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const Q = JSON.stringify;

test('learning pictures import without a DOM; the loop frame stops at Gate', () => {
  for (const h of [mountLoop(null), mountLearningResults(null, { evidence: {} })]) assert.doesNotThrow(() => { h.play(); h.pause(); h.reset(); h.destroy(); });
  assert.deepEqual(LOOP_STEPS.map(s => s.name), ['Held', 'Answer', 'Label', 'Train', 'Gate', 'Promote']);
  assert.equal(loopFrame(0).at, -1, 'idle shows no card');
  assert.equal(loopFrame(LOOP_MS).at, 4, 'end state: card at Gate');
  assert.equal(loopFrame(LOOP_MS * 10).at, 4, 'never reaches Promote');
  let prev = -1;
  for (let t = 0; t <= LOOP_MS; t += 50) { const { at } = loopFrame(t); assert.ok(at >= prev && at <= 4); prev = at; }
  assert.deepEqual([150.7, 27, 1, 0.3].map(niceCeil), [200, 30, 1, 0.3]);
});

test('learning loop and results in the page', { timeout: 180000 }, async t => {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const server = createServer(async (req, res) => {
    try {
      let file = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  const evidence = JSON.parse(await readFile(join(ROOT, 'jev-runtime/demo/data/learning-evidence.json'), 'utf8'));
  const obs = JSON.parse(await readFile(join(ROOT, 'data/onto-observability.json'), 'utf8'));
  const shots = [];
  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const p = session.page, ev = p.ev;
    const base = `http://127.0.0.1:${server.address().port}/index.html#view=runtime-observation&tab=learning`;
    const size = (width, height = 1100) => p.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const go = async hash => { await p.send('Page.navigate', { url: 'about:blank' }); await p.send('Page.navigate', { url: base + hash }); };
    const loopState = () => ev(`return document.querySelector('[data-rt-learn-loop]')?.dataset.state`);
    const resultsState = () => ev(`return document.querySelector('[data-rt-learn-results]')?.dataset.state`);
    const visible = sel => ev(`const els=[...document.querySelectorAll(${Q(sel)})];return els.length>0&&els.every(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&!e.closest('.rt-tip-body,details:not([open])')})`);
    const noOverflow = () => ev('return document.documentElement.scrollWidth<=innerWidth+1');
    const shot = async name => {
      const r = await ev(`const e=document.querySelector('#rtLearning');e.scrollIntoView({block:'start',behavior:'instant'});await new Promise(r=>setTimeout(r,150));const b=e.getBoundingClientRect();return {x:0,y:b.top+scrollY,width:innerWidth,height:b.height}`);
      const { data } = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...r, scale: 1 } });
      const file = join(process.env.TMPDIR || tmpdir(), `opus-taskT1-a1-${name}.png`);
      await writeFile(file, Buffer.from(data, 'base64')); shots.push(file);
    };

    // 1. Loop: idle until shown, autoplays once, ends with the card at Gate.
    await size(1400);
    await go('');
    await until(() => ev('return !!document.querySelector("[data-rt-learn-ring]")'), 'loop ring', 30000);
    const ring = await ev(`const svg=document.querySelector('[data-rt-learn-ring]');return {role:svg.getAttribute('role'),label:svg.getAttribute('aria-label'),nodes:[...svg.querySelectorAll('[data-node]')].map(n=>n.dataset.node),li:document.querySelectorAll('.rt-learning-loop li').length,futureDashed:svg.querySelector('[data-node=promote]').classList.contains('future')}`);
    assert.equal(ring.role, 'img');
    for (const s of LOOP_STEPS) assert.ok(ring.label.includes(s.name), 'aria-label names ' + s.name);
    assert.deepEqual(ring.nodes, LOOP_STEPS.map(s => s.key));
    assert.equal(ring.li, 6);
    assert.equal(ring.futureDashed, true);
    await until(async () => ['playing', 'done'].includes(await loopState()), 'loop autoplay starts');
    for (const sel of ['[data-rt-learn-illus]', '[data-rt-learn-loop-claim]', '[data-rt-learn-future]', '[data-rt-learn-ring]']) assert.equal(await visible(sel), true, sel + ' visible');
    assert.equal(await ev(`return document.querySelector('[data-rt-learn-loop-claim]').textContent`), 'Illustration. Label → Train → Gate were run on a public benchmark with benchmark labels; reviewer answers (steps 1–2) and Promote are not yet tested.');
    assert.match(await ev(`return document.querySelector('#rtLearning').textContent`), /Training on reviewer labels and production promotion are future work/);
    await until(async () => (await loopState()) === 'done', 'loop done', LOOP_MS + 8000);
    const atGate = await ev(`const c=document.querySelector('[data-rt-learn-card]').getBoundingClientRect();const cx=c.left+c.width/2,cy=c.top+c.height/2;
      const d=[...document.querySelectorAll('[data-rt-learn-ring] [data-node]')].map(n=>{const r=n.getBoundingClientRect();return [n.dataset.node,Math.hypot(r.left+r.width/2-cx,r.top+r.height/2-cy)]}).sort((a,b)=>a[1]-b[1]);
      return {at:document.querySelector('[data-rt-learn-card]').dataset.at,nearest:d[0][0],kev:document.querySelector('[data-rt-learn-kev]').textContent,promoteOn:document.querySelector('[data-node=promote]').classList.contains('on')}`);
    assert.deepEqual(atGate, { at: 'gate', nearest: 'gate', kev: 'Kev′', promoteOn: false }, 'card stops at Gate, Promote never lit');
    assert.equal(await noOverflow(), true, '1400 loop overflow');
    await shot('loop-1400');

    // Controls: Replay plays again, Pause pauses, Step jumps to the next stop.
    await ev(`document.querySelector('[data-rt-learn-replay]').click()`);
    assert.equal(await loopState(), 'playing');
    await ev(`document.querySelector('[data-rt-learn-play]').click()`);
    assert.equal(await loopState(), 'paused');
    assert.equal(await ev(`return document.querySelector('[data-rt-learn-play]').textContent`), 'Play');
    const before = await ev(`return document.querySelector('[data-rt-learn-card]').dataset.at`);
    await ev(`document.querySelector('[data-rt-learn-step]').click()`);
    const after = await ev(`return document.querySelector('[data-rt-learn-card]').dataset.at`);
    assert.equal(LOOP_STEPS.findIndex(s => s.key === after), LOOP_STEPS.findIndex(s => s.key === before) + 1, `Step ${before} → ${after}`);
    for (let i = 0; i < 6 && (await loopState()) !== 'done'; i++) await ev(`document.querySelector('[data-rt-learn-step]').click()`);
    assert.equal(await loopState(), 'done', 'stepping ends at Gate');
    assert.equal(await ev(`return document.querySelector('[data-rt-learn-card]').dataset.at`), 'gate');
    // Keyboard: the controls are real buttons.
    assert.equal(await ev(`const b=document.querySelector('[data-rt-learn-step]');b.focus();return document.activeElement===b&&b.tagName==='BUTTON'`), true);

    // 2. Lifecycle: leaving pauses, coming back does not replay.
    await go('');
    await until(async () => (await loopState()) === 'playing', 'loop playing', 30000);
    await ev(`window.__rtSubnav.learning.open('results')`);
    assert.notEqual(await loopState(), 'playing', 'leaving the sub-tab pauses');
    await ev(`window.__rtSubnav.learning.open('loop')`);
    await sleep(400);
    assert.equal(await loopState(), 'paused', 'coming back does not replay');

    // 3. Results via deep link: numbers, gate rows, reality check.
    for (const width of [1400, 390]) {
      await size(width, width === 390 ? 844 : 1100);
      await go('&sub=results');
      await until(() => ev('return !!document.querySelector("#rtJudgeRealNote")'), 'results rendered', 30000);
      await until(async () => (await resultsState()) === 'done', 'results grown', 10000);
      const r = await ev(`
        const values=[...document.querySelectorAll('#rtLearning [data-evidence-value]')].map(e=>({path:e.dataset.evidenceValue,digits:Number(e.dataset.digits),text:e.textContent}));
        const tiles=[...document.querySelectorAll('#rtLearning .rt-learning-tiles .metric')];
        const gate=[...document.querySelectorAll('#rtLearningGate [data-evidence-gate]')].map(e=>({id:e.dataset.evidenceGate,verdict:e.querySelector('[data-evidence-verdict]').textContent,text:e.textContent,visible:e.getBoundingClientRect().height>0}));
        const note=document.querySelector('#rtJudgeRealNote');
        const fills=[...document.querySelectorAll('.rt-learning-tiles .rt-lbar-fill')].map(f=>f.getBoundingClientRect().width/f.parentElement.getBoundingClientRect().width);
        return {values,tiles:tiles.length,labelled:tiles.filter(e=>e.textContent.includes('measured on an open benchmark (AgentDojo held-out); benchmark labels, not yet customer reviewers')).length,
          gate,note:note.innerText,fills,gateFills:[...document.querySelectorAll('.rt-learn-gatecard')].map(c=>[...c.querySelectorAll('.rt-lbar-fill')].map(f=>f.getBoundingClientRect().width)),
          realFills:[...note.querySelectorAll('.rt-lbar-fill')].map(f=>f.getBoundingClientRect().width/f.parentElement.getBoundingClientRect().width)}`);
      assert.ok(r.values.length >= 17, 'at least 17 evidence values: ' + r.values.length);
      for (const v of r.values) assert.equal(v.text, Number(v.path.split('/').reduce((o, k) => o[k], evidence)).toFixed(v.digits), v.path);
      assert.equal(r.tiles, 3); assert.equal(r.labelled, 3);
      assert.deepEqual(r.gate.map(g => g.id), Object.keys(evidence.gate));
      for (const row of r.gate) {
        const g = evidence.gate[row.id];
        const detail = g.safetyOk ? `Fixed ${g.fixed} · Broke ${g.broke} · ${g.evidenceOk ? 'evidence check passed' : 'needs more evidence'}` : g.missed.after > g.missed.before ? `Safety check failed: more missed cases (${g.missed.before} → ${g.missed.after})` : `Safety check failed: more false alarms (${g.falseHolds.before} → ${g.falseHolds.after})`;
        assert.equal(row.verdict, g.verdict);
        assert.equal(row.text, `${evidence.models[row.id].label}: ${g.verdict} · ${detail}`, row.id);
        assert.equal(row.visible, true, row.id + ' gate line visible');
      }
      // Bars are linear from 0 on their own scale: recall, then instruction_override AUROC on 0–1 (the third tile is ms).
      const m = evidence.models, near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.02, `${msg}: ${a} vs ${b}`);
      [m['kev-0.8b'].goal_deviation.recall, m['kev-0.8b-ft'].goal_deviation.recall, m['kev-0.8b'].instruction_override.auroc, m['kev-0.8b-ft'].instruction_override.auroc].forEach((v, i) => near(r.fills[i], v, 'tile bar ' + i));
      const [la, lb] = [m['kev-0.8b'].latency.p50_ms, m['kev-0.8b-ft'].latency.p50_ms];
      near(r.fills[4] / r.fills[5], la / lb, 'latency bars share one scale');
      const g0 = Object.values(evidence.gate)[0];
      near(r.gateFills[0][0] / r.gateFills[0][2], g0.fixed / g0.missed.before, 'gate bars share one scale');
      near(r.realFills[0], obs.judge_baseline.e1_split_auroc, 'split AUROC bar'); near(r.realFills[1], obs.judge_baseline.real_runs_auroc, 'real-runs AUROC bar');
      for (const key of ['e1_split_auroc', 'real_runs_auroc']) assert.ok(r.note.includes(Number(obs.judge_baseline[key]).toFixed(3)), key);
      assert.match(r.note, /call level/); assert.match(r.note, /run level/); assert.match(r.note, /goal_deviation/);
      assert.match(r.note, /Different units and data: expect real-world results nearer the lower figure\./);
      assert.match(r.note, new RegExp(`n = ${obs.v2_descriptive.runs}`));
      for (const sel of ['[data-rt-learn-measured]', '[data-rt-learn-claim]', '#rtJudgeRealNote', '#rtJudgeRealNote .rt-learn-unit']) assert.equal(await visible(sel), true, `${width}: ${sel} visible`);
      assert.match(await ev(`return document.querySelector('[data-rt-learn-claim]').innerText`), /benchmark labels, not yet customer reviewers/);
      assert.equal(await noOverflow(), true, width + ' results overflow');
      await shot('results-' + width);
      if (width === 390) {
        await ev(`window.__rtSubnav.learning.open('loop')`);
        await until(async () => (await loopState()) === 'done', 'loop done at 390', LOOP_MS + 8000);
        assert.equal(await ev(`return [...document.querySelectorAll('.rt-learning-loop li, [data-rt-learn-ring]')].every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1})`), true, 'ring and legend inside the 390 px viewport');
        assert.equal(await noOverflow(), true, '390 loop overflow');
        await shot('loop-390');
      }
    }

    // 4. Reduced motion: no autoplay, both pictures finished at once.
    await size(1400);
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await go('');
    await until(() => ev('return !!document.querySelector("[data-rt-learn-loop]")'), 'loop (reduced)', 30000);
    assert.equal(await loopState(), 'done', 'reduced motion: loop end state at once');
    assert.equal(await ev(`return document.querySelector('[data-rt-learn-card]').dataset.at`), 'gate');
    await ev(`document.querySelector('[data-rt-learn-replay]').click()`);
    assert.equal(await loopState(), 'done', 'reduced motion: Replay shows the end state');
    await ev(`window.__rtSubnav.learning.open('results')`);
    await until(() => ev('return !!document.querySelector("[data-rt-learn-results]")'), 'results (reduced)', 30000);
    assert.equal(await resultsState(), 'done', 'reduced motion: bars grown at once');
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

    assert.deepEqual(p.errors.filter(e => !/favicon|fonts\.g|ERR_CERT|net::ERR_(INTERNET|NAME)/i.test(String(e))), [], 'no page errors');
    t.diagnostic('screenshots: ' + shots.join(', '));
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});
