// S4 of logs/2026-10-10_CREATOR_DOMAIN_FLEET_PLAN.md (non-negotiable 1): the creator-platform text shipped on
// the site names no real consumer content platform or its parent company. Case-insensitive, word-boundary, over
// a fixed list of non-vendored files. jev-runtime/** is excluded because it is byte-identical to the upstream
// engine checkout (tests/site/jev-runtime-vendored.test.mjs guards that), and its creator text is scanned by the
// engine-side tests/unit/web/demo-creator-brand.test.ts. `google`, `apple` and `meta` are left out of the list:
// they collide with strings already in these files and are not tenant brands — the Google Fonts preconnects,
// the -apple-system font stack and hardware names, and HTML <meta> / metadata. Their parents are still covered
// as `alphabet` and `meta platforms`, which do not collide. No git and no network, so it runs in the CI archive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = [
  'index.html',
  'js/jev-runtime-host.js',
  'js/jev-runtime-model.js',
  'js/rt-fleet.js',
  'js/rt-subtabs.js',
  'swm/data/packs/creator-platform.json',
  'logs/2026-10-10_CREATOR_PLATFORM_RUNTIME_OBSERVATION_DESIGN.md',
  'js/rt-onto-fleet-model.js',
  'js/rt-onto-fleet.js',
  'js/rt-onto-graph.js',
  'js/rt-onto-vision.js',
  'tools/gen-onto-data.mjs',
  'data/creator-slice.json',
  'data/ontology-files.json',
  'logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md',
];
const DENY = [
  'tiktok', 'douyin', 'bytedance', 'kuaishou', 'kwai', 'youtube', 'instagram', 'facebook',
  'meta platforms', 'snapchat', 'bilibili', 'xiaohongshu', 'rednote', 'reelshort', 'dramabox',
  'netflix', 'twitch', 'alphabet',
];
const DENY_RE = new RegExp(`\\b(${DENY.join('|')})\\b`, 'i');

test('the shipped creator-platform text names no real consumer platform or parent company', () => {
  for (const rel of FILES) {
    const text = readFileSync(join(ROOT, rel), 'utf8');
    const hit = text.match(DENY_RE);
    assert.equal(hit, null, `${rel} contains "${hit?.[0]}"`);
  }
});
