# Jev runtime demo

The simulated Jev runtime demo. This copy is the canonical source and is edited here. It was forked on 2026-11-10 from
[jev-runtime-observability](https://github.com/silex-ai-lab/jev-runtime-observability) (`web/demo/` plus the shared
`web/js/runs.js`, `web/js/verdict.js` and `web/css/runs.css`) at the commit in [`VENDORED.json`](VENDORED.json).
Its styles are dark, like the console.

- **Page:** `/jev-runtime/demo/index.html`, with `?domain=ap|soc`, `?embed=1` (inside a host iframe) and `?back=<relative url>`.
- **In the site:** the **Runtime Observation** view (left nav, Environment) embeds it and drives it (`js/jev-runtime-host.js`).
  Plans: [`../logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md`](../logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md) (built), then [`../logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md`](../logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md) (moved to its own view).
- **Guide:** every page explained in plain language (Chinese), with screenshots: [`../docs/jev-runtime-guide/`](../docs/jev-runtime-guide/README.md).
- **Everything is simulated:** the judge, latencies and tenant. No model is called and nothing leaves the browser.

It supersedes the older AP-only [`../jev-observability/`](../jev-observability/README.md), which stays live unchanged.
