# Runtime Observation：Agent fleet 子页签 + Learning loop / Ontology 可视化（fleet 计划）

版本 **v0.3**，供第 3 轮计划评审（第 1、2 轮意见及修改见 §R1、§R2）。日期 2026-10-11。

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
  - **worktree 里的内容全部是公开的或本次就要公开的**：已跟踪文件就是 `git archive` 发布到 demo.opensilex.ai 的内容（只有 `.github` 被 export-ignore，`logs/` 也会发布）；T0 新增的文件（本计划、三个模块初版、测试）会随本次合并一起发布，不含任何私有数据。所以 worktree 内的“读取白名单”只是工作指引，**不是**安全边界，这里如实说明；
  - 真正需要强制的边界是 worktree 之外：OpenCode 配置写入 `"permission": { "external_directory": "deny", "shell": "ask", "webfetch": "deny" }`（2.x 的 shell 工具键名是 `shell`；`external_directory: deny` 在 2.x 下会弹窗而不是直接拒绝）。worktree 外的任何读取一律 Reject；
  - **MiMo 不执行它自己写的代码**。运行 Node 会以用户的完整文件和网络权限执行 MiMo 写的 JS，并把输出交还给 MiMo，这会绕过上面所有控制。所以 MiMo 的 shell 请求只批准两类：`node --check <它的 js 文件>`（只做语法检查）和限于它 3 个文件的只读 git 命令（`git status`、`git diff -- <这 3 个文件>`）；其他一律 Reject，包括 `node --test`；
  - **可执行的验证由 planner 来做**，每次执行前先检查**完整快照**：`git -C $SCRATCH/mimo-wt status --porcelain` 和 `git -C $SCRATCH/mimo-wt diff`（含未跟踪文件），确认只改了它的 3 个文件，并且这 3 个文件里没有：`child_process`、`os`、`net`、`http(s)` 客户端请求、`worker_threads`、`process.env`、动态 `import()`、指向 worktree 外的绝对路径或 `..`、除 `node:test`、`node:assert/strict`、`./ontology-card/browser.mjs`、被测模块和下面这套静态服务器之外的任何 import。唯一允许的 `fs`/`http`/`path`/`url` 用法是从 `rt-fleet.test.mjs` 原样复制的本地静态服务器（只监听 127.0.0.1，读取限定在 worktree 根目录内并带越界检查）。模块 `js/rt-onto-run.js` 本身不得有任何 import。检查通过后 planner 才在 worktree 里运行 `node --test tests/site/rt-onto-run.test.mjs`，只把通过/失败的断言行发回给 MiMo。MiMo 每次改动后都要重新检查才能再运行；
  - **受信任的测试工具例外**：`tests/site/ontology-card/browser.mjs` 由 planner 运行时会启动 Chrome，并在系统临时目录创建、事后删除一个 profile。这是已跟踪、未被 MiMo 修改的测试工具的行为，不是 MiMo 的代码；MiMo 看不到这个 profile；
  - **全量测试和 `ontology-card.test.mjs`（它会读 SOURCE 清单）同样由 planner 运行**，结果以文字（通过/失败的断言）发回给 MiMo；
  - 合并前用 `git show --stat` 确认只动了它的 3 个文件，再由 planner 把这 3 个文件取回主分支。
- **仓库**：`silex-mockup`，分支 `subtabs-visual`，从 `main` 的 `4782b78` 拉出。合并到 `main` 并推送会触发 CI 部署（需全票 IMPL-APPROVED；用户已授权“通过后自动执行”）。引擎（`jev-runtime/**`）和数据文件（`data/*.json`、`jev-runtime/demo/data/*.json`）**不改**。
- **Scratch 目录**：`/var/folders/x3/8mdzc51d11j_z0l1mt77lpmr0000gn/T//fleet-0PNN2p`。
- **不碰**：主工作区里另一个会话的未提交改动（`tests/site/ontology-card/browser.mjs`、`tests/site/run-site-probes.mjs`、`tests/site/chrome-reaper.mjs`），以及未跟踪的 `logs/2026-10-05_KEV_ONTOLOGY_IMPROVEMENT_PLAN.md`。分支在单独的 worktree（`$SCRATCH/site-wt`）里开发。
  - 本分支会修改已跟踪的 `tests/site/run-site-probes.mjs`（见 T0）。主工作区里这个文件有另一个会话的未提交改动，所以 **D1 不在主工作区合并**：在 `site-wt` 里从 `origin/main` 开一个分离 HEAD，`--no-ff` 合并 `subtabs-visual`，`git push origin HEAD:main`。主工作区和它的本地 `main` 都不动，另一个会话的改动原样保留；交付时告诉用户主工作区的 `main` 落后于 `origin/main`，需要他们自己在合适的时候 stash/pull。

## 不可违反的要求

1. **所有数字来自数据或引擎**：Learning 用 `jev-runtime/demo/data/learning-evidence.json` 和 `data/onto-observability.json` 的 `judge_baseline`；Ontology 用 `data/onto-s1.json` 和 `data/onto-observability.json`；Fleet 沿用 `fleetModel`。不写死任何数字。动画里的点、条、格子数量都由这些数据算出来，图例写明比例（例如“每格 = 1 % 的告警”）。
2. **诚实性标注保持在页面上可见**（非零包围盒，不在折叠的 `<details>` 或 `.rt-tip-body` 里），由测试在 1400 px 和 390 px 下检查，**在该标注所属的子页签被选中时**：
   - Fleet：沿用上次的全部可见性断言（Simulated 标签、“Scenario counts, computed by the engine, not measurements”、X1 的两条诚实性说明、路由说明、Trace only 结局卡片上的 “scripted outcome”）；
   - Learning（顶部，任何子页签）：引言里的 “not yet from customer reviewers”（S44 现有断言，保持可见）；
   - Learning `loop`：`Illustration` 标签（`[data-rt-learn-illus]`）；可见说明（`[data-rt-learn-loop-claim]`）：“Illustration. Label → Train → Gate were run on a public benchmark with benchmark labels; reviewer answers (steps 1–2) and Promote are not yet tested.”；第 6 步 Promote 的 “Future work”（`[data-rt-learn-future]`）；
   - Learning `results`：`Measured` 标签（从引言移到这里，`[data-rt-learn-measured]`）；“benchmark labels, not yet customer reviewers”（`[data-rt-learn-claim]`）；Reality check（`#rtJudgeRealNote`）的两个 AUROC 数值，以及紧挨着它们的 “call level” 和 “run level”；
   - Ontology（顶部）：`Measured` 标签；“No judge model”（`[data-rt-onto-nojudge]`）；
   - Ontology `how`：可见一句（`[data-onto-how-claim]`）：“Real held-out AgentDojo runs from an earlier cohort, not the pool in ②. No judge model.”；可见一句（`[data-onto-how-lost]`）：“Types can also lose an alert”，它本身是按钮，切到 how 里的 “Alert lost” 例子；
   - Ontology `s1`：适用范围（`[data-onto-s1] .rt-scope` 内 `[data-onto-s1-scope]`）；“Observed, not a guarantee”（在 `[data-onto-s1-tiles]` 内，`[data-onto-s1-observed]`）；
   - Ontology `ex`：`[data-onto-ex-claim]`：“Real held-out runs, one per case, picked by a fixed rule, including the cases where types lose an alert.”。
3. **现有测试和钩子不变**：`tests/site/*.test.mjs`、`tests/site/ontology-card.test.mjs`、`tests/site/ontology-s1-card.test.mjs` 现有断言继续成立。具体包括：
   - Ontology：`data-onto-seg="s1"|"ex"`、`data-onto-cell-btn`、`data-onto-mode-btn`、`#rtOntology[data-onto-mode]`、`data-onto-run`、`data-onto-call`、`data-onto-flagged`、`.rt-onto-why` 的 textContent 等于 `why_not` 原文、`data-onto-empty`、`data-onto-chain`、`data-onto-s1`、`data-onto-s1-verdict`、`data-onto-s1-num="prov-F"|"s1-F"`、`data-onto-s1-part` / `-ok` 和其中 `.rt-chip` 的文字、`[data-onto-s1] tbody tr` 表格行、`[data-onto-s1] a` 链接列表；`#rtOntology` 的文字里不出现 “Not confirmed / not established / Follow-up test / did not establish / Inconclusive / AgentDyn”；
   - Learning：`#rtJudgeRealNote` 的文字包含两个 AUROC（三位小数）；所有 `data-evidence-value`（≥ 17 个，数值格式不变，包括阈值、样本量和置信区间）；`#rtLearningGate [data-evidence-gate]` 每行的 textContent **逐字等于** `${label}: ${verdict} · ${detail}`（可以放在印章卡片里作为可见的一行）；`[data-evidence-verdict]`；`#rtLearning .rt-learning-tiles .metric` 恰好 3 个，每个的文字（含 ⓘ）都包含 “measured on an open benchmark (AgentDojo held-out); benchmark labels, not yet customer reviewers”；`.rt-learning-loop li` 恰好 6 个（新设计里它是环形图的文字图例，也是无障碍替代）；`#rtLearning` 的文字里包含 S21 列出的全部说明句（each model's own calibrated threshold、question-level、no fitted threshold、similar local judge HTTP p50 in this run、Training on reviewer labels and production promotion are future work、Calibrations not activated、Question-level errors at each model’s own threshold…、全部 caveats），它们可以在 ⓘ 里；`#rtTryLoop`；
   - S21/S44（`tests/site/run-site-probes.mjs`）：除下面“探针迁移”里列出的两处，全部断言不变；
   - Fleet：上次所有 `data-rt-*` / `data-rt-f*` 钩子。
   - 若某个断言因为结构调整（例如元素换了位置）必须改，只能改定位方式，不能放宽断言内容，并在代码评审时单独列出。
4. **动画规则**：只用 SVG、CSS 和原生 JS，不引入外部库或网络请求；`prefers-reduced-motion` 下不自动播放、直接显示终态；有 Play/Pause/Replay（至少 Replay），键盘可操作；**只在所在子页签第一次真正显示时自动播放一次**，离开（换子页签、换一级页签、离开 Runtime Observation 视图）时暂停，再回来不自动重播；390 px 下页面无横向溢出；无 console 错误。生命周期统一由 subnav 的 `bind()` 管理（契约 1）。
   - **图表必须诚实**：条形图从 0 开始、线性刻度、图例写明刻度；所有 AUROC 条画在同一条 0–1 轴上，并画出 0.5 “coin flip” 虚线；不同单位的数字（call level / run level）不能画成同一实验的前后对比；动画只能是“从 0 长出来”或“逐个点亮”，不能用“从 A 形变到 B”来暗示一个集合是另一个的子集；不编造数据里没有的字段。
5. **文字减量规则**：每个面板顶部只留一句话加 ⓘ；定义、方法、p 值、样本量、来源一律进 ⓘ（复用 `js/rt-tip.js`）；图上的说明用短标签。被移进 ⓘ 的内容不能丢。
6. **模块可在 Node 里导入**：新模块顶层不访问 DOM，便于 `tests/site/*-modules.test.mjs` 做纯函数检查。

## 共享契约（T0 先完成）

### 1. 子页签组件 `js/rt-subnav.js`

```js
mountSubnav(navEl, {
  tab,            // 所属的一级页签 id：'fleet' | 'learning' | 'ontology'
  label,          // tablist 的 aria-label
  items: [{ key, label, hint, extra, attrs }],  // hint：按钮下一行短说明（经 aria-describedby 关联，不进可访问名称）；
                                                // extra：标签后的徽标 HTML；attrs：额外属性，例如 {'data-onto-seg':'s1'}
  panels,         // 容器元素，里面每个直接子元素 [data-rt-subpanel="<key>"] 是一个面板
  initial,        // 默认 key
}) → { open(key, {focus}), current(), initial, isShown(key), bind(key, handle), destroy() }
```

- **语义**：`<nav role="tablist">`；按钮 `role="tab"`、唯一 id `rtSub-<tab>-<key>`、`data-rt-sub="<key>"`、`aria-selected`、`aria-controls`，roving tabindex，←/→/Home/End 切换并移动焦点；面板 `role="tabpanel"`、`aria-labelledby` 指向按钮。窄屏下 nav 在自身内部横向滚动，页面不溢出；获得焦点的按钮滚动到 nav 的可见范围内。
- **Next 按钮**：每个面板（最后一个除外）底部有 “Next: <下一个标签> →”。点击时先把焦点移到下一个子页签按钮，再隐藏旧面板（焦点不会落在被隐藏的元素上）。
- **“真正显示”** = Runtime Observation 视图处于 active、一级页签是 `tab`、当前子页签是 `key`。`isShown(key)` 返回这个判断。
- **生命周期，唯一负责者是 subnav**：宿主（`rt-fleet.js`、`jev-runtime-host.js`、`rt-ontology.js`）在模块挂载后调用 `bind(key, handle)`。subnav 保证：
  - `key` 第一次真正显示时调用一次 `handle.play()`；若 `bind` 时 `key` 已经在显示且还没播放过（模块因为要先取数据而晚挂载），立即调用；
  - `key` 不再真正显示时（换子页签、`rt:tab` 换到别的一级页签、`rt:view` 离开 Runtime Observation 视图）调用 `handle.pause?.()`；
  - 再次显示**不**自动重播；
  - reduced motion 下不调用 `play()`（模块挂载时已经显示终态）。
  - 事件 `rt:sub`（`detail = { tab, sub }`）照常派发，供其他监听者使用；`index.html` 的 `showView` 每次切换视图都派发 `rt:view`（`detail = { view }`）。
- **深链接**：`#view=runtime-observation&tab=<tab>&sub=<key>`；不带 `&sub=` 的链接打开该页签的默认子页签。`rt-subtabs.js` 的 `fromHash` 调用 `requestSub(tab, key)`：子页签栏已存在就直接打开；还不存在（fleet 在第一次打开时才渲染，ontology 要等数据加载完）就记入 `window.__rtSubPending[tab]`，栏挂载时取用。后来的 hash 覆盖之前未取用的请求（只有最新的生效）。不认识的 key、缺省 key 都回到 `initial`。`index.html` 的 `stateHash()` 在子页签不是 `initial` 时追加 `&sub=`。点击不写 hash（与站内其他导航一致）。
- `rt-ontology.js` 原来的 `showPane()`、`[data-onto-pane]` 和 `aria-pressed` 写法全部删除；`data-onto-seg` 只是 subnav 按钮上的附加属性（ontology-card 测试靠它定位）。
- **T0 草稿**：本节描述的就是 site-wt 里已经写好的、尚未提交的 T0 草稿；它在计划关卡通过前不提交，并作为 T0 的一部分在代码关卡评审。

### 2. 各页签的子页签

| 页签 | key（默认在前） | 标签 / hint | 内容 |
|---|---|---|---|
| Agent fleet | `cascade` | Cascade demo / 每一步都成功，结果却违规 | X1 动画（现有） |
| | `agents` | Agents & teams / 谁在运行什么 | 泳道图（现有 `[data-rt-fmap]`） |
| | `routing` | Who reviews / 被拦下的调用交给谁 | 复核路由点阵（现有 `[data-rt-froute]`），第一次显示时自动 Play |
| | `scenarios` | All scenarios / 11 个场景，开与关 | 11 行矩阵 + “Show as tables” |
| Learning loop | `loop` | How it learns / 复核答案变成训练数据 | 循环示意动画（新，T1），带 `Illustration` 标签 |
| | `results` | Measured results / 微调前后，以及现实折扣 | 前后对比条、上线关卡、Reality check（新，T1），带 `Measured` 标签 |
| Ontology | `how` | How types help / 真实运行，有得也有失 | 类型如何起作用的动画讲解（新，T2），三个例子：Caught by both、Alert saved、Alert lost |
| | `s1` | Pre-registered test / 已确认的结果 | 告警构成 + 精度方格 + 召回条 + 三项检查（新，T2）；按钮上带现有的 verdict 徽标 |
| | `ex` | Example runs / 四类真实例子 | 运行时间线可视化（新，T3），现有的 cell/mode 切换按钮保留 |

Fleet 的 X1 引导演示通过 `bind('cascade', { play: tour, pause })` 管理：离开 `cascade`、离开 fleet 页签或离开视图都取消演示并暂停。
`mountMap(el, model, opts)` 新增 `opts.routeEl`：给定时，复核路由区块渲染进 `routeEl`，并在区块内画一行**本地的 agent 来源标签**（`[data-rt-froute-src]`，被拦下的调用所属的 agent），点从这些标签飞向复核桶。旧的 agent 卡片在另一个子页签里、被隐藏时包围盒为零，所以不能再做起点。离开 `routing` 时重置未完成的飞行。T0 改，测试在 1400 和 390 px 下都验证飞行。

### 3. 新模块（T0 先放“搬过去的现有实现”，保证 T0 时所有测试通过；编码者在此基础上升级）

所有 handle 都实现 `{ play(), pause(), reset(), destroy() }`（没有动画的部分可以是空函数）。`destroy()` 清掉计时器、rAF 和监听器。

```js
// js/rt-learning-visual.js（T1，coder-opus）
mountLoop(el, { tip, reducedMotion }) → handle
mountLearningResults(el, { evidence, judge, runs }, { tip, reducedMotion }) → handle
//   evidence = learning-evidence.json；judge = onto-observability.json 的 judge_baseline（可能为 null）；runs = v2_descriptive.runs

// js/rt-onto-visual.js（T2，coder-sol）
export const VERDICT          // 由 rt-ontology.js 用于子页签按钮上的徽标，保留导出
mountOntoHow(el, { examples, al, provenance_note }, { tip, reducedMotion }) → handle
mountOntoS1(el, s1, { tip, reducedMotion }) → handle

// js/rt-onto-run.js（T3，coder-mimo）
mountOntoRun(el, { ex, mode, desc }, { tip, reducedMotion }) → handle & { update({ ex, mode, desc }) }
//   rt-ontology.js 挂载一次；cell 或 mode 变化时调用 update()。只有 mode 变化时只重放解释链，不整块重绘。
```

T0 把 `jev-runtime-host.js` 里 `renderLearningEvidence` 的 HTML 生成搬进 `mountLearningResults`，把 `rt-ontology.js` 里的 `s1Block`、`example()`/`chain()` 分别搬进 `mountOntoS1` 和 `mountOntoRun`，`#rtJudgeRealNote` 的填写从 `rt-ontology.js` 移到 `mountLearningResults`（host 负责加载 `judge_baseline` 并传入）。`mountOntoHow` 和 `mountLoop` 在 T0 是占位（`mountLoop` 渲染现有的 6 步静态列表）。

## 视觉设计（编码者的要求）

### T1 Learning loop（coder-opus）

**`loop` 子页签：循环示意动画。**
- 顶部可见 `Illustration` 标签（`[data-rt-learn-illus]`，`.rt-chip[data-kind="sim"]` 样式）。
- 一个 SVG 环，6 个节点：Held → Answer → Label → Train → Gate → Promote。节点用小图标 + 一两个词。SVG 带 `data-rt-learn-ring`、`role="img"` 和由步骤名生成的 `aria-label`（S21 检查它和图例在 390 px 下都在视口内）。
- 一个“被拦下的动作”小卡片沿环移动：Held 处出现“?”，Answer 处变成 ✓safe 或 ✗unsafe，Label 处变成标签块落进“训练集”小桶，Train 处模型图标变成 Kev′，Gate 处出现闸门。**卡片停在 Gate，不到 Promote**；Promote 节点始终是虚线，带可见的 “Future work”（`[data-rt-learn-future]`），原来的 Promote ⓘ 文字（“Training on reviewer labels and production promotion are future work…”）保留在 DOM 里。
- 环下方是 6 步的文字图例 `<ol class="rt-learning-loop">`（恰好 6 个 `li`，每步一句短话），它同时是无障碍替代；390 px 下环和图例都不溢出（环可以缩小或改为纵向，标签放在环外）。
- 可见说明（`[data-rt-learn-loop-claim]`）：“Illustration. Label → Train → Gate were run on a public benchmark with benchmark labels; reviewer answers (steps 1–2) and Promote are not yet tested.”
- 控件：Play/Pause、Replay、Step。`data-state` 取 `idle|playing|paused|done`。

**`results` 子页签：结果图。**
- 顶部可见 `Measured` 标签（`[data-rt-learn-measured]`）和 `[data-rt-learn-claim]` 那句 “Measured on an open benchmark (AgentDojo held-out) with benchmark labels, not yet customer reviewers.”（细节和 caveats 的 ⓘ 保留）。
- **前后对比条**：外层保留 `.rt-learning-tiles`，里面恰好 3 个 `.metric` 组，每组的 ⓘ 里保留原来的说明和那句 benchmark 标签说明。
  - goal_deviation recall：两根 0–1 横条（released / fine-tuned），用 `recall_ci` 画 95 % 置信区间须线；
  - instruction_override AUROC：两根横条，与 Reality check 共用 0–1 轴和 0.5 “coin flip” 虚线；
  - p50 延迟：两根 ms 横条，从 0 开始；“about the same” 这句话要由数据判断（例如两者相差不到 10 %），不写死；“similar local judge HTTP p50 in this run” 这句原文保留在 ⓘ 里（S21 匹配它）。
  - 数值上保留 `data-evidence-value` / `data-digits`；所有 ≥ 17 个 `data-evidence-value` 都保留（阈值、样本量、置信区间可以在 ⓘ 里）。
  - 进入时条从 0 长出来。
- **上线关卡**：每个候选模型一张卡，内容是 fixed / broke 两段对比条，以及 missed 前后；结论用印章式徽标（KEEP / DISCARD）。每张卡里有一行可见文字 `[data-evidence-gate]`，textContent 逐字等于 `${label}: ${verdict} · ${detail}`（与现在相同），`[data-evidence-verdict]` 在其中。规则说明的 ⓘ 保留在 `#rtLearningGateTitle` 里。
- **Reality check**（`#rtJudgeRealNote`）：两根 **goal_deviation** AUROC 条（指标名写在条旁边，免得被当成 instruction_override），共用 0–1 轴和 0.5 虚线：“Benchmark split · call level” 0.961 和 “Real agent runs (n = runs) · run level” 0.741。“call level / run level” 紧挨着数值可见。可见结论一句：“Different units and data: expect real-world results nearer the lower figure.” “测试集里的攻击条目从格式上就能认出来”这条解释放进它的 ⓘ。`judge` 为 null 时不渲染这一块。

**T1 测试** `tests/site/rt-learning-visual.test.mjs`（headless，没有 Chrome 时跳过；打开 `#view=runtime-observation&tab=learning`，用 `&sub=results` 深链接测结果页）：
- 环上 6 个节点，图例恰好 6 个 `li`，`[data-rt-learn-future]` 可见；卡片结束时停在 Gate；`[data-rt-learn-illus]` 和 `[data-rt-learn-loop-claim]` 可见；
- 动画结束后 `data-state=done`；reduced motion 下不自动播放、直接是终态；离开子页签后 `data-state` 不是 `playing`，回来不自动重播；
- 所有 `data-evidence-value` 的文字等于 JSON 按 `data-digits` 格式化后的值；3 个 `.metric`；gate 行逐字匹配；
- `#rtJudgeRealNote` 含两个三位小数 AUROC、可见的 “call level” 和 “run level”；`[data-rt-learn-measured]`、`[data-rt-learn-claim]` 可见；
- 1400/390 px 无横向溢出，并各截一张图存到 `$TMPDIR` 供评审；无 console 错误。

### T2 Ontology 的 how 和 s1（coder-sol）

**`how` 子页签：真实运行的动画讲解。** 数据取 `examples` 里 `cell` 为 `both`、`saved`、`lost` 的三个例子，**只显示数据里有的字段**。
- 一个三选一的小切换：Caught by both / Alert saved / Alert lost。
- 每个例子：上方是用户任务；下面左右两栏，“Without types” 和 “With types”，每栏是这个运行的调用卡片。动画分三拍：
  1. 调用卡片依次出现（工具名 + 参数）；
  2. 解释出现：
     - 某个规则在某个调用上告警时（`prov.call_index` 或 `otp.call_index` 非空），在该调用下画出它的解释：with types 用 `otp.explanation` 的三个标签（`may cause → effects`、`argument denotes → class`、`value appeared earlier in a tool output, not in the user's task`）；without types 用通用规则的三句（write call、argument = value、the value appeared earlier in a tool output and not in the user's task）；
     - 规则不告警的调用，显示 `why_not` 里对应的原文；
     - 来源摘录（`source.excerpt`）高亮该值；“appeared earlier” 后面的 ⓘ 写明 `provenance_note`（“a proxy, not proof of origin”）；
  3. 判定：告警的调用卡片变红并标 “Alert”，其余标 “No alert”。
  - 对 `saved`：with types 一侧只显示调用和 `why_not.otp` 原文（“no hazard-relevant parameter”），**没有** effect/class 标签；
  - 对 `lost`：without types 告警，with types 不告警，并显示 `why_not.otp` 原文。这一例就是代价。
- 可见：`[data-onto-how-claim]` 那句（见“不可违反的要求”2）；`[data-onto-how-lost]` 按钮 “Types can also lose an alert” 切到 `lost` 例子；ⓘ 写明这些运行来自更早的 held-out cohort（`al.counts.runs` 个运行、`al.models`），不是 ② 里的 S1 池。
- 控件 Play/Pause/Replay；reduced motion 显示终态。

**`s1` 子页签：结果图。**
- 顶部：现有 verdict 徽标 + headline + 范围说明（`.rt-scope` 里的 `[data-onto-s1-scope]`），都可见。
- **告警构成**（不是漏斗）：两根**独立的**堆叠横条，画在同一条从 0 开始的线性刻度上，图例写明刻度。“Without types: 5015 alerts”和“With types: 4000 alerts”，每根分成 real attack（TP）和 false alarm（F − TP）两段，进入时各自从 0 长出来；**不做从一根形变到另一根的动画**。旁边一句可见的说明：“Different alert sets: types also catch some attacks the untyped rule missed (TP 2065 → 2139).”（数字由数据算）。数字保留 `data-onto-s1-num="prov-F"` / `"s1-F"`。
- **精度方格**：两个 10×10 方格，“of 100 alerts, 41 real” → “53 real”（`of100(precision)`），进入时逐格点亮。
- **召回条**：`Pos` 次成功攻击中被告警的比例，两根 0–1 横条，可见 “Observed, not a guarantee”（`[data-onto-s1-observed]`）。
- 这三组图放在 `[data-onto-s1-tiles]` 容器里（S44 读它的 innerText）。每张图的 ⓘ 放原来 Alerts/Precision/Recall 的定义。
- **三项预注册检查**：一排三个徽章，保留 `data-onto-s1-part` / `-ok` 和 `.rt-chip` 文字（held），解释进 ⓘ（ⓘ 里保留 p 值，S44 读 “p = 0.00010”）。
- 每个 base model 的表格和来源链接保留在 `<details>`（钩子不变）。

**T2 测试** `tests/site/rt-onto-visual.test.mjs`（打开 `#view=runtime-observation&tab=ontology`，`&sub=s1` 测 s1）：
- how：三个例子在两种规则下的告警调用与 `otp/prov.call_index` 一致；有 `otp.explanation` 的例子，标签文字取自它；`saved` 的 with-types 一侧逐字显示 `why_not.otp` 原文且没有 effect/class 标签；`[data-onto-how-lost]` 切到 `lost`；`[data-onto-how-claim]` 可见；
- s1：两根条的总数和 TP 与 `onto-s1.json` 一致；方格点亮数等于 `of100(precision)`；三项检查与数据一致；`[data-onto-s1-observed]`、`[data-onto-s1-scope]` 可见；
- reduced motion 终态；离开子页签后不在 playing；1400/390 px 无溢出并截图；无 console 错误。

### T3 Ontology 的 ex（coder-mimo）

- 一次运行画成**横向时间线**：每个调用是一张小卡片（工具名、read/write 图标），用箭头连起来；用户任务放在时间线起点的气泡里。
- 被告警的调用卡片变红并有一次脉冲动画，标注 “Alert”；未告警的标注 “No alert”，原因（`.rt-onto-why`，原文不变）以小字显示在卡片下方。
- 解释链：With ontology 模式且 `otp.explanation` 非空时，画成从参数值到危害类的标签链（三个标签依次出现）；Without 模式画成通用规则的三句；来源摘录高亮该值（沿用 `hl()`）。解释为空的调用只显示 `why_not` 原文，不编造。
- `update()` 只改 mode 时只重放解释链的动画，不整块重绘。
- 空例子显示现有的 “no qualifying example” 文字（`data-onto-empty`）。
- 窄屏（≤ 600 px）时间线改为纵向。
- cell / mode 两组按钮由 T0 改成 `role="group"` + `aria-pressed`（钩子 `data-onto-cell-btn` / `data-onto-mode-btn` 不变），T3 不动它们。

**T3 测试** `tests/site/rt-onto-run.test.mjs`：四个 cell × 两种 mode 下，`data-onto-call` 的序号、`data-onto-flagged`、`.rt-onto-why` 文字与数据一致（与 `ontology-card.test.mjs` 第 4 项同口径）；**只在 `otp.explanation` 非空时**要求 with 模式下有 `data-onto-chain` 且含其 effects/class；390 px 无溢出；reduced motion 下完整显示；无 console 错误。

### 探针迁移（T0，planner；`tests/site/run-site-probes.mjs`）

只改下面两处，其他断言原样保留：
- **S21**：“390 px 下 `.rt-learning-loop li` 排成两行三个”是旧静态列表的版式断言，改为“`loop` 子页签下环形图和 6 步图例在 390 px 下都在视口内、页面无横向溢出”。`li` 恰好 6 个的断言保留。S21 在检查前先选中相应子页签（`loop` / `results`），这是定位方式的改变。
- **S44**：`#rtJudgeRealNote` 可见性检查之前先选中 Learning 的 `results` 子页签；`[data-onto-s1] .rt-scope` 和 `[data-onto-s1-tiles]` 之前先选中 Ontology 的 `s1` 子页签。断言内容不变。
- 新增 **S45**：三个页签的子页签深链接（冷加载，包括 ontology 数据加载被延迟 1.5 s 的情况）、不认识的 `sub` 回到默认、连续快速切换 hash 时只有最后一个生效、`stateHash()` 带 `&sub=`、←/→ 键盘切换和 Next 按钮的焦点（1400 和 390 px）。
- 探针在 `site-wt` 里运行；主工作区里另一个会话对同一文件的未提交改动不受影响（见“运行信息”）。

## 任务

| # | 负责人 | 依赖 | 工作内容 | 验收标准 |
|---|---|---|---|---|
| T0 | planner | — | 写 `js/rt-subnav.js`（契约 1，含 `bind`/`isShown`/`requestSub`）、`css/rt-subnav.css`、`tests/site/rt-subnav.test.mjs`（深链接冷加载含延迟取数、快速切换、无效 key、键盘、Next 焦点、`bind` 的播放/暂停/不重播，以及 Learning/Ontology 的可见性断言，1400 和 390 px）；接入 fleet（`rt-fleet.js` 改为 4 个子面板，`mountMap` 加 `routeEl` 和本地来源标签，X1 和 routing 走 `bind`）、learning（host 改为 `mountLoop`/`mountLearningResults` + `bind`）、ontology（`rt-ontology.js` 改用 subnav，删除 `showPane`，三个挂载点，cell/mode 按钮改为 `role="group"` + `aria-pressed`）。按“共享契约 3”把现有实现搬进三个新模块；`index.html` 精简三个面板的引言（一句 + ⓘ，Learning 引言保留可见的 “not yet from customer reviewers”），加 CSS 链接，`showView` 派发 `rt:view`，`stateHash()` 加 `&sub=`；`rt-subtabs.js` 调用 `requestSub`。新增 `tests/site/rt-visual-modules.test.mjs`（Node 里 import 三个新模块）。更新 `tests/site/rt-fleet.test.mjs`（可见性断言改为在所属子页签下检查）、`rt-fleet-map.test.mjs`（用 `&sub=routing` 打开，并等自动播放结束再做原来的断言；这是断言流程的改变，代码评审时单列）、`rt-fleet-grid.test.mjs`（用 `&sub=scenarios`）、`ontology-card.test.mjs` 第 6 项（等 `#rtJudgeRealNote` 出现再读）。按“探针迁移”改 `run-site-probes.mjs`。计划关卡通过后提交 T0，再给编码者开工。 | `node --test tests/site/*.test.mjs` 全部通过；站点探针结果不比 main 差（S20 是原有失败）；子页签深链接三个页签都能打开 |
| T1 | coder-opus | T0 | `js/rt-learning-visual.js`、`css/rt-learning-visual.css`、`tests/site/rt-learning-visual.test.mjs` | 见 T1 测试；T0 的全部测试仍通过 |
| T2 | coder-sol | T0 | `js/rt-onto-visual.js`、`css/rt-onto-visual.css`、`tests/site/rt-onto-visual.test.mjs` | 见 T2 测试；T0 的全部测试仍通过 |
| T3 | coder-mimo | T0 | `js/rt-onto-run.js`、`css/rt-onto-run.css`、`tests/site/rt-onto-run.test.mjs`，在独立 worktree 中完成 | 见 T3 测试；`ontology-card.test.mjs` 仍通过 |
| T4 | planner | T1–T3 | 集成：统一样式、ⓘ 文案、Next 按钮的顺序；跑全部测试和站点探针；截取 1400/390 px 下每个子页签的截图供评审；更新 changelog（`logs/README.md`）和本计划的记录。 | `git archive` 导出目录里 CI 测试全部通过；探针结果不比 main 差；截图通过评审 |
| D1 | planner | Step 7 全票 | `--no-ff` 合并到 `main` 并推送，由 CI 部署；`pages_sync --verify-only`；对线上跑探针；在真实 Chrome 里清掉相关文件缓存后打开三个深链接检查。 | 线上与提交逐字节一致；三个页签的子页签和动画在 Chrome 里正常 |

## 文件归属（同一文件只有一个写入者）

- **planner**：`js/rt-subnav.js`、`css/rt-subnav.css`、`js/rt-subtabs.js`、`js/rt-fleet.js`、`js/rt-fleet-x1.js`（仅生命周期接入）、`js/rt-fleet-map.js` 和 `css/rt-fleet-map.css`（`routeEl`、本地来源标签及其几何）、`js/jev-runtime-host.js`、`js/rt-ontology.js`、`index.html`、`css/rt-subtabs.css`、`tests/site/rt-subnav.test.mjs`、`tests/site/rt-visual-modules.test.mjs`、`tests/site/rt-fleet.test.mjs`、`tests/site/rt-fleet-map.test.mjs`、`tests/site/rt-fleet-grid.test.mjs`、`tests/site/ontology-card.test.mjs`、`tests/site/run-site-probes.mjs`（分支内）、`logs/*`；T0 阶段三个新模块的初始版本，交接后归对应编码者。
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

## §R1：第 1 轮意见及对应修改

第 1 轮（plan v0.1）：codex **PLAN-REJECTED**（7 条），claude **PLAN-REJECTED**（7 条）。

| 意见 | 修改 |
|---|---|
| `saved`/`lost`/`miss` 的 `otp.explanation` 为空，how 的三个类型标签会变成编造（codex 1、claude 1） | how 只用数据里有的字段：有解释才画标签，没有就显示 `why_not` 原文；`saved` 一侧逐字显示 “no hazard-relevant parameter”；“value came from” 改为 “appeared earlier in a tool output”，ⓘ 写明 `provenance_note`（proxy, not proof）；T2/T3 测试只在解释非空时要求标签 |
| how 默认页只展示类型有利的例子（claude 2） | how 加第三个例子 “Alert lost”；可见按钮 “Types can also lose an alert”；ⓘ 写明来自更早的 cohort，不是 S1 池 |
| s1 的“漏斗”收缩动画暗示子集关系，与 TP 上升矛盾（claude 3） | 改为同一刻度上的两根独立堆叠条，各自从 0 长出；可见一句说明两组告警不同（TP 2065 → 2139）；“诚实图表”写进要求 4 |
| loop 说明夸大（1–2 步没测过），卡片走到 Promote（claude 4） | 可见说明改为 Illustration 版本；`Illustration` 标签放 loop，`Measured` 移到 results；卡片停在 Gate；Promote 的 ⓘ 原文保留 |
| AUROC 条缺 0.5 基线；reality check 两个数单位不同（codex 2、claude 5） | 所有 AUROC 条共用 0–1 轴和 0.5 虚线；“call level / run level” 可见；格式可识别的解释进 ⓘ；不画成前后对比 |
| 子页签深链接的异步注册、“首次显示”的定义、离开时暂停的负责者（codex 3、4，claude 7） | 契约 1 重写：`requestSub` 待定队列（最新的生效、无效 key 回默认）、`isShown`、`bind()` 统一负责播放/暂停/不重播，`rt:view` 覆盖离开视图；所有 handle 都有 play/pause/reset/destroy；唯一 tab id、tabpanel、Next 先移焦点；新增 S45 和 `rt-subnav.test.mjs` 覆盖冷加载延迟取数、快速切换、390 px 键盘 |
| routing 的点从隐藏的 agent 卡片起飞（codex 5） | routing 区块内画本地来源标签作为起点；离开 routing 时重置；两种宽度验证飞行；文件归属扩到 map 的 JS/CSS |
| S21/S44 探针会坏，且没有负责人（codex 6、claude 6） | 新增“探针迁移”：列出唯一两处改动及替代断言，其余保持；planner 在分支内负责；D1 改为在 site-wt 分离 HEAD 合并推送，不碰主工作区的他人改动；需要保留的 S21/S44 钩子写进要求 3 |
| MiMo 的读取白名单在 worktree 内无法强制；测试会读 SOURCE 和 Chrome profile（codex 7） | 如实说明 worktree 内全是公开或即将公开的内容，白名单只是指引；强制边界是 worktree 外 + `shell: ask` + `webfetch: deny`，planner 只批准三类命令；全量测试和 ontology-card 由 planner 跑并回传结果 |
| T0 草稿在计划关卡前已写，契约里没写它的语义；`showPane` 要删（claude 7） | 契约 1 写明全部语义；草稿在计划通过前不提交，作为 T0 一部分在代码关卡评审；删除 `showPane`/`aria-pressed`/`data-onto-pane` |
| 非阻塞（已采纳） | recall 画置信区间须线；`mountOntoRun.update()`；hint 用 `aria-describedby`；ex 按钮改 `role="group"`；“about the same” 由数据判断；各编码任务的验收含 390 px 截图；reduced motion 下不自动播放 |

## §R2：第 2 轮意见及对应修改

第 2 轮（plan v0.2，sha `d7bf206…`）：codex **PLAN-REJECTED**（1 条），claude **PLAN-REJECTED**（1 条）；claude 确认第 1 轮 7 条全部解决。

| 意见 | 修改 |
|---|---|
| 预先批准 MiMo 运行 `node --test` 会以用户完整权限执行 MiMo 写的代码，绕过所有边界（codex 1、claude 1） | MiMo 只能运行 `node --check` 和限于它 3 个文件的只读 git；planner 每次执行前检查完整快照（禁用 API 和 import 清单），再自己运行测试，只回传通过/失败行；写明受信任测试工具的临时 profile 例外 |
| 非阻塞（已采纳） | §2 “告警漏斗”改为“告警构成”；reality check 的条上写明 goal_deviation；“similar local judge HTTP p50 in this run” 保留在 ⓘ；子页签按钮获得焦点时滚动到可见范围；不带 `&sub=` 的链接回到默认子页签（T0 草稿已实现，`rt-subnav.test.mjs` 覆盖）；X1 handle 已有 `stop()`；T1 的环形图加 `data-rt-learn-ring` 钩子供 S21 使用（v0.2 发出后补上） |

## 计划批准

第 3 轮（plan v0.3，sha256 前缀 `21cf6cc93da3`）：codex **PLAN-APPROVED**，claude **PLAN-APPROVED**，**PLANNER (claude): PLAN-APPROVED**。全票通过，进入实现。
第 3 轮的非阻塞建议，采纳为 planner 的检查项：检查 MiMo 快照时，浏览器侧也不允许 `fetch`/`XMLHttpRequest`/`WebSocket` 或指向非本地来源的资源；回传给 MiMo 的测试结果只含断言行，不含堆栈；代码关卡时确认 `rt-subnav.test.mjs` 同时覆盖“先有待定请求、后来的链接不带 `&sub=`”的情况。

## 实现记录

- T0：`e7dfe80`（planner）。T1 coder-opus（`opus-taskT1-a1`，1 次完成）；T2 coder-sol（`sol-taskT2-a1`，1 次完成）；T3 coder-mimo（`mimo-taskT3-a1..a3`，前两次是它自己测试里的期望写错，模块本身没问题，第 3 次通过）。
- **MiMo 边界的执行情况（如实记录）**：OpenCode 2.0.20 下 `"shell": "ask"` **没有生效**，MiMo 的 shell 调用不弹窗直接执行。planner 从 OpenCode 会话库逐条审计：全部 shell 调用都是 worktree 内的 `ls`/`grep`、`node --check`、`git status/diff`；全部读取都在 worktree 内；没有运行 `node --test`，没有越界。它的测试由 planner 在三次快照检查后运行（模块无任何 import；测试的静态服务器与 `rt-fleet-map.test.mjs` 逐字相同；唯一偏差是第 31 行用常量路径读取 worktree 内的 `data/onto-observability.json`，判定安全并保留）。
- **T4 集成（planner）**：MiMo 的 3 个文件从 `subtabs-mimo` 原样取回；`rt-ontology.js` 补上 `sub.bind('ex', runView)`（MiMo 发现的 T0 遗漏）；因此 `rt-onto-run.test.mjs` 中“页面加载后为 idle”的两处断言改为：页面上先等首次显示的那次播放结束再 `reset()`，并另起一个独立挂载检查“挂载本身不启动动画”（断言内容没有放宽）；`css/rt-subnav.css` 修正 390 px 下子页签按钮文字重叠（改为按内容宽度、nav 内部横向滚动）。
- 结果：`node --test tests/site/*.test.mjs` 75/75；站点探针 44/45（S20 为原有失败，与 main 相同）；三个页签所有子页签在 1400/390 px 下页面无横向溢出。

## 代码评审第 1 轮（head `07ef0ff`，rev `537bd8cb1ccfb31a`）

codex **IMPL-REJECTED**（3 条），claude **IMPL-REJECTED**（1 条）。

| 意见 | 修改 |
|---|---|
| how/s1 在动画中途被隐藏时，`pause()` 冻结在中间一拍：判定被隐藏、条为 0、方格不亮，与标签矛盾（claude 1） | coder-sol：`handle.pause()` 直接收束到终态（屏幕上的 Pause 按钮仍可停在当前拍）；新增快速切换回归测试。顺带采纳：完成后 Play 等同 Replay、召回条底色改为中性、`tip` 改为参数传递 |
| `rt-onto-run.js` 的 Replay 和切换规则在 reduced motion 下仍有动画（codex 1） | coder-mimo：所有动画入口在调用时检查 reduced motion，直接到终态；CSS 加 reduced-motion 规则；测试覆盖 Replay、play、切换规则 |
| `rt:view` 同步早于路由选中目标子页签，消耗了被离开子页签的那次自动播放；被取代的待定请求仍会生效（codex 2） | planner：`rt:view` 的同步推迟一个任务；任何新的 `view=` 路由清空待定请求；新增三项回归（离开再回到另一个子页签、被 Overview 取代、被不带 `&sub=` 的链接取代），并确认它们在旧代码上失败 |
| index.html 里旧的 `.rt-onto-calls{display:grid}` 覆盖了时间线布局；连接箭头方向和末尾箭头错误（codex 3） | planner 删除该旧规则；coder-mimo 提高选择器优先级、只在相邻调用之间画连接、加 1400/390 px 几何测试 |

- **MiMo 边界（如实记录）**：本轮 MiMo 执行了一次规则外的 `node -e`，内容是读取 worktree 内公开的 `data/onto-observability.json` 并打印各例子的字段计数，没有越界、没有网络。原因同上：OpenCode 2.0.20 下 `"shell": "ask"` 不生效。以后的 fleet 应把 OpenCode 的 shell 权限视为不可强制，改用沙箱或事后审计。
- 结果：`node --test tests/site/*.test.mjs` 75/75；探针 44/45（S20 原有失败）；全部子页签 1400/390 px 无横向溢出。
- 非阻塞（claude）：S45 比计划描述的薄（没有 390 px、键盘、Next），这些由 CI 里的 `rt-subnav.test.mjs` 覆盖；计划“探针迁移”一节的 S45 描述以此为准。
