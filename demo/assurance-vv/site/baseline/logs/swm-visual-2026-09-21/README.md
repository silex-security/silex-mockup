# Security World Model — 视觉设计稿

[打开设计画廊](index.html) · [完整计划](../2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md) · [评审记录](REVIEW.md)

**计划 v0.2 与四张图已通过两轮评审，Claude、DeepSeek、Codex 全员 PLAN-APPROVED。**

本目录是规划与设计材料，不是已经实现或上线的产品。现有页面、数据、D3 和其他 tab 均未修改。

| 效果图 | 展示状态 | 核心改变 |
|---|---|---|
| [01 覆盖全景](01-coverage.png) / [SVG](01-coverage.svg) | Enterprise 总览 | 放大覆盖主图；编号连接 domain 列表与扇区；右侧用六维条形图和关键 gaps 解释数字 |
| [02a 本体全景](02a-ontology-overview.png) / [SVG](02a-ontology-overview.svg) | L1 默认态 | 240 个真实节点的有界展开，标明 370 个 L1 节点、598 个全层节点，公开来源可追溯 |
| [02b 关系聚焦](02-ontology.png) / [SVG](02-ontology.svg) | 用户选择 Refund workflow 示例后的 L4 聚焦态 | 展示 9/24 聚焦节点 / 8 条聚焦关系；保留另外 15 个运行实例作为弱化上下文；箭头表达实际存储方向；选中详情显示来源。默认仍是 L1 |
| [03 四层结构](03-layers.png) / [SVG](03-layers.svg) | 用户选中 L3 | 四层浅透视平面，直立文字，真实 bundle 计数，点击后去 Explorer 同一层 |

视觉方向：保留浅色外壳，局部深靛色画布，紫色焦点，白色详情面板。效果图均为 1600×1000 原生 SVG，文字、几何和关系可直接核对，PNG 由本地 Chrome 导出。

动效实现约束写在计划中：一次短展开，选中时短过渡，布局稳定后停止；支持 reduced motion。不增加假实时流量或演示数字的跳动。

数据是真实的文件记录，不代表真实客户观测：公开本体保留官方 ID；Silex 业务实例、关系映射与覆盖率仍标 illustrative。计数来自现有 bundle。设计稿没有重新计算覆盖率，没有模拟出新的执行结果。

`review-v0.1-manifest.json` 和 `review-v0.2-manifest.json` 记录各轮送审 SHA-256，当前设计版本为 v0.2；`baseline-data-sha256.json` 记录本次读取的数据和 vendor 基线。完整 reviewer 意见保存于本次 scratch 目录，项目评审记录只摘录结论和所需修订。
