# 完成业务路线图待办

## Goal

完成 `docs/business-improvement-roadmap.md` 中仍为待做的 BIZ-11～15、BIZ-20～27，把 GitPulse 从报告生成器继续推进为可靠、可审计、可长期使用的本地工作报告工作台。

## Requirements

- 13 个候选项均保留为独立子任务，分别规划、实现、验证和归档。
- 严格串行推进；任一时刻只激活一个实现任务。
- 每个子任务必须有可测试验收标准；复杂任务在开始前补齐 `design.md` 与 `implement.md`。
- 每个子任务完成后形成一个独立的本地任务提交；全部任务完成前禁止推送。
- 全部子任务完成后执行前端构建、完整 Playwright、Rust check/test、跨层一致性和最终工作区审计，再统一推送 `codex/roadmap-completion`。
- 执行顺序按依赖优化：BIZ-11 → BIZ-22 → BIZ-12 → BIZ-25 → BIZ-13 → BIZ-20 → BIZ-26 → BIZ-15 → BIZ-14 → BIZ-24 → BIZ-21 → BIZ-23 → BIZ-27。

## Acceptance Criteria

- [ ] 13 个子任务均已归档，父任务显示 13/13 完成。
- [ ] 每个子任务均有独立提交及对应验证证据。
- [ ] 路线图状态与实际实现保持一致，不把部分完成标成已完成。
- [ ] 最终全量质量门禁通过，工作区无意外未提交变更。
- [ ] 全部本地提交仅在最终审计通过后一次性推送远程分支。

## Scope Notes

- BIZ-24 只补实验能力隔离与回退说明，不重写现有 OAuth 实现。
- BIZ-26 基于现有 localStorage 自动减半保护继续做 Tauri 文件存储迁移与可感知降级，不重复已有保护。
- BIZ-27 基于现有跨平台 CI 追加 a11y、窄屏/高缩放和真实 Tauri smoke 门禁。
