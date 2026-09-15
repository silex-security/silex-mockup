# 9/14 改动说明

`index.html` 是在早先一版 GPT 生成的 Silex 控制台 demo 基础上，按 2026-09-14 产品 demo 评审会的结论改出来的。原站的布局、配色、交互和子功能都保留，只做定点改动：会上没有决定删除的子功能一个都没删，「放后面」的页面只标了 `Later`。

页面上共标记了 48 处改动。打开 `index.html`，点右上角 **◆ 9/14 changes**：可以看到改动清单，逐条跳过去，改过的地方会用虚线框标出。

## 整体结构

- **左侧导航按客户使用阶段重新分组**
  - Pre-deployment：Blueprint Studio
  - Post-deployment：Incident Queue、Agentic Control Validation、Policy Review
  - Environment：Validation Horizon、Sim-to-Real、Workflow Library、Security Landscape、Integrations
- **新增 Validation Horizon 页面**，放在 Environment 第一个。
- **Integrations 标为 `Later`**（原站这一页是空的）。
- **顶栏新增**
  - 「Simulated agents · demo」标签：页面上的 agent 都是模拟的。
  - 「Definitions」弹窗：residual risk、sim-to-real calibration、critical evidence 等指标的定义，注明是草稿、需要核实。
  - 「◆ 9/14 changes」改动清单。

## 各页面

### Overview
- Coverage confidence 往上移。
- World model coverage 放进顶部指标。
- 按部门的 domain suites 试放在这一页。
- Latest runtime evidence、Workflow Attack Path Validation、Evidence timeline、Sim-to-real 四张卡片默认折叠；点「Run validation」会自动展开进度卡。
- residual risk 等指标旁边加「definition」链接。

### Incident Queue
- 筛选栏从页面上方挪到卡片列表旁边。
- 新增 Use case、Agent type 两个筛选。

### Incident 详情页
- 顶部新增 6 步流程条：Incident Evidence → Causal Workflow → Alternative Paths → Control & Policy Review → Agentic Control Validation → Approve for Shadow，一次只高亮当前一步。
- 「Control Intervention」改名为 **Control & Policy Review**，里面新增：
  - 左边是仍然可达的替代路径，右边是 control 建议，并排显示，由人勾选；
  - 「Send to Agentic Control Validation →」下一步按钮；
  - 待定问题：送 shadow 之前是否必须先通过验证。

### Blueprint Studio
- 流程从 4 步改为 5 步：Blueprint Builder → Blueprint Check → Proving Ground → Control & Policy Review → Decision → Workflow Library，并注明第 3 步起与部署后流程相同。
- Control point 改用虚线边框、◆ 标记和琥珀色，和 agent 区分开，工具栏加图例。
- Blueprint Check 新增「What the check asks」卡片：假想这个 agent 部署后会发生什么，提前给出 policy 更新建议；检查结果怎么对应 ontology L1–L4 还待确认。
- 已完成的步骤不再看起来像当前步骤。

### Agentic Control Validation（Proving Ground）
- 显示本次 run 的来源（部署后的 incident，或部署前的 blueprint）。
- 新增 Run queue：一个 workflow 一次 run，能看到状态和哪些在并行跑。
- 新增 Control validation 步骤：对比当前控制和候选控制下的可达路径、正常完成率和防御置信度。
- 新增 Decision 卡片：approve 后把 workflow 登记进 Workflow Library，或者送 Policy Review 给高权限审批。

### Policy Review
- 分成两类用户：
  - **In-incident review**：给操作人员，挂在具体 incident 上审核。
  - **Overall approval · CISO**：给高权限审批人，按领域汇总待批 policy，点 Review 跳到对应 incident；注明可以在主流程之后再做。

### Validation Horizon（新页面）
回答「拦住一次攻击之后，这个修复能管用多久」：
- 三个阶段：Immediate（攻击已被拦截）、Short-term（加了新 policy 的 workflow 持续观察）、每月回测（medium 和 long term 合并）。
- 回测历史表：随着 agent 和 workflow 增加，每月重跑同一组场景。
- 「Diagnosis → treatment」服务卡片：每月重新校准环境并出回测报告是诊断；针对发现的问题出 policy 更新包、做定向 red teaming 是治疗。

### Sim-to-Real
- 新增定义说明：模拟环境和生产行为的吻合程度，会随新增 agent 和 workflow 漂移，每月由 Validation Horizon 重新校准。
- 原来的 Validation horizons 表移到 Validation Horizon 页面，这里留一个跳转。

### Workflow Library
- 新增一张从 Blueprint 审批后入库的 workflow 卡片，标为 Simulated。

### Security Landscape
- Ontology Architecture 加注：检查结果和四层 ontology 的展示方式待与 ontology 研究负责人对齐。
- Runtime Knowledge Graph、Cross-Domain Risk 标为 `Later`，没有删除。

## 做了的取舍

- **导航分组**：采用会上提出的 pre-deployment / post-deployment / environment 三块，没有按技术纵线分 tab。
- **唯一的合并**：Validation Horizon 里 medium term 和 long term 合并成每月回测，依据是会上的结论。
- **数字都是示意**，包括新增的回测历史和日期；背后没有真实引擎。

## 待办

### 待决定
- [ ] 送 shadow 之前，是否每个 control 都必须先通过 Agentic Control Validation（Incident 详情页上标为待定）。
- [ ] 模块最终怎么分：pre-deployment / post-deployment / environment 三块，还是再单独拆出一块；Validation Horizon 最终放在哪。
- [ ] Enterprise domain suites 是否留在 Overview：Overview 主要面向 CISO，还是也要按部门（vertical）看。
- [ ] Horizontal agent（文件读取、数据分析等所有部门都会用的 agent）在按部门划分的结构里放在哪。
- [ ] 「Blueprint」是否是行业通用说法；如果不是，是否换一个更通俗的名字。

### 待补内容
- [ ] 核实 Definitions 弹窗里的指标定义（residual risk、residual reachability、sim-to-real calibration、coverage confidence、critical evidence、world model coverage、defense confidence），目前是草稿。
- [ ] 明确 Blueprint Check 具体检查哪些项，以及检查结果怎么对应 ontology L1–L4。
- [ ] 和 ontology 研究负责人对齐 Security Landscape 里 ontology 和 Security World Model 的展示方式。
- [ ] 把示意数字换成真实跑出来的结果（回测历史、run queue、control validation 对比等）。

### 后续再做
- [ ] Policy Review 的 Overall approval · CISO 视图（页面上已有占位，主流程之后再完善）。
- [ ] Runtime Knowledge Graph、Cross-Domain Risk、Integrations 这几个标为 `Later` 的页面。
- [ ] Proving Ground 里多个 workflow 并行运行、状态实时更新的真实交互（目前是静态示意）。
- [ ] 真实接入 agent：demo 阶段全部是模拟 agent，有资源后再做。
