// Every table of the console and Agent Gym uses the shared data table, css/table.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))).flat();
const sources = [join(ROOT, 'index.html'), ...(await walk(join(ROOT, 'js'))), ...(await walk(join(ROOT, 'agent-gym/js')))].filter(f => /\.(html|js)$/.test(f));

// A grid of status tiles laid out with table markup. It has no rows to rule or hover, so it is not a data table.
const GRIDS = /\brun-matrix\b/;

test('every table carries the dt class', async () => {
  let seen = 0;
  for (const file of sources) {
    const text = await readFile(file, 'utf8');
    for (const m of text.matchAll(/<table\b[^>]*>|h\('table',\s*\{[^}]*\}/g)) {
      if (GRIDS.test(m[0])) continue;
      seen++;
      assert.match(m[0], /class(?:=|:\s*)["'](?:[^"']*\s)?dt(?:\s|["'])/, `${relative(ROOT, file)}: ${m[0]}`);
    }
  }
  assert.ok(seen >= 20, `only ${seen} tables found, the scan is broken`);
});

test('the console and Agent Gym load css/table.css, and no stylesheet restates its header', async () => {
  assert.match(await readFile(join(ROOT, 'index.html'), 'utf8'), /href="css\/table\.css"/);
  assert.match(await readFile(join(ROOT, 'agent-gym/index.html'), 'utf8'), /href="\.\.\/css\/table\.css"/);
  for (const dir of ['css', 'agent-gym/css']) {
    for (const file of (await readdir(join(ROOT, dir))).filter(f => f.endsWith('.css') && f !== 'table.css')) {
      const css = await readFile(join(ROOT, dir, file), 'utf8');
      for (const m of css.matchAll(/[^{}]*\bth\b[^{}]*\{([^}]*)\}/g))
        assert.doesNotMatch(m[1], /text-transform:\s*uppercase/, `${dir}/${file} restyles a table header: ${m[0].trim().slice(0, 90)}`);
    }
  }
});
