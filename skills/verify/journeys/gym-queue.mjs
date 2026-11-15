// A visitor opens Agent Gym in the console and filters the experiment queue to one stage. The tab count, the
// rows, the console URL and the screen after a reload must all name the same stage.
const FRAME = { frame: '#gymFrame' };
const inGym = code => `const d = document.getElementById('gymFrame')?.contentDocument; if (!d || d.readyState !== 'complete') return null; ${code}`;

export default async function ({ go, ev, click, reload, waitFor, text, shot, check }) {
  await go('#view=gym');
  await waitFor(inGym(`return !!d.querySelector('button.gym-tab[data-tab="pending"]')`), 'experiment queue');
  check('Agent Gym lands on the experiment queue', (await ev(inGym('return d.location.hash'))) === '#/experiments', await ev(inGym('return d.location.hash')));
  const label = await text('button.gym-tab[data-tab="pending"]', FRAME);
  const expected = Number(label.match(/(\d+)\s*$/)?.[1]);
  check('the Pending tab shows a count', expected > 0, label);

  await click('button.gym-tab[data-tab="pending"]', FRAME);
  const rows = await waitFor(inGym(`
    const rows = [...d.querySelectorAll('table.dt tbody tr.xq-row')].map(r => r.dataset.stage);
    return d.location.hash === '#/experiments?status=pending' && rows.length ? rows : null`), 'pending rows');
  await shot('pending');
  check('the table shows as many rows as the Pending tab counts', rows.length === expected, { rows: rows.length, expected });
  check('every row is a pending experiment', rows.every(s => s === 'pending'), rows);
  check('the Pending tab is the selected one', (await ev(inGym(`return d.querySelector('button.gym-tab[aria-selected="true"]')?.dataset.tab`))) === 'pending');
  const want = '#view=gym&path=' + encodeURIComponent('/experiments?status=pending');
  check('the console URL carries the filtered route', (await ev('return location.hash')) === want, await ev('return location.hash'));

  await reload();
  const after = await waitFor(inGym(`
    const rows = [...d.querySelectorAll('table.dt tbody tr.xq-row')].map(r => r.dataset.stage);
    return d.location.hash === '#/experiments?status=pending' && rows.length ? rows : null`), 'pending rows after reload');
  check('a reload reopens the same filtered queue', after.length === expected && after.every(s => s === 'pending'), after);
  await shot('pending-after-reload');
}
