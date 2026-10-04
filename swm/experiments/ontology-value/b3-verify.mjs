import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, canonicalJSON, loadCorpus, scanner } from './firewall-check.mjs';
export function expectedRequest(fold, manifest, prompt) {
  const tools = manifest.tools.filter(t => t.source === 'agentdojo' && t.suite === fold.suite)
    .map(t => ({ name: t.name, description: t.description ?? '' })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { model: 'deepseek-v4-pro', temperature: 0, messages: [{ role: 'system', content: prompt },
    { role: 'user', content: canonicalJSON({ suite: fold.suite, tools, blocked_observation: { calls: fold.blocked.calls } }) }] };
}
export function verifyRequest(raw, fold, manifest, prompt, corpus) {
  const expected = expectedRequest(fold, manifest, prompt), violations = [];
  if (raw !== canonicalJSON(expected)) violations.push('request differs from independent reconstruction');
  // Scan the independently reconstructed non-observation context, not an attacker-controlled parsed envelope.
  const outside = structuredClone(expected), user = JSON.parse(outside.messages[1].content);
  delete user.blocked_observation; outside.messages[1].content = canonicalJSON(user);
  violations.push(...scanner(corpus)(outside));
  return { ok: !violations.length, violations };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = resolve(ROOT, 'swm/experiments/ontology-value');
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
  try {
    const observations = JSON.parse(readFileSync(arg('observations', resolve(base, 'e3/observations.json')), 'utf8'));
    const manifest = JSON.parse(readFileSync(arg('manifest', resolve(base, 'out/tool-manifest.json')), 'utf8'));
    const prompt = readFileSync(arg('prompt', resolve(base, 'e3/b3-prompt.txt')), 'utf8');
    const requests = arg('dir', resolve(base, 'e3/out')), corpus = loadCorpus();
    const results = observations.folds.map(fold => {
      if (!/^[\w.:-]+$/.test(fold.fold_id)) throw new Error('unsafe fold id');
      return { fold_id: fold.fold_id, ...verifyRequest(readFileSync(resolve(requests, 'b3', `${fold.fold_id}.request.json`), 'utf8'), fold, manifest, prompt, corpus) };
    });
    if (!results.length) throw new Error('no folds to verify');
    console.log(JSON.stringify({ ok: results.every(x => x.ok), results }, null, 2)); process.exitCode = results.every(x => x.ok) ? 0 : 1;
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
