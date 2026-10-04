// runner.test.mjs — CLI-level fixtures for e3/run.mjs (defect fixes). Spawns the real runner with `node`
// on synthetic observations and asserts exit codes + emitted files. No network: DEEPSEEK_API_KEY is
// always unset; the B3 arm is exercised through E3_FAKE_B3_RESPONSE_DIR (a runner hook) so no request
// is ever made.
//   node fixtures/synthetic/runner.test.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RUNNER = join(ROOT, 'e3', 'run.mjs');

let failed = 0;
function assert(cond, msg) { if (!cond) { failed++; console.error('FAIL: ' + msg); } }
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) { failed++; console.error(`FAIL: ${msg} — got ${ja}, want ${jb}`); }
}

const baseEnv = () => { const env = { ...process.env }; delete env.DEEPSEEK_API_KEY; delete env.E3_FAKE_B3_RESPONSE_DIR; return env; };
const run = (args, envExtra = {}) => spawnSync('node', [RUNNER, ...args], { env: { ...baseEnv(), ...envExtra }, encoding: 'utf8' });

const TMP = mkdtempSync(join(ROOT, 'fixtures', 'synthetic', '.runner-'));

const obsPath = join(TMP, 'observations.json');
const harmPath = join(TMP, 'harm.json');
writeFileSync(obsPath, JSON.stringify({ folds: [{ fold_id: 'f1', suite: 'banking', blocked: { calls: [{ function: 'send_money', args: {} }] } }] }));
writeFileSync(harmPath, JSON.stringify({ f1: { suite: 'banking', pairs: [['send_money', 'value transfer']] } }));

const genPredictors = (out) => {
  mkdirSync(out, { recursive: true });
  const r = run(['--observations', obsPath, '--out', out]);
  assert(r.status === 0, `generate predictors exit 0 (got ${r.status}, ${r.stderr})`);
  return r;
};

// ---- defect 1: boolean flags by presence ----
{
  const fake = join(TMP, 'fake-b3');
  mkdirSync(fake, { recursive: true });
  writeFileSync(join(fake, 'f1.json'), JSON.stringify({ choices: [{ message: { content: '[]' } }] }));

  const outTerminal = join(TMP, 'b3-terminal');
  const rt = run(['--observations', obsPath, '--out', outTerminal, '--b3'], { E3_FAKE_B3_RESPONSE_DIR: fake });
  assert(rt.status === 0, '--b3 terminal exit 0');
  assert(existsSync(join(outTerminal, 'b3', 'f1.json')), '--b3 terminal writes b3/f1.json');
  assert(JSON.parse(readFileSync(join(outTerminal, 'b3', 'f1.status.json'), 'utf8')).status === 'ok', '--b3 terminal status ok');

  const outNonTerminal = join(TMP, 'b3-nonterminal');
  const rnt = run(['--b3', '--observations', obsPath, '--out', outNonTerminal], { E3_FAKE_B3_RESPONSE_DIR: fake });
  assert(rnt.status === 0, '--b3 non-terminal exit 0');
  assert(existsSync(join(outNonTerminal, 'b3', 'f1.json')), '--b3 non-terminal writes b3/f1.json');

  const outNoKey = join(TMP, 'b3-nokey');
  const rnk = run(['--observations', obsPath, '--out', outNoKey, '--b3']);
  assert(rnk.status !== 0, '--b3 without key exits non-zero');
  assert(/DEEPSEEK_API_KEY/.test(rnk.stderr), '--b3 without key prints a clear error');
  assert(!existsSync(join(outNoKey, 'b3')), '--b3 without key makes no b3 request/output');

  const predOut = join(TMP, 'pred');
  genPredictors(predOut);
  const scTerminal = run(['--observations', obsPath, '--out', predOut, '--score', '--harm', harmPath]);
  assert(scTerminal.status === 0, '--score terminal exit 0');
  assert(existsSync(join(predOut, 'scores.json')), '--score terminal writes scores.json');

  const scNonTerminal = run(['--score', '--observations', obsPath, '--out', predOut, '--harm', harmPath]);
  assert(scNonTerminal.status === 0, '--score non-terminal exit 0');
  assert(existsSync(join(predOut, 'scores.json')), '--score non-terminal writes scores.json');

  const scores = JSON.parse(readFileSync(join(predOut, 'scores.json'), 'utf8'));
  assert(scores['p-onto'] && scores['p-onto'].all_folds && scores['p-onto'].b3_cohort, 'scores reports p-onto over all_folds and b3_cohort');
  assert(scores.b1 && scores.b1.all_folds && scores.b1.b3_cohort, 'scores reports b1 over all_folds and b3_cohort');
  assert(scores.b2 && scores.b2.all_folds && scores.b2.b3_cohort, 'scores reports b2 over all_folds and b3_cohort');
  assert(Array.isArray(scores.b3.cohort_fold_ids), 'scores reports b3 cohort_fold_ids');
  assert(Array.isArray(scores.b3.missing), 'scores reports b3 missing list');
  assert(scores.b3.missing.length === 1, 'b3 missing (no b3 run) lists the fold');
  eq(scores.b3.missing[0], { fold_id: 'f1', reason: 'missing status' }, 'b3 missing reason for absent b3 run');
  eq(scores.b3.cohort_fold_ids, [], 'b3 cohort empty when b3 not run');
}

// ---- defect 2: missing results must never become successful empty predictions ----
{
  // 2a. missing prediction file for a deterministic predictor -> hard error
  const out = join(TMP, 'missing-pred');
  genPredictors(out);
  rmSync(join(out, 'p-onto', 'f1.json'));
  const r = run(['--observations', obsPath, '--out', out, '--score', '--harm', harmPath]);
  assert(r.status !== 0, 'missing p-onto prediction exits non-zero');
  assert(/incomplete run: p-onto f1/.test(r.stderr), 'missing p-onto prediction reports incomplete run: p-onto f1');

  // 2b. corrupt (unparseable) prediction file -> hard error
  const out2 = join(TMP, 'corrupt-pred');
  genPredictors(out2);
  writeFileSync(join(out2, 'b1', 'f1.json'), 'not json');
  const r2 = run(['--observations', obsPath, '--out', out2, '--score', '--harm', harmPath]);
  assert(r2.status !== 0, 'corrupt b1 prediction exits non-zero');
  assert(/incomplete run: b1 f1/.test(r2.stderr), 'corrupt b1 prediction reports incomplete run: b1 f1');

  // helper: build a scoring dir with valid deterministic predictors, then a caller shapes b3/.
  const scenario = (name, setup) => {
    const out = join(TMP, name);
    genPredictors(out);
    mkdirSync(join(out, 'b3'), { recursive: true });
    setup(out);
    const r = run(['--observations', obsPath, '--out', out, '--score', '--harm', harmPath]);
    assert(r.status === 0, `${name} scores exit 0`);
    return JSON.parse(readFileSync(join(out, 'scores.json'), 'utf8'));
  };

  // 2c. missing status file
  {
    const s = scenario('b3-missing-status', (out) => { writeFileSync(join(out, 'b3', 'f1.json'), '[]'); });
    eq(s.b3.missing, [{ fold_id: 'f1', reason: 'missing status' }], 'missing status -> b3_missing with reason');
    eq(s.b3.cohort_fold_ids, [], 'missing status excluded from cohort');
    eq(s['p-onto'].b3_cohort.pooled.folds, 0, 'p-onto b3_cohort empty when b3 missing');
    eq(s['p-onto'].all_folds.pooled.folds, 1, 'p-onto all_folds still scores the fold');
  }

  // 2d. corrupt status file
  {
    const s = scenario('b3-corrupt-status', (out) => {
      writeFileSync(join(out, 'b3', 'f1.status.json'), 'not json');
      writeFileSync(join(out, 'b3', 'f1.json'), '[]');
    });
    eq(s.b3.missing, [{ fold_id: 'f1', reason: 'corrupt status' }], 'corrupt status -> b3_missing with reason');
    eq(s.b3.cohort_fold_ids, [], 'corrupt status excluded from cohort');
  }

  // 2e. corrupt predictions (status ok, .json not an array)
  {
    const s = scenario('b3-corrupt-preds', (out) => {
      writeFileSync(join(out, 'b3', 'f1.status.json'), JSON.stringify({ status: 'ok' }));
      writeFileSync(join(out, 'b3', 'f1.json'), '{"tool":"x"}');
    });
    eq(s.b3.missing, [{ fold_id: 'f1', reason: 'corrupt predictions' }], 'corrupt predictions -> b3_missing with reason');
    eq(s.b3.cohort_fold_ids, [], 'corrupt predictions excluded from cohort');
  }

  // 2f. status 'failed'
  {
    const s = scenario('b3-status-failed', (out) => {
      writeFileSync(join(out, 'b3', 'f1.status.json'), JSON.stringify({ status: 'failed', http_status: 500, attempts: 2 }));
    });
    eq(s.b3.missing, [{ fold_id: 'f1', reason: 'status failed' }], 'status failed -> b3_missing with reason');
    eq(s.b3.cohort_fold_ids, [], 'status failed excluded from cohort');
  }

  // 2g. inconsistent pair (status not ok but a prediction file exists)
  {
    const s = scenario('b3-inconsistent', (out) => {
      writeFileSync(join(out, 'b3', 'f1.status.json'), JSON.stringify({ status: 'failed' }));
      writeFileSync(join(out, 'b3', 'f1.json'), '[]');
    });
    eq(s.b3.missing, [{ fold_id: 'f1', reason: 'inconsistent pair' }], 'inconsistent pair -> b3_missing with reason');
    eq(s.b3.cohort_fold_ids, [], 'inconsistent pair excluded from cohort');
  }

  // 2h. genuine successful empty B3 response counts as scored (empty), not missing
  {
    const s = scenario('b3-empty-ok', (out) => {
      writeFileSync(join(out, 'b3', 'f1.status.json'), JSON.stringify({ status: 'ok' }));
      writeFileSync(join(out, 'b3', 'f1.json'), '[]');
    });
    eq(s.b3.cohort_fold_ids, ['f1'], 'empty ok response counts in the cohort');
    eq(s.b3.missing, [], 'empty ok response is not missing');
    eq(s.b3.metrics.folds[0].fold_id, 'f1', 'empty ok response scored as a fold');
    eq(s.b3.metrics.folds[0].emitted, 0, 'empty ok response emitted nothing');
    eq(s['p-onto'].b3_cohort.pooled.folds, 1, 'p-onto b3_cohort matches the b3 cohort');
    eq(s['p-onto'].all_folds.pooled.folds, 1, 'p-onto all_folds still one fold');
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(`runner test: ${failed === 0 ? 'PASS' : `${failed} FAILURES`}`);
process.exit(failed === 0 ? 0 : 1);
