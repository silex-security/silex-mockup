/* Fails if the committed ../app differs from a fresh build (guards against a stale bundle). */
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
const out = mkdtempSync(join(tmpdir(), 'bs-build-'));
execSync(`npx vite build --outDir ${out} --emptyOutDir`, { stdio: 'ignore' });
const list = d => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? list(join(d, f)).map(x => join(f, x)) : [f]);
const a = list('../app').sort(), b = list(out).sort();
const diff = a.length !== b.length || a.some((f, i) => f !== b[i] || !readFileSync(join('../app', f)).equals(readFileSync(join(out, b[i]))));
if (diff) { console.error('app/ is stale: run npm run build and commit'); process.exit(1); }
console.log('app/ matches a fresh build (' + a.length + ' files)');
