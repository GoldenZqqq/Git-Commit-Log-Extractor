# 实施计划

## 1. UI 对齐

- [x] 修正 `.report-switch button` 的 flex 对齐规则，覆盖浅色、深色、窄窗口和 disabled 状态。
- [x] 增加计算样式/几何中心回归断言，保留现有 Tab 键盘导航断言。

## 2. 警告归属与折叠

- [x] 让 `WorkbenchEventLog` 仅在报告视图显示。
- [x] 将警告改为默认折叠摘要，加入详情展开、检查并清理和关闭动作。
- [x] 将关闭动作接入 `App` 的 warnings 状态，不影响报告、扫描和索引业务流程。

## 3. 安全清理

- [x] 扩展 `useWorkspaceHealth.refresh` 返回本次结构化检查结果。
- [x] 新增可清理候选计算和确认对话框，严格区分可清理/仅提示状态。
- [x] 批量更新根目录、仓库索引、禁用记录与本地缓存，并在剩余根目录存在时重扫。
- [x] 覆盖无可清理项、取消、全部失效、检查失败和扫描中禁用状态。

## 4. 验证

- [x] `npm run build`。
- [x] 定向 Playwright：workbench、repository-panel、task-state、responsive、accessibility。
- [x] `npm run test:e2e` 全量回归。
- [x] `cd src-tauri && cargo fmt -- --check && cargo check && cargo test`。
- [x] `git diff --check`，确认无 Tauri payload 变化、无调试日志和类型绕过。
- [x] 本地开发环境检查浅色/暗色、报告/洞察/健康切换、警告关闭和清理确认流程。

## 风险与回滚点

- 清理时序失败：先保留配置更新，回退自动重扫为手动重扫提示。
- 警告归属错误：恢复事件区渲染位置，但保留折叠和关闭行为。
- 状态筛选误判：以 `WorkspaceHealthResult` 枚举为唯一来源，不解析警告文本。
