# Baseline, 2026-11-10

Taken at main `df13449` plus the Blueprint Studio deep-link fix, before any visual change.

- `baseline-1440/`: `node tools/site-shot.mjs <dir>`, the 1440px set. The 1280px set was also clean (no page error, no sideways scroll) and is not stored.
- Counts below: `node tools/style-audit.mjs`.

| stylesheet | colors | fontSizes | under12px | radii | shadows | inlineStyleAttrs |
| --- | --- | --- | --- | --- | --- | --- |
| index.html <style> | 118 | 25 | 202 | 22 | 19 | 108 |
| css/rt-fleet-grid.css | 0 | 7 | 8 | 3 | 2 |  |
| css/rt-fleet-map.css | 0 | 4 | 1 | 5 | 0 |  |
| css/rt-fleet-x1.css | 0 | 7 | 7 | 4 | 3 |  |
| css/rt-learning-visual.css | 0 | 6 | 1 | 3 | 1 |  |
| css/rt-onto-fleet.css | 7 | 8 | 5 | 5 | 0 |  |
| css/rt-onto-graph.css | 0 | 9 | 8 | 3 | 1 |  |
| css/rt-onto-run.css | 0 | 3 | 4 | 1 | 2 |  |
| css/rt-onto-vision.css | 10 | 7 | 1 | 5 | 2 |  |
| css/rt-onto-visual.css | 0 | 4 | 2 | 1 | 0 |  |
| css/rt-pipeline.css | 1 | 7 | 12 | 7 | 0 |  |
| css/rt-subnav.css | 1 | 4 | 2 | 2 | 1 |  |
| css/rt-subtabs.css | 12 | 14 | 10 | 7 | 2 |  |
| swm/css/swm-vowl.css | 6 | 1 | 1 | 0 | 0 |  |
| swm/css/swm.css | 67 | 14 | 56 | 13 | 5 |  |
| agent-gym/css/environment.css | 1 | 10 | 5 | 5 | 5 |  |
| agent-gym/css/queue.css | 0 | 5 | 1 | 1 | 0 |  |
| agent-gym/css/run-results.css | 0 | 8 | 10 | 8 | 3 |  |
| agent-gym/css/scenario.css | 0 | 9 | 4 | 7 | 4 |  |
| agent-gym/css/shell.css | 1 | 11 | 2 | 10 | 7 |  |
| agent-gym/css/tokens.css | 28 | 0 | 0 | 0 | 0 |  |
| agent-gym/css/workbench.css | 0 | 14 | 3 | 5 | 5 |  |
