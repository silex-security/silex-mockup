# SILEX Speedrun in the demo

The Speedrun view of the demo (`index.html#view=speedrun`) shows the SILEX Speedrun app from [wangfe/silex-speedrun](https://github.com/wangfe/silex-speedrun), a private repo. All of its data is illustrative.

| Path | What it is |
|---|---|
| `app/` | The built app that the demo serves. Build output, never edited by hand. |
| `VENDORED.json` | The upstream commit that `app/` was built from, and the sha256 of every built file. |
| `web/` | The Vite shell that builds `app/`. |
| `../tools/sync-speedrun.mjs` | Builds `app/` from one upstream commit. |
| `../js/speedrun-host.js` | Loads `app/` into the Speedrun view. |

## Update to a newer upstream commit

You need a checkout of the upstream repo.

```bash
node tools/sync-speedrun.mjs <path to silex-speedrun checkout> <commit>
node --test tests/site/speedrun-*.test.mjs
node tests/site/run-site-probes.mjs --only S46
```

The tool reads `src/` with `git archive <commit>`, so uncommitted changes in the checkout are not picked up. It writes the source to `web/.upstream/` (git-ignored), runs the build, and rewrites `VENDORED.json`. A change to `web/` also needs a sync, and `speedrun-vendored.test.mjs` fails until it is done. Commit `app/` and `VENDORED.json` together.

To change what the app shows, change it upstream and sync. Do not edit `app/`.

## How the shell works

Upstream is a Next.js App Router app. Its pages are async server components and its client components call a mock API. The demo is static files with no server, so the shell supplies the three things Next would.

- **Routing.** `web/src/routes.js` turns the `app/**/page.tsx` file paths into a route table. The route lives in the URL hash (`app/index.html#/speedrun/teams/refund?c=2`), so the build works under any path. `web/src/main.jsx` calls the matching page function with its `params` and `searchParams` and renders the element it returns, inside the upstream layouts.
- **Next imports.** `web/src/next/` holds stand-ins for `next/link`, `next/navigation` (`useRouter`, `redirect`, `notFound`) and `next/server`. `vite.config.js` aliases them.
- **Mock API.** A `fetch` wrapper sends `/api/...` calls to the upstream `route.ts` handlers in the page. Experiments and benchmark builds a visitor creates last until the page reloads. The app's route is not mirrored in the demo's URL, so a reload returns to the overview.

Plain GET forms (the search boxes) navigate through the same router. A new upstream page, layout or API route is picked up by the next sync with no change here, as long as it uses only those Next features. An import the shell has no stand-in for fails the build. File conventions the shell does not know (route groups, catch-all segments, `not-found.tsx`, `error.tsx`, `loading.tsx`) build but do not behave as in Next, so check the upstream diff for them and walk the new screens after a sync.

The upstream root layout is not used. `web/index.html` carries its theme script, and `web/src/main.jsx` imports its fonts, and `web/src/app.css` imports its `globals.css`.

## Theme

The app follows the theme saved by its own header toggle. With nothing saved it uses `?theme=dark|light`, then the system setting. The demo passes `?theme=dark`.
