# BIZ-22 拆分任务忙碌状态

## Goal

区分阻塞型任务与轻量操作，使复制、导出、AI 操作等不会不必要地遮挡当前报告或禁用无关控件。

## Background

- `src/App.tsx` 当前用单一 `isBusy` 包裹仓库扫描、报告生成、AI 润色和导出。
- `src/components/Workbench.tsx` 在 `isBusy` 时用全屏 loading 替换 `MarkdownPreview`，因此导出或 AI 请求期间用户看不到原稿。
- 扫描进度、报告提取进度和部分对话框已有独立状态；本任务只收敛 App 级异步任务，不重写已有对话框内部状态。

## Requirements

- 用可并存的显式任务状态替代单一全局 `isBusy`，区分 `scan`、`generate`、`polish`、`export` 和 `interaction`。
- 只有 `generate` 可以用提取进度遮挡预览；扫描、AI 润色、导出和复制期间保留当前 Markdown。
- AI 润色与导出在各自按钮显示 loading；扫描继续在仓库面板展示进度和取消入口；复制保持轻量反馈。
- 用集中冲突矩阵保护资源：报告生成与扫描/AI/导出/复制互斥，AI 与导出互斥，同类任务防重复；扫描可与 AI/导出/复制并行。
- 即使 UI 禁用尚未生效，任务启动边界也必须同步拒绝重复点击或冲突调用，避免 React 状态延迟引发竞态。
- 无关导航、设置入口、历史打开和预览阅读不因轻量任务被全局禁用。

## Acceptance Criteria

- [x] 报告生成时仍显示阻塞进度；导出/AI 润色时原预览保持可见。
- [x] 无关按钮不会因其他轻量操作被全局禁用。
- [x] 冲突操作仍受到可靠防重保护。
- [x] Playwright 覆盖至少一个阻塞任务和两个轻量任务状态。
- [x] 仓库扫描进度与取消入口只绑定 `scan`，现有对话框局部 busy 行为不回归。

## Evidence

- `src/App.tsx` 当前只有一个 `isBusy`。
- `src/components/Workbench.tsx` 在 `isBusy` 时整块替换 `MarkdownPreview`。
- 完成后 `useTaskActivity` 统一管理五类活动任务、同步防重与冲突矩阵；App 级 `isBusy` 已移除。
- Playwright 通过挂起真实 mock 命令验证生成阻塞、AI/导出非阻塞、导出期间复制并行、同 tick 防重复和扫描取消归属。
- 验证结果：`npm run build`、26 条 Playwright、`cargo check`、101 条 Rust 测试、`cargo fmt -- --check` 与 `git diff --check` 均通过。
- 视觉证据：浅色 AI 润色态与深色导出态已截图核验，原稿可读、按钮局部 loading、设置/复制入口保持稳定。

## Out of Scope

- 不修改 Rust 命令协议或并发实现。
- 不统一 Batch、空白日补写、洞察刷新等组件内部已有的局部 loading 状态。
- 不在本任务实现 AI 润色差异视图；该能力由后续 BIZ-12 负责。
