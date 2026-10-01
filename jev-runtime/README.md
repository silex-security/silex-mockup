# Jev runtime demo (vendored)

A byte-identical copy of the simulated Jev runtime demo from
[jev-realtime-observability](https://github.com/silex-ai-lab/jev-realtime-observability) (`web/demo/` plus the shared
`web/js/runs.js`, `web/js/verdict.js` and `web/css/runs.css`). The source commit and the sha256 of every file are in
[`VENDORED.json`](VENDORED.json).

- **Page:** `/jev-runtime/demo/index.html`, with `?domain=ap|soc`, `?embed=1` (inside a host iframe) and `?back=<relative url>`.
- **In the site:** System Validation → **Runtime · every agent action** embeds it and drives it (`js/jev-runtime-host.js`).
  Plan: [`../logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md`](../logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md).
- **Everything is simulated:** the judge, latencies and tenant. No model is called and nothing leaves the browser.
- **Do not edit these files here.** `tests/site/jev-runtime-vendored.test.mjs` fails on any local change. Change the demo
  upstream, then re-sync:

```bash
node tools/sync-jev-runtime.mjs ~/workplace/Silex/jev-realtime-observability <commit>
```

It supersedes the older AP-only [`../jev-observability/`](../jev-observability/README.md), which stays live unchanged.
