# BIZ-26 迁移报告历史本地存储

## Goal

把报告历史从 WebView localStorage 迁移到 Tauri 应用数据文件，保留旧数据并让容量/写入降级对用户可见。

## Requirements

- Rust 提供报告历史加载、保存、清空命令，文件采用版本化且可恢复的本地格式。
- 首次升级自动迁移合法 localStorage 历史；成功后清理旧键，失败则保留旧数据并提示。
- 写入使用安全替换策略，损坏文件可隔离并恢复到最近可用记录。
- 继续遵守 30/60/120/200 条上限和现有历史 API 语义。
- 容量或文件写入失败不得影响设置持久化或当前报告预览。

## Acceptance Criteria

- [ ] 旧 localStorage 历史升级后无损可见，重复启动不会重复迁移。
- [ ] 新历史写入 Tauri 本地文件，设置 localStorage 不再承载报告正文。
- [ ] 损坏、无权限和写入失败有可理解提示与可用降级。
- [ ] 清空、裁剪、更新和日历读取均使用同一数据源。
- [ ] Rust 与 Playwright 覆盖迁移、读写、损坏恢复和清空。

## Evidence

- `src/model.ts::saveReportHistory` 已能在 localStorage quota 失败时减半保留记录，但没有用户提示，正文仍受 WebView 配额约束。
