#!/usr/bin/env node
// Share the Platform page styles with the Assurance case view: every selector rooted at #assurance becomes
// :is(#assurance,#assurance-case), which has the same specificity, so the cascade does not change.
//
//   node tools/codemods/assurance-case-scope.mjs          apply
//   node tools/codemods/assurance-case-scope.mjs --check  exit 1 if a run would change the file
//
// Running it twice changes nothing: a prefix already inside :is(...) is not matched again.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../css/console.css');
const SCOPE = ':is(#assurance,#assurance-case)';

export const rescope = css => css.replace(/#assurance(?![\w-])/g, (m, offset) => css.startsWith(':is(', offset - 4) ? m : SCOPE);

if (import.meta.url === `file://${process.argv[1]}`) {
  const before = await readFile(FILE, 'utf8'), after = rescope(before);
  if (process.argv.includes('--check')) process.exitCode = before === after ? 0 : 1;
  else if (before !== after) await writeFile(FILE, after);
  console.log(`${[...after.matchAll(/:is\(#assurance,#assurance-case\)/g)].length} scoped selectors`);
}
