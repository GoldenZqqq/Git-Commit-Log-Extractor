# 完成业务路线图待办

## Goal

完成 `docs/business-improvement-roadmap.md` 中仍为待做的 BIZ-11～15、BIZ-20～27，把 GitPulse 从报告生成器继续推进为可靠、可审计、可长期使用的本地工作报告工作台。

## Requirements

- 13 个候选项均保留为独立子任务，分别规划、实现、验证和归档。
- 严格串行推进；任一时刻只激活一个实现任务。
- 每个子任务必须有可测试验收标准；复杂任务在开始前补齐 `design.md` 与 `implement.md`。
- 每个子任务完成后形成一个独立任务提交。默认批量推送；用户于 2026-07-16 明确授权在 BIZ-15 与空白日补写提示词调整完成并通过集成验证后执行一次阶段性 checkpoint push。
- 全部子任务完成后仍需执行前端构建、完整 Playwright、Rust check/test、跨层一致性和最终工作区审计，并再次同步 `codex/roadmap-completion`。
- 执行顺序按依赖优化：BIZ-11 → BIZ-22 → BIZ-12 → BIZ-25 → BIZ-13 → BIZ-20 → BIZ-26 → BIZ-15 → BIZ-14 → BIZ-24 → BIZ-21 → BIZ-23 → BIZ-27。

## Acceptance Criteria

- [x] 13 个子任务均已归档，父任务显示 13/13 完成。
- [x] 每个子任务均有独立提交及对应验证证据。
- [x] 路线图状态与实际实现保持一致，不把部分完成标成已完成。
- [x] 最终全量质量门禁通过，工作区无意外未提交变更。
- [x] 阶段性推送均有用户明确授权且在对应集成审计通过后执行；13 项完成后再执行最终同步。

## Scope Notes

- BIZ-24 只补实验能力隔离与回退说明，不重写现有 OAuth 实现。
- BIZ-26 基于现有 localStorage 自动减半保护继续做 Tauri 文件存储迁移与可感知降级，不重复已有保护。
- BIZ-27 基于现有跨平台 CI 追加 a11y、窄屏/高缩放和真实 Tauri smoke 门禁。

## Completion Evidence

| Task | Commit |
| --- | --- |
| BIZ-11 | `7a598e4` 支持补充非 Git 工作事项 |
| BIZ-22 | `7640660` 拆分任务忙碌状态 |
| BIZ-12 | `c500c03` 增加 AI 润色对照 |
| BIZ-25 | `e954eb1` 加固仓库扫描循环保护 |
| BIZ-13 | `0be46e8` 增加工作区健康视图 |
| BIZ-20 | `6dd5385` 支持仓库搜索与批量启停 |
| BIZ-26 | `5d4b947` 迁移报告历史本地存储 |
| BIZ-15 | `fff3c37` 增加项目回顾视图 |
| BIZ-14 | `282f0a7` 支持配置方案导入导出 |
| BIZ-24 | `163bdaf` 隔离 Codex OAuth 实验能力 |
| BIZ-21 | `7810d4f` 加固弹层菜单可访问性 |
| BIZ-23 | `a71b578` 加固窄屏与高缩放布局 |
| BIZ-27 | `debe23c` 补齐桌面质量门禁 |

最终验证：frontend smoke 7/7、生产构建、a11y 3/3、响应式 3/3、全量 Playwright 66/66、Rust 125/125、真实 Windows Tauri WebView smoke、YAML 解析与 `git diff --check` 均通过。
