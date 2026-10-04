# Ontology value for runtime observability — experiment code

Plan and record: [`logs/2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md`](../../../logs/2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md).

| File | Owner | What |
|---|---|---|
| `snapshot.mjs` → `out/snapshot.json` | planner | F1: the pre-import ontology (`350362a`), layers 1–2, `{id,label,kind,layer,def}` nodes and `{s,t,pred}` links only |
| `manifest.mjs` → `out/tool-manifest.json` | planner | tool names, suite-qualified ids, impact, descriptions (AgentDojo docstrings from the pinned archive); no state text |
| `tool-map.mjs`, `export-context.mjs`, `e3/*.mjs`, `fixtures/synthetic/` | coder-deepseek (blind) | tool map, ontology context, E3 predictors and scorer |
| `firewall-check.mjs`, `b3-verify.mjs`, `fixtures/firewall/` | reviewer-codex | F3-art and F3-b3 |

Nothing here writes to `swm/data/`. Run order: `node snapshot.mjs && node manifest.mjs`, then the coder's scripts.
