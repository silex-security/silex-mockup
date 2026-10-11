// Scenario Expansion: the public text stays neutral (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, neutrality check).
// Denied terms are stored hashed; the list lives in the private repo. Scanned: every js/sx-*, css/sx-* and
// tests/site/sx-* file (new files join automatically), the index.html fragment between the sx:begin and sx:end
// markers, the public plan, and this change's logs/README.md entry between its sx-log markers. Each text is split
// into lowercase a-z0-9 tokens; every token and every pair of adjacent tokens is hashed and compared, and every 2-4
// character run of CJK text is hashed too. No git and no network, so it runs in the CI archive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HASHES = new Set([
  "101e21bef69a3df68f36ca31deb6616f10cc70e4bae8eed9ce83a9effb1fd5cb",
  "45c3615ff7b5094bf2037f55fb0a575eedb74d96158e87994c6ca4e77ee92e3f",
  "ef4095ba96e4950581a6cc5f9de4092a20901a2cfaf9d2a3b02891afceae6e34",
  "be7d8808355816986c83eb797645ec1112a05eb102c5db842080b7a4773d2af6",
  "c9501add4202316f2637ec7238e9287b6889d0339e341d8b559937c0c115e603",
  "18889a721a537ee1d9f6de4268a9ccf9f3e59bfebac6441f393996fa66ac80a0",
  "575130c033b13a4deee1fc5ccce59075e3e053bc094c990cf56de4b52a8c501b",
  "07ae38b93d8054d84aac37039c71ad114a8685a3857084d568f260ce69f0737f",
  "e010963a4422ead3525b4c5f99ac5136cfa5883f284b959dce67b39160979819",
  "e1b2becb7b86d54efdc49c709c2f0be1cd7b43212ffe975215852cf543d02e60",
  "7f3fa48ca885678134842fa7456f3ece53a97f843b610185d900ac4e467c7490",
  "06cb75f132725b4bb3365dbbe3bed8c53075c49f4fc4b63dc4b91acde5695d3d",
  "76f9df77e8afeb0caad8b2924689dc8f60bee743e49463a36844a819f36f39e7",
  "397984f7fe0425c76d550c98e5088869ec8c5823171dfea9461cd2eaf8e21ffa",
  "f6d67b8aee1974f71da2ef40eef85ea8c2f25178825c4c339a3894839037b8d5",
  "09f498614b57af7902da792d05c25dfdb10bd2481cf2f9c04545f5920acac723",
  "e0e3328407a16324ec5a66e167a49e4fd3d6f35dd6841f1ef86fcf62b4c80445",
  "af3c0cbf54070db04a0b2298398dc65f81933659c8d870fa6e6c782a859edef1",
  "b87bbc7e8359c5bc1cda19f7909cb154f49df06c42b3ef205a5231e15b6d4ec0",
  "811c96bbc3af6c177b272c9ae1c8f60eff55c06c963e573270fdf7e8dd68e55f",
  "b7edf8bb851ee516086011b49853a6dbdc2e4c5ed40502bd94e7c94ae25d57ed",
  "b85e5b805cb6a16840aa44d7e71aa3da0d0e967d64b56bd02629f5f40bbd3a9e",
  "dde6090dd078f77fc3ff6470a75f2e3679a64c0c2a52fbed8fd7ccd8da697a19",
  "7e27a865600b1bfd5c99106413e49ccd02d36102d64ade73add21aa31ea30c19",
  "849b9e6779c9d376d61e62d51d43895b0d758b40712e973c2014a558028519f2",
  "095e0f417f10c97ff982850d9993efe4e8d32bcd02b7df75f9fc9873f817749e",
  "701f7120557c78dadb0945bf9b3fe5464bc1a19768d445636a206e5a8cd3e0c8",
  "65af16a60e0f95268925118a0d2b21b42a166bba1f36c031837031661a82b4b6",
  "be3b5ed12e072cc3a1313a95ecdb3fc69dc94791fca51567f32499715f7a593c",
  "49b27b70fd537e4f2a83874f285df367a70664752446770a4aac69b521fa6e67",
  "b1a62b91bf0f56667b5419deab849784b2079e98851e54ec4ea9d3523dc15026",
  "11f2252f70c86e1a2856d863602a2ef08ae30202dfe8f9fe3183d3babc54ec47",
  "04675d4a5d7ad37c54e3a0e8bfa47f24fc6faed1ae593254bb85b1a7d3bb61d8",
  "755254296d9d1c2c436b0512e85baccf88823d4f58d469494883d784bad6fa68",
  "e5961a2f5550a41f7ad2386f9a71718865253fe5c54964cfa61a4449b33378d0",
  "a116a1678da56c73ad219554cef00bc45dba8e0e34b677e987ade694de26da81"
]);
const sha = s => createHash('sha256').update(s).digest('hex');

/** The hashes of every token, adjacent token pair and short CJK run in a text. */
export function fingerprints(text) {
  const out = new Set();
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  tokens.forEach((t, i) => { out.add(sha(t)); if (i + 1 < tokens.length) out.add(sha(t + ' ' + tokens[i + 1])); });
  for (const run of text.match(/[㐀-鿿]+/g) ?? []) {
    for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= run.length; i++) out.add(sha(run.slice(i, i + n)));
  }
  return out;
}

const between = (text, a, b) => { const i = text.indexOf(a), j = text.indexOf(b); return i >= 0 && j > i ? text.slice(i, j) : null; };

function sources() {
  const out = [];
  for (const dir of ['js', 'css', 'tests/site']) {
    for (const f of readdirSync(join(ROOT, dir))) if (f.startsWith('sx-')) out.push([`${dir}/${f}`, readFileSync(join(ROOT, dir, f), 'utf8')]);
  }
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const view = between(index, '<!-- sx:begin -->', '<!-- sx:end -->');
  assert.ok(view, 'index.html has the sx:begin/sx:end markers');
  out.push(['index.html (sx fragment)', view]);
  const plan = 'logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md';
  if (existsSync(join(ROOT, plan))) out.push([plan, readFileSync(join(ROOT, plan), 'utf8')]);
  const entry = between(readFileSync(join(ROOT, 'logs/README.md'), 'utf8'), '<!-- sx-log:begin -->', '<!-- sx-log:end -->');
  if (entry) out.push(['logs/README.md (sx-log entry)', entry]);
  return out;
}

test('the public Scenario Expansion text contains no denied term', () => {
  const scanned = sources();
  assert.ok(scanned.length >= 8, 'the scan covers the view and its modules');
  for (const [name, text] of scanned) {
    const hit = [...fingerprints(text)].some(h => HASHES.has(h));
    assert.equal(hit, false, `${name} contains a denied term (see the private list)`);
  }
});

test('the fingerprint matcher finds tokens, pairs and CJK runs', () => {
  // Self-check with a term that is on no list: hashes of tokens, adjacent pairs and CJK runs are all produced.
  const f = fingerprints('Alpha-Beta gamma 演示文本');
  for (const s of ['alpha', 'beta', 'alpha beta', 'beta gamma', '演示', '文本', '演示文本']) assert.ok(f.has(sha(s)), s);
});
