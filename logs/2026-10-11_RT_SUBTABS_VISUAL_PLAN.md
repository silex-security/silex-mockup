# Runtime Observation：Agent fleet 子页签 + Learning loop / Ontology 可视化（fleet 计划）

版本 **v0.1**，供第 1 轮计划评审。日期 2026-10-11。

## 需求

用户（2026-10-11）原话：“agent-fleet 页面太长，可以按照逻辑分类在 agent-fleet 页面里面增加 sub-tabs，可以直接点击进入。还有就是 "learning loop" 和 “ontology” sub-tab 也有同样的文字过多的问题，请按照页面 demo 需要增加动画和图片。”

沿用 2026-10-10 的要求：设计交给多 agent 评审，通过后自动执行，尽量减少人的参与（同一人员配置，见下）。

**现状（本地 1400 px 实测，main `4782b78`）**

| 页签 | 面板高度 | 可见词数 | 问题 |
|---|---|---|---|
| Agent fleet | 2877 px | 572 | 四块内容（X1 动画、泳道图、复核路由、11 行矩阵）加表格，一屏看不完，需要一路往下滚 |
| Learning loop | 697 px | 333 | 引言一大段；6 步循环是静态文字卡；结果是三张数字卡加一段 Reality check 长句 |
| Ontology | 807 px | 317 | 引言一大段；Alerts/Precision/Recall 三张定义卡；结果靠文字解释；Example runs 的解释链全是文字 |

**目标读者与 10 秒理解目标**：Head of AI 或投资人。

- Agent fleet：点子页签就能直接看到想看的那一块，不用滚动；
- Learning loop：一眼看懂“人复核 → 标签 → 训练 → 关卡 → 上线”这个循环，以及微调前后好了多少、现实中要打多少折扣；
- Ontology：一眼看懂“给动作加上类型 → 告警更少、更准”，并且看到一次真实运行里类型是怎么起作用的。

## 运行信息

- **人员配置**（用户 2026-10-10 指定，本次沿用）：
  - planner：Claude Code `claude-opus-5-5`（本会话）；
  - 编码：`coder-opus`（Claude Opus 5.5，effort medium）、`coder-sol`（Codex `gpt-6.1-sol`，reasoning medium）、`coder-mimo`（OpenCode `opencode/mimo-v2.6-flash-free`）；
  - 评审：`reviewer-codex`（GPT-6.1-Sol high）、`reviewer-claude`（Claude Opus 5.5 high）。
  - 计划关卡和代码关卡都需要两位评审 + planner 全票。编码席位只实现，不投票。
  - 复用上次的五个窗格（handle 见 `$SCRATCH/seats.env`）。评审和 Opus/Sol 编码席位开新会话（`/clear`、`/new`），拿到完整计划后再工作。MiMo 席位按下面的数据规则重新启动。
- **MiMo 的数据规则**（与上次相同）：
  - 只在独立的 `git worktree` 里工作（`$SCRATCH/mimo-wt`，分支 `subtabs-mimo`，从 T0 的提交拉出），worktree 里只有已跟踪、已公开发布的文件；
  - 读取白名单：本计划、它自己的 3 个文件、`js/rt-ontology.js`、`js/rt-tip.js`、`js/rt-subnav.js`、`data/onto-observability.json`、`tests/site/ontology-card.test.mjs`、`tests/site/ontology-card/browser.mjs`、`css/rt-subtabs.css`；
  - worktree 外的任何读取请求，planner 一律 Reject；
  - OpenCode 配置写入 `"permission": { "external_directory": "deny" }`（2.x 下它会弹窗而不是直接拒绝，手动 Reject 是第二道防线）；
  - 合并前用 `git show --stat` 确认只动了它的 3 个文件，再由 planner 把这 3 个文件取回主分支。
- **仓库**：`silex-mockup`，分支 `subtabs-visual`，从 `main` 的 `4782b78` 拉出。合并到 `main` 并推送会触发 CI 部署（需全票 IMPL-APPROVED；用户已授权“通过后自动执行”）。引擎（`jev-runtime/**`）和数据文件（`data/*.json`、`jev-runtime/demo/data/*.json`）**不改**。
- **Scratch 目录**：`/var/folders/x3/8mdzc51d11j_z0l1mt77lpmr0000gn/T//fleet-0PNN2p`。
- **不碰**：主工作区里另一个会话的未提交改动（`tests/site/ontology-card/browser.mjs`、`tests/site/run-site-probes.mjs`、`tests/site/chrome-reaper.mjs`），以及未跟踪的 `logs/2026-10-05_KEV_ONTOLOGY_IMPROVEMENT_PLAN.md`。分支在单独的 worktree（`$SCRATCH/site-wt`）里开发，不影响主工作区。

## 不可违反的要求

1. **所有数字来自数据或引擎**：Learning 用 `jev-runtime/demo/data/learning-evidence.json` 和 `data/onto-observability.json` 的 `judge_baseline`；Ontology 用 `data/onto-s1.json` 和 `data/onto-observability.json`；Fleet 沿用 `fleetModel`。不写死任何数字。动画里的点、条、格子数量都由这些数据算出来，图例写明比例（例如“每格 = 1 % 的告警”）。
2. **诚实性标注保持在页面上可见**（非零包围盒，不在折叠的 `<details>` 或 `.rt-tip-body` 里），由测试在 1400 px 和 390 px 下检查，**在该标注所属的子页签被选中时**：
   - Fleet：沿用上次的全部可见性断言（Simulated 标签、“Scenario counts, computed by the engine, not measurements”、X1 的两条诚实性说明、路由说明、Trace only 结局卡片上的 “scripted outcome”）；
   - Learning：`Measured` 标签；“benchmark labels, not yet customer reviewers”（结果子页签）；第 6 步 Promote 标为 “Future work”（循环子页签）；Reality check 的两个 AUROC 数值（结果子页签）；
   - Ontology：`Measured` 标签；“No judge model”；S1 的适用范围“held-out AgentDojo tasks and these models only”；召回的 “observed, not a guarantee”；Example runs 上“真实的 held-out 运行，按固定规则挑选，包括类型丢掉告警的例子”这一句（短句可见，细节进 ⓘ）。
3. **现有测试和钩子不变**：`tests/site/*.test.mjs`、`tests/site/ontology-card.test.mjs`、`tests/site/ontology-s1-card.test.mjs` 现有断言继续成立。具体包括：
   - Ontology：`data-onto-seg="s1"|"ex"`、`data-onto-cell-btn`、`data-onto-mode-btn`、`#rtOntology[data-onto-mode]`、`data-onto-run`、`data-onto-call`、`data-onto-flagged`、`.rt-onto-why` 的 textContent 等于 `why_not` 原文、`data-onto-empty`、`data-onto-chain`、`data-onto-s1`、`data-onto-s1-verdict`、`data-onto-s1-num="prov-F"|"s1-F"`、`data-onto-s1-part` / `-ok` 和其中 `.rt-chip` 的文字、`[data-onto-s1] tbody tr` 表格行、`[data-onto-s1] a` 链接列表；`#rtOntology` 的文字里不出现 “Not confirmed / not established / Follow-up test / did not establish / Inconclusive / AgentDyn”；
   - Learning：`#rtJudgeRealNote` 的文字包含两个 AUROC（三位小数）、`data-evidence-value`、`data-evidence-gate`、`data-evidence-verdict`、`#rtTryLoop`；
   - Fleet：上次所有 `data-rt-*` / `data-rt-f*` 钩子。
   - 若某个断言因为结构调整（例如元素换了位置）必须改，只能改定位方式，不能放宽断言内容，并在代码评审时单独列出。
4. **动画规则**：只用 SVG、CSS 和原生 JS，不引入外部库或网络请求；`prefers-reduced-motion` 下直接显示终态；有 Play/Pause/Replay（至少 Replay），键盘可操作；**只在所在子页签第一次显示时自动播放一次**，切走时暂停；390 px 下页面无横向溢出；无 console 错误。
5. **文字减量规则**：每个面板顶部只留一句话加 ⓘ；定义、方法、p 值、样本量、来源一律进 ⓘ（复用 `js/rt-tip.js`）；图上的说明用短标签。被移进 ⓘ 的内容不能丢。
6. **模块可在 Node 里导入**：新模块顶层不访问 DOM，便于 `tests/site/*-modules.test.mjs` 做纯函数检查。

## 共享契约（T0 先完成）

### 1. 子页签组件 `js/rt-subnav.js`

```js
mountSubnav(navEl, {
  tab,            // 所属的一级页签 id：'fleet' | 'learning' | 'ontology'
  label,          // tablist 的 aria-label
  items: [{ key, label, hint, attrs }],   // hint 是一行短说明（按钮下方小字）；attrs 是额外属性，例如 {'data-onto-seg':'s1'}
  panels,         // 容器元素，里面每个 [data-rt-subpanel="<key>"] 是一个面板
  initial,        // 默认 key
}) → { open(key, { focus }), current(), destroy() }
```

- 渲染 `<nav class="rt-subnav" role="tablist">`，按钮为 `role="tab"`、`data-rt-sub="<key>"`、`aria-selected`、`aria-controls`，roving tabindex，←/→/Home/End 切换。
- 每个按钮带序号徽标（①②③④）、短标签和一行 hint。窄屏下 nav 在自身内部横向滚动，页面不溢出。
- 每个子面板底部有一个 “Next: <下一个标签> →” 按钮（最后一个没有），用于按故事顺序走完整个页签。
- 切换时派发 `document` 事件 `rt:sub`，`detail = { tab, sub }`。子页签第一次显示时另派发一次 `detail.first = true`，各模块据此自动播放。
- **深链接**：`#view=runtime-observation&tab=<tab>&sub=<key>` 打开对应子页签。`js/rt-subtabs.js` 的 `fromHash` 把 `sub` 转交给对应的 subnav（通过 `window.__rtSubnav[tab]`）。`index.html` 的 `stateHash()` 在子页签不是默认值时追加 `&sub=`。点击不写 hash（与站内其他导航一致）。

### 2. 各页签的子页签

| 页签 | key（默认在前） | 标签 / hint | 内容 |
|---|---|---|---|
| Agent fleet | `cascade` | Cascade demo / 每一步都成功，结果却违规 | X1 动画（现有） |
| | `agents` | Agents & teams / 谁在运行什么 | 泳道图（现有 `[data-rt-fmap]`） |
| | `routing` | Who reviews / 被拦下的调用交给谁 | 复核路由点阵（现有 `[data-rt-froute]`），第一次显示时自动 Play |
| | `scenarios` | All scenarios / 11 个场景，开与关 | 11 行矩阵 + “Show as tables” |
| Learning loop | `loop` | How it learns / 复核答案变成训练数据 | 循环动画（新，T1） |
| | `results` | Measured results / 微调前后，以及现实折扣 | 前后对比条、上线关卡、Reality check（新，T1） |
| Ontology | `how` | How types help / 一次真实运行 | 类型如何起作用的动画讲解（新，T2） |
| | `s1` | Pre-registered test / 已确认的结果 | 告警漏斗 + 精度方格 + 三项检查（新，T2）；按钮上带现有的 verdict 徽标 |
| | `ex` | Example runs / 四类真实例子 | 运行时间线可视化（新，T3），现有的 cell/mode 切换按钮保留 |

Fleet 的 X1 引导演示只在 `cascade` 子页签可见时播放：离开 `cascade`（`rt:sub`）或离开 fleet 页签都取消演示并暂停（T0 在 `rt-fleet-x1.js` 的 `onTab` 旁加一个 `rt:sub` 监听）。
`mountMap(el, model, opts)` 新增 `opts.routeEl`：给定时，复核路由区块渲染进 `routeEl`，否则维持现状（T0 改）。

### 3. 新模块（T0 先放“搬过去的现有实现”，保证 T0 时所有测试通过；编码者在此基础上升级）

```js
// js/rt-learning-visual.js（T1，coder-opus）
mountLoop(el, { tip, reducedMotion }) → { play, pause, reset, destroy }
mountLearningResults(el, { evidence, judge, runs }, { tip, reducedMotion }) → { play, destroy }
//   evidence = learning-evidence.json；judge = onto-observability.json 的 judge_baseline；runs = v2_descriptive.runs

// js/rt-onto-visual.js（T2，coder-sol）
mountOntoHow(el, { examples }, { tip, reducedMotion }) → { play, pause, reset, destroy }
mountOntoS1(el, s1, { tip, reducedMotion }) → { play, destroy }

// js/rt-onto-run.js（T3，coder-mimo）
mountOntoRun(el, { ex, mode, desc }, { tip, reducedMotion }) → { destroy }
//   每次 cell 或 mode 变化时由 rt-ontology.js 重新调用（先 destroy 旧的）
```

T0 把 `jev-runtime-host.js` 里 `renderLearningEvidence` 的 HTML 生成搬进 `mountLearningResults`，把 `rt-ontology.js` 里的 `s1Block`、`example()`/`chain()` 分别搬进 `mountOntoS1` 和 `mountOntoRun`，`#rtJudgeRealNote` 的填写从 `rt-ontology.js` 移到 `mountLearningResults`（host 负责加载 `judge_baseline` 并传入）。`mountOntoHow` 和 `mountLoop` 在 T0 是占位（`mountLoop` 渲染现有的 6 步静态列表）。

## 视觉设计（编码者的要求）

### T1 Learning loop（coder-opus）

**`loop` 子页签：循环动画。**
- 一个 SVG 环，6 个节点：Held → Answer → Label → Train → Gate → Promote。节点用小图标 + 一两个词，长说明进 ⓘ。
- 一个“被拦下的动作”小卡片沿环移动：在 Held 处出现“?”，在 Answer 处变成 ✓safe 或 ✗unsafe，在 Label 处变成一个标签块落进“训练集”小桶，Train 处模型图标“升级”成 Kev′，Gate 处出现一道闸门（通过 / 拦下），最后到 Promote。
- Promote 节点为虚线，带可见的 “Future work” 标签。
- 控件：Play/Pause、Replay、Step；reduced motion 下显示所有节点已点亮的终态。
- 环下方一行可见小字：“Steps 1–5 tested on a public benchmark; labels came from the benchmark, not yet from customer reviewers.”

**`results` 子页签：结果图。**
- **前后对比条**（三组）：goal_deviation recall、instruction_override AUROC、p50 延迟。每组两根横条（released / fine-tuned），进入时从 0 长到数值；数值上保留 `data-evidence-value`。p50 延迟画成两根几乎一样长的条，强调“没变慢”。
- **上线关卡**：每个候选模型一张卡，内容是“fixed / broke”两段对比条，以及 missed 前后（KEEP 的 21→7、DISCARD 的 25→27）；关卡结论用印章式徽标（KEEP / DISCARD），保留 `data-evidence-gate`、`data-evidence-verdict`。规则说明进 ⓘ。
- **Reality check**：两根 AUROC 条：“benchmark split 0.961” 和 “real agent runs 0.741”，0.5 处画一条“coin flip”虚线。元素 id 为 `#rtJudgeRealNote`，可见文字至少包含两个三位小数的 AUROC 和一句短结论（“Expect real-world results nearer the lower figure”）。
- 可见：`Measured` 标签、“benchmark labels, not yet customer reviewers”。

**T1 测试** `tests/site/rt-learning-visual.test.mjs`（headless，没有 Chrome 时跳过）：环上 6 个节点且第 6 个带可见 “Future work”；动画结束后 `data-state=done`；reduced motion 下直接是终态；条的数值与 JSON 一致（按 `data-digits` 格式化）；两个 gate 的 verdict 与 JSON 一致；`#rtJudgeRealNote` 含两个 AUROC；1400/390 px 无溢出；无 console 错误。

### T2 Ontology 的 how 和 s1（coder-sol）

**`how` 子页签：一次真实运行的动画讲解**（数据取 `examples` 里 `cell="both"` 和 `cell="saved"` 两个例子，不编造）。
- 上半：同一个写调用，左边“Without types”，右边“With types”。动画分三拍：
  1. 调用卡片出现（工具名 + 参数）；
  2. 右边依次贴上三个类型标签：`may cause → <effect>`、`argument denotes → <class>`、`value came from → tool output`（取自 `otp.explanation`）；左边只有一条通用规则“write call + value seen in a tool output”；
  3. 判定：`both` 例子两边都告警；`saved` 例子左边告警（误报）、右边因为参数类别不在危害类里而不告警。
- 两个例子用一个小切换（“Caught by both” / “Alert saved”）。
- 可见一句：“A real held-out AgentDojo run. No judge model.”
- 控件同上；reduced motion 显示终态。

**`s1` 子页签：结果图。**
- 顶部：现有 verdict 徽标 + 一句 headline（现有 `headline()`）+ 范围说明（可见）。
- **告警漏斗**：两根堆叠条，“Without types: 5015 alerts” 和 “With types: 4000 alerts”，每根分成“real attack (TP)”和“false alarm (F−TP)”两段，进入时动画收缩到右边的长度。数字用现有 `data-onto-s1-num="prov-F"` / `"s1-F"` 钩子。
- **精度方格**：两个 10×10 方格，“of 100 alerts, 41 real” → “53 real”（`of100(precision)`），切换或进入时逐格点亮。
- **召回条**：2469 次成功攻击中被告警的比例，84 → 87，旁边可见 “observed, not a guarantee”。
- **三项预注册检查**：一排三个带 ✓ 的徽章，保留 `data-onto-s1-part` / `-ok` 和 `.rt-chip` 文字（held），解释文字进 ⓘ。
- 每个 base model 的表格和来源链接保留在 `<details>`（钩子不变）。
- Alerts/Precision/Recall 三张定义卡从面板顶部移走，定义进相应图的 ⓘ。

**T2 测试** `tests/site/rt-onto-visual.test.mjs`：how 的两个例子的告警结果与 `examples` 里 `otp/prov.call_index` 一致；标签文字取自 `otp.explanation`；漏斗条的数字与 `onto-s1.json` 一致；方格点亮数等于 `of100(precision)`；三项检查与数据一致；reduced motion 终态；1400/390 px 无溢出；无 console 错误。

### T3 Ontology 的 ex（coder-mimo）

- 一次运行画成**横向时间线**：每个调用是一张小卡片（工具名、impact 图标：read/write），用箭头连起来；用户任务放在时间线起点的气泡里。
- 被告警的调用卡片变红并有一次脉冲动画，标注 “Alert”；未告警的标注 “No alert”，原因（`.rt-onto-why`，原文不变）以小字显示在卡片下方。
- 解释链：With ontology 模式下画成从参数值到危害类的“标签链”（三个标签依次出现）；Without 模式下画成通用规则的三条短句；来源摘录（`source.excerpt`）里高亮该值（沿用 `hl()`）。
- 切换 mode 时只重放解释链的动画，不整页闪。
- 空例子显示现有的 “no qualifying example” 文字（`data-onto-empty`）。
- 窄屏（390 px）时间线改为纵向。

**T3 测试** `tests/site/rt-onto-run.test.mjs`：四个 cell × 两种 mode 下，`data-onto-call` 的序号、`data-onto-flagged`、`.rt-onto-why` 文字与数据一致（与 `ontology-card.test.mjs` 第 4 项同口径）；with 模式下 `data-onto-chain` 存在且含 `otp.explanation` 的 effects/class；390 px 无溢出；reduced motion 下无动画仍完整显示；无 console 错误。

## 任务

| # | 负责人 | 依赖 | 工作内容 | 验收标准 |
|---|---|---|---|---|
| T0 | planner | — | 建 worktree 和分支。写 `js/rt-subnav.js`、`css/rt-subnav.css`、`tests/site/rt-subnav.test.mjs`；接入 fleet（`rt-fleet.js` 改为 4 个子面板，`mountMap` 加 `routeEl`，routing 第一次显示时自动 Play，X1 加 `rt:sub` 监听）、learning（host 改为调用 `mountLoop`/`mountLearningResults`）、ontology（`rt-ontology.js` 改用 subnav，三个挂载点）。按“共享契约 3”把现有实现搬进三个新模块；`index.html` 精简三个面板的引言（一句 + ⓘ），加 CSS 链接，`stateHash()` 加 `&sub=`；`rt-subtabs.js` 转交 `sub`。新增 `tests/site/rt-visual-modules.test.mjs`（Node 里 import 三个新模块）。更新 `tests/site/rt-fleet.test.mjs` 的可见性断言为“在所属子页签下检查”，并加入 Learning/Ontology 的可见性断言（见“不可违反的要求”2）。提交 T0 后给编码者开工。 | `node --test tests/site/*.test.mjs` 全部通过；`node tests/site/ontology-card.test.mjs` 和 `ontology-s1-card.test.mjs` 通过；子页签深链接三个页签都能打开 |
| T1 | coder-opus | T0 | `js/rt-learning-visual.js`、`css/rt-learning-visual.css`、`tests/site/rt-learning-visual.test.mjs` | 见 T1 测试；T0 的全部测试仍通过 |
| T2 | coder-sol | T0 | `js/rt-onto-visual.js`、`css/rt-onto-visual.css`、`tests/site/rt-onto-visual.test.mjs` | 见 T2 测试；T0 的全部测试仍通过 |
| T3 | coder-mimo | T0 | `js/rt-onto-run.js`、`css/rt-onto-run.css`、`tests/site/rt-onto-run.test.mjs`，在独立 worktree 中完成 | 见 T3 测试；`ontology-card.test.mjs` 仍通过 |
| T4 | planner | T1–T3 | 集成：统一样式、ⓘ 文案、Next 按钮的顺序；跑全部测试和站点探针；截取 1400/390 px 下每个子页签的截图供评审；更新 changelog（`logs/README.md`）和本计划的记录。 | `git archive` 导出目录里 CI 测试全部通过；探针结果不比 main 差；截图通过评审 |
| D1 | planner | Step 7 全票 | `--no-ff` 合并到 `main` 并推送，由 CI 部署；`pages_sync --verify-only`；对线上跑探针；在真实 Chrome 里清掉相关文件缓存后打开三个深链接检查。 | 线上与提交逐字节一致；三个页签的子页签和动画在 Chrome 里正常 |

## 文件归属（同一文件只有一个写入者）

- **planner**：`js/rt-subnav.js`、`css/rt-subnav.css`、`js/rt-subtabs.js`、`js/rt-fleet.js`、`js/rt-fleet-x1.js`（仅 `rt:sub` 监听）、`js/rt-fleet-map.js`（仅 `routeEl`）、`js/jev-runtime-host.js`、`js/rt-ontology.js`、`index.html`、`css/rt-subtabs.css`、`tests/site/rt-subnav.test.mjs`、`tests/site/rt-visual-modules.test.mjs`、`tests/site/rt-fleet.test.mjs`、现有测试文件的必要定位调整、`logs/*`；T0 阶段三个新模块的初始版本，交接后归对应编码者。
- **coder-opus**：`js/rt-learning-visual.js`、`css/rt-learning-visual.css`、`tests/site/rt-learning-visual.test.mjs`。
- **coder-sol**：`js/rt-onto-visual.js`、`css/rt-onto-visual.css`、`tests/site/rt-onto-visual.test.mjs`。
- **coder-mimo**：`js/rt-onto-run.js`、`css/rt-onto-run.css`、`tests/site/rt-onto-run.test.mjs`。
- 编码者需要改契约或别人的文件时，写 question 文件给 planner，不自行修改。

## 风险与说明

- **ontology-card 测试的定位**：它点击 `[data-onto-seg="s1"|"ex"]` 切换面板。subnav 按钮通过 `attrs` 带上这两个属性，所以测试无需修改。
- **`#rtJudgeRealNote` 跨模块**：从 `rt-ontology.js` 移到 Learning 模块后，ontology-card 第 6 项照旧通过（它只读这个元素的文字）。
- **X1 引导演示与子页签**：默认子页签就是 `cascade`，所以打开 fleet 页签时的行为与现在相同；切到别的子页签时演示取消。
- **4 小时浏览器缓存**（Cloudflare 账号设置）仍未解决，不在本计划内；部署后用 `fetch(cache:'reload')` 在 Chrome 里刷新验证。
- **MiMo 的 OpenCode 2.x 权限键**：shell 工具名是 `shell`，`external_directory: deny` 会弹窗。按上次做法，逐个弹窗由 planner 判断，越界一律 Reject。
