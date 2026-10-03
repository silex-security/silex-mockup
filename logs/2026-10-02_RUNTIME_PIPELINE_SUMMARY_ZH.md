# 2026-10-02 改动总结：Runtime Observation 的六步文字改成流程动画（中文）

本文总结 Runtime Observation 页这次的改动。完整计划、评审记录和测试说明见 [`2026-10-02_RUNTIME_PIPELINE_VISUAL_PLAN.md`](2026-10-02_RUNTIME_PIPELINE_VISUAL_PLAN.md)。

流程：先写计划并评审，再实现，然后做代码评审。

- **计划**：Claude（规划）、DeepSeek、Codex 三方评审 3 轮，到 r3 一致通过。
- **代码**：评审 3 轮，到 r3 一致通过。DeepSeek 在代码第 3 轮时 API 余额用完，经用户授权，由免费模型 LongCat（`opencode/longcat-2.5-preview-free`）接替这个席位。

## 起因

用户反馈了 Runtime Observation 页上 “How runtime validation works” 卡片的问题：

1. **位置不对**：这张卡在 Run 按钮上方约 700 px 处，中间还隔着 “The judge learns from your reviewers” 卡片。在 Scripted scenarios 里点 Run 时，根本看不到这张卡。
2. **难懂**：六步文字（“OpenTelemetry-shaped span”、“atomic questions” 等）用户看不明白。
3. **希望改成动态图片。**

## 改动

### 1. 位置

- 删掉 “How runtime validation works” 卡片。
- 流程动画放在 **Scripted scenarios** 卡片顶部，紧挨着 Run 按钮。状态标签（Ready / Running / Complete）和结果行也移到这里。
- 卡片顺序改为：参考数字 → Scripted scenarios（含动画）→ The judge learns → 嵌入的 demo。
- 在 1440×900 下，点 12 个场景中任意一个的 Run，动画和按钮都同时在屏幕上。手机宽度下，点了下方的按钮会先把动画滚进屏幕。

### 2. 动态图

- 一个写着工具名的小标签依次经过 **Agent action → Hard rules → Judge (Jev) → Policy**，从 **Allow / Hold / Block** 三个出口之一离开，最后落进 **Evidence**。
- 每个框下面只有一行白话说明，比如 “fixed checks can veto alone”、“model answers risk questions”。原来的术语留在帮助提示和使用指南里。
- **显示的内容都来自引擎返回的结果（envelope），不另外编造**：
  - 硬规则做决定时，判官其实也跑了，只是不参与决定，所以显示 “ran · not deciding”，而不是 “跳过”；
  - 判官超时（F1）时显示 “timed out”，Policy 框显示 fallback 是 fail-open 还是 fail-closed；
  - monitor 模式下动作照常执行（走 Allow），但做决定的框保持 “本来会拦截” 的颜色，用虚线框标上 monitor，并显示 “would have been blocked”。
- Evidence 框保留原来的声明：“preview only; nothing leaves the browser”。

### 3. 状态

- **点 Run 之前**：循环播放默认策略参考集里的三个真实例子：S1 放行、S2 转人工、S3 拦截，标题以 “Example ·” 开头。页面不在屏幕上，或浏览器切到后台时，立即暂停。
- **点 Run 之后**：先把场景注入下方 demo，再把 demo **实际返回**的每个动作按顺序播一遍（“Action i of n · …”）。因此在 Policy Studio 里改了策略，动画也会变。
  - 动画下面一排小圆点，每个点代表一个动作，颜色就是它的出口，鼠标悬停可看说明；
  - **Skip** 直接跳到结尾。
- **新的 Run 打断旧的**：旧的画面和圆点立刻清空，只播放最新的那次。
- **减少动态效果**：系统设置了 “减少动态效果” 时不播动画，一步显示最终结果。
- **出错**：demo 10 秒内没加载好，就显示错误状态，并清掉上次运行的残留。
- **不再自动滚走**：Run 之后页面停在动画这里，免得错过。跑完后点 “See this run in the decision plane ↓” 再跳到下方 demo。“Try the loop” 仍然会滚过去。

## 文件

- 新增 `js/rt-pipeline.js`：动画组件，以及把一条 envelope 转成画面状态的纯函数 `traceOf`。
- 新增 `css/rt-pipeline.css`：只用站点已有的颜色变量。
- `index.html`：调整卡片结构和顺序。
- `js/jev-runtime-host.js`：接入动画，去掉 Run 后的自动滚动。
- `js/jev-runtime-model.js`：新增 `referenceExamples()`。
- 测试：
  - 新增 `tests/site/rt-pipeline.test.mjs`；
  - `tests/site/run-site-probes.mjs` 新增 S39–S42，并把 S15、S18、S19、S21 改为读取动画状态。
- 指南：`docs/jev-runtime-guide/README.md` §8.1–8.3，以及截图 08、09。

## 没有改动

- 嵌入的 demo（`jev-runtime/demo/`），由 `jev-runtime-vendored.test.mjs` 保证。
- System Validation 的六步卡片。S42 检查它仍然正常播放。
- “The judge learns” 卡片的内容。

## 测试

- 单元测试 29/29。
- Runtime 相关页面测试 12/12。全站 41/42：没过的 S20 在改动前的 `200f5f4` 上同样失败，是环境问题。
- SWM 测试全部通过。
- 关键测试都验证过能失败：
  - 把 “播放 demo 实际结果” 换成 “播放参考例子”，S39 失败；
  - 同时去掉三道 “新 Run 打断旧 Run” 的防护，S41 失败；
  - 代码评审修的每个问题，撤掉修复后对应断言都会失败。

## 评审发现并修好的问题

- **计划阶段**：
  - DeepSeek 指出删卡片会丢掉 “preview only” 声明，F1 的第一个动作是 fail-open，并且纠正了几处测试行号；
  - Codex 指出第一步就删掉 `#rtSteps` 会让 Run 直接报错，以及缺少表示出错状态的接口。
- **代码阶段（Codex）**：新 Run 加载时旧画面残留；出错状态带着旧圆点；例子播完仍显示 “0 records”；monitor 模式下做决定的框颜色不对。
- **集成测试（Claude）**：Evidence 框缺元素导致崩溃；前一个例子的状态带到下一个；小标签挡住框里的文字；改变窗口大小后横向溢出；离开页面后动画没有立即暂停。

## 留到以后（非阻塞）

- 被打断的计时器留下一个永远不结束的 promise，是很小的内存泄漏。
- Skip 按钮在没播放时也显示，但点了没有作用。
- “减少动态效果” 只在页面加载时读取一次。
