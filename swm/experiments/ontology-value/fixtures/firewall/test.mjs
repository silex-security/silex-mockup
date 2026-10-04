import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projection, checkArtifacts, checkBinding, bindingAgreement, canonicalJSON, scanner } from '../../firewall-check.mjs';
import { expectedRequest, verifyRequest } from '../../b3-verify.mjs';
const corpus = { goals: ['synthetic attacker asks transfer all hidden records immediately'], identifiers: ['ZZ00123456789012345678'], files: 0 };
const temp = mkdtempSync(join(tmpdir(), 'onto-firewall-'));
function write(file, value) { const path = join(temp, file); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); }
function check() { return checkArtifacts({ directory: temp, corpus }); }
let tests = 0;
try {
  const original = projection(); write('out/snapshot.json', original); assert.equal(check().ok, true); tests++;
  const changes = [
    x => x.links.push({ s: x.nodes[0].id, t: x.nodes[1].id, pred: 'TASK_DERIVED' }),
    x => { x.nodes[0].def = 'Modified definition'; },
    x => x.nodes.push({ id: 'synthetic-leak', label: 'Paraphrase without any goal overlap', kind: 'hazard', layer: 2, def: 'Independent looking wording' }),
  ];
  for (const mutate of changes) { const x = structuredClone(original); mutate(x); write('out/snapshot.json', x); assert.equal(check().ok, false); tests++; }
  write('out/snapshot.json', original);
  write('out/ontology-context.v1.json', { tool: corpus.goals[0] }); assert.equal(check().ok, false); tests++;
  write('out/ontology-context.v1.json', {});
  write('out/tool-manifest.json', { tools: [{ description: `Use ${corpus.identifiers[0]}` }] }); assert.equal(check().ok, false); tests++;
  write('out/tool-manifest.json', { tools: [] });
  assert.equal(checkArtifacts({ directory: temp, corpus, requireAll: true }).ok, false); tests++;
  const manifest = { tools: [{ source: 'agentdojo', suite: 'synthetic', name: 'send', description: 'Send the approved record' }] };
  const fold = { fold_id: 'synthetic-0', suite: 'synthetic', blocked: { calls: [{ function: 'send', args: { recipient: corpus.identifiers[0] } }] } };
  const prompt = 'Predict alternate same-harm paths.';
  const good = expectedRequest(fold, manifest, prompt);
  assert.equal(verifyRequest(canonicalJSON(good), fold, manifest, prompt, corpus).ok, true); tests++;
  const extra = structuredClone(good), content = JSON.parse(extra.messages[1].content);
  content.blocked_observation.calls.push({ function: 'ordinary_lookup', args: {} }); extra.messages[1].content = canonicalJSON(content);
  assert.equal(verifyRequest(canonicalJSON(extra), fold, manifest, prompt, corpus).ok, false); tests++;
  const annotation = structuredClone(good); annotation.annotation = 'annotator notes';
  assert.equal(verifyRequest(canonicalJSON(annotation), fold, manifest, prompt, corpus).ok, false); tests++;
  const badPrompt = corpus.goals[0];
  assert.equal(verifyRequest(canonicalJSON(expectedRequest(fold, manifest, badPrompt)), fold, manifest, badPrompt, corpus).ok, false); tests++;
  const literalScan = scanner({ goals: [], identifiers: ['attacker@example.test', 'new_password'], files: 0 });
  assert.deepEqual(literalScan('attackerXexampleYtest'), []); tests++;
  assert.ok(literalScan('attacker@example.test').length); tests++;
  assert.ok(literalScan('new_password').length); tests++;
  assert.deepEqual(literalScan('new password'), []); tests++;
  const bindingCases = JSON.parse(readFileSync(new URL('./binding-cases.json', import.meta.url), 'utf8'));
  const validate = binding => checkBinding(binding, bindingCases.manifest, bindingCases.snapshot);
  const valid = validate(bindingCases.valid);
  assert.deepEqual(valid.violations, []); assert.deepEqual(valid.null_counts, { synthetic: 1 }); tests++;
  for (const fixture of bindingCases.failures) {
    const binding = structuredClone(bindingCases.valid);
    if (fixture.remove) delete binding.tools[fixture.remove];
    else binding.tools[fixture.id][fixture.field] = fixture.value;
    assert.ok(validate(binding).violations.length, fixture.name); tests++;
  }
  const extraBinding = structuredClone(bindingCases.valid);
  extraBinding.tools['agentdojo:synthetic/extra'] = { action: null, core: 'core:read' };
  assert.ok(validate(extraBinding).violations.length); tests++;
  assert.deepEqual(bindingAgreement(valid, valid, bindingCases.manifest), {
    overall: { total: 2, agree: 2 }, per_suite: { synthetic: { total: 2, agree: 2 } }
  }); tests++;
  const different = structuredClone(bindingCases.valid);
  different.tools['agentdojo:synthetic/send'] = { action: null, core: 'core:write' };
  assert.deepEqual(bindingAgreement(valid, validate(different), bindingCases.manifest), {
    overall: { total: 2, agree: 1 }, per_suite: { synthetic: { total: 2, agree: 1 } }
  }); tests++;
  // Exercise the default artefact path with the independent git projection still intact.
  const realAction = original.nodes.find(n => n.kind === 'action' && n.layer === 2);
  const parent = original.links.find(l => l.s === realAction.id && l.pred === 'SUBCLASS_OF').t;
  const coreRead = original.nodes.find(n => n.kind === 'action' && n.layer === 1).id;
  const binding = { version: 1, tools: {
    'agentdojo:synthetic/send': { action: realAction.id, core: parent },
    'agentdojo:synthetic/lookup': { action: null, core: coreRead }
  } };
  write('out/tool-manifest.json', bindingCases.manifest);
  write('binding.json', binding); write('binding-2.json', binding);
  const both = check(); assert.equal(both.ok, true);
  assert.equal(both.binding_agreement.overall.agree, 2);
  assert.deepEqual(both.results.find(x => x.file === 'binding.json').null_counts, { synthetic: 1 }); tests++;
  for (const file of ['binding.json', 'binding-2.json']) {
    const bad = structuredClone(binding); delete bad.tools['agentdojo:synthetic/lookup'];
    write(file, bad); assert.equal(check().ok, false); tests++;
    write(file, { ...binding, reason: corpus.goals[0] }); assert.equal(check().ok, false); tests++;
    write(file, { ...binding, reason: corpus.identifiers[0] }); assert.equal(check().ok, false); tests++;
    const entry = canonicalJSON(binding.tools['agentdojo:synthetic/send']);
    write(file, `{"tools":{"agentdojo:synthetic/send":${entry},"agentdojo:synthetic/send":${entry},"agentdojo:synthetic/lookup":${canonicalJSON(binding.tools['agentdojo:synthetic/lookup'])}}}`);
    assert.equal(check().ok, false); tests++;
    write(file, binding);
  }
  write('out/tool-map.json', {}); write('e3/effect-class.json', {}); write('e3/b3-prompt.txt', prompt);
  assert.equal(checkArtifacts({ directory: temp, corpus, requireAll: true }).ok, true); tests++;
  rmSync(join(temp, 'binding-2.json'));
  assert.equal(check().ok, true); tests++;
  assert.equal(check().results.find(x => x.file === 'binding-2.json').status, 'MISSING'); tests++;
  assert.equal(checkArtifacts({ directory: temp, corpus, requireAll: true }).ok, false); tests++;
  console.log(`firewall fixtures: PASS (${tests} checks)`);
} finally { rmSync(temp, { recursive: true, force: true }); }
