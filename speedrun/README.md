# SILEX Speedrun in the demo

The Speedrun view of the demo (`index.html#view=speedrun`) shows the SILEX Speedrun app. This repo owns its source and edits it here. It was forked from [wangfe/silex-speedrun](https://github.com/wangfe/silex-speedrun) at the commit in `VENDORED.json`, and the upstream author syncs from this repo. All of its data is illustrative.

| Path | What it is |
|---|---|
| `app/` | The built app that the demo serves. Build output, never edited by hand. |
| `VENDORED.json` | The fork commit, and the sha256 of every source and built file. |
| `web/upstream/src/` | The app source (Next.js App Router). Edited here. |
| `web/` | The Vite shell that builds `app/` from it. |
| `../tools/build-speedrun.mjs` | Builds `app/` from `web/` and rewrites `VENDORED.json`. |
| `../js/speedrun-host.js` | Loads `app/` into the Speedrun view. |

## Change the app

Edit the source in `web/upstream/src/` or the shell in `web/`, then build.

```bash
node tools/build-speedrun.mjs
node --test tests/site/speedrun-*.test.mjs
node tests/site/run-site-probes.mjs --only S46
```

The tool runs `npm ci` and `npm run build` in `web/` and rewrites `VENDORED.json`. Running it twice on the same tree writes the same files. `speedrun-vendored.test.mjs` fails until `app/` is the build of the current `web/` sources. Commit the source, `app/` and `VENDORED.json` together. Do not edit `app/` by hand.

## How the shell works

The app is a Next.js App Router app. Its pages are async server components and its client components call a mock API. The demo is static files with no server, so the shell supplies the three things Next would.

- **Routing.** `web/src/routes.js` turns the `app/**/page.tsx` file paths into a route table. The route lives in the URL hash (`app/index.html#/speedrun/teams/refund?c=2`), so the build works under any path. `web/src/main.jsx` calls the matching page function with its `params` and `searchParams` and renders the element it returns, inside the upstream layouts.
- **Next imports.** `web/src/next/` holds stand-ins for `next/link`, `next/navigation` (`useRouter`, `redirect`, `notFound`) and `next/server`. `vite.config.js` aliases them.
- **Mock API.** A `fetch` wrapper sends `/api/...` calls to the upstream `route.ts` handlers in the page. Experiments and benchmark builds a visitor creates last until the page reloads.

Plain GET forms (the search boxes) navigate through the same router. A new page, layout or API route is picked up by the next build with no change in the shell, as long as it uses only those Next features. An import the shell has no stand-in for fails the build. File conventions the shell does not know (route groups, catch-all segments, `not-found.tsx`, `error.tsx`, `loading.tsx`) build but do not behave as in Next, so walk the new screens after adding one.

The upstream root layout is not used. `web/index.html` carries its theme script, and `web/src/main.jsx` imports its fonts, and `web/src/app.css` imports its `globals.css`.

## Links to a screen

`js/speedrun-host.js` mirrors the app's route in the demo URL as `#view=speedrun&path=<route>`, with the route URL-encoded. A reload or a shared link reopens that screen. Examples:

- `index.html#view=speedrun&path=%2Fspeedrun%2Fteams%2Frefund%2Ftrace` opens the Refund Team trace replay.

The overview is plain `#view=speedrun`. What a visitor created is not in the URL and still resets on reload.

## Links to Agent Gym

Agent Gym is the console's, not this app's. The app still carries its older `app/gym/**` pages, but the shell never renders them. `web/src/gym.js` and the stand-ins send every path under `/gym` to the console instead.

- `next/link` renders a link to `/gym` as `<a href="../../index.html#view=gym" target="_top">`.
- `useRouter().push('/gym/experiments/<id>')` (the *Send to Agent Gym* button) looks the experiment up in the mock API, builds the handoff id `<team>-<kind of change>` from its team and `<change>-v<id>` variant name, and sets the top window's hash to `#view=gym&path=%2Fhandoff%2Fspeedrun%2F<handoff id>`. An experiment it cannot map (a seeded one) opens `#view=gym`. The page is rebuilt afterwards, so the form is fresh when the visitor returns.
- A direct hash to `/gym…` (an old shared link) does the same from `resolve()` in `web/src/main.jsx`.
- The URL is relative to this page, so it also works when the app is opened on its own, where the top window is the app itself.

The handoff ids and the Gym experiment each one creates are in `agent-gym/js/fixtures/handoffs.js`. `tests/site/speedrun-gym-link.test.mjs` checks that every team and kind of change Speedrun can send has a template.

## Links to the Workflow Library

Each team has a required `workflow` field (`registered` with the Library id and name, or `unregistered` with a name). The team header shows it as a Governance link. An anchor with `data-host-hash="<hash>"` sets the hash of the page that embeds the app, and `app.css` hides such anchors when the app runs alone. `tests/site/library-speedrun-link.test.mjs` checks the field against `workflowData` in `index.html`.

## Theme

The app uses `?theme=dark|light` when the URL carries it, then the theme saved by its own header toggle, then the system setting. The demo passes `?theme=light` to match the console, and hides the app header, so the toggle exists only when the app runs alone.
