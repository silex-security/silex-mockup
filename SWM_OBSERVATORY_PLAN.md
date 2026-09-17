# Security World Model Observatory — 执行计划 (2026-09-17)

> **状态：已实现并验证（2026-09-17）。** 实际产出与本计划一致；差异见文末「实现说明」。

D3.js 重做 **Security World Model** 下的 *World Model Coverage* 与 *Security Ontology* 两个面板，
支持多层抽象（semantic zoom），视觉参考 Arize Phoenix（暗色画布 + 发光节点 + 下钻式 inspector）。

## 0. 已确认的决策

| 项 | 决定 |
|---|---|
| 视觉 | 暗色 observatory 画布嵌在现有浅色 app 中；inspector / KPI 保持浅色 |
| 数据 | D3FEND + MITRE ATLAS + ATT&CK Enterprise + UCO/OWASP 四源全要，构建期蒸馏 |
| 交付 | 本地验证截图 → 直接 commit + push 到 `main`，Vercel 自动部署 |
| 框架 | D3 v7，本地 vendor（离线可跑），无打包器、无 npm 运行时依赖 |

## 1. 数据源实测（2026-09-17 全部 HTTP 200）

| 源 | URL | 实测 | 用途 |
|---|---|---|---|
| D3FEND | `d3fend.mitre.org/ontologies/d3fend.json` | 4.6MB，`@graph` 7688 项，4465 具名 owl:Class，4462 带 subClassOf，497 带 d3fend-id | L1 本体骨架 + 真实继承树 |
| MITRE ATLAS | `raw.githubusercontent.com/mitre-atlas/atlas-navigator-data/main/dist/stix-atlas.json` | STIX JSON（免 YAML 解析） | L3 agentic 威胁叠加 |
| ATT&CK Enterprise | `raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json` | 53.8MB STIX | L1/L2 传统威胁锚点（只留 tactics + 代表性 techniques） |
| UCO | `raw.githubusercontent.com/ucoProject/UCO/master/ontology/uco/{core,action,identity,observable}.ttl` | TTL，正则抽 label/definition/subClassOf | L1 上层通用类 |
| OWASP LLM/Agentic Top 10 | 条目内置于构建脚本（公开清单，体量小） | — | 风险条目标签 |

原始数据**不进仓库**；构建脚本抓取后蒸馏为 `swm/data/*.json`（目标 < 400KB），产物提交，Vercel 零构建。

## 2. 目录结构

```
swm/
  README.md                 模块说明、如何重建数据
  css/swm.css               暗色画布 tokens、inspector、层级轨道
  js/swm-core.js            共享：level controller、tooltip、inspector、色标、数据加载
  js/swm-ontology.js        Ontology Explorer（力导向图 / 径向树 / 关系矩阵 三视图）
  js/swm-coverage.js        Coverage Observatory（zoomable sunburst + 上下文雷达 + gap 交叉筛选）
  data/ontology.json        构建产物
  data/coverage.json        构建产物
  data/SOURCES.md           来源、许可证、抓取时间、蒸馏规则
  tools/build-ontology.mjs  抓取 + 蒸馏 + 统计（node，无依赖）
  vendor/d3.v7.min.js       固化的 D3
```

## 3. 多层抽象模型（两个面板共用）

| 层 | 含义 | 数据来源 |
|---|---|---|
| **L1** General Agent Security Ontology | Identity / Agent / Tool / Action / Resource / Policy / Threat / Outcome 八大类及其子类 | UCO 上层类 + D3FEND DigitalArtifact 继承树 |
| **L2** Domain Ontology Packs | Finance / CX / Identity&IT / HR / Procurement 的实体、约束、禁止结果 | Silex 自有（映射到 L1） |
| **L3** Agentic-System Ontology | Planner / Memory / RAG / Tool / MCP / Sub-agent + 威胁叠加 | ATLAS techniques + OWASP LLM Top 10 |
| **L4** Runtime Knowledge Graph | 真实 agent、工具调用、策略决策、incident 实例 | Silex mock 实例（连回现有 demo 数据：WF-021、I-1042 等） |

交互：层级轨道（L1→L4）切换 = 整图形变过渡；点击节点 = 语义放大到其子节点；面包屑回退；
同一份数据三种渲染切换（力导向图 / 径向树 / 关系矩阵）。

## 4. 面板设计

### 4.1 World Model Coverage → "Coverage Observatory"
- **主视图**：zoomable sunburst，Enterprise → Domain → Capability → Workflow → Entity type，弧色 = 覆盖率顺序色标，点击下钻 + 面包屑。
- **上下文雷达**：D3 重写现有雷达，随下钻节点切换维度数值，带过渡动画——同一张雷达在不同抽象层读数不同，就是"多层抽象"的直观证明。
- **KPI 行**：加权覆盖率、已理解实体数、未观测盲区、上次校准时间。
- **Gap 交叉筛选**：点击弧 → 下方 gap 列表过滤到该子树；gap 条目可跳回现有 Workflow Library / Incident Queue（复用既有 `data-lib-*` 跳转）。

### 4.2 Security Ontology → "Ontology Explorer"
- **主视图**：力导向图，节点大小 = 实例数，颜色 = 八大类，边样式 = 关系类型（DELEGATES_AUTHORITY / CALLS / GOVERNS / ENABLES…）。
- **视图切换**：图 / 径向树（看继承层次）/ 关系矩阵（看关系密度）。
- **左侧**：层级轨道 L1-L4 + 搜索 + 分组过滤。
- **右侧 inspector**：定义、**真实出处**（D3FEND ID、ATLAS AML.Txxxx、ATT&CK Txxxx、UCO IRI、OWASP LLM0x）、覆盖率、关联 runtime 实例数、关系列表（可点击跳转）。
- **来源徽标**：节点带来源标记，让观众看到"这不是编的，是 MITRE/UCO 真数据"。

## 5. 分步执行

| # | 步骤 | 完成标准 |
|---|---|---|
| 1 | 脚手架：`swm/` 目录、vendor D3、`swm.css` 基础 tokens | 目录就位，D3 可从本地加载 |
| 2 | `tools/build-ontology.mjs`：抓四源 → 蒸馏 → 写 `data/ontology.json` + `data/coverage.json` + `SOURCES.md` | `node swm/tools/build-ontology.mjs` 跑通，产物 < 400KB，打印各源节点数 |
| 3 | `swm-core.js`：数据加载、level controller、色标、tooltip、inspector 骨架 | 控制台能取到解析后的图数据，无报错 |
| 4 | `swm-ontology.js`：三视图 + semantic zoom + 搜索 + inspector | 四层可切换、可下钻、可回退；点击节点 inspector 显示真实出处 |
| 5 | `swm-coverage.js`：sunburst + 上下文雷达 + KPI + gap 交叉筛选 | 下钻时雷达与 gap 列表同步变化 |
| 6 | 接入 `index.html`：替换 `#wm-overview` / `#wm-ontology` 内容，懒加载初始化，其余面板不动 | 切 tab 才初始化；其他页面零回归 |
| 7 | Chrome 实机验证：截图、console 无错、窄屏、重复切 tab 不重复渲染 | 截图交付，问题清零 |
| 8 | 文档：`swm/README.md`、更新根 `README.md` 与 `CHANGES.md` | 说明数据来源与重建方式 |
| 9 | commit + push main，验证线上 `silex-mockup.vercel.app` | 线上两个面板与本地一致 |

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| 抓取的本体节点过多导致图糊成一团 | 构建期按层裁剪 + 运行时每层限节点数，超出走"展开更多" |
| ATT&CK 53MB 拖慢构建 | 只在构建期抓，流式取需要的字段；产物不含原始 STIX |
| 暗色画布与浅色 app 割裂 | 画布做圆角卡片 + 内阴影过渡，inspector/KPI 留浅色，色板沿用现有 `--blue`/`--lav` 派生 |
| 单文件 index.html 体积膨胀 | 新代码全部外链到 `swm/`，index.html 仅增加挂载点与 script 标签 |
| 离线 demo（无网络）不可用 | D3 本地 vendor，数据 JSON 本地化；`file://` 下用 script 注入而非 fetch，保证双环境可跑 |

## 7. 实现说明（与计划的差异）

1. **八大本体分组不用颜色区分**，改用 D3 symbol 形状 + 图例 + rail 列表。原因：dataviz
   调色板校验器对「所有配对」场景（节点图属于此类）判定 8 色无法通过色觉障碍分离度下限，
   红橙一对连正常视觉下限都不到。颜色改为编码抽象层级（有序，单色阶）与覆盖率。
2. **力导向图的半径编码从「层级」改为「离分组锚点的深度」**。按层级映射会把 L1 的全部节点
   压进内圈四分之一，画布浪费且节点重叠。八个分组锚点固定在等分角度上，子树向外辐射。
3. **新增关系矩阵视图**（计划中列为可选），它在解释「谁对谁有什么类型的关系」时比图更快。
4. 数据蒸馏后为 591 节点 / 769 关系（计划目标 ~500），bundle 302KB，低于 400KB 上限。
