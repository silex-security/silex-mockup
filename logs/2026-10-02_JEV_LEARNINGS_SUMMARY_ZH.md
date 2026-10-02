# 2026-10-02 改动总结：从 jev-simplified 借鉴的优化（中文）

本文总结 silex-mockup 这次按 jev-simplified 最新 “Ontology link” 改动做的优化。完整计划、5 轮计划评审和代码评审记录见 [`2026-10-02_JEV_LEARNINGS_PLAN.md`](2026-10-02_JEV_LEARNINGS_PLAN.md)。

流程：先写计划、评审，再实现、做代码评审。计划经过 Claude（规划）、DeepSeek、Codex 三方 5 轮评审，到 v5 一致通过；代码也要三方都通过后才 push。

## 起因

jev-simplified 在 10 月 2 日把 silex-mockup 的 World Model（本体优化之前的版本）复制进了它的 SOC demo，并把两者打通。复制过程中，它还修好了我们代码里原本就有的几个 bug。所以这次主要是把这些改进搬回来。

## 改动

### 1. 深链接（A）

- **新增地址**：
  - `#view=security-model&tab=<子页>&node=<节点>`：打开 World Model 并定位到节点；
  - `#view=incident&incident=<事件>`：打开某条事件；
  - `#view=workflow&workflow=<工作流>`：打开某个工作流。
  - 只要带 `node`，就打开 Ontology Graph，因为只有这个子页能定位节点。
- **页面一打开就是深链接也能用**：加载器还没就绪时，路由先把请求记下来；等加载器发出 `swm:loader-ready` 事件、或页面 `load` 后，再接着处理。
- **前进/后退**：
  - 从页面里点链接跳转时，如果当前地址为空，或者已经和画面对不上，会先把它改写成完整的当前状态，例如 `&incident=I-1042`；
  - `#studio`、`#studio=new` 原样保留，作为返回目标。
- **取消跳转**：每个跳转请求都带一个编号。切换页面或子页、或者打开了更新的链接，旧请求就作废，回来以后也不会再自动跳过去。
- **坏链接**：节点、子页或事件不存在时，会弹出提示，并回到默认页面。
- **Assurance 按钮**：“Open the full World Model explorer” 改为用深链接打开 Ontology Graph。
- **刻意保留的限制**：普通的左侧导航点击不会改地址栏，所以后退回到的是上一次记录的地址。

### 2. 从 jev 搬回的健壮性修复（B）

- **B1 加载失败可以重试**：失败后会显示 Retry 按钮，点了只重新请求失败和剩下的文件，已经加载过的文件不会再执行一遍。
- **B2 定位时清掉筛选**：定位节点时，会自动清掉 Network 的“最小连接数”和 subclass 筛选，避免节点被它们藏起来。
- **B3 隐藏时不启动**：面板只有在真正显示时（`SWM.isShown`）才会启动。离开页面后，即使加载才完成，也不会在后台挂载或跑动画。
- **`assurance.html` 不受影响**：它用同一个加载器，但没有路由，也不监听 `swm:loader-ready` 事件，所以这些改动对它不起作用。

### 3. 事件详情页的 Ontology 行（C）

对应关系**按站点事件来定，不按编号对应**：World Model 示例数据里的 `rt-inc-1042` 是另一条记录（“退款循环”）。

- **I-1042**（外部邮件触发修改供应商银行账户，已被拦截）：
  - 显示三个可以点击的芯片：hazard “Bank Detail Change From Unverified Instruction”（curated）→ CHARACTERIZES → ATLAS AML.T0052 Phishing（published）→ MITIGATED_BY → Dual Approval（curated）。
  - 点芯片会跳进 World Model，并定位到对应节点。
  - 页面上写明了这几点：
    - 这是模型里相关的**潜在**风险，不是观测到的结果，因为这次尝试被拦下了；
    - Phishing 只是最接近的公开分类，不是说这起事件就是钓鱼；
    - Dual Approval 是本体里的控制，不是 PAY-042，也不能证明问题已经修好；
    - 这个 hazard 在 Procurement 包里，而事件归在 Finance 下。
- **I-1038**（多个 agent 的退款累加超限）：显示 “No modelled hazard yet” 盲点，因为本体里还没有“跨 agent 金额累加”这类风险。
- **其他事件**：不显示这一行。

### 4. 详情面板的链条文字（E）

选中 L4 节点时，详情面板会用文字写出链条，并标明每条关系的方向和评审等级：

- 每一行都是完整的一句：主语 关系 宾语；
- 实例 INSTANCE_OF 组件；
- 指向这个组件的威胁（THREATENS，方向是威胁 → 组件），有缓解措施的排在前面；
- 缓解措施 COUNTERS 威胁（每条缓解措施单独一句），或者写 “No mapped countermeasure”；
- 示例事件还会显示 EXHIBITS 的 hazard。

图本身不变，L4 节点仍然不显示它和 L3 的连线。

### 5. 砍掉的（D）

“运行时检查”叠加层没有做：为它改冻结的契约不值得，而且 jev 的映射里把一个组件当成了控制措施。

## 自动检查

- **`probe-swm.mjs` 新增 P1–P6**：
  - P1：390px 宽度下没有横向溢出；
  - P2：键盘搜索后能选中；
  - P3：定位节点时会清掉筛选；
  - P4：加载失败后重试，而且不会重复执行已加载的文件；
  - P5：离开后，晚到的加载不会挂载；
  - P6：链条文字里每一句的主语、关系和宾语方向都正确。代码评审第 1 轮发现 COUNTERS 写反了，修好后加了这项；它在修复前的代码上会失败。
- **`run-site-probes.mjs` 新增 S22–S38**（只在本地跑，不在线上子集里）：
  - 冷启动深链接；
  - 默认子页和静态子页；
  - 坏链接；
  - 加载过程中后退、切换页面或子页；
  - 跳转请求的取消；
  - 前进/后退；
  - Studio 路由；
  - I-1042 和 I-1038 的 Ontology 行；
  - `assurance.html`；
  - Assurance 页的“Open the full World Model explorer”按钮（S38）。
- **证明检查真的能抓到问题**：S22（冷启动链接）在改动前的代码（`df79519`）上失败，在新代码上通过。
- **最终结果**：两套检查各连跑三遍。`probe-swm.mjs` 每遍 15/15 通过；站点检查每遍 37/38，唯一失败的是 S20，它在改动前的 BASE 上也同样失败，是本机无头浏览器的环境问题。

## 不变的部分

- 内嵌的 jev demo（`jev-runtime/`）逐字节不变；
- Coverage 的数字；
- 公开来源的节点 ID；
- Refund 示例；
- World Model 以外的页面（例外：路由、事件详情页的 Ontology 行，以及 Assurance 那个按钮）。
