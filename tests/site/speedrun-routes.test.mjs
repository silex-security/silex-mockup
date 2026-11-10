// The Speedrun shell (speedrun/web) serves the upstream Next.js pages from a hash route. These are the route rules it relies on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, layoutsFor, match, parseHash } from '../../speedrun/web/src/routes.js';

const pages = compile([
  '../upstream/src/app/page.tsx',
  '../upstream/src/app/speedrun/page.tsx',
  '../upstream/src/app/speedrun/teams/[teamId]/page.tsx',
  '../upstream/src/app/speedrun/teams/[teamId]/trace/page.tsx',
  '../upstream/src/app/gym/experiments/[id]/page.tsx'
], 'page.tsx');

test('a static path matches its page', () => {
  assert.deepEqual(match(pages, '/'), { key: '../upstream/src/app/page.tsx', params: {} });
  assert.deepEqual(match(pages, '/speedrun'), { key: '../upstream/src/app/speedrun/page.tsx', params: {} });
});
test('a [param] folder captures one decoded segment', () => {
  assert.deepEqual(match(pages, '/speedrun/teams/order%20support'), { key: '../upstream/src/app/speedrun/teams/[teamId]/page.tsx', params: { teamId: 'order support' } });
  assert.deepEqual(match(pages, '/speedrun/teams/refund/trace').params, { teamId: 'refund' });
  assert.deepEqual(match(pages, '/gym/experiments/exp-028').params, { id: 'exp-028' });
});
test('a trailing slash is ignored and an unknown path matches nothing', () => {
  assert.equal(match(pages, '/speedrun/').key, '../upstream/src/app/speedrun/page.tsx');
  assert.equal(match(pages, '/speedrun/teams'), null);
  assert.equal(match(pages, '/speedrun/teams/refund/trace/extra'), null);
});
test('API routes compile the same way', () => {
  const apis = compile(['../upstream/src/app/api/teams/[teamId]/builder/recommendations/[rid]/route.ts'], 'route.ts');
  assert.deepEqual(match(apis, '/api/teams/refund/builder/recommendations/r2').params, { teamId: 'refund', rid: 'r2' });
});
test('a page is wrapped by the layouts above it, outermost first', () => {
  const layouts = ['../upstream/src/app/speedrun/teams/layout.tsx', '../upstream/src/app/gym/layout.tsx', '../upstream/src/app/speedrun/layout.tsx'];
  assert.deepEqual(layoutsFor(layouts, '../upstream/src/app/speedrun/teams/[teamId]/page.tsx'),
    ['../upstream/src/app/speedrun/layout.tsx', '../upstream/src/app/speedrun/teams/layout.tsx']);
});
test('the hash carries the path and the query', () => {
  assert.deepEqual(parseHash(''), { pathname: '/', search: {}, href: '/' });
  assert.deepEqual(parseHash('#/gym?status=done&page=2'), { pathname: '/gym', search: { status: 'done', page: '2' }, href: '/gym?status=done&page=2' });
});
