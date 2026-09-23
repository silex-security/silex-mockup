/* Every t('key', ...) used under src/ must exist in zh.js; so must every lint
   code, effect type and node-catalog key listed in src/i18n/required.js. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const zh = (await import('../src/i18n/zh.js')).default;
const req = (await import('../src/i18n/required.js')).REQUIRED_KEYS;
const files = d => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]);
const used = new Set(req);
for (const f of files('src').filter(f => /\.(jsx?|mjs)$/.test(f))) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*['"`]([\w.:-]+)['"`]/g)) used.add(m[1]);
const missing = [...used].filter(k => !(k in zh)).sort();
if (missing.length) { console.error(`zh.js is missing ${missing.length} key(s):\n  ` + missing.join('\n  ')); process.exit(1); }
console.log(`i18n: ${used.size} keys, all present in zh.js`);
