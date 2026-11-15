---
name: verify
description: Drive the SILEX demo console (the static site in index.html, with the embedded Agent Gym, Speedrun, Blueprint Studio and Jev runtime apps) in a real headless Chrome the way a visitor does, and capture screenshots and a check report as proof. Use before declaring any change to index.html, js/, css/, agent-gym/, speedrun/, blueprint_studio/, jev-runtime/, swm/ or data/ done, to reproduce a reported page behaviour, or when asked to verify, prove or smoke-test this site.
---

# Verify the SILEX demo console

The product is a static site. A visitor opens `index.html`, moves between views from the sidebar or a `#view=` link, and works inside four embedded apps that run in same-origin iframes. Nothing is built and there is no backend, so "launch" means serving this checkout and opening it in Chrome. All driving goes through one helper, `skills/verify/scripts/drive.mjs`. `.claude/skills/verify` and `.agents/skills/verify` are symlinks to `skills/verify`.

The feature map in [`features/`](features/README.md) says what each feature is and which journey proves it. Read its README before driving. A proof that drives one convenient view is incomplete when the map lists other entry points for the feature you changed.

The unit tests (`node --test tests/site/*.test.mjs`) check markup and module behaviour. They do not replace this skill. Run them as well, and use this skill to show the change working on the page.

## Launch

```bash
node skills/verify/scripts/drive.mjs run skills/verify/journeys/<name>.mjs
```

Each run is its own instance. The helper serves the checkout on a free loopback port, starts a headless Chrome with a fresh temporary profile, runs the journey, and stops both. There is no server to keep alive and no fixed port, so runs in two worktrees do not collide. The page is ready when `document.readyState` is `complete` and `window.__gymHost` exists. `go()` and `reload()` wait for that.

Requirements are Node 22 or later and Chrome or Chromium. Set `CHROME` to the binary when it is not in a standard location. Nothing is installed from npm.

The helper serves the checkout that contains it. To verify another worktree, run that worktree's copy of the helper.

## Doctor

```bash
node skills/verify/scripts/drive.mjs doctor
```

It prints the Node version, the checkout path, commit, branch and whether it has uncommitted changes, the four entry pages, whether the console loads without a page error, and how many Chrome profiles the check left behind. Exit 0 means the checkout is worth driving. Exit 2 means Chrome is missing. Run it first whenever a journey fails in a way the journey does not explain.

## Drive

A journey is an ES module whose default export receives the page API. Write a new one beside the existing journeys in `skills/verify/journeys/` and start from the closest one.

```js
export default async function ({ go, click, choose, waitFor, text, count, ev, reload, shot, check }) {
  await go('#view=runtime-observation');
  await choose('#rtScenarioSelect', 'S3');
  await waitFor(`return document.getElementById('rtStatus').innerText.trim() === 'RUNNING'`, 'S3 running');
  await click('#rtPipeSkip');
  await waitFor(`return document.getElementById('rtStatus').innerText.trim() === 'COMPLETE'`, 'S3 complete');
  check('S3 ends blocked', /block/i.test(await text('#rtPipeCaption')), await text('#rtPipeCaption'));
  await shot('s3-complete');
}
```

| Call | What it does |
|---|---|
| `go(hash)` | Loads `index.html` with the hash and waits until the console is ready. |
| `click(selector, { frame })` | Moves the pointer to the element's centre and clicks. It throws when the element is missing, has no size or is covered. |
| `choose(selector, value, { frame })` | Sets a native `<select>` and sends its `change` event. The OS popup of a select is not in the page, so it cannot be clicked. |
| `waitFor(code, label, timeoutMs)` | Runs the function body in the page until it returns a truthy value, and returns that value. |
| `text(selector, { frame })`, `count(selector, { frame })` | Read the visible text of one element, or count matches. |
| `ev(code)` | Runs an async function body in the page and returns its value. Use it to read state, not to set it. |
| `reload()` | Reloads the page and waits until the console is ready. |
| `shot(name)` | Writes a numbered PNG of the viewport to the evidence directory. |
| `check(label, ok, detail)` | Records one assertion and prints `ok` or `FAIL`. |

Pass `{ frame: '#gymFrame' }` to reach into an embedded app. The frames are `#gymFrame` (Agent Gym), `#speedrunFrame` (Speedrun) and `#rtFrame` (the Jev runtime demo, hidden until a tab opens it). Inside `ev` and `waitFor`, use `document.getElementById('gymFrame').contentDocument`.

Stable handles: sidebar entries are `aside .nav button[data-view="<view>"]`, the sidebar opens with `#navToggle`, a view is `section.view.active`, Runtime Observation tabs are `#rtTab-<tab>`, World Model tabs are `#wmtab-<tab>`, and Agent Gym elements carry `data-focus-key`, `data-tab`, `data-experiment` and `data-stage`. Prefer these over text and position.

`--width <px>` sets the viewport width (default 1440, height 1000). `--out <dir>` sets the evidence directory.

## Evidence

Each run writes to `.verify/<UTC date-time>-<journey>/` in the checkout, which git ignores:

- `report.json` holds the journey path, the commit, branch and dirty flag, every step with its time, every check with its detail, the page errors and the verdict.
- `NN-<name>.png` are the screenshots in the order they were taken. A step that throws adds `NN-failure.png`.

The run passes only when every check is `ok`, at least one check ran, no step threw and the page logged no error or exception. Font and favicon fetch failures are not counted.

Proof standards for this site:

- Drive the visitor's path. Use `click` and `choose` to change the page. Calling page functions or writing `localStorage` from `ev` to reach a state is not a proof of the path to that state.
- Capture the action and the resulting state. Take a screenshot after the click, and check the state the visitor reads, such as a status chip, a row count or the URL.
- Take each expected value from the requirement, the README or a data file, and say which in the journey's comment. Do not copy it from a first run.
- Check side effects. The site's only side effects are the URL and `localStorage` (`silex.gym.demo.v2`, `silex.nav.pinned`, and the Studio keys named in `js/STUDIO_BRIDGE_CONTRACT.md`). Each run starts with empty storage, so a journey that needs earlier state must create it through the page.
- A new journey must be able to fail. Break the behaviour it covers, run it, read the failing check, then restore the file. Quote that failing line in the report to the reviewer.

Quote the final `PASSED n/n checks` line and the evidence path when you report. Attach the screenshots a reviewer needs to a PR by hand; the evidence directory is not committed.

## Cleanup

The helper stops the server and the Chrome it started, and deletes that Chrome's temporary profile, when the journey ends, fails or is interrupted with Ctrl-C or SIGTERM. Nothing else needs tearing down. `kill -9` on the helper skips this and leaves a Chrome process and an `ontology-card-chrome-*` directory in the temp directory.

Never stop Chrome by name. The user's own browser and other agents' runs are also Chrome. `doctor` reports profile directories that were already in the temp directory. They may belong to a run in progress, so leave them unless you can tie them to a run you killed.

Cleanup never touches `.verify/`. Delete old evidence directories yourself when they are no longer needed.

## Helpers

- `skills/verify/scripts/drive.mjs` is the only helper. Its two commands are shown above. It reuses the repo's own CDP client (`tests/site/ontology-card/browser.mjs`), Chrome reaper (`tests/site/chrome-reaper.mjs`) and static server (`tools/gym-shot.mjs`).
- `node tools/site-shot.mjs <out-dir> [widths]` screenshots every view at several widths and fails on a page error or sideways scroll. Use it for layout changes that touch many views.
- `node tools/gym-shot.mjs '<gym route>' <WxH> <out.png>` screenshots one Agent Gym screen on its own page.

## Keeping this current

Run `/maintain-verification-skill` after views, embedded apps or their handles change. The feature map is only useful while its journeys pass on `main`.
