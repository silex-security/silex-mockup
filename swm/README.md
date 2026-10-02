# Security World Model — Observatory

D3-based replacement for the **World Model Coverage**, **Security Ontology** and
**Ontology Layers** panels under *Security World Model* in [`../index.html`](../index.html).
Three panels, one shared abstraction level (`SWM.level`, `SWM.setLevel`, `SWM.onLevel`):
**L1 general → L2 domain → L3 agentic-system → L4 runtime**.

Build history of the 2026-09-21 visual upgrade and Network view, and why it took the time it did (not the data): [`BUILD_HISTORY.md`](BUILD_HISTORY.md).

---

## 通俗说明:这三张图用了哪些真实数据(中文)

**一句话:** 图的**骨架和分类学(taxonomy)是从 5 个公开、真实的安全标准抓取蒸馏出来的**;而**具体到某家企业的业务实例和所有覆盖率百分比,是 Silex 自己编的示例(mock)**。真假在数据里是明确分开、可核对的。

### 真实数据 —— 来自 5 个公开安全本体/标准

| 来源 | 是什么 | 抓取节点 | 许可 | 在图里的作用 |
|---|---|---|---|---|
| **MITRE D3FEND** | 防御技术 / 数字工件(digital artifact)官方本体 | **213** | D3FEND Terms(免费,署名) | L1 **继承骨架** + policy/control 语义 |
| **MITRE ATLAS** | 专门针对 AI/ML 系统的攻击战术技术 | **96** | Apache-2.0 / ATLAS Terms | agentic 威胁语义,挂到它攻击的组件上 |
| **MITRE ATT&CK Enterprise** | 企业级攻击战术技术(14 tactics) | **61** | ATT&CK Terms(免费,署名) | L1 通用威胁语义 |
| **UCO(Unified Cyber Ontology)** | 网络安全的统一上层本体 | **72** | Apache-2.0 | L1 **顶层类**(Agent / Identity / Tool / Action…) |
| **OWASP GenAI** | LLM Top 10 (2025) + Agentic 威胁清单 T1–T15 | **25** | CC BY-SA 4.0 | 挂到对应的 agentic 组件上 |

这 5 个来源约 **467 个真实节点,全部保留原始官方 ID**,可去 MITRE / OWASP 官网逐一核对。整张图共 **755 nodes · 1378 typed relations**(SUBCLASS_OF 406 · GROUPED_UNDER 201 · ACHIEVES 126 · PART_OF_DOMAIN 107 · THREATENS 105 …),由 [`tools/build-ontology.mjs`](tools/build-ontology.mjs) 从上述 URL 实时抓取 + 蒸馏生成,画图用 D3.js(pinned 7.9.0,可离线)。

### 怎么拼成一个四层世界模型(L1→L2→L3→L4)

**L1 通用**(439)· **L2 行业包**(167)· **L3 agentic 系统**(125)· **L4 运行时实例**(24)。关键:四层是**展示分组,不是分类等级**——只有 `SUBCLASS_OF` 表示"是一种";领域归属用 `PART_OF_DOMAIN`,部署用 `DEPLOYED_IN`,八个 L1 分组只是导航(`GROUPED_UNDER`)。每个谓词都有类型签名(`tools/schema.mjs`),构建脚本在签名不符、展示树或 `SUBCLASS_OF` 图出现环、或节点挂到更低层时**直接失败,不写 bundle**。

### ⚠️ 哪些是真的、哪些是示例(与下面 "What is real and what is mock" 一致)

每个节点和每条关系都带 `review` 评审等级,inspector 里可见:

- **published**:上面 5 个公开标准的节点、官方 ID、以及类之间的继承结构。
- **curated**(Silex 自编的语义断言):L1 核心概念、L2 domain pack 的实体/动作/hazard/禁止结果、L3 组件和记录 schema、威胁→缓解措施映射、OWASP→组件映射。CRM 和 Legal 是**候选**领域包,只在本体里,不进 coverage。
- **heuristic**(关键词推断):ATLAS 技术打到哪个 L3 组件。
- **illustrative**(示例 mock):注册工作流、**整个 L4 运行时图**及由它推出的部署/实例关系、**所有 coverage 百分比**。

> **"某领域有哪些概念、怎么继承" 是真的公开标准;"某公司覆盖了 82%、还有 8 个盲点" 是编的示例占位。** 这正好对上 positioning 的 evidence-grade 原则:真的标 real,示例的标 illustrative,不混。

### 每张图具体吃哪块数据

- **Ontology Layers**(L1→L2→L3→L4 带状 + ribbon)→ `ontology.json` 的 `chain`(每层计数、相邻层之间的 typed relations,以及跨层跳过的 `skips`)。
- **Security Ontology**(graph / hierarchy / relation matrix)→ `ontology.json` 的 **755 nodes · 1378 typed relations**,每个节点/关系按 review 等级标注。
- **World Model Coverage**(可缩放 sunburst + 雷达)→ `coverage.json`(coverage tree / gaps / KPIs)。其中 **weighted coverage 82% · 29.4K entities · 8 blind spots · sim-vs-observed 94%** 等数字**均为 illustrative,非实测**。

完整来源与许可见 [`data/SOURCES.md`](data/SOURCES.md)。

---

## Tiers are presentation groups; only SUBCLASS_OF is subsumption

L1 → L2 → L3 → L4 group the model for reading; they are not taxonomic ranks. Every node names one
display `parent` (with its `parentPred`) for the Hierarchy view, but only `SUBCLASS_OF` says that
one concept is a kind of another. A domain pack is an L2 root, and its entities, actions, hazards and
prohibited outcomes are `PART_OF_DOMAIN` it and `SUBCLASS_OF` an L1 core class. An agentic component
is `SUBCLASS_OF` an L1 core class and `DEPLOYED_IN` the domains where the illustrative runtime graph
has an instance of it. A published ATLAS technique hangs under its ATLAS tactic and `THREATENS` its
component as a heuristic edge. `swm/tools/schema.mjs` gives every predicate its allowed node-kind
pairs and review grades; `build-ontology.mjs` refuses to write a bundle that breaks one, that has a
cycle in the display tree or the `SUBCLASS_OF` graph, or that hangs a node under a lower tier. The
Ontology Layers panel draws `ontology.chain`: band counts, ribbons between adjacent tiers, and a
caption for the relations that skip a tier.

```
swm/
  css/swm.css              dark observatory canvas + light inspector chrome
  js/swm-core.js           colour scales, glyphs, tooltip, provenance chips, panel registry
  js/swm-loader.js         lazy-loads d3 + bundles the first time a panel is opened
  js/swm-ontology.js       Ontology Explorer  (graph / hierarchy / relation matrix)
  js/swm-coverage.js       Coverage Observatory (zoomable sunburst + contextual radar)
  js/swm-layers.js         Ontology Layers     (the four tiers, bands + ribbons)
  data/ontology.json|.js   generated graph: 755 nodes · 1378 typed relations, schema, chain summary
  data/coverage.json|.js   generated coverage tree, gaps and KPIs
  data/SOURCES.md          where every public node came from, and its licence
  tools/build-ontology.mjs fetch + distil + contract-check pipeline (node, no dependencies)
  tools/schema.mjs         the contract: kinds, predicate signatures, review grades
  tools/silex-seed.mjs     Silex's own L2/L3/L4 mock content
  skills/                  agent skills + scripts for rebuilding on another host
  vendor/d3.v7.min.js      pinned D3 7.9.0, so the demo also runs offline
```

## Rebuilding the data

```bash
node swm/tools/build-ontology.mjs            # fetch, distil, write data/
node swm/tools/build-ontology.mjs --offline  # rebuild from swm/.cache only
```

Raw downloads (~60MB, mostly ATT&CK) land in `swm/.cache/`, which is git-ignored.
Only the distilled bundles are committed, so Vercel needs no build step.

### On a host that has never run this

The full procedure — prerequisites, what a healthy run looks like, and what to do when an upstream
moves — is packaged as two agent skills under [`skills/`](skills/README.md), which also read as plain
runbooks. Link them once per host (see that README) or just follow them.

```bash
./swm/skills/swm-data-rebuild/scripts/check-sources.sh         # 1. are the nine upstreams reachable?
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs  # 2. is the simulated seed consistent?
node swm/tools/build-ontology.mjs                              # 3. build
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs     # 4. verify what the page will get
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs    # 5. headless screenshots of all three panels
```

Requirements: node ≥ 18 (global `fetch`; node ≥ 22 only for the screenshot step), ~70MB of disk for
the cache, outbound HTTPS to `d3fend.mitre.org` and `raw.githubusercontent.com`, and a Chrome or
Chromium binary if you want step 5. No npm install, ever — there is no `package.json` by design.

Each script exits non-zero on failure, so the five lines above work as a CI job. Never hand-edit a
bundle: `verify-bundle.mjs` checks that `ontology.js` and `ontology.json` still agree.

### Changing the simulated content

The invented half of the bundle — domain packs, capabilities, workflows, agentic components, the
whole runtime graph, every percentage and every gap — lives in `tools/silex-seed.mjs`. Adding a
domain, wiring new runtime behaviour, retelling the coverage story or re-skinning the demo for another
industry is covered by [`skills/swm-simulation-data`](skills/swm-simulation-data/SKILL.md), with a
field-by-field schema in its `references/seed-schema.md` and a worked "add a Legal domain" example in
`references/worked-example.md`. Validate before building:

```bash
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs [path/to/candidate-seed.mjs]
```

## What is real and what is mock

| Layer | Content | Source |
|---|---|---|
| L1 | Upper classes, digital-artifact tree, defensive techniques, enterprise tactics | UCO, MITRE D3FEND, MITRE ATT&CK — real identifiers, real definitions |
| L3 threats | AI/agent attack techniques and risk catalogues | MITRE ATLAS, OWASP LLM Top 10 (2025), OWASP Agentic AI T1–T15 |
| L1 core / L2 / L3 components | Core concepts, domain packs (CRM and Legal as candidates), actions, hazards, prohibited outcomes, components, record schemas | **Silex-authored**, graded `curated` in the inspector |
| Workflows / L4 / every percentage | Registered workflows, the runtime graph and what is derived from it | **Silex mock content**, graded `illustrative` |

The threat → component edges (heuristic for ATLAS, curated for OWASP) and countermeasure → threat
edges (curated) are Silex-authored mappings over public data, and their review grades say so. See [`data/SOURCES.md`](data/SOURCES.md).

## Encoding decisions

The panels sit on a **white canvas**, and every ramp was re-validated with the dataviz palette
validator against `#ffffff`:

- **Abstraction layer** is ordinal, so it gets a single-hue violet ramp
  (`#b8a3ee → #50339c`, light end 2.21:1 on white) — passes monotone lightness, step gaps and
  surface contrast. Violet is the section's primary colour: the ontology graph, the hierarchy, the
  layer bands and the ribbons are all drawn from it.
- **Coverage** gets a plum ramp (`#dfa0d5 → #54254f`, light end 2.07:1), same checks. Layer and
  coverage are two sequential encodings the Explorer switches between, so they stay in the purple
  family but a hue apart — otherwise flipping "colour by" would repaint the graph in the same
  colours. Every step of both ramps leaves a text colour with at least 4.8:1 against it, which the
  earlier teal ramp's middle steps did not.
- **Text on a filled mark** is never guessed: `SWM.textOn()` returns whichever of white and ink has
  the higher measured contrast against that exact fill, and `SWM.haloOn()` adds a thin
  opposite-colour halo so a label survives landing on a boundary. Marks are drawn fully opaque so
  the measured colour is the colour on screen.
- **A CSS rule beats an SVG `fill` attribute**, so the stage's fallback text colour is scoped
  `text:not([fill])`. Without that, every contrast-picked label was silently repainted grey — which
  is exactly how the labels became unreadable in the first place.
- **Status never tints body text.** `SWM.statusHtml()` renders a tinted icon beside a word on the
  normal ink token, which is what the reserved palette's sub-3:1 steps require.
- **Ontology group is carried by glyph shape, not colour.** Eight simultaneous hues cannot
  clear the all-pairs CVD floor in a node-link view, so the eight groups use eight D3
  symbols, listed with their shapes in the rail and in the legend.
- Status (critical / serious / warning / healthy) is a reserved palette and always ships
  with an icon and a word, never colour alone.

## Extending it

- New domain, capability, workflow, agentic component, runtime node or gap → edit
  `tools/silex-seed.mjs` and rebuild.
- New public source → add a fetcher + parser in `tools/build-ontology.mjs`, give its nodes
  a `src` entry, and record it in `SOURCES.md`.
- The two panels are registered by id (`wm-overview`, `wm-ontology`) through
  `SWM.register()`; a third panel only needs a mount point and one more `register` call.
