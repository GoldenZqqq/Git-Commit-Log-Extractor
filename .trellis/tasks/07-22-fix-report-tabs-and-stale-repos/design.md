# 技术设计

## 1. 范围与边界

本任务包含两个互不耦合的前端体验修复：报告类型 Tab 的内容对齐，以及报告警告/失效路径的上下文与处理流程。清理能力会修改现有前端设置和本地索引，但不删除文件系统内容，不新增 Tauri 命令或 Rust payload。

## 2. 现状与根因

- `.report-switch button` 继承旧版 `display: grid`，新工作台样式只调整尺寸和间距，未设置 `align-items`/`justify-content`，文本因此按默认网格行为靠上。
- `WorkbenchEventLog` 由 `Workbench` 在三个顶层视图之后无条件渲染，`warnings` 只有字符串数组，结果报告错误在洞察和健康页仍占据底部空间。
- Rust 已通过 `inspect_workspace_health` 返回结构化的 `WorkspaceRootHealth` 与 `WorkspaceRepoHealth`，状态足够支持安全清理。现有 `removeRootDir`、`removeRepoFromIndex`、`persistRepoIndexCache` 可复用。

## 3. UI 设计

### 3.1 报告类型 Tab

- 用 `inline-flex` 替换按钮的网格布局，`align-items: center` 和 `justify-content: center` 负责几何居中，保留当前高度、焦点环、选中背景和 roving `tabIndex`。
- 不通过负 margin 或单独调整中文字符位置做“视觉补偿”，避免不同语言或字体下再次偏移。

### 3.2 警告事件区

- `Workbench` 仅在 `workbenchView === "report"` 时渲染 `WorkbenchEventLog`。
- `WorkbenchEventLog` 将警告渲染为一条摘要：数量、简短动作提示、`查看详情`、`检查并清理`、关闭按钮；详情使用原生 `details`，不新增常驻大卡片。
- 关闭操作只调用 `setWarnings([])`，不修改配置。重新生成、扫描或其他现有任务仍按当前逻辑替换警告。

### 3.3 清理预览

- 新增轻量确认对话框，列出可移除根目录和仓库路径，显示数量及“不会删除磁盘文件”说明。
- 可清理集合由结构化状态计算：根目录 `missing`/`not_directory`，仓库 `missing`/`not_git`。不可访问、分支变化和未知分支只保留在详情中。
- 无可清理项时不打开确认对话框，显示“当前没有可安全清理的项；不可访问路径请检查挂载或权限”。

## 4. 数据流与状态

1. 用户点击“检查并清理”。
2. App 调用现有 `workspaceHealth.refresh()`；hook 返回本次 `WorkspaceHealthResult`，同时更新健康页缓存。
3. App 从结果计算 `WorkspaceCleanupCandidate`，打开预览对话框。
4. 用户取消：关闭预览，不改变设置、仓库数组或缓存。
5. 用户确认：
   - 从 `settings.rootDirs` 移除候选根目录；
   - 从 `repos` 移除候选仓库；
   - 从 `settings.disabledRepos` 移除候选仓库路径；
   - 持久化新的 `RepoIndexCache`；
   - 更新健康结果；
   - 若仍有根目录，使用新根目录触发一次扫描；否则清空索引缓存并显示结果。

为避免 React state 更新尚未生效就使用旧根目录，扫描函数接受可选的根目录覆盖值，校验也使用合并后的临时设置。

## 5. 兼容性与风险

- 不改 `RepoScanResult`、`WorkspaceHealthResult` 或任何 Tauri command 签名；现有 mock 和 Rust 端保持兼容。
- `WorkspaceHealthResult` 为空或检查失败时不得清理任何内容。
- 失效根目录和仓库的移除是配置层操作，可通过重新添加目录和重新扫描恢复；磁盘数据完全不变。
- 现有健康页单项“移除索引”继续保留，批量清理只是共享同一状态判断和持久化规则。

## 6. 回滚

- Tab 只涉及 CSS，可单独回退样式规则。
- 警告区和清理对话框可回退为现有事件区；不需要数据库或迁移回滚。
- 若扫描触发时序回归，保留清理后的设置与缓存更新，暂时移除自动重扫，恢复为提示用户手动重扫。
