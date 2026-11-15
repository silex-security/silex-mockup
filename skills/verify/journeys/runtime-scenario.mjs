// A visitor picks a scripted situation in Runtime Observation and watches it go through the gate. S1 is the
// ordinary payment whose three actions all run. S3 is the over-limit payment that a hard rule blocks.
export default async function ({ go, ev, click, choose, waitFor, text, shot, check }) {
  await go('#view=runtime-observation');
  check('the view opens on READY before a scenario is chosen', (await text('#rtStatus')) === 'READY', await text('#rtStatus'));
  const options = await ev(`return [...document.getElementById('rtScenarioSelect').options].filter(o => o.value).length`);
  check('the dropdown offers the 34 scripted situations', options === 34, options);

  const run = async id => {
    await choose('#rtScenarioSelect', id);
    await waitFor(`return document.getElementById('rtStatus').innerText.trim() === 'RUNNING'`, `${id} running`);
    await click('#rtPipeSkip');
    await waitFor(`return document.getElementById('rtStatus').innerText.trim() === 'COMPLETE'`, `${id} complete`);
    return { caption: await text('#rtPipeCaption'), what: await text('#rtScenWhat') };
  };

  const normal = await run('S1');
  await shot('s1-complete');
  check('S1 runs to its third and last action', /^Action 3 of 3 /.test(normal.caption), normal.caption);
  check('S1 ends allowed by policy', /allowed by policy/.test(normal.caption), normal.caption);

  const blocked = await run('S3');
  await shot('s3-complete');
  check('S3 describes the over-limit payment', /over-limit/i.test(blocked.what), blocked.what);
  check('S3 ends blocked', /block/i.test(blocked.caption), blocked.caption);
  check('S3 does not end allowed', !/allowed by policy/.test(blocked.caption), blocked.caption);
}
