// A visitor opens the sidebar and walks every view. Each click must move the URL, the highlighted sidebar entry
// and the one visible view together, and Back must return to the view before.
export default async function ({ go, ev, click, waitFor, count, shot, check }) {
  await go('#view=assurance');
  await click('#navToggle');
  await waitFor(`const s = window.__siteNav.state(); return s.open && s.settled && document.getElementById('sidebar').getBoundingClientRect().left >= 0`, 'sidebar open');
  await shot('sidebar-open');
  const views = await ev(`return [...document.querySelectorAll('aside .nav button[data-view]')].map(b => b.dataset.view)`);
  check('the sidebar lists the 11 views the README names', views.length === 11, views);
  for (const view of views.filter(v => v !== 'assurance')) {
    await click(`aside .nav button[data-view="${view}"]`);
    const state = await waitFor(`
      const active = [...document.querySelectorAll('section.view.active')].filter(s => s.offsetParent !== null);
      const now = { hash: location.hash, nav: document.querySelector('aside .nav button.active')?.dataset.view, shown: active.length };
      return now.hash.startsWith('#view=${view}') && now.nav === '${view}' && now.shown === 1 ? now : null`, `view ${view}`);
    check(`${view}: URL, sidebar highlight and one visible view agree`, true, state);
  }
  await shot('last-view');
  const last = views.at(-1), previous = views.at(-2);
  await ev('history.back()');
  await waitFor(`return location.hash.startsWith('#view=${previous}') && document.querySelector('aside .nav button.active')?.dataset.view === '${previous}'`, `Back to ${previous}`);
  check(`Back from ${last} returns to ${previous}`, true);
  check('no view scrolls sideways at this width', await ev('return document.documentElement.scrollWidth <= innerWidth'), await ev('return { win: innerWidth, doc: document.documentElement.scrollWidth }'));
  check('one view is visible at the end', (await count('section.view.active')) === 1);
}
