# 产品验证闭环设计

## Scope And Boundaries

本任务只增加验证文档和 GitHub Issue Form，并把已有支持包能力映射到验证流程。它不改变应用运行时、Tauri IPC、持久化、网络请求或凭据处理。

## Components

1. `docs/product-validation-plan.md`：唯一的产品验证计划，包含用户分层、候选假设、数据边界、证据快照、评分模型、暂缓门槛和复评节奏。
2. `.github/ISSUE_TEMPLATE/product-feedback.yml`：按统一字段收集角色、场景、频率、影响、当前工作流、期望结果、试用意愿和脱敏样例。
3. `prd.md`：保存 Trellis 任务级验收与当前决策；不复制完整问卷或实现清单。
4. `docs/business-improvement-roadmap.md`：记录 v0.6 路线完成后的产品方向结论和链接。

## Data Flow

```text
用户填写 Issue Form
  -> 公开 GitHub Issue（用户主动提交）
  -> 维护者按字段去重、引用、评分

应用内支持包入口
  -> 本地构建并展示脱敏预览
  -> 用户复制 Safe Issue Summary 或手动导出 ZIP
  -> 用户自行决定是否在浏览器附加 ZIP
```

Issue Form 不接受原始日志、提交内容、工作区路径、凭据或完整报告作为必填材料。支持包规范继续由 `.trellis/spec/tauri-rust/support-bundle.md` 约束。

## Candidate Scoring Contract

每个候选方向按 10 分评分：需求信号 0-3 分、重复性 0-2 分、试用意愿 0-2 分、战略贴合度 0-2 分、证据质量 0-1 分。证据质量为 0 时总分不得超过 6 分；总分达到 7 分仍必须满足实现门槛后才能立项。

## Compatibility And Rollback

- 兼容性：只新增 Markdown/YAML 文档，不改变构建入口或应用数据格式。
- 回滚：删除新增文档和 Issue Form 即可，不需要数据迁移或用户升级动作。
- 风险：GitHub 流量和下载量会混入 CI/开发活动；单条反馈可能代表个人偏好。计划要求标注代理指标、保留反证并等待多用户重复信号。
