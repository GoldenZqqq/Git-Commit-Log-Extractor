# 修复报告 Tab 对齐与失效仓库清理

## Goal

修复首页报告类型 Tab 文字垂直偏上的视觉缺陷，并把仓库扫描产生的失效根目录警告变成安全、可执行的清理流程，减少用户只能阅读原始错误却不知道如何处理的挫败感。

## Background

- `src/styles/preview.css:10` 将 `.report-switch button` 设为 `display: grid`，首页重构又在 `src/styles/workbench.css:168` 缩短按钮高度，但未定义网格内容的垂直对齐，导致日报、周报、月报和自定义文字视觉上偏上。
- `src-tauri/src/git_ops/scan.rs` 当前把扫描问题作为可读字符串返回；这些警告既可能来自失效根目录，也可能来自根目录内部的权限、目录项或断链问题，不能通过解析字符串决定删除对象。
- 项目已有 `inspect_workspace_health` 的结构化根目录状态：`healthy`、`missing`、`inaccessible`、`not_directory`，并已有设置持久化与单个根目录移除能力。
- 清理操作只修改 GitPulse 的 `settings.rootDirs`、仓库索引和禁用状态，不删除磁盘上的任何目录或文件。

## Requirements

### R1. Report Tab Alignment

- 四个报告类型 Tab 的文字在默认、hover、active、disabled 状态下均水平和垂直居中。
- 对齐修复必须覆盖浅色、深色、桌面和窄窗口，不改变现有 Tab 高度、键盘导航或选中语义。

### R2. Actionable Scan Warning

- 扫描警告区需要先汇总问题数量，再按需展开原始详情，避免多行系统错误直接占据首页底部。
- 当扫描存在路径警告时，提供“检查失效目录”入口，调用现有结构化工作区健康检查，而不是解析警告文本。
- 检查结果应区分可安全清理的根目录与可能只是暂时不可访问的根目录。

### R3. Safe Cleanup

- 清理前展示将从 GitPulse 配置/索引移除的根目录和仓库数量、路径，并明确“不会删除磁盘文件”。
- 只自动处理 `missing`、`not_directory` 根目录和 `missing`、`not_git` 仓库索引；`inaccessible`、`branch_unknown`、`branch_changed` 等状态保留，避免把临时离线或权限问题误判为删除。
- 确认后批量更新 `settings.rootDirs`，同步清理被移除仓库的索引和禁用状态，更新健康结果；仍有根目录时重新扫描剩余目录。
- 用户取消时不得修改设置、索引或磁盘内容。
- 清理完成后展示具体结果；若没有可清理目录，应说明仍可能是权限、挂载或断链问题，并保留原始详情。

### R4. Warning Ownership and Dismissal

- 扫描/生成警告只在报告视图的底部事件区显示；洞察和健康视图不应被报告警告占据。
- 警告默认折叠为一行汇总，原始详情通过“查看详情”展开；保留关闭按钮，关闭只清除当前内存中的这批警告，不改变仓库设置。
- “检查并清理”先调用工作区健康检查并打开确认预览；检查失败时保留警告并给出可重试提示。

## Acceptance Criteria

- [ ] 日报、周报、月报、自定义 Tab 的文字在 Chromium 截图和计算样式断言中垂直居中，键盘方向键/Home/End 行为保持通过。
- [ ] 扫描/生成警告只在报告视图显示为可关闭的折叠汇总，原始错误详情可展开查看。
- [ ] 点击“检查并清理”使用 `inspect_workspace_health` 的结构化状态，不从中文/英文错误字符串提取路径。
- [ ] 清理确认文案明确只移除 GitPulse 配置；取消不会触发设置或索引变更。
- [ ] 确认清理后移除目标根目录、失效仓库索引及禁用记录，并重新扫描剩余目录。
- [ ] `missing` / `not_directory`、无可清理项、全部根目录失效、检查失败和扫描中禁用状态均有回归测试。
- [ ] `npm run build`、相关 Playwright、`cargo test` 和 `git diff --check` 通过。

## Out of Scope

- 删除或移动用户磁盘上的目录、仓库和 Git 数据。
- 自动修复目录权限、重新挂载网络盘或移动硬盘。
- 通过解析操作系统错误文本推断路径或错误类型。
- 重构完整工作区健康页面或仓库扫描协议。

## Open Question

- 已确认：只清理确定失效的 `missing` / `not_directory` 根目录与 `missing` / `not_git` 仓库索引；`inaccessible` 等状态保留并提示用户处理。
