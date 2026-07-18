# BIZ-13 增加工作区健康视图 — 技术设计

## UX Structure

工作台顶层 tabs 扩展为“报告 / 洞察 / 健康”。健康视图占用主内容宽度，结构为：

1. 标题、隐私说明、刷新检查/重新扫描/设置动作。
2. 一条 `dl` 摘要带：扫描新鲜度、根目录、索引、启用/禁用、失效、分支提醒。
3. 根目录状态列表。
4. 仓库状态表，逐行提供启停与失效索引移除。

全部使用现有 token、按钮与状态色；不引入卡片网格、modal 或装饰动画。加载态使用固定高度 skeleton 行，内容滚动不遮住头部动作。

## Cross-Layer Contract

```rust
WorkspaceHealthOptions {
    root_dirs: Vec<String>,
    indexed_repos: Vec<RepoInfo>,
    disabled_repos: Vec<String>,
}

WorkspaceHealthResult {
    roots: Vec<WorkspaceRootHealth>,
    repos: Vec<WorkspaceRepoHealth>,
}
```

根目录条目：`path/status/detail`。仓库条目：`path/name/cachedBranch/currentBranch/status/detail/disabled`。Rust enum 使用 `snake_case` 值，字段通过 `rename_all = "camelCase"` 与 TypeScript 对齐。

## Status Semantics

### Root

- `healthy`：路径存在且为目录。
- `missing`：metadata 返回 NotFound，通常已移动、删除或外置盘未挂载。
- `not_directory`：路径存在但不是文件夹。
- `inaccessible`：权限或其他 I/O 错误。

### Repository

- `healthy`：目录与 `.git` 标记有效，当前分支和缓存一致。
- `missing`：仓库目录不存在。
- `inaccessible`：目录或 `.git` metadata 无法读取。
- `not_git`：目录存在但 `.git` 文件/目录标记不存在。
- `branch_unknown`：Git 命令无法读出当前分支。
- `branch_changed`：当前分支与缓存分支不同，提示重新扫描同步索引。

`missing/inaccessible/not_git` 计入失效路径；`branch_unknown/branch_changed` 计入分支提醒，但仍保留仓库启停动作。

## Rust Boundary

新增 `workspace_health.rs` 负责纯本地检查，`lib.rs` 仅注册 `inspect_workspace_health` 并在 `spawn_blocking` 中调用。模块不读取 Git log，只调用现有 `git_ops::current_branch`。

将仓库路径有效性 helper 放到 `workspace_health`，设置诊断的 `repo_index` 复用它，避免健康视图与诊断对 `.git` 文件/worktree 的定义漂移。

## Frontend State

新增 `useWorkspaceHealth` hook：

- 按需 invoke，使用 ref 防止重复刷新。
- rootDirs 变化时清空旧结果。
- 暴露 `refresh(reposOverride?)`、`setRepoDisabled` 和 `removeRepo`，便于 App 同步修复结果。
- 健康结果不写 localStorage；`scannedAt` 由 App 从 `RepoIndexCache` 传入。

`saveRepoIndexCache` 返回刚写入的 cache；新增显式持久化 helper，使移除失效项可以保留原 `scannedAt`，而重新扫描刷新时间。

## Repair Data Flow

```text
重新扫描 → RepoScanResult → repos/cache/scannedAt → refresh health
启用/禁用 → settings.disabledRepos → optimistic health row → generation scope
移除失效索引 → confirm → repos/cache (preserve scannedAt) → health rows → generation scope
打开设置 → existing SettingsDialog
```

## Tests

- Rust：空输入、健康根目录、缺失/非目录根、健康/缺失/非 Git/分支未知/分支变化仓库、PermissionDenied 分类、诊断复用。
- Playwright：空工作区、全部健康、部分失效；验证刷新、启停、确认移除、返回报告后的仓库范围同步。
- 视觉：1280×720 明暗主题，确保表格滚动、状态徽标和动作层级清晰。

## Rollback

移除命令、hook、健康视图及 cache helper，恢复两项工作台 tabs；缓存 JSON schema 不变，无数据迁移。
