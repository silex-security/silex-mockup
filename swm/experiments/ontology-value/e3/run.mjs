// run.mjs — X2b E3 CLI. The scorer is the ONLY code that reads harm; this runner never reads harm unless
// invoked with --score. For each fold it passes ONLY that fold to the predictors.
//   node e3/run.mjs --observations <file> --out <dir> [--b3]
//   node e3/run.mjs --observations <file> --out <dir> --score --harm <file>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildToolMap } from '../tool-map.mjs';
import { pOnto, b1, b2 } from './predict.mjs';
import { buildRequest, serializeRequest, send, parseResponse } from './b3.mjs';
import { scoreAll } from './score.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

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

if (arg('score')) {
  const harmPath = arg('harm');
  if (!harmPath) throw new Error('--score requires --harm');
  const harm = JSON.parse(readFileSync(harmPath, 'utf8'));
  const preds = { 'p-onto': {}, b1: {}, b2: {}, b3: {} };
  for (const name of Object.keys(preds)) {
    for (const fold of folds) {
      const p = join(outDir, name, `${fold.fold_id}.json`);
      try { preds[name][fold.fold_id] = JSON.parse(readFileSync(p, 'utf8')); } catch { preds[name][fold.fold_id] = []; }
    }
  }
  const scores = {};
  for (const name of Object.keys(preds)) scores[name] = scoreAll(preds[name], harm);
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

if (arg('b3')) {
  mkdirSync(join(outDir, 'b3'), { recursive: true });
  for (const fold of folds) {
    const tools = manifest.tools.filter(t => t.source === 'agentdojo' && t.suite === fold.suite);
    const req = buildRequest(fold, tools, promptText);
    writeFileSync(join(outDir, 'b3', `${fold.fold_id}.request.json`), serializeRequest(req));
    if (process.env.DEEPSEEK_API_KEY) {
      const raw = await send(req);
      writeFileSync(join(outDir, 'b3', `${fold.fold_id}.response.json`), raw);
      const parsed = parseResponse(raw, tools);
      writeFileSync(join(outDir, 'b3', `${fold.fold_id}.json`), JSON.stringify(parsed.predictions, null, 1) + '\n');
      writeFileSync(join(outDir, 'b3', `${fold.fold_id}.dropped.json`), JSON.stringify(parsed.dropped, null, 1) + '\n');
    }
  }
}

console.log(`done: ${folds.length} folds -> ${outDir}`);
