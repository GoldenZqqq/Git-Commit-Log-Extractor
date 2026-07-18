# v0.5.3 主线收口设计

## Baseline

- Target：`main`，当前包含 v0.5.1 与 3 个最新 Trellis 归档提交。
- Source：`origin/codex/roadmap-completion`，包含 v0.5.2/v0.5.3 及 26 个主线未有提交。
- 已用 `git merge-tree` 预演：产品代码无并行修改冲突；冲突集中在 3 个旧任务的 Trellis 归档文件。

## Merge Strategy

1. 先把当前路线任务树作为独立规划提交推送到 `main`。
2. 从最新 `main` 创建 `codex/mainline-v053-reconciliation`。
3. 使用 `git merge --no-ff origin/codex/roadmap-completion` 保留两个 tag 的祖先关系。
4. Trellis 冲突采用语义合并：任务状态取 `completed`，验收项取双方并集，验证记录保留更强证据，新增的历史迁移验证文件保留。
5. 推送分支并创建 PR，让 GitHub 对 merge result 运行完整 CI。
6. CI 全绿后 merge PR，更新本地 `main` 并归档本任务。

## Compatibility

- 不改变 Tauri IPC；合并内容就是已发布二进制对应源代码。
- v0.5.1 用户数据迁移行为保持发布分支实现。
- 当前新建路线任务只存在 target 侧，Git 应自动保留。

## Rollback

- PR 合并前可直接关闭分支。
- PR 合并后如出现阻断，revert merge commit；不得移动或重打 v0.5.2/v0.5.3 tag。
