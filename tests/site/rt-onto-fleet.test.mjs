// logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, task T3: the Ontology tab's "In the agent fleet" sub-tab
// (js/rt-onto-fleet.js, wired in js/rt-ontology.js). Headless via tests/site/sx-harness.mjs: a cold deep link opens it;
// the grade line and the three limits are visible; eight rule rows with predicates; team rows equal fleetModel().queues;
// the figures equal the model; "See it run" opens the Agent fleet tab and the fleet tab's new line opens this sub-tab,
// each after arriving by the target hash first and switching tab by click; "Explore the graph" opens Graph & files;
// the scoped note and both chips; no horizontal page scroll at 1400 and 390 px; no page errors. Skips without Chrome.
// Set ONTO_FLEET_SHOT_PREFIX to save <prefix>-1400.png and <prefix>-390.png of the sub-tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withPage, until, ROOT } from './sx-harness.mjs';
import { fleetOntology, PACK_PATH, FILES_PATH } from '../../js/rt-onto-fleet-model.js';
import { fleetModel } from '../../js/rt-fleet.js';
import { LIMITS, GRADE_LINE, fleetShape, leadText } from '../../js/rt-onto-fleet.js';

const Q = JSON.stringify;
const readJson = rel => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const model = fleetOntology(readJson(PACK_PATH), readJson(FILES_PATH));
const queues = fleetModel({ seed: 7 }).queues;
const PANEL = '#rtOntology [data-rt-subpanel="fleet"]';

test('the lead counts agents and the teams that own them, from the engine', () => {
  // Independent of fleetShape(): the fleet table fleetModel() builds lists one row per agent with its team.
  const fleet = fleetModel({ seed: 7 }).fleet;
  const want = { agents: fleet.length, teams: new Set(fleet.map(r => r.team)).size };
  assert.deepEqual(fleetShape(), want);
  assert.deepEqual(want, { agents: 6, teams: 5 }, 'two agents share the ads team');
  assert.equal(leadText(), 'Six agents of a fictional content platform, owned by five teams.');
  assert.equal(leadText({ agents: 3, teams: 3 }), 'Three agents of a fictional content platform, owned by three teams.');
});

test('Ontology · In the agent fleet: deep link, jobs, rules, teams, routes and layout', { timeout: 240000 }, async t => {
  await withPage(t, async ({ ev, go, size, overflow, errors, page }) => {
    const tab = () => ev('return window.__rtTabs?.current?.() ?? null');
    const sub = () => ev('return window.__rtSubnav?.ontology?.current?.() ?? null');
    const visible = sel => ev(`const els = [...document.querySelectorAll(${Q(sel)})];
      return els.length > 0 && els.every(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest('[hidden]'); })`);
    const shownSub = async () => ((await tab()) === 'ontology' && await visible(PANEL)) ? sub() : null;
    const shot = async name => {
      const prefix = process.env.ONTO_FLEET_SHOT_PREFIX;
      if (!prefix) return;
      const w = await ev('return innerWidth');
      await size(w, await ev('return document.documentElement.scrollHeight'));
      const r = await ev(`scrollTo(0, 0); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector(${Q(PANEL)}).getBoundingClientRect();
        return { x: 0, y: Math.max(0, b.top - 120), width: innerWidth, height: b.height + 136 }`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
      writeFileSync(`${prefix}-${name}.png`, Buffer.from(data, 'base64'));
      await size(w, 1000);
    };

    // Cold deep link: the sub-tab opens once the ontology bar has mounted.
    await go('#view=runtime-observation&tab=ontology&sub=fleet');
    await until(async () => (await shownSub()) === 'fleet', 'cold &sub=fleet', 15000);

    // The scoped note, the two chips, and the bar's two new items with their hints.
    const note = await ev('return document.querySelector("#rtOntology .rt-intro p").innerText');
    assert.match(note, /How types help, Pre-registered test and Example runs: the same alert rule/);
    assert.match(note, /In the agent fleet and Graph & files: the ontology the simulated agent fleet runs on/);
    assert.equal(await ev('return document.querySelector("[data-rt-onto-nojudge]").textContent'), 'No judge model is used there.');
    assert.equal(await ev('return document.querySelector(\'#rtOntology .rt-intro .rt-chip[data-kind="ran"]\').textContent'), 'Measured');
    assert.equal(await ev('return document.querySelector(\'#rtOntology .rt-intro .rt-chip[data-kind="sim"]\').textContent'), 'Simulated · fleet sub-tabs');
    assert.match(await ev('return document.getElementById("rtSub-ontology-fleet").innerText'), /In the agent fleet[\s\S]*What the ontology does for six agents/);
    assert.match(await ev('return document.getElementById("rtSub-ontology-graph").innerText'), /Graph & files[\s\S]*The vision, today's pack, every JSON file/);

    // The lead sentence, computed: six agents, five teams (ad-curator and ad-buyer share the ads team).
    const lead = await ev(`return document.querySelector(${Q(PANEL + ' [data-onto-fleet-lead]')}).innerText`);
    assert.ok(lead.startsWith(leadText()), lead);
    assert.doesNotMatch(lead, /each on its own team/);

    // Grade line and the three limits, visible.
    assert.ok(await visible(`${PANEL} [data-onto-fleet-grade]`));
    assert.equal(await ev(`return document.querySelector(${Q(PANEL + ' [data-onto-fleet-grade]')}).innerText`), GRADE_LINE);
    assert.ok(await visible(`${PANEL} [data-onto-fleet-limits]`));
    const limits = await ev(`return document.querySelector(${Q(PANEL + ' [data-onto-fleet-limits]')}).innerText`);
    for (const s of LIMITS) assert.ok(limits.includes(s), s);
    for (const job of ['facts', 'rules', 'routes']) assert.ok(await visible(`${PANEL} [data-onto-fleet-job="${job}"]`), job);

    // Figures from the model.
    const num = k => ev(`return document.querySelector(${Q(`${PANEL} [data-onto-fleet-num="${k}"]`)}).textContent`);
    assert.equal(await num('triples'), String(model.counts.triples));
    assert.equal(await num('calls'), String(model.counts.calls));
    assert.equal(await num('rules'), String(model.rules.length));
    assert.equal(await num('on'), String(queues.on.total));
    assert.equal(await num('off'), String(queues.off.total));
    const facts = await ev(`return [...document.querySelectorAll(${Q(PANEL + ' [data-onto-fleet-fact] code')})].map(e => e.innerText)`);
    const want = [...new Set(model.x1.flatMap(s => s.on.triples.map(t => `${t.s} ${t.p} ${t.o}`)))];
    assert.deepEqual(facts, want);
    for (const f of ['FEATURES subject:minor', 'purpose:advertising EXCLUDES subject:minor', 'pool:hot SYNCS_TO pool:ad-candidates']) {
      assert.ok(facts.some(x => x.includes(f)), f);
    }

    // Eight rule rows, each with non-empty predicates and its "declared complete" list.
    const rules = await ev(`return [...document.querySelectorAll(${Q(PANEL + ' [data-onto-fleet-rule]')})].map(e => ({ id: e.dataset.ontoFleetRule, preds: e.querySelector('[data-onto-fleet-preds]').innerText }))`);
    assert.deepEqual(rules.map(r => r.id), model.rules.map(r => r.id));
    assert.equal(rules.length, 8);
    for (const r of rules) {
      const m = model.rules.find(x => x.id === r.id);
      assert.ok(m.predicates.length > 0);
      for (const p of m.predicates) assert.ok(r.preds.includes(p), `${r.id} shows ${p}`);
      if (m.complete.length) assert.match(r.preds, new RegExp(`declared complete: ${m.complete.join(', ')}`), r.id);
      else assert.doesNotMatch(r.preds, /declared complete/, r.id);
    }

    // Team rows: data-on / data-off equal fleetModel().queues, every queued team present.
    const teams = await ev(`return [...document.querySelectorAll(${Q(PANEL + ' [data-onto-fleet-team]')})].map(e => [e.dataset.ontoFleetTeam, Number(e.dataset.on), Number(e.dataset.off)])`);
    for (const k of new Set([...Object.keys(queues.on.byTeam), ...Object.keys(queues.off.byTeam)])) assert.ok(teams.some(x => x[0] === k), `team ${k} has a row`);
    for (const [k, on, off] of teams) {
      assert.equal(on, queues.on.byTeam[k] ?? 0, `${k} with the slice`);
      assert.equal(off, queues.off.byTeam[k] ?? 0, `${k} trace only`);
    }
    assert.equal(teams.reduce((n, x) => n + x[1], 0), queues.on.total);

    // The two route buttons carry data-wm-route.
    assert.equal(await ev(`return document.querySelector(${Q(PANEL + ' [data-onto-fleet-go="fleet"]')}).getAttribute('data-wm-route')`), '#view=runtime-observation&tab=fleet');
    assert.equal(await ev(`return document.querySelector(${Q(PANEL + ' [data-onto-fleet-go="graph"]')}).getAttribute('data-wm-route')`), '#view=runtime-observation&tab=ontology&sub=graph');

    // 1400 px: no horizontal page scroll; screenshot.
    let o = await overflow();
    assert.ok(o.doc <= o.win, `1400 px: page ${o.doc}px wide`);
    await shot('1400');

    // "Explore the graph" opens Graph & files.
    await ev(`document.querySelector(${Q(PANEL + ' [data-onto-fleet-go="graph"]')}).click()`);
    await until(async () => (await sub()) === 'graph' && await visible('#rtOntology [data-rt-subpanel="graph"]'), 'Explore the graph opens Graph & files', 15000);
    // Panel order (amendment v0.4): the vision mount first, then "What exists today" over the v0.3 graph.
    assert.deepEqual(await ev(`const p = document.querySelector('#rtOntology [data-rt-subpanel="graph"]');
      return [...p.children].slice(0, 3).map(e => e.matches('[data-onto-vision-mount]') ? 'vision' : e.matches('h3') ? e.textContent : e.id)`),
      ['vision', 'What exists today', 'rtOntoGraph']);

    // Arrive at the fleet tab by its hash, switch to Ontology → In the agent fleet by clicks, then "See it run".
    await go('#view=runtime-observation&tab=fleet');
    await until(async () => (await tab()) === 'fleet', 'arrive at the fleet tab');
    await ev('document.getElementById("rtTab-ontology").click()');
    await until(async () => (await tab()) === 'ontology' && !!(await sub()), 'ontology tab by click', 15000);
    await ev('document.getElementById("rtSub-ontology-fleet").click()');
    await until(async () => (await shownSub()) === 'fleet', 'fleet sub-tab by click');
    await ev(`document.querySelector(${Q(PANEL + ' [data-onto-fleet-go="fleet"]')}).click()`);
    await until(async () => (await tab()) === 'fleet' && await visible('#rtFleetPanel'), '"See it run" opens the Agent fleet tab');

    // Arrive at the sub-tab by its hash, switch to Agent fleet by click, then its new line opens the sub-tab again.
    await go('#view=runtime-observation&tab=ontology&sub=fleet');
    await until(async () => (await shownSub()) === 'fleet', 'arrive at &sub=fleet', 15000);
    await ev('document.getElementById("rtTab-fleet").click()');
    await until(async () => (await tab()) === 'fleet', 'fleet tab by click');
    const line = '#rtFleetPanel .rt-fleet-onto-link [data-wm-route]';
    assert.equal(await ev(`return document.querySelector(${Q(line)}).getAttribute('data-wm-route')`), '#view=runtime-observation&tab=ontology&sub=fleet');
    assert.match(await ev(`return document.querySelector(${Q(line)}).innerText`), /How the ontology works here, as a graph/);
    await ev(`document.querySelector(${Q(line)}).click()`);
    await until(async () => (await shownSub()) === 'fleet', 'the fleet tab line opens In the agent fleet');

    // 390 px: no horizontal page scroll; screenshot.
    await size(390, 1000);
    await go('#view=runtime-observation&tab=ontology&sub=fleet');
    await until(async () => (await shownSub()) === 'fleet', 'fleet at 390 px', 15000);
    o = await overflow();
    // Mobile emulation lets innerWidth grow with the content, so compare with the fixed width, not with innerWidth.
    assert.ok(o.doc <= 390 && o.win <= 390, `390 px: page ${o.doc}px wide in a ${o.win}px window`);
    await shot('390');

    assert.deepEqual(errors(), [], 'no page exceptions or console errors');
  });
});
