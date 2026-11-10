import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditCss } from '../../tools/style-audit.mjs';

test('auditCss counts distinct values and ignores comments and repeats', () => {
  const css = `/* #abcdef font-size:3px */
    .a{color:#FFF;font-size:11px;border-radius:8px;box-shadow:0 1px 2px #000}
    .b{color:#fff;font-size:11px;border-radius: 8px}
    .c{background:#17191d;font-size:var(--t1);font-size:9.5px}`;
  assert.deepEqual(auditCss(css), { colors: 3, fontSizes: 3, under12px: 3, radii: 1, shadows: 1 });
});
