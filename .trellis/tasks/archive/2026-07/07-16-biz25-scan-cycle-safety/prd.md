# BIZ-25 加固仓库扫描循环保护

## Goal

确保仓库递归扫描面对 symlink、Windows junction、重叠根目录或目录循环时能够终止，并给出可理解警告。

## Background

- `src-tauri/src/git_ops.rs::visit_dir` 当前只用 `path.is_dir()` 决定递归，没有目录级 visited 集合；目录链接回环会重复进入。
- 现有仓库去重发生在扫描结束后，只能去掉重复结果，无法阻止重复目录遍历。
- `visit_dir` 会吞掉子目录递归错误，根目录失效也静默跳过；`scan_repos` 仅返回 `Vec<RepoInfo>`，前端没有路径警告通道。
- 已有测试覆盖重叠根目录、进度和扫描前取消，本任务必须保持这些行为；BIZ-13 将复用本任务形成的扫描结果与警告契约。

## Requirements

- 在整次多根目录扫描范围内按 canonical 目录身份维护 visited 集合；目录进入前先规范化并判重，同一物理目录最多扫描一次。
- 默认跟随能够解析到目录的 symlink 和 Windows junction，以保留链接内仓库发现能力；失效链接、文件链接和已访问目标不递归。
- 单个根目录或子路径的 canonicalize、目录项读取、元数据读取失败时继续其他路径，并记录包含操作与路径的中文警告。
- 新增 `RepoScanResult { repos, warnings }` 作为 Rust/Tauri/React 的扫描结果契约；前端保存成功仓库索引并显示聚合警告。
- 警告必须去重且有固定上限；超限时用汇总提示代替无限增长。Git 不可用和用户主动取消仍保留为硬错误。
- 保持取消扫描、进度回调、忽略目录、稳定排序和仓库路径去重行为；不新增依赖。

## Acceptance Criteria

- [x] Unix 目录链接循环在有限遍历次数内结束；Windows 在 symlink/junction 可创建时执行等价条件测试。
- [x] 重叠根目录和不同链接指向同一仓库只扫描一次、只返回一条，最终进度仍正确完成。
- [x] 无效根目录、失效链接和路径读取错误产生有界中文警告，同时其他有效根目录仓库仍返回。
- [x] 前端能够消费新结果契约、更新仓库缓存并在工作台显示扫描警告。
- [x] 既有取消、进度、worktree `.git` 文件与重叠根目录测试保持通过。
- [x] `npm run build`、相关 Playwright、`cargo check`、`cargo test`、`cargo fmt -- --check` 与 `git diff --check` 通过。

## Verification

- `npm run build`：通过。
- `npm run test:e2e`：32/32 通过；新增扫描警告继续返回仓库并可见的跨层回归。
- `cargo check`：通过。
- `cargo test`：106/106 通过；包含无效根目录、确定性 read_dir 失败、失效链接、有界警告和 Windows 条件循环。
- `cargo fmt -- --check`：通过。
- `git diff --check`：通过；无临时调试日志或 TypeScript 类型绕过。

## Technical Notes

- visited 身份使用 `fs::canonicalize` 后的 `PathBuf`；展示路径继续移除 Windows verbatim 前缀。
- 警告最多保留 49 条明细和 1 条省略汇总，避免恶意或损坏目录树造成无界内存与 UI 噪声。
- 目录名忽略规则在跟随链接前执行；链接可指向根目录外部，这是现有“发现链接内仓库”语义的一部分。
- `find_git_repos` 保留返回 `Vec<RepoInfo>` 的兼容包装；带进度的主扫描函数和 Tauri 命令返回结构化结果。

## Evidence

- `src-tauri/src/git_ops.rs::visit_dir` 当前通过 `path.is_dir()` 递归，没有目录 visited 集合；只在发现仓库后按 canonical path 去重。

## Out of Scope

- 不增加“是否跟随链接”用户设置，不限制链接必须留在所选根目录内。
- 不实现完整工作区健康视图、失效缓存项修复或扫描历史持久化；这些属于 BIZ-13。
- 不通过新增 crate 或 Windows shell 命令创建 junction；Windows 测试使用标准库 symlink 能力并在系统不允许创建时安全跳过。
