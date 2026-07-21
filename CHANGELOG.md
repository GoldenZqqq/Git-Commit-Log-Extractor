# Changelog

## Unreleased

尚无未发布变更。

## 0.6.1 - 2026-07-21

GitPulse v0.6.1 修复跨平台发布打包问题，并保持开发性能基准的独立质量覆盖。

### Changed

- 将 workspace benchmark 隔离为显式启用的开发工具，默认桌面构建不再将其纳入安装包。
- 在主线 CI 和发布前校验中单独运行 benchmark 测试，避免隔离工具后减少测试覆盖。

### Fixed

- 修复 macOS universal bundle 因缺少辅助 benchmark binary 而无法生成安装包的问题。

## 0.6.0 - 2026-07-21

GitPulse v0.6.0 是一次稳定性与可持续交付版本，重点加强升级恢复、桌面质量和隐私支持能力。

### Added

- 增加隐私安全支持诊断包：本机预览、脱敏导出，生成 GitHub Issue 时只携带安全摘要，不自动上传原始工作区数据。
- 建立大型工作区基准和报告热点优化，降低多仓库、多提交场景下的扫描与提取压力。
- 增加结构化产品反馈入口，持续验证下一阶段产品方向。

### Changed

- 加固升级迁移、历史报告恢复和失败回退路径，降低从旧版本升级时的数据风险。
- 完成前端与 Rust 核心模块边界拆分，保持现有报告、导出和 Tauri IPC 行为兼容。
- 补齐发布治理、桌面可访问性、响应式和真实 Windows WebView smoke 门禁。

### Fixed

- 修复短窗口下支持包弹层底部被裁切的问题。
- 修复发布验证中 WebView2 Runtime 驱动版本匹配问题。

### Upgrade Notes

- Windows 用户可通过安装包或应用内更新升级；macOS/Linux 请从 Releases 页面手动下载。
- 报告历史、配置迁移和凭据安全存储沿用本地优先策略，不引入默认遥测或云端同步。

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
