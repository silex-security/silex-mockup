# Agent fleet 子页签：可视化与动画改版（fleet 计划）

版本 **v0.3**，供第 3 轮计划评审使用。日期 2026-10-10。

## 需求

用户（2026-10-10）原话：“Agent fleet page 有很多文字，帮忙生成一些图片或者 demo 动画帮助理解整个流程，适当减少大段文字，文字解释可以放到悬浮框补充背景。”

**目标读者与 10 秒理解目标。** 读者是 Head of AI 或投资人。看一眼就应该明白四件事：

1. 平台上有很多 agent，分属不同团队；
2. 每个 agent 自己的那一步看起来都没问题；
3. ontology 补上的是 agent 之间的事实；
4. 补上之后，问题在源头就被拦下，并交给对的团队处理。

页面以图为主线讲清这四点。大段文字移进 ⓘ 悬浮框（复用 `js/rt-tip.js`）。

## 运行信息

- **人员配置**（用户 2026-10-10 指定）：
  - planner：Claude Code `claude-opus-5-5`（本会话）；
  - 编码：
    - `coder-opus`：Claude Opus 5.5，effort medium；
    - `coder-sol`：Codex `gpt-6.1-sol`，reasoning effort medium；
    - `coder-mimo`：OpenCode `opencode/mimo-v2.6-flash-free`；
  - 评审：`reviewer-codex`（GPT-6.1-Sol high）和 `reviewer-claude`（Claude Opus 5.5 high）。

  计划关卡和代码关卡都需要两位评审 + planner 全票通过。编码席位只实现，不投票。DeepSeek 不在本次配置中。
- **MiMo 的数据规则。** 免费档的数据可能被用于训练。约束如下：
  - **工作目录**：MiMo 席位在独立的 `git worktree` 里工作（分支 `fleet-visual-mimo`，从 T0 的提交拉出）。worktree 里只有已跟踪的文件，也就是 `git archive` 会发布、demo.opensilex.ai 已经公开的那一套。silex-mockup 主工作区里未跟踪的私有文件（如 `logs/2026-10-05_KEV_ONTOLOGY_IMPROVEMENT_PLAN.md`）不在其中。
  - **读取白名单**：任务说明里只列出本计划、它自己的文件、`js/rt-fleet.js`、`js/rt-tip.js`、`js/rt-subtabs.js`、`js/jev-runtime-host.js` 和 vendored 引擎。
  - **越界请求一律拒绝**：MiMo 席位的任何 external-directory 或 worktree 外的读取请求，planner 一律选 Reject，包括兄弟仓库 jev-runtime-observability。这覆盖了“选最窄的 allow”这一惯例。
  - **合并方式**：先用 `git show --stat` 确认要合并的提交只涉及它负责的 3 个文件，然后由 planner 把这 3 个文件（模块、CSS、测试）cherry-pick 回 `fleet-visual`。
  - **T3 的前置条件**（第 2 轮 claude 1）：
    - (a) 关闭现有的 `coder-mimo` 终端（`term_f1e15fd6…`，它在主工作区启动），不给它派任何任务；
    - (b) 先提交本计划，再从 T0 的提交创建 worktree，位置在 scratch 目录下（`$SCRATCH/mimo-wt`），不放在 silex-mockup 目录里；
    - (c) 在该 worktree 里重新启动 OpenCode，配置文件写入 `"permission": { "external_directory": "deny" }`，并确认底栏显示 MiMo。手动 Reject 作为第二道防线；
    - (d) 把启动命令和 worktree 路径记入 ledger。
- **仓库**：`silex-mockup`，分支 `fleet-visual`，从 `main` 的 `07b754c` 拉出。
  - 合并到 `main` 并推送会触发 CI 部署（需全票 IMPL-APPROVED，用户已授权“通过后自动执行”）。
  - 引擎（jev-runtime-observability）**不改**。
- **Scratch 目录**：`/var/folders/x3/8mdzc51d11j_z0l1mt77lpmr0000gn/T//fleet-8iL7qp`。评审席位沿用上一轮的 `reviewer-codex` 和 `reviewer-claude`，编码席位新建。

## 不可违反的要求

1. 所有决策和计数仍由 vendored 引擎在页面加载时计算（沿用 `fleetModel`），不写死任何数字。
2. 以下内容**保持在页面上可见**，不能只放进悬浮框：
   - Simulated 标签；
   - “场景计数，由引擎计算，不是测量结果”；
   - X1 的两条诚实性说明：链路来自声明的类型化事实，不是运行时推断；三个检查点是分别独立评估的。

   这沿用 2026-10-07 子页签改版的规则：诚实性标注不能只放在悬浮框里。
3. **无障碍与测试钩子。** 原有表格保留在可展开的 `<details>`（“以表格查看”）里，现有的 `data-rt-*` 钩子保持不变，`tests/site/rt-fleet.test.mjs` 的断言继续成立。动画要支持：
   - `prefers-reduced-motion`：直接显示终态，不播放；
   - 键盘操作：播放、切换、单步；
   - 390 px 宽度下不出现横向溢出。
4. **不引入外部库或网络请求。** 只用 SVG、CSS 和原生 JS。
5. **ontology 关闭时**（用户在 iframe 里切换）不影响本页。本页始终同时展示开、关两种结果。

## 新页面结构（自上而下）

| 区块 | 视觉 | 保留的可见文字 | 移进 ⓘ 的内容 |
|---|---|---|---|
| A. 页头 | 一行标题和一个 ⓘ | “Many agents, many teams: what one trace cannot see” + Simulated 标签 | 原来的引言段落 |
| B. X1 连锁动画（旗舰） | 动画分 5 个节点：Ops request（附约束“no minors in ads”）→ Trend Scout → Platform sync → Ad Curator → Ad Buyer。<br><br>一个“视频卡片” token 沿链路移动。上方有切换：**Trace only / With ontology**，配合 ▶ Play、↺ Replay 和单步按钮。<br><br>**Trace only**：每个节点依次亮起绿色 ✓，终点出现红色结局卡片“minor-featuring video in paid ads ✗”。<br><br>**With ontology**：三条事实以芯片形式飞入，分别是 `FEATURES subject:minor`、`advertising EXCLUDES minor`、`pool:hot SYNCS_TO ad-candidates`。token 停在 Trend Scout，显示 HOLD，然后飞向 “trust-safety” 队列图标；后两个节点显示为“独立检查点：BLOCK”。 | 标题一行；每个节点下一个决策标签；**可见的**诚实性说明：“链路来自声明的类型化事实，不是运行时推断”和“各检查点分别评估；真实执行中，源头 HOLD 之后后两步不会发生”；Trace only 的结局卡片上标注 “scripted outcome” | 每一步的规则 id 和原因；类型化三元组及其等级；“在真实执行中，HOLD 之后后两步不会发生” |
| C. Fleet 地图 | 按团队分 5 条泳道，每个 agent 一张卡片，卡片上是工具芯片，按影响类别着色（read/write/payment）。悬浮在工具上时显示 reviewer 团队。 | 团队名、agent 名、“Authored configuration” 标签 | 每个工具的影响类别和 reviewer；pack 链接 |
| D. 谁来复核 | 点阵：每个被拦下的调用是一个点，按 reviewer 团队分组着色。左侧是 “With the slice: N”，右侧是 “Trace only: M”（M 很可能是 0，显示为空栏）。点击 Play 时，各点从对应 agent 飞向团队桶。悬浮在点上时显示场景、工具和规则。 | 两侧的计数；“Scenario counts, computed by the engine”；**可见的**路由说明：“routed to owner · simulated, no tickets” | 每个点的细节 |
| E. 场景矩阵 | 共 11 行：8 个普通场景，加上 X1 的三步各占一行。列是 a/b 两个变体各自的 Trace only / With slice，单元格内是图标序列（✓ ran / ⏸ HOLD / ⛔ BLOCK）。每行一个 ▶ 按钮，播放该行的 `play` id（例如 `TR1b`、`X1Pb`），并切到 Scenarios 页签播放管线动画。 | 场景短名、图标 | 场景描述、各步的决策序列、规则原因 |
| F. 以表格查看 | `<details>` 里放原有的 X1 两列清单（连同其钩子和 FEATURES/EXCLUDES 文字）、fleet 表、队列表和 22 行场景表，原有钩子不变。 | — | — |

## 共享契约（T0 先完成，三位编码者都按它开发）

**`fleetModel()` 新增以下纯数据字段**，旧字段保持不变：

```js
model.x1 = [{ id, what, team, agent, tool,
  on:  { decision, action, stopped, rules, reasons, triples: [{ s, p, o, grade }] },   // triples：只取触发规则的那条事实的 used
  off: { decision, action, stopped, rules, reasons } }]
model.dots = [{ scenario, agent, tool, team, decision, rule }]   // ontology=1 时 action ∈ NON_EXECUTING 的每个调用，与 queues 判定相同
model.matrix = [ // 11 行：TR1 TR2 CS1 CS2 CR1 CR2 SD1 SD2 X1P X1C X1B
  { key: 'TR1', label, play: 'TR1b',
    a: { id: 'TR1a', on: [call], off: [call] }, b: { id: 'TR1b', on: [call], off: [call] } } ]
// call = { tool, decision, stopped, rules, reasons }。多步 trace（TR2、SD1、SD2）在单元格里画成图标序列（✓→✓→⏸）
```

**三个挂载函数**，每个都在独立文件里：

```js
mountX1(el, model, { tip, reducedMotion })
mountMap(el, model, { tip, reducedMotion })
mountGrid(el, model, { tip, run })
```

返回值是 `{ play?(), pause?(), reset?(), destroy() }`。

`run(id)` 由 rt-fleet.js 注入，依次执行：`__rtTabs.open('scenarios')`；把焦点移到 Scenarios 页签；调用 `__jevRuntime.run(id)`。token 的守卫逻辑由 host 的 `run` 自己处理。

**Node 可导入规则**：模块顶层不访问 `document`、`window`、`matchMedia`；`reducedMotion` 一律由参数传入。

**DOM 钩子（新增，只用下面列出的名字；不复用任何 `data-rt-x1*` 或 `data-rt-fleet-*` 名字，以免改变现有测试的计数）**：
- `[data-rt-fx1]`：根节点，带 `data-mode="off|on"` 和 `data-state="idle|playing|paused|done"`；
- `[data-rt-fx1-node="ops|X1Pb|sync|X1Cb|X1Bb"]`：其中 `ops`、`sync` 是叙事节点，不是引擎决策，样式要与工具决策节点有所区分；
- `[data-rt-fx1-fact]`；
- `[data-rt-fx1-claim]`：可见的诚实性标注；
- `[data-rt-fmap-agent]`；
- `[data-rt-fdot]`；
- `[data-rt-froute-claim]`；
- `[data-rt-fgrid-row]`；
- `[data-rt-fgrid-play]`。

**交互与无障碍**：
- 超过 5 秒的动画必须提供 Pause（WCAG 2.2.2）；
- 步骤变化通过 `aria-live="polite"` 区域播报；
- 颜色不能是唯一的信息载体，图标和工具芯片都要带文字或可访问名称；
- SVG 上的说明用 HTML 覆盖层承载 `rt-tip`；
- 切换模式、Reset、离开页签、`destroy` 时取消正在进行的动画。

**样式**：每个模块一个 CSS 文件，只使用站点已有的 CSS 变量（`--blue`、`--lav`、`--green`、`--red`、`--amber`、`--line`、`--muted`、`--mono` 等）。

## 任务

| # | 负责人 | 依赖 | 工作内容 | 验收标准 |
|---|---|---|---|---|
| T0 | planner | — | 地基。`js/rt-fleet.js` 里的 `fleetModel` 新增 `x1[].on.triples`（只取触发规则那条事实的 `used`）、`dots`（与 `queues` 用同一个“未执行动作集”判定）、`matrix`（11 行，见契约）。渲染新骨架，即区块 A–F 的挂载点。**区块 F 的 `<details>` 原样保留现有的静态 X1 两列清单**，连同 `data-rt-x1` / `data-rt-x1-side` / `data-rt-x1-step` / `data-rt-fleet-decision` 钩子和 FEATURES/EXCLUDES 文字，另外加上 fleet 表、队列表和 22 行场景表，所以现有测试在整个过程中都成立。三个模块先放占位实现（`mount*` 返回 `{destroy(){}}`，模块顶层不访问 DOM），对应的 CSS 和 `<link>` 一并写好。新增 `tests/site/rt-fleet-modules.test.mjs`：在 Node 里 import 三个模块，并检查 `fleetModel` 的新字段，包括 11 行、每行的 ▶ id 都能被 `scenarioById` 找到、`dots.length === queues.on.total`。`index.html` 的引言精简成一行加 ⓘ。 | `node --test tests/site/*.test.mjs` 全部通过 |
| T1 | coder-opus | T0 | `js/rt-fleet-x1.js`、`css/rt-fleet-x1.css`、`tests/site/rt-fleet-x1.test.mjs`：区块 B 的动画，要求见“交互与无障碍”。 | 自己的 headless 测试通过（没有 Chrome 时跳过）：两种模式下各节点的决策与 `model.x1` 一致；结束后 `data-state=done`；reduced-motion（`Emulation.setEmulatedMedia`）下直接到终态；Pause 有效；`ops`/`sync` 叙事节点不带任何引擎决策标签；390 px 无溢出；无 console 错误 |
| T2 | coder-sol | T0 | `js/rt-fleet-map.js`、`css/rt-fleet-map.css`、`tests/site/rt-fleet-map.test.mjs`：区块 C 的泳道地图，以及区块 D 的点阵和飞行动画。`mountMap` 不需要 `run`，D 区的 Play 不调用引擎。 | 自己的 headless 测试通过：6 张 agent 卡片；点数等于 `queues.on.total`；Trace only 的计数等于 `queues.off.total`；每个点可以用键盘聚焦，并带有规则 id 的说明；reduced-motion 下直接显示终态；390 px 无溢出 |
| T3 | coder-mimo | T0 | `js/rt-fleet-grid.js`、`css/rt-fleet-grid.css`、`tests/site/rt-fleet-grid.test.mjs`，在独立 worktree 中完成：区块 E 的 11 行矩阵和 ▶ 按钮。 | 自己的 headless 测试通过：11 行；每个单元格的图标序列与 `model.matrix` 一致，且带可访问名称；点击 ▶ 后 Scenarios 页签被选中、焦点落在该页签上，并且通过实际执行状态确认场景开始运行（`#rtStatus` 显示 Running 或 Complete，`#rtScenarioSelect` 的值等于该行的 `play` id；`summary()` 只是静态目录，不能用来判断）；390 px 无溢出 |
| T4 | planner | T1, T2, T3 | 集成：统一样式和悬浮框文案。在 `tests/site/rt-fleet.test.mjs` 里新增**可见性测试**（S44 风格）：下列标注的包围盒非零，并且不在已折叠的 `<details>` 或 `.rt-tip-body` 里；分别在 1400 px 和 390 px、X1 两种模式、idle 和 done 两种状态下检查。标注包括：Simulated 标签、“Scenario counts, computed by the engine, not measurements”、X1 的诚实性说明（声明的类型化事实，不是运行时推断；各检查点分别评估，真实执行中源头 HOLD 之后后两步不会发生）、路由说明（“routed to owner · simulated, no tickets”）、Trace only 结局卡片上的 “scripted outcome”（只要卡片显示出来就检查）；持续显示的诚实性说明在两种模式、所有被测状态下都保持可见。另外检查 ▶ 之后 fleet 深链接依然有效。完成后跑站点端到端探针、截取桌面和手机截图，并更新设计文档 §0 和 changelog。 | `git archive` 导出目录里跑 CI 测试全部通过；探针 43/44（S20 为原有失败）；截图通过人工审阅 |
| D1 | planner | Step 7 全票 | 合并 `fleet-visual` 到 `main`（`--no-ff`）并推送，由 CI 部署；运行 `pages_sync --verify-only`；对线上跑探针；在真实 Chrome 里先清掉这几个文件的缓存，再打开深链接检查。 | 线上与提交逐字节一致；深链接打开 fleet 页签；动画可以播放 |

## 文件归属（同一文件只有一个写入者）

- **planner**：`js/rt-fleet.js`、`index.html`、`css/rt-subtabs.css`、`tests/site/rt-fleet.test.mjs`、`tests/site/rt-fleet-modules.test.mjs`、`logs/*`；T0 阶段的三个占位文件，交接后归对应编码者。
- **coder-opus**：`js/rt-fleet-x1.js`、`css/rt-fleet-x1.css`、`tests/site/rt-fleet-x1.test.mjs`。
- **coder-sol**：`js/rt-fleet-map.js`、`css/rt-fleet-map.css`、`tests/site/rt-fleet-map.test.mjs`。
- **coder-mimo**：`js/rt-fleet-grid.js`、`css/rt-fleet-grid.css`、`tests/site/rt-fleet-grid.test.mjs`（在它自己的 worktree 中）。
- **新增的 CSS 文件**由 planner 在 T0 时以 `<link>` 写进 `index.html`。
- **不碰**：`jev-runtime/**`、`swm/**`、其他 `js/*.js`。

## 风险与说明

- **动画的诚实性。** “token 飞向 trust-safety 队列”表达的是路由归属（`OWNED_BY_TEAM`），不是说真实系统已经建立了工单。区块 D 用可见的 `[data-rt-froute-claim]` 写明这一点，悬浮框里再补充细节。
- **4 小时缓存期间的上线影响。** 本次只新增模块文件（都是新 URL），改动的已有文件只有 `js/rt-fleet.js`、`index.html` 和 `css/rt-subtabs.css`。老访客如果仍持有缓存的旧 `rt-fleet.js`，看到的会是改版前的页面，但不会出现新旧混用导致的错误，因为 `rt-tip.js`、`rt-subtabs.js` 和 vendored 引擎都没有改。因此“其他 `js/*.js` 一律不碰”严格执行。
- **缓存问题不在本计划内**（第 1 轮 claude 4 和 codex 的非阻塞意见）。
  - **根因**：`opensilex-demo.pages.dev` 返回的是 `max-age=0, must-revalidate`，即 Pages 的默认值；`demo.opensilex.ai` 返回的是 `max-age=14400`。这来自该域名在 Cloudflare 上的 Browser Cache TTL 设置，加 `_headers` 未必能覆盖。
  - **修复方式**：需要修改 Cloudflare 账号配置，例如把 Browser Cache TTL 改成 “Respect Existing Headers”，或加一条 Cache Rule。这超出了合并授权的范围，交给用户单独决定。
  - **本次 D1** 只能在真实 Chrome 里先清掉这几个文件的缓存再检查，并在报告里说明：老访客最多可能要等 4 小时才能看到新版本。

## §R1：第 1 轮意见及对应修改

| 意见（提出人） | 修改 |
|---|---|
| 9 行矩阵装不下 X1 的三对 trace，而且 `X1b` 这个 id 不存在（claude 1、codex 1） | 改为 11 行，每行带 `play` id；多步 trace 画成图标序列；T0 用测试检查所有 `play` id 都能被 `scenarioById` 找到 |
| 旧的 X1 钩子会被删掉；模块必须能在 Node 里导入（claude 2、codex 2） | 区块 F 的 `<details>` 原样保留静态 X1 清单和它的钩子；新钩子只用 `data-rt-f*`；模块顶层不访问 DOM；T0 新增 Node 导入测试 |
| 诚实性标注的可见性没有测试（claude 3） | T4 新增 S44 风格的可见性测试（两种宽度 × 两种模式 × idle/done 两种状态） |
| 缓存的诊断错了，`_headers` 未必有效（claude 4，codex 的非阻塞意见） | `_headers` 移出本计划，记录根因；修复需要改 Cloudflare 账号配置，交给用户决定 |
| MiMo 的工作目录限制不住读取范围（claude 5，codex 的非阻塞意见） | 改用只含已跟踪文件的独立 worktree，并给出读取白名单；越界请求一律拒绝 |
| 路由和“源头 HOLD 之后后两步不会执行”这两条只放在悬浮框里（codex 3、claude 的非阻塞意见） | 都改为可见标注，并由测试检查 |
| （非阻塞）WCAG、aria-live、焦点移动、取消、只靠颜色区分、tip 放在 SVG 上、每位编码者各有测试文件、triples 只取触发规则的事实、dots 判定与 queues 一致、mountMap 不需要 run | 全部写进契约，或写进对应任务的验收 |

## §R2：第 2 轮意见及对应修改

| 意见（提出人） | 修改 |
|---|---|
| 现有的 MiMo 席位在主工作区里，拥有默认权限（claude 1） | 关闭该席位；在 scratch 下建立 worktree；配置 `external_directory: deny`；先提交本计划；把启动命令记入 ledger。作为 T3 的前置条件 |
| （非阻塞）钩子前缀会和 `data-rt-fleet-*` 冲突（claude） | 只用列出的名字，不复用任何 `data-rt-fleet-*` 名字 |
| （非阻塞）风险一节的路由说明与区块 D 不一致；缓存期间的上线影响（claude） | 已更新 |
| （非阻塞）cherry-pick 之前检查 `--stat`；T1 的叙事节点不带决策标签（claude） | 已写入 |
| （非阻塞）T3 要用实际执行状态验证；T4 的结局卡片规则（codex） | 已写入 |

## 计划批准

（每轮的结论追加在这里）

计划 v0.3 的第 3 轮结论（2026-10-10）：
- `codex-plan-r3`：**PLAN-APPROVED**
- `claude-plan-r3`：**PLAN-APPROVED**
- **PLANNER (claude): PLAN-APPROVED**

前两轮的情况：第 1 轮两位都驳回；第 2 轮 codex 批准、claude 驳回。

第 3 轮 claude 的非阻塞建议会落实到 MiMo 席位的配置里：`"bash": "ask"`；配置文件的 sha256 记入 ledger。

## 实现与代码评审记录

**任务结果**：
- T0、T4 由 planner 完成；
- T1（coder-opus，Claude Opus 5.5 medium）、T2（coder-sol，GPT-6.1-Sol medium）、T3（coder-mimo，MiMo-V2.6-Flash Free，在独立 worktree 中完成，以 `--stat` 核对后 cherry-pick 回来）全部 succeeded。

**代码评审轮次**：

| 轮次 | 评审版本 | codex（GPT-6.1-Sol high） | claude（Opus 5.5 high） | 发现的问题与修复 |
|---|---|---|---|---|
| r1 | f6a2885 | **IMPL-REJECTED** | **IMPL-REJECTED** | 1. 减少动态效果设置下，X1 打开时是空白的 idle 状态（两位都指出）→ 打开时、切换模式时、Reset 时都直接显示终态。<br>2. 390 px 下动画在屏幕外播放 → 舞台随当前步骤自动横向滚动。<br>3. 矩阵说明写成 “11 scripted traces, each run four ways” → 改为 “11 scenarios, 22 scripted traces”。<br>此外：演示期间的逐步播报合并为结束时一句总结；只读工具的悬浮说明改为“无 reviewer”；修正 X1 handle 的取法 |
| r2 | **f402f64** | **IMPL-APPROVED** | **IMPL-APPROVED** | — |

**PLANNER (claude): IMPL-APPROVED**，针对 f402f64（diff blob `72df79ad09b47864d6f43f54c7af3c5d1938bcac`，基线 `07b754cd9750b4dabffdaf4631a216469e37a204`）。

**planner 事后修改了编码者的文件**（已在 r1 中向评审披露）：
- 在 `js/rt-fleet-x1.js` 加入 `tour()`，并相应修改 `tests/site/rt-fleet-x1.test.mjs`；
- 修正 `js/rt-fleet-grid.js` 的说明文字及其测试；
- 修正 `js/rt-fleet-map.js` 的只读工具悬浮说明。

**MiMo 席位的教训**（建议写进 orca-agent-fleet skill）：
- OpenCode 2.x 的 shell 工具名叫 `shell`，所以 `"bash": "ask"` 不起作用；
- `"external_directory": "deny"` 实际效果是弹窗询问，而不是直接拒绝；
- planner 审计了它的全部 47 次工具调用：没有读取任何私有内容；唯一一次越界读取（读回它自己的截图）被拒绝。

**留待以后处理的非阻塞建议**：
- 390 px 下演示结束时，Ad Buyer 的 BLOCK 标签仍有部分被裁切（codex）；
- reduced-motion 下的 “End state.” 播报可以改成一句状态总结；
- `follow()` 依赖 `style.left`（claude）。

**不在本次评审范围、未合入的改动**：主工作区里有另一个会话在 23:33 做的修改（`tests/site/ontology-card/browser.mjs`、`run-site-probes.mjs`、新增的 `chrome-reaper.mjs`），本次没有提交，也没有回退。

**CI 失败与修复（D1）**：
- 合并提交 b9c1d8e 推送后，GitHub Actions 运行 38118627811 在测试阶段失败，因此没有部署：结局卡片有 0.4 s 的弹出动画，初始透明度为 0，CI 恰好在第 0 帧取样。
- 修复只改测试：先等终态卡片可见、且动画播完，再检查可见性。本地用延迟动画复现了这个问题：修复前失败，修复后通过。
- 确认轮 r3（针对 a6b79e8）：codex **IMPL-APPROVED**，claude **IMPL-APPROVED**，**PLANNER (claude): IMPL-APPROVED**。

## 部署记录（D1，2026-10-11 UTC）

- main 推进到 `2e72f5e`（b9c1d8e 合并 + a6b79e8 CI 修复 + 记录），GitHub Actions 运行 38119062270 成功。
- `pages_sync --verify-only`：**LIVE MATCHES 2e72f5e**，pages.dev 和 demo.opensilex.ai 共校验 24 个文件。三个新模块的线上 sha256 与仓库一致。
- 在真实 Chrome 中清除这些文件的缓存后打开深链接：fleet 页签自动播放演示，最后停在 on/done，决策为 HOLD、BLOCK、BLOCK，并播报了 “Demo finished …” 总结；点阵 10 个点，矩阵 11 行，说明文字已是修正后的版本。
- **观察到的小问题**（与 codex 和 claude 的非阻塞建议同类）：Chrome 窗口约 1300 px 宽时，演示结束后舞台略向右滚，Ops request 和左侧的事实芯片被裁掉一小截。
- 所有席位均设为 `left`；MiMo 的 worktree 已删除（分支 `fleet-visual-mimo` 保留在本地）；账本检查通过。
- **老访客问题**：在 Cloudflare 的 Browser Cache TTL 设置修改之前，回访用户最多 4 小时内可能看到旧版本。
