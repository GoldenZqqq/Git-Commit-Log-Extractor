# BIZ-25 加固仓库扫描循环保护 — 技术设计

## Result Contract

Rust 与前端新增同名结果形状：

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoScanResult {
    pub repos: Vec<RepoInfo>,
    pub warnings: Vec<String>,
}
```

`scan_repos` 从 `Result<Vec<RepoInfo>, String>` 改为 `Result<RepoScanResult, String>`。`find_git_repos` 继续作为兼容包装只取 `result.repos`，现有内部调用无需扩散警告契约。

## Scanner State

将参数过多的递归函数收敛为 `RepoScanner<'a, F>`：

```text
RepoScanner
├─ cancel_requested
├─ on_progress
├─ visited_dirs: HashSet<PathBuf>
├─ seen_repo_paths: HashSet<String>
├─ repos
├─ warnings
├─ omitted_warning_count
└─ scanned_dirs
```

整次扫描只创建一个 scanner，所有根目录共享 `visited_dirs`。这使重叠根目录、symlink 和 junction 别名都在进入递归前被同一集合阻断。

## Traversal Algorithm

1. 每个根目录先检查取消状态，再交给 `visit_dir(root, root_label)`。
2. `visit_dir` 先 canonicalize；失败则记录警告并返回 `Ok(())`。
3. canonical 路径已访问则直接返回；首次访问才增加 `scanned_dirs` 并发送进度。
4. 若当前目录是 Git 仓库，按 canonical 路径构建 `RepoInfo`、去重、发送进度并停止向仓库内部递归。
5. `read_dir` 失败记录警告并返回；目录项、file type 或链接目标 metadata 失败同样记录后继续。
6. 普通目录直接递归；symlink/junction 仅在目标 metadata 表明是目录时递归；普通文件不处理。
7. 所有根目录结束后稳定排序仓库，封装警告省略摘要，发送最终完成进度。

## Link Policy

- 可解析的目录链接默认跟随，因为用户可能用链接组织工作区。
- canonical identity 决定是否访问，不以链接文本路径判重。
- 失效链接显示警告但不成为硬错误。
- 链接名仍经过 `.git`、`node_modules`、`target`、`dist`、`.venv`、`__pycache__` 忽略规则。
- 文件链接不递归，也不作为仓库返回。

## Warning Policy

- 信息格式：`扫描已跳过“<path>”：<operation>失败（<error>）`。
- 对完全相同消息去重。
- 最多保留 49 条明细；更多失败计数聚合为第 50 条 `另有 N 个路径问题未逐条显示`。
- canonicalize、read_dir、目录项、file type 和链接目标 metadata 均为非致命警告。
- `ensure_git_available` 失败与 `SCAN_CANCELLED_MESSAGE` 仍返回 `Err`；取消不得伪装成普通警告。

## Frontend Flow

```text
invoke<RepoScanResult>("scan_repos")
  → updateRepoIndex(result.repos)
  → setWarnings(result.warnings)
  → status: 已发现 N 个仓库 / 已发现 N 个仓库，跳过 M 个路径问题
```

Playwright Tauri mock 保留 `scanRepos` fixture，并增加可选 `scanWarnings`，由 mock 统一封装成新结果，避免大面积重写场景数据。

## Compatibility and Rollback

- 事件 `repo-scan-progress` 字段不变，避免破坏既有监听与取消测试。
- 仓库缓存格式不变；只缓存成功发现的仓库。
- 回滚时恢复命令数组返回、移除前端结果类型与警告消费即可；无持久化迁移。

## Tests

- Rust：Unix 循环、Windows 条件链接循环、链接别名去重、无效根目录警告与有效根继续、警告上限、既有取消/进度回归。
- Playwright：扫描结果带警告时仓库仍更新，警告详情与计数状态可见。
- 全量：frontend build/e2e、Rust check/test/fmt、diff check。
