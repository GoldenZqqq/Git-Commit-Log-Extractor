# 拆分 Rust 超大模块

## Goal

拆分 report 与 git_ops，保持命令 API、输出和性能行为

## Confirmed Facts

- `src-tauri/src/report.rs` 当前 2935 行，其中生产逻辑约 2030 行，混合了提取结果构建、模板渲染、脱敏、证据链接、周期拆分、导出与批量命名。
- `src-tauri/src/git_ops.rs` 当前 1232 行，其中生产逻辑约 700 行，混合了仓库递归扫描、Git 进程调用、提交参数构建与输出解析。
- `lib.rs`、`cli.rs`、`commit_pipeline.rs`、诊断、支持包、工作区健康检查和 benchmark 均通过 `report::*` / `git_ops::*` 调用；保留稳定 facade 可把回归面限制在 Rust 内部。
- 现有 Rust 单元测试覆盖报告文本、脱敏、证据、周期、命名、扫描循环、取消、Git 解析与 Windows 进程标志；workspace benchmark 可保护扫描、提取和渲染热点。

## Requirements

- R1：拆分 `report.rs` 和 `git_ops.rs` 的渲染、导出、命名、仓库发现、Git 调用与提交提取职责。
- R2：保持 Tauri command、CLI、serde、错误文案、报告文本和导出文件兼容。
- R3：不得降低扫描循环保护、取消、并发边界或 Windows 无控制台行为。
- R4：先补模块边界测试，再执行机械移动和可见性收紧。
- R5：`report` 与 `git_ops` 必须继续作为稳定 facade；现有公开符号路径、参数、返回值、错误文本和排序规则不得变化。
- R6：按可独立回滚的批次拆分，先移动纯逻辑，再移动 I/O；不得同时重构算法或改变性能阈值。

## Acceptance Criteria

- [x] AC1：`report.rs`、`git_ops.rs` 及新增核心模块均不超过 600 行；最大核心文件为 `report/render_core.rs` 546 行，最大测试文件为 `git_ops/tests.rs` 532 行。
- [ ] AC2：Rust fmt/check/test、CLI smoke、前端 build/E2E 与真实 Tauri smoke 通过。
- [x] AC3：关键报告 golden/snapshot 与 Git fixture 输出保持一致；Rust lib `138/138`、benchmark binary `11/11` 与 release smoke benchmark 均通过。

## Technical Notes

- `report` 计划拆为提取结果、模板核心、提交条目、证据引用、周期内容、日期范围、导出和批量命名模块；根模块仅声明子模块并兼容导出。
- `git_ops` 计划拆为仓库扫描、提交查询/解析和 Git 命令适配模块；扫描器仍共享同一取消标记、visited set、warning collector 和 progress callback。
- 模块移动期间优先使用 `pub(super)`；只有 facade 需要兼容的符号才 `pub use`，不扩大 crate 外 API。

## Out of Scope

- 不拆分 `commit_pipeline.rs`、`models.rs`、`ai.rs`、`codex_oauth.rs` 等其他超限模块；后续另立治理任务。
- 不修改报告模板、用户可见文案、Git 参数、并发度、benchmark 阈值、Tauri command 或 serde schema。
- 不引入新依赖，不升级 Rust edition，不改变导出格式实现。

## Dependency

- 依赖前端拆分完成，避免同时重构 IPC 两端。
