# BIZ-13 增加工作区健康视图

## Goal

提供集中式工作区健康视图，让用户看到索引新鲜度、失效仓库、禁用仓库、分支状态和可执行修复入口。

## Background

- `RepoIndexCache` 已保存 `rootDirs`、`repos` 与 `scannedAt`，但 App 只恢复仓库数组，没有保留扫描时间供 UI 使用。
- 设置诊断已有粗粒度根目录/仓库有效性检查，但无法逐项展示路径状态、当前分支或直接修复。
- BIZ-25 已将扫描结果升级为 `RepoScanResult { repos, warnings }` 并加固链接循环；本任务复用其路径语义，不重新实现扫描器。
- 工作台已有“报告 / 洞察”顶层视图，健康信息需要比辅助栏更宽的状态表和修复操作。

## Requirements

- 在“报告 / 洞察”同级增加“健康”视图，展示根目录、最近扫描时间及新鲜度、索引仓库数、启用/禁用数、失效路径数和分支提醒数。
- Rust 本地检查根目录、缓存仓库路径、`.git` 文件/目录标记与当前分支，区分缺失、不可访问、非目录/非 Git、分支未知和分支变化。
- 提供刷新健康检查、重新扫描、禁用/启用、移除失效缓存项和打开设置；移除只影响 GitPulse 索引，不删除本地目录。
- 修复后仓库列表、禁用配置、生成范围和健康摘要必须使用同一 App 状态同步更新。
- 健康检查不读取 commit 内容、不写仓库、不触发 AI；后台命令保持在 blocking 线程。
- 空工作区、首次未检查、加载、失败、全部健康和部分失效均提供明确状态与键盘可用操作。

## Acceptance Criteria

- [x] 用户能在一个视图看到扫描时间及健康汇总。
- [x] 失效仓库和未知分支明确列出并带修复操作。
- [x] 修复后工作台仓库索引和生成范围同步更新。
- [x] 空工作区、全部健康、部分失效三种状态有自动化覆盖。
- [x] 根目录/仓库状态与 Rust/TypeScript camelCase 契约一致，设置诊断复用同一仓库有效性判断。
- [x] `npm run build`、完整 Playwright、`cargo check/test/fmt` 与 `git diff --check` 通过。

## Technical Notes

- `WorkspaceHealthOptions` 传入 `rootDirs`、当前 `indexedRepos` 与 `disabledRepos`；`WorkspaceHealthResult` 返回逐项 roots/repos，不返回冗余汇总数字。
- 仓库状态为 `healthy | missing | inaccessible | not_git | branch_unknown | branch_changed`；根目录状态为 `healthy | missing | inaccessible | not_directory`。
- `scannedAt` 继续由 WebView 缓存拥有，不进入 Rust 命令；移除缓存项保留原时间，重新扫描才更新时间。
- 健康视图使用紧凑摘要带、根目录列表和仓库表，不新增 modal、装饰性指标卡或动画。

## Evidence

- `RepoIndexCache` 已保存 `scannedAt`，但 UI 只提示载入缓存数量。
- BIZ-25 已让扫描返回路径警告，但仍没有缓存健康诊断模型和逐项修复视图。

## Dependency

- 在 BIZ-25 扫描循环保护完成后实施。

## Out of Scope

- 不自动移动或重新定位仓库，不修改 Git 分支或仓库内容。
- 不持久化健康检查结果；每次打开/刷新按当前文件系统重新计算。
- 不实现 BIZ-20 的仓库搜索/批量启停，也不迁移报告历史。
