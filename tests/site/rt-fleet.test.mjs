// S4 of logs/2026-10-10_CREATOR_DOMAIN_FLEET_PLAN.md: the Agent fleet panel (js/rt-fleet.js, S3) and its
// agreement with the candidate Creator Platform Pack. The first checks are pure (fleetModel is DOM-free);
// the last drives a headless Chrome page from a local static server. No git and no network, so it runs in
// the CI `git archive` export (CI sets CHROME=/usr/bin/google-chrome). The headless check skips with a clear
// message when no Chrome binary exists, like tests/site/ontology-card.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fleetModel } from '../../js/rt-fleet.js';
import { runStream } from '../../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor } from '../../jev-runtime/demo/js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../../jev-runtime/demo/js/engine/types.js';
import { DOMAINS } from '../../jev-runtime/demo/js/engine/domains.js';
import { browser, until } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const NON_EXECUTING = new Set(['hold_for_review', 'hold_for_approval', 'deny', 'stop_and_handover']);
const pre = envs => envs.filter(e => e.boundary === 'pre_tool');

/** Independent recomputation of the team queues from the engine, not from fleetModel. */
function recompute(seed, ontology) {
  const byTeam = {};
  let total = 0;
  for (const t of scenariosFor('creator')) {
    for (const e of pre(runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed, ontology }))) {
      if (!NON_EXECUTING.has(e.action)) continue;
      const team = DOMAINS.creator.reviewers[e.tool.name] ?? 'unassigned';
      byTeam[team] = (byTeam[team] ?? 0) + 1;
      total += 1;
    }
  }
  return { byTeam, total };
}

test('fleetModel: 22 creator scenarios, six fleet rows, and the X1 chain on/off', () => {
  const m = fleetModel({ seed: 7 });
  assert.equal(m.scenarios.length, 22);
  assert.deepEqual(m.scenarios.map(s => s.id), scenariosFor('creator').map(t => t.scenario));
  assert.equal(m.fleet.length, 6);
  assert.deepEqual([...new Set(m.fleet.map(r => r.agent))].sort(), [...DOMAINS.creator.agents].sort());

  const x1 = Object.fromEntries(m.x1.map(x => [x.id, x]));
  assert.deepEqual(m.x1.map(x => x.id), ['X1Pb', 'X1Cb', 'X1Bb']);
  assert.deepEqual([x1.X1Pb.on.decision, x1.X1Cb.on.decision, x1.X1Bb.on.decision], ['HOLD', 'BLOCK', 'BLOCK']);
  assert.deepEqual(x1.X1Pb.on.rules, ['latent_ad_path']);
  assert.deepEqual(x1.X1Cb.on.rules, ['ad_use_eligibility']);
  assert.deepEqual(x1.X1Bb.on.rules, ['ad_use_eligibility']);
  for (const id of ['X1Pb', 'X1Cb', 'X1Bb']) {
    assert.equal(x1[id].off.decision, 'ALLOW', id);
    assert.equal(x1[id].off.stopped, false, id);
  }
  assert.equal(m.queues.off.total, 0, 'nothing is stopped without the slice');
});

test('fleetModel queues equal an independent engine recomputation, both settings', () => {
  const m = fleetModel({ seed: 7 });
  assert.deepEqual(m.queues.on, recompute(7, true));
  assert.deepEqual(m.queues.off, recompute(7, false));
});

test('the pack and the engine agree on every OWNED_BY_TEAM reviewer', () => {
  const pack = JSON.parse(readFileSync(join(ROOT, 'swm/data/packs/creator-platform.json'), 'utf8'));
  // How the pack encodes the ten reviewed actions: the class ids' trailing name maps to a tool.
  const TOOL_BY_CLASS = {
    'pack:ActionPushTrend': 'promo.push_trend_to_homepage',
    'pack:ActionHotPool': 'promo.add_to_hot_pool',
    'pack:ActionSelectCreative': 'ads.select_creative',
    'pack:ActionLaunchCampaign': 'ads.launch_campaign',
    'pack:ActionUpdateLoginEmail': 'help.update_login_email',
    'pack:ActionRefund': 'help.refund_coins',
    'pack:ActionPayoutChange': 'creator.update_payout_account',
    'pack:ActionBuyPromotion': 'studio.buy_promotion',
    'pack:ActionAnalyticsRead': 'creator.get_creator_analytics',
    'pack:ActionUseAsset': 'studio.use_asset',
  };
  const teamIds = new Set(pack.teams.map(t => t.id));
  const owned = pack.edges.filter(e => e.p === 'OWNED_BY_TEAM');
  assert.equal(owned.length, Object.keys(TOOL_BY_CLASS).length, 'one OWNED_BY_TEAM edge per reviewed action');
  for (const e of owned) {
    const tool = TOOL_BY_CLASS[e.s];
    assert.ok(tool, `edge subject ${e.s} maps to a tool`);
    assert.ok(teamIds.has(e.o), `edge object ${e.o} is a pack team`);
    assert.equal(e.o, `team:${DOMAINS.creator.reviewers[tool]}`, `${tool} is owned by ${e.o}`);
  }
  // Every reviewed tool has exactly one owner in the pack.
  for (const tool of Object.keys(DOMAINS.creator.reviewers)) {
    const owners = owned.filter(e => TOOL_BY_CLASS[e.s] === tool);
    assert.equal(owners.length, 1, `${tool} has one owner`);
  }
});

test('the Agent fleet page renders the X1 chain, the queues and the reference metrics', { timeout: 120000 }, async (t) => {
  let session;
  try {
    session = await browser();
  } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless page check skipped');
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
  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const p = session.page;
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1100, deviceScaleFactor: 1, mobile: false });
    await p.send('Page.navigate', { url: `${origin}/index.html#view=runtime-observation&tab=fleet` });
    await until(() => p.ev('return !!document.querySelector("#rtFleet[data-ready]")'), 'Agent fleet panel', 30000);

    // Code review r3: the X1 card names the facts the engine actually uses (FEATURES + the EXCLUDES policy), and no longer
    // presents a missing ELIGIBLE_FOR as the check.
    const x1Text = await p.ev('return document.querySelector("[data-rt-x1]").textContent');
    assert.match(x1Text, /purpose:advertising EXCLUDES subject:minor/);
    assert.match(x1Text, /video FEATURES subject:minor/);
    assert.doesNotMatch(x1Text, /ELIGIBLE_FOR publish/);
    const snap = await p.ev(`return {
      tabSelected: document.querySelector('[data-rt-tab="fleet"]')?.getAttribute('aria-selected'),
      panelVisible: !!document.getElementById('rtFleetPanel') && !document.getElementById('rtFleetPanel').hidden && document.getElementById('rtFleetPanel').classList.contains('active'),
      x1: !!document.querySelector('[data-rt-x1]'),
      sides: document.querySelectorAll('[data-rt-x1-side]').length,
      on: [...document.querySelectorAll('[data-rt-x1-side="on"] [data-rt-fleet-decision]')].map(e => e.dataset.rtFleetDecision),
      off: [...document.querySelectorAll('[data-rt-x1-side="off"] [data-rt-fleet-decision]')].map(e => e.dataset.rtFleetDecision),
      simulated: /Simulated/.test(document.querySelector('[data-rt-x1]')?.textContent ?? ''),
      scenarioRows: document.querySelectorAll('[data-rt-fleet-scenario]').length,
      queueOn: document.querySelector('[data-rt-queue-total-on]')?.textContent.trim(),
      creatorOptions: [...document.querySelectorAll('#rtScenarioSelect optgroup')].filter(g => /Creator platform/.test(g.label)).reduce((n, g) => n + g.querySelectorAll('option').length, 0),
      refScenarios: document.querySelector('#rtMetrics [data-rt-metric="scenarios"] .metric-value')?.textContent.trim()
    };`);

    assert.equal(snap.tabSelected, 'true', 'the Agent fleet tab is selected');
    assert.equal(snap.panelVisible, true, 'the Agent fleet panel is visible');
    assert.equal(snap.x1, true, 'the X1 card exists');
    assert.equal(snap.sides, 2, 'the X1 card has both sides');
    assert.deepEqual(snap.on, ['HOLD', 'BLOCK', 'BLOCK'], 'on-side decisions');
    assert.deepEqual(snap.off, ['ALLOW', 'ALLOW', 'ALLOW'], 'off-side decisions');
    assert.equal(snap.simulated, true, 'the X1 card carries the Simulated chip');
    assert.equal(snap.scenarioRows, 22, 'one row per scenario');
    assert.equal(snap.queueOn, String(fleetModel({ seed: 7 }).queues.on.total), 'the on-queue total equals the model');
    assert.equal(snap.creatorOptions, 22, '22 creator options in the picker');
    assert.equal(snap.refScenarios, '12', 'the reference metric still counts the 12 AP/SOC scenarios');

    // T4 of logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md: the honesty notes stay visible text, never only in a tip or in the
    // closed "Show as tables" details, at desktop and phone widths and in both X1 modes, idle and done (S44 style).
    // logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md: each note is checked while the sub-tab it belongs to is selected.
    const NOTES = {
      always: ['#rtFleetPanel .rt-fleet-intro .rt-chip[data-kind="sim"]'],
      cascade: ['[data-rt-fx1] .rt-chip[data-kind="sim"]', '[data-rt-fx1-claim]'],
      routing: ['[data-rt-froute] .rt-chip[data-kind="sim"]', '[data-rt-froute-claim]'],
      scenarios: ['[data-rt-fgrid] .rt-chip[data-kind="sim"]'],
    };
    const visibleNotes = sub => p.ev(`return ${JSON.stringify([...NOTES.always])}.concat(${JSON.stringify(NOTES)}[${JSON.stringify(sub)}]).map(sel => {
      const els = [...document.querySelectorAll(sel)];
      const ok = els.length > 0 && els.every(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0
        && !e.closest('.rt-tip-body') && !e.closest('details:not([open])'); });
      return [sel, ok];
    })`);
    const openSub = async key => { await p.ev(`document.querySelector('#rtFleet [data-rt-sub="${key}"]').click()`);
      await until(() => p.ev(`return window.__rtSubnav.fleet.current() === '${key}' && !document.querySelector('#rtFleet [data-rt-subpanel="${key}"]').hidden`), 'sub ' + key); };
    const x1Mode = async m => { await p.ev(`document.querySelector('[data-rt-fx1-mode="${m}"]').click()`);
      await until(() => p.ev(`return document.querySelector('[data-rt-fx1]').dataset.mode === '${m}'`), 'mode ' + m); };
    // Four sub-tabs in story order, cascade first; a tablist with one selected tab and one visible panel.
    assert.deepEqual(await p.ev(`return [...document.querySelectorAll('#rtFleet [data-rt-sub]')].map(b => [b.dataset.rtSub, b.getAttribute('role'), b.getAttribute('aria-selected')])`),
      [['cascade', 'tab', 'true'], ['agents', 'tab', 'false'], ['routing', 'tab', 'false'], ['scenarios', 'tab', 'false']]);
    assert.equal(await p.ev(`return document.querySelector('#rtFleet [data-rt-fleet-subnav]').getAttribute('role')`), 'tablist');
    for (const width of [1400, 390]) {
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 600 });
      await openSub('cascade');
      for (const m of ['on', 'off']) {
        await x1Mode(m);
        for (const phase of ['idle', 'done']) {
          if (phase === 'done') {
            await p.ev(`document.querySelector('[data-rt-fx1-act="step"]') && [...Array(8)].forEach(() => document.querySelector('[data-rt-fx1-act="step"]').click())`);
            await until(() => p.ev('return document.querySelector("[data-rt-fx1]").dataset.state === "done"'), 'x1 done');
          }
          for (const [sel, ok] of await visibleNotes('cascade')) assert.equal(ok, true, `${width}px ${m} ${phase}: ${sel} visible`);
          if (m === 'off' && phase === 'done') assert.match(await p.ev('return document.querySelector("[data-rt-fx1]").textContent'), /scripted outcome/);
        }
        if (width === 1400) await p.ev(`document.querySelector('[data-rt-fx1-act="replay"]')?.click(); document.querySelector('[data-rt-fx1-act="play"]')?.click()`);
      }
      for (const sub of ['routing', 'scenarios']) {
        await openSub(sub);
        for (const [sel, ok] of await visibleNotes(sub)) assert.equal(ok, true, `${width}px ${sub}: ${sel} visible`);
        assert.ok(await p.ev('return document.documentElement.scrollWidth <= innerWidth'), `${width}px ${sub}: no horizontal page scroll`);
      }
      assert.ok(await p.ev('return document.documentElement.scrollWidth <= innerWidth'), `${width}px: no horizontal page scroll`);
    }
    // ▶ in the matrix hands over to the Scenarios tab; the fleet deep link still opens the fleet tab afterwards.
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1100, deviceScaleFactor: 1, mobile: false });
    await p.ev('document.querySelector(\'[data-rt-fgrid-play="CR2b"]\').click()');
    await until(() => p.ev('return document.querySelector(\'[data-rt-tab="scenarios"]\').getAttribute("aria-selected") === "true" && document.getElementById("rtScenarioSelect").value === "CR2b"'), 'CR2b plays in Scenarios', 15000);
    await p.ev('location.hash = "#view=dashboard"; location.hash = "#view=runtime-observation&tab=fleet"');
    await until(() => p.ev('return window.__rtTabs.current() === "fleet"'), 'fleet deep link after ▶', 10000);
    await p.ev('location.hash = "#view=runtime-observation&tab=fleet&sub=agents"');
    await until(() => p.ev('return window.__rtSubnav.fleet.current() === "agents" && !document.querySelector(\'#rtFleet [data-rt-subpanel="agents"]\').hidden'), '&sub=agents deep link', 10000);
    // Next walks the story; leaving the cascade cancels its guided demo.
    await p.ev(`document.querySelector('#rtFleet [data-rt-subpanel="agents"] [data-rt-sub-next]').click()`);
    assert.equal(await p.ev('return window.__rtSubnav.fleet.current()'), 'routing');
    assert.notEqual(await p.ev('return document.querySelector("[data-rt-fx1]").dataset.state'), 'playing', 'the X1 demo does not play on another sub-tab');
    // The text routing note is the claim the dots illustrate.
    assert.match(await p.ev('return document.querySelector("[data-rt-froute-claim]").textContent'), /simulated, no tickets/);

    await new Promise(r => setTimeout(r, 300));
    const errors = p.errors.filter(e => !/favicon|fonts\.(googleapis|gstatic)|ERR_CERT_AUTHORITY_INVALID/.test(e));
    assert.deepEqual(errors, [], 'no page exceptions or console errors');
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});
