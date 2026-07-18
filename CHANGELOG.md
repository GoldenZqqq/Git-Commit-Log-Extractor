# Changelog

## Unreleased

尚无未发布变更。

## 0.5.3 - 2026-07-18

### Added

- 支持脱敏配置方案导入/导出，可迁移作者别名、项目映射、证据规则和模板而不携带凭据。
- 将 Codex OAuth 隔离为实验能力，并保留稳定 AI 提供方的回退路径。

### Changed

- 加固弹层、菜单和模型选择的键盘操作、焦点恢复与可访问性语义。
- 支持 320px 窄窗口、200% 等效缩放和小高度桌面布局。
- 补齐 browser mocked E2E、a11y、responsive 与真实 Windows Tauri WebView smoke 门禁。
- 精简工作台状态与提交提取进度文案。

## 0.5.2 - 2026-07-16

### Added

- 支持补充会议、设计、联调等非 Git 工作事项，并写入最终报告与历史记录。
- 增加 AI 润色前后对照与事实提示，接受前可审查或回退。
- 增加工作区健康视图、仓库搜索和当前筛选结果批量启停。
- 将报告历史迁移到带版本、备份恢复和损坏隔离的 Tauri 本地文件存储。
- 增加项目回顾视图，按项目聚合历史报告、提交证据、AI 与导出状态。

### Fixed

- 避免符号链接、junction 或循环目录导致重复扫描。
- 让空白日补写沿用项目名映射，并收紧默认提示词以减少空泛事项。

## 0.5.1 - 2026-07-15

### Changed

- Rebuilt the main branch as a Tauri 2 desktop app with React and Rust.
- Moved local Git workspace scanning and commit extraction from Python to Rust.
- Reworked the UI into a product-style local workbench.
- Preserved the Python/Tkinter implementation on `codex/legacy-python-desktop`.

### Added

- Local repository scan command.
- Date-range commit extraction command.
- One-click previous-month performance report generation.
- Project-grouped monthly report sections:
  - Project progress
  - Actual completion
  - Monthly summary
- Optional OpenAI-compatible AI polishing through environment variables.
- Release bundle support through `npm run tauri build`.
- Windows x86_64 updater integration and GitHub Release pipeline.
