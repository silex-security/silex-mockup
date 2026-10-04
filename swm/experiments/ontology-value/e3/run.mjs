// run.mjs — X2b E3 CLI. The scorer is the ONLY code that reads harm; this runner never reads harm unless
// invoked with --score. For each fold it passes ONLY that fold to the predictors.
//   node e3/run.mjs --observations <file> --out <dir> [--b3]
//   node e3/run.mjs --observations <file> --out <dir> --score --harm <file>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildToolMap } from '../tool-map.mjs';
import { pOnto, b1, b2 } from './predict.mjs';
import { buildRequest, serializeRequest, send, parseResponse } from './b3.mjs';
import { scoreAll } from './score.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// Value options: return the token following the flag (undefined if absent or terminal).
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
// Boolean flags: presence only, independent of any value option. This fixes the defect where a
// terminal `--b3` / `--score` (nothing after it) was read through arg() and silently ignored.
const hasFlag = (k) => process.argv.includes(`--${k}`);

const obsPath = arg('observations');
const outDir = arg('out');
if (!obsPath || !outDir) throw new Error('--observations and --out are required');

const manifest = JSON.parse(readFileSync(join(HERE, '../out/tool-manifest.json'), 'utf8'));
const snapshot = JSON.parse(readFileSync(join(HERE, '../out/snapshot.json'), 'utf8'));
const effectClass = JSON.parse(readFileSync(join(HERE, 'effect-class.json'), 'utf8'));
const toolMap = buildToolMap(manifest, snapshot).tools;
const promptText = readFileSync(join(HERE, 'b3-prompt.txt'), 'utf8');

const observations = JSON.parse(readFileSync(obsPath, 'utf8'));
const folds = observations.folds ?? [];
mkdirSync(outDir, { recursive: true });

// E3_FAKE_B3_RESPONSE_DIR (optional, test-only): when set, the B3 arm reads one raw response per fold
// from <dir>/<fold_id>.json instead of calling the DeepSeek API. Inert unless the env var is set;
// unset, the runner behaves exactly as before (requires DEEPSEEK_API_KEY and POSTs to the API).
const fakeB3Dir = process.env.E3_FAKE_B3_RESPONSE_DIR;

if (hasFlag('score')) {
  const harmPath = arg('harm');
  if (!harmPath) throw new Error('--score requires --harm');
  const harm = JSON.parse(readFileSync(harmPath, 'utf8'));

  // A deterministic predictor's prediction file must exist and parse to an array; anything else is a
  // hard error so a missing run can never masquerade as a successful empty prediction.
  const readPred = (name, fid) => {
    const p = join(outDir, name, `${fid}.json`);
    let parsed;
    try { parsed = JSON.parse(readFileSync(p, 'utf8')); } catch { throw new Error(`incomplete run: ${name} ${fid}`); }
    if (!Array.isArray(parsed)) throw new Error(`incomplete run: ${name} ${fid}`);
    return parsed;
  };

  // A B3 fold only counts when its status file exists, parses to status 'ok', AND its prediction file
  // exists and is a valid array. Every other case is reported as b3_missing with a reason.
  const readB3 = (fold) => {
    const fid = fold.fold_id;
    const sp = join(outDir, 'b3', `${fid}.status.json`);
    const pp = join(outDir, 'b3', `${fid}.json`);
    let statusObj = null;
    try { statusObj = JSON.parse(readFileSync(sp, 'utf8')); } catch { /* missing or corrupt */ }
    let pred = null;
    let predErr = false;
    try {
      const pj = JSON.parse(readFileSync(pp, 'utf8'));
      if (Array.isArray(pj)) pred = pj; else predErr = true;
    } catch { predErr = true; }

    if (statusObj === null) return { ok: false, reason: existsSync(sp) ? 'corrupt status' : 'missing status' };
    if (statusObj.status !== 'ok') {
      if (pred !== null) return { ok: false, reason: 'inconsistent pair' };
      return { ok: false, reason: `status ${statusObj.status}` };
    }
    if (predErr) return { ok: false, reason: existsSync(pp) ? 'corrupt predictions' : 'missing predictions' };
    return { ok: true, reason: null, value: pred };
  };

  const strictPreds = {};
  for (const name of ['p-onto', 'b1', 'b2']) {
    strictPreds[name] = {};
    for (const fold of folds) strictPreds[name][fold.fold_id] = readPred(name, fold.fold_id);
  }

  const b3Preds = {};
  const b3Cohort = [];
  const b3Missing = [];
  for (const fold of folds) {
    const r = readB3(fold);
    if (r.ok) { b3Preds[fold.fold_id] = r.value; b3Cohort.push(fold.fold_id); }
    else b3Missing.push({ fold_id: fold.fold_id, reason: r.reason });
  }

  const restrict = (all) => {
    const o = {};
    for (const fid of b3Cohort) o[fid] = all[fid];
    return o;
  };

  const scores = {};
  for (const name of ['p-onto', 'b1', 'b2']) {
    scores[name] = {
      all_folds: scoreAll(strictPreds[name], harm),
      b3_cohort: scoreAll(restrict(strictPreds[name]), harm),
    };
  }
  scores.b3 = {
    cohort_fold_ids: b3Cohort,
    metrics: scoreAll(b3Preds, harm),
    missing: b3Missing,
  };

  writeFileSync(join(outDir, 'scores.json'), JSON.stringify(scores, null, 1) + '\n');
  console.log(`scores written to ${join(outDir, 'scores.json')}`);
  process.exit(0);
}

const predictors = { 'p-onto': pOnto, b1, b2 };
for (const [name, fn] of Object.entries(predictors)) {
  mkdirSync(join(outDir, name), { recursive: true });
  for (const fold of folds) {
    const ctx = {
      tools: manifest.tools.filter(t => t.source === 'agentdojo' && t.suite === fold.suite),
      toolMap,
      snapshot,
      effectClass,
    };
    const preds = fn(fold, ctx);
    writeFileSync(join(outDir, name, `${fold.fold_id}.json`), JSON.stringify(preds, null, 1) + '\n');
  }
}

if (hasFlag('b3')) {
  if (!fakeB3Dir && !process.env.DEEPSEEK_API_KEY) {
    throw new Error('--b3 requires the DEEPSEEK_API_KEY environment variable to be set');
  }
  mkdirSync(join(outDir, 'b3'), { recursive: true });
  // Fetch a raw response: from the fake directory when the hook is set, otherwise from the live API.
  const fetchRaw = async (req, fold) => {
    if (fakeB3Dir) return readFileSync(join(fakeB3Dir, `${fold.fold_id}.json`), 'utf8');
    return await send(req);
  };
  for (const fold of folds) {
    const tools = manifest.tools.filter(t => t.source === 'agentdojo' && t.suite === fold.suite);
    const req = buildRequest(fold, tools, promptText);
    writeFileSync(join(outDir, 'b3', `${fold.fold_id}.request.json`), serializeRequest(req));

    let raw = null;
    let httpStatus = null;
    let attempts = 0;
    try {
      attempts = 1;
      raw = await fetchRaw(req, fold);
      httpStatus = 200;
    } catch (e) {
      try {
        attempts = 2;
        raw = await fetchRaw(req, fold);
        httpStatus = 200;
      } catch (e2) {
        httpStatus = e2.status ?? null;
        writeFileSync(join(outDir, 'b3', `${fold.fold_id}.status.json`),
          JSON.stringify({ status: 'failed', http_status: httpStatus, attempts }, null, 1) + '\n');
        continue;
      }
    }
    writeFileSync(join(outDir, 'b3', `${fold.fold_id}.response.json`), raw);
    const parsed = parseResponse(raw, tools);
    writeFileSync(join(outDir, 'b3', `${fold.fold_id}.json`), JSON.stringify(parsed.predictions, null, 1) + '\n');
    writeFileSync(join(outDir, 'b3', `${fold.fold_id}.dropped.json`), JSON.stringify(parsed.dropped, null, 1) + '\n');
    writeFileSync(join(outDir, 'b3', `${fold.fold_id}.status.json`),
      JSON.stringify({ status: parsed.status, http_status: httpStatus, attempts }, null, 1) + '\n');
  }
}

console.log(`done: ${folds.length} folds -> ${outDir}`);
