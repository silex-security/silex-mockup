# Enterprise World Model — Observatory

The D3 panels behind the **Enterprise World Model** view of [`../index.html`](../index.html)
(formerly *Security World Model*, hence the `swm` prefix). The view has five sub-tabs; this module
draws three of them:

| Sub-tab (in page order) | Panel id | Drawn by |
|---|---|---|
| **Ontology Layers** (default) | `wm-architecture` | `js/swm-layers.js` |
| **Ontology Graph** (Network / Graph / Hierarchy / Relations views; opens on Network) | `wm-ontology` | `js/swm-ontology.js`, with `js/swm-vowl.js` + `js/swm-vowl-ui.js` for Network |
| **World Model Coverage** | `wm-overview` | `js/swm-coverage.js` |
| Domain Suites | `wm-landscape` | static markup and inline script in `index.html`, not this module |
| Coverage Gaps | `wm-gaps` | static markup in `index.html`, not this module |

The view shell (header, sub-tab bar, panel containers), sub-tab switching, the
`#view=security-model&tab=…&node=…` deep links and the tab-bar styles also live in `index.html`.
The three D3 panels share one abstraction level (`SWM.level`, `SWM.setLevel`, `SWM.onLevel`):
**L1 general → L2 domain → L3 agentic-system → L4 runtime**.

Build history of the 2026-09-21 visual upgrade and Network view, and why it took the time it did (not the data): [`BUILD_HISTORY.md`](BUILD_HISTORY.md).

---

## 通俗说明:这三张图用了哪些真实数据(中文)

**一句话:** 图的**骨架和分类学(taxonomy)是从 5 个公开、真实的安全标准抓取蒸馏出来的**;而**具体到某家企业的业务实例和所有覆盖率百分比,是 Silex 自己编的示例(mock)**。真假在数据里是明确分开、可核对的。

### 真实数据 —— 来自 5 个公开安全本体/标准

| 来源 | 是什么 | 抓取节点 | 许可 | 在图里的作用 |
|---|---|---|---|---|
| **MITRE D3FEND** | 防御技术 / 数字工件(digital artifact)官方本体 | **213** | D3FEND Terms(免费,署名) | L1 **继承骨架** + policy/control 语义 |
| **MITRE ATLAS** | 专门针对 AI/ML 系统的攻击战术技术 | **131** | Apache-2.0 / ATLAS Terms | agentic 威胁语义,挂到它攻击的组件上;含 35 条官方缓解措施(mitigation)及其 `COUNTERS` 关系 |
| **MITRE ATT&CK Enterprise** | 企业级攻击战术技术(15 tactics) | **101** | ATT&CK Terms(免费,署名) | L1 通用威胁语义;为 Identity & IT 包补 7 个身份类技术,含 33 条官方缓解措施 |
| **UCO(Unified Cyber Ontology)** | 网络安全的统一上层本体 | **72** | Apache-2.0 | L1 **顶层类**(Agent / Identity / Tool / Action…) |
| **OWASP GenAI** | LLM Top 10 (2025) + Agentic 威胁清单 T1–T15 | **25** | CC BY-SA 4.0 | 挂到对应的 agentic 组件上 |

这 5 个来源共 **542 个真实节点,全部保留原始官方 ID**,可去 MITRE / OWASP 官网逐一核对。2026-10-03 起,Finance、Customer Service、Identity & IT 三个行业包另外接入了领域标准和 benchmark(见下节)。整张图共 **2106 nodes · 9299 typed relations**(SUBCLASS_OF 442 · GROUPED_UNDER 370 · ACHIEVES 133 · PART_OF_DOMAIN 141 · THREATENS 105 · COUNTERS 343 · DEMONSTRATES 278 …),由 [`tools/build-ontology.mjs`](tools/build-ontology.mjs) 从钉死版本的 URL 抓取 + 蒸馏生成(每个输入的 commit 和 sha256 记录在 [`tools/sources/MANIFEST.json`](tools/sources/MANIFEST.json),字节不符即拒绝构建),画图用 D3.js(pinned 7.9.0,可离线)。

### 领域接地(2026-10-03)

[计划](../logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md)。三个行业包的实体、动作和危害现在能指向公开来源:

- **领域标准**:Finance **对齐到** FIBO 和 Common Data Model,Customer Service 对齐到 Common Data Model,Identity & IT 对齐到 OCSF 1.9.0。对齐用 `CLOSE_MATCH`(含义相近,不声称子类)。找不到等义公开类的实体(如 *Customer*、*Refund*、*Role*)列为未匹配并写明原因。
- **Benchmark**:21 个危害引用 AgentDojo 注入任务、τ²-bench 政策条款与文档、Agent Security Bench 场景或 ToolEmu 案例。每条引用标 **derived**(来源直接描述该有害行为)或 **related**(只是相邻规则,机制由 Silex 建模)。Benchmark 是研究环境,不是企业实测行为。
- **公开案例**:ATLAS 57 个案例(17 个真实事件、40 个演练)和 2 个 ATT&CK campaign 作为 L3 `case` 节点。危害只在经评审、写明理由的配对上 `EXEMPLIFIED_BY` 案例(4 对)。案例发生在别处,不进 L4,不计入覆盖率。
- **缓解措施**:ATLAS 与 ATT&CK 官方缓解措施使 L3 威胁中有映射的从 45 个增至 73 个(共 105)。NIST SP 800-53 控制项是人工映射,不代表合规声明。

许可证与署名见 [`data/NOTICES.md`](data/NOTICES.md)。

### L4 公开 benchmark 运行(2026-10-03)

[计划](../logs/2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md)。L4 新增 946 次公开运行、135 个事故、3 个模型、60 个工具,在 Ontology Graph 里用"Public benchmark runs"开关显示(默认关)。Finance、IT 来自 AgentDojo(Llama-3.3-70B 与加了防御的 Meta-SecAlign-70B),Customer Service 来自 τ²-bench 零售(Claude 3.7 Sonnet)。评测器判"得手"不等于出现危害:只有通过审定的轨迹规则才连到 L2 危害(119 个),其余 17 个写明原因。benchmark 节点不进部署关系、覆盖率和 KPI。

### 怎么拼成一个四层世界模型(L1→L2→L3→L4)

**L1 通用**(547)· **L2 行业包**(204)· **L3 agentic 系统**(187)· **L4 运行时实例**(24)。L4 另含公开 benchmark 运行,合计 24 illustrative + 1144 benchmark 个节点(默认隐藏,见下)。关键:四层是**展示分组,不是分类等级**——只有 `SUBCLASS_OF` 表示"是一种";领域归属用 `PART_OF_DOMAIN`,部署用 `DEPLOYED_IN`,八个 L1 分组只是导航(`GROUPED_UNDER`)。每个谓词都有类型签名(`tools/schema.mjs`),构建脚本在签名不符、展示树或 `SUBCLASS_OF` 图出现环、或节点挂到更低层时**直接失败,不写 bundle**。

### ⚠️ 哪些是真的、哪些是示例(与下面 "What is real and what is mock" 一致)

每个节点和每条关系都带 `review` 评审等级,inspector 里可见:

- **published**:上面 5 个公开标准的节点、官方 ID、以及类之间的继承结构。
- **curated**(Silex 自编的语义断言):L1 核心概念、L2 domain pack 的实体/动作/hazard/禁止结果、L3 组件和记录 schema、威胁→缓解措施映射、OWASP→组件映射。CRM 和 Legal 是**候选**领域包,只在本体里,不进 coverage。
- **heuristic**(关键词推断):ATLAS 技术打到哪个 L3 组件。
- **illustrative**(示例 mock):注册工作流、**整个 L4 运行时图**及由它推出的部署/实例关系、**所有 coverage 百分比**。

> **公开标准里的概念和它们之间的继承是真的(published);Silex 自编的核心概念、领域包及其继承是 curated 断言,不是公开标准;"某公司覆盖了 82%、还有 8 个盲点" 是编的示例占位(illustrative)。** 这正好对上 positioning 的 evidence-grade 原则:按等级标注,不混。`coverage.json` 里新增的 `ontologyCompleteness` 是结构完整度(包含标为 candidate 的 CRM、Legal 两行),不是观测覆盖率。

### 每张图具体吃哪块数据

- **Ontology Layers**(L1→L2→L3→L4 带状 + ribbon)→ `ontology.json` 的 `chain`(每层计数、相邻层之间的 typed relations,以及跨层跳过的 `skips`)。
- **Ontology Graph**(Network / Graph / Hierarchy / Relations 四种视图)→ `ontology.json` 的 **2106 nodes · 9299 typed relations**,每个节点/关系按 review 等级标注。
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
  css/swm.css              dark chart stages + white inspector "paper"
  css/swm-vowl.css         Network view styles
  js/swm-core.js           colour scales, glyphs, tooltip, provenance chips, panel registry
  js/swm-loader.js         lazy-loads d3 + bundles + panel scripts the first time a panel is opened
  js/swm-ontology.js       Ontology Graph      (network / graph / hierarchy / relation matrix)
  js/swm-vowl.js           Network view engine (VOWL notation, WebVOWL-style interaction) ┐ loaded by index.html
  js/swm-vowl-ui.js        Network view controls                                          ┘ (defer), not the loader
  js/swm-coverage.js       Coverage Observatory (zoomable sunburst + contextual radar)
  js/swm-layers.js         Ontology Layers     (the four tiers, bands + ribbons)
  data/ontology.json|.js   generated graph: 2106 nodes · 9299 typed relations, schema, chain summary
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

Three more checks from the 2026-10-02 ontology-rigor run
([plan](../logs/2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md)):

```bash
node swm/skills/swm-data-rebuild/scripts/competency.mjs   # six competency questions answered from the bundle
node swm/skills/swm-data-rebuild/scripts/check-copy.mjs   # every count printed in the docs matches the bundle
node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs    # browser interaction probes (node >= 22, Chrome)
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

Since the 2026-09-21 visual upgrade, charts draw on a **dark stage** (`#10162b → #26305a`) and
inspectors stay on white **paper**. Each ordinal ramp therefore has two variants, defined in
`js/swm-core.js` and copied as CSS tokens in `css/swm.css` (keep the two in step); the contrast
figures in the `swm-core.js` comments are measured against `#26305a` or `#ffffff`.

| Encoding | On the stage | On paper |
|---|---|---|
| Abstraction layer (ordinal, violet, L1 brightest) | `#ece5ff → #9b82ef` | `#50339c → #8e70d9` |
| Coverage (ordinal, plum/pink, 40–100 %) | `#e0569f → #f8e2ef` | `#b0529c → #471d43` |
| Status (reserved) | `#0ca30c / #fab219 / #ec835a / #d03b3b` | same |

- **Layer and coverage stay a hue apart.** They are two sequential encodings behind the same
  "colour by" switch; sharing one hue would make both modes repaint the graph identically.
- **Text on a filled mark** is never guessed: `SWM.textOn()` returns whichever of white and ink has
  the higher measured contrast against that exact fill, and `SWM.haloOn()` adds a thin
  opposite-colour halo so a label survives landing on a boundary. Marks are drawn fully opaque so
  the measured colour is the colour on screen.
- **A CSS rule beats an SVG `fill` attribute**, so the stage's fallback text colour is scoped
  `text:not([fill])`. Without that, every contrast-picked label was silently repainted.
- **Status never tints body text.** `SWM.statusHtml()` renders a tinted icon beside a word on the
  normal ink token, and status always ships with an icon and a word, never colour alone.
- **Ontology group is carried by glyph shape, not colour.** Eight simultaneous hues cannot
  clear the all-pairs CVD floor in a node-link view, so the eight groups use eight D3
  symbols, listed with their shapes in the rail and in the legend.

## Extending it

- New domain, capability, workflow, agentic component, runtime node or gap → edit
  `tools/silex-seed.mjs` and rebuild.
- New public source → add a fetcher + parser in `tools/build-ontology.mjs`, give its nodes
  a `src` entry, and record it in `SOURCES.md`.
- The three panels are registered by id (`wm-architecture`, `wm-ontology`, `wm-overview`) through
  `SWM.register()`; another panel needs a mount point and sub-tab in `index.html`, one more
  `register` call, and its script and mount id added to `FILES` and `PANELS` in `js/swm-loader.js`.
