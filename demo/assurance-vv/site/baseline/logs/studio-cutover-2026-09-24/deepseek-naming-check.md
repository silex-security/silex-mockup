# Cutover impact: EWM / Ontology Graph rename on blueprint_studio/

Rename in origin/main (4 commits: 39fbe01, 073e073, 6c5f39b, b5127c6):
- Security World Model → Enterprise World Model
- Security Ontology (tab / L1 layer / coverage card) → Ontology Graph
- "General Agent Security Ontology" (L1 layer name) → "General Agent Ontology Graph"

## (a) Does the slice / `--check` still pass against origin/main's ontology.json? — YES

`blueprint_studio/tools/ontology-slice.mjs` (`buildSlice`) reads only:
- `ontology.nodes` filtered to `layer===3 && kind==='component'` (the 13 `ag:*` L3 classes), plus threat nodes by id;
- `ontology.links` filtered to `pred==='THREATENS'`;
- `ontology.version` and `ontology.generated`.

The origin/main change to `swm/data/ontology.json` is **only** the L1 layer's `name` field ("General Agent Security Ontology" → "General Agent Ontology Graph") inside the `layers` and `chain` arrays — none of which the slice reads. The `nodes` (598) and `links` (800) arrays are byte-identical.

Verified by extracting `origin/main:swm/data/ontology.json` and comparing: `buildSlice(origin/main ontology)` is **byte-identical** to the committed `blueprint_studio/ontology/slice.json` (13 classes, 105 threats, 105 links). `node tools/ontology-slice.mjs --check` therefore keeps passing. No change needed.

## (b) Strings that must change

The mockup site (origin/main `index.html`) is English-only; it carries **no Chinese** for the new names. Proposed Chinese below is DeepSeek's own, kept consistent with the existing `zh.js` vocabulary (企业 = enterprise, 世界模型 = world model, 本体 = ontology, 图 = graph).

| file:line | current | → proposed |
|---|---|---|
| `web/src/trace/Spine.jsx:1` (comment) | `the Security World Model's named layers` | `the Enterprise World Model's named layers` |
| `web/src/trace/Spine.jsx:28` | `t('trace.spine', 'Security World Model layers')` | `t('trace.spine', 'Enterprise World Model layers')` |
| `web/src/trace/Spine.jsx:29` | `t('trace.spine', 'Security World Model layers')` | `t('trace.spine', 'Enterprise World Model layers')` |
| `web/src/i18n/zh.js:745` | `'trace.spine': '安全世界模型各层'` | `'trace.spine': '企业世界模型各层'` |
| `README.md:76` | `onto the Security World Model's named layers and the Security Ontology` | `onto the Enterprise World Model's named layers and the Ontology Graph` |

Notes on scope:
- **"Security Ontology" (→ "Ontology Graph") appears only once**, in `README.md:76`. There is **no** "安全本体" anywhere in `zh.js`.
- The many generic "ontology" strings (`ontology class`, `ontology bundle`, `ontology version`, "As of ontology …"; 本体类 / 本体包 / 本体版本) refer to the concept, not the renamed proper name, and correctly stay as-is — matching origin/main's own unchanged phrasing ("a self-evolving L1–L4 ontology over a runtime knowledge graph").
- `web/src/trace/CONTRACT.md` and the templates use "ontology" generically and "world model" generically; no change needed.
- `logs/2026-09-24_DECISION_TRACE_PROPOSAL.md` is historical and per the task is excluded.

## (c) Would a rebase/merge conflict? — NO

The two branches touch fully disjoint file sets:

- blueprint-studio changed: `blueprint_studio/**` and `logs/2026-09-*.md`.
- origin/main changed: `swm/**`, root `index.html`, `assurance.html`, `SECURITY_WORLD_MODEL.md`.

No file is modified by both (note `blueprint_studio/index.html` ≠ root `index.html`, and blueprint-studio only *reads* `swm/data/ontology.json` via the slice tool, never writes it). Verified two ways, without touching the real branch:

1. `git merge-tree --write-tree blueprint-studio origin/main` → clean (single tree OID, exit 0).
2. A temp worktree at `blueprint-studio`, `git rebase origin/main` → "Successfully rebased and updated detached HEAD" (32/32 commits, zero conflicts).

After such a rebase, `node tools/ontology-slice.mjs --check` still passes, because the rebased `swm/data/ontology.json` differs from the branch's only in the L1 layer name that the slice ignores.
