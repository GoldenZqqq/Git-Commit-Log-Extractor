# BIZ-20 仓库搜索与批量操作 — 实施计划

## Risk Level

Level 1。行为局限于前端仓库辅助面板和现有设置状态，但批量操作会影响报告范围并需同步健康视图；先写 Playwright 回归，再实现并做完整前端验证。

## Checklist

1. **红灯与数据边界**
   - [x] 新增 Playwright 多仓库场景，覆盖映射名/原名/路径/分支搜索、状态数量与组合筛选。
   - [x] 覆盖当前结果批量禁用/恢复、未命中仓库保持、localStorage 与生成范围同步。
   - [x] 覆盖初始全禁用状态的提示与恢复入口，并确认旧 UI 失败。

2. **组件与筛选交互**
   - [x] 新增 `RepositoryPanel.tsx`，从 `Workbench` 提取仓库面板、行和空索引引导。
   - [x] 实现本地 query/status 状态、统一搜索文本、命中计数、批量动作与筛选空态。
   - [x] 拆分 `RepositoryPanel.css` 并调整 `components.css` / `layout.css`，保持明暗主题和列表滚动。

3. **App 与健康投影同步**
   - [x] App 新增一次性 `setReposEnabled(paths, enabled)`，保留未命中/陈旧禁用路径并反馈变更数量。
   - [x] `useWorkspaceHealth` 新增批量禁用投影方法；`Workbench` 接入批量回调。

4. **验证与收口**
   - [x] 定向 Playwright 转绿，执行 1280×720 明暗主题视觉核验。
   - [x] `npm run build`、完整 `npm run test:e2e`、`git diff --check`。
   - [x] 运行 `trellis-check`，更新必要前端规范与任务验收。
   - [x] 路线图改为已完成，归档并创建独立本地提交；不推送。

## Expected Files

- `src/components/RepositoryPanel.tsx`
- `src/components/Workbench.tsx`
- `src/hooks/useWorkspaceHealth.ts`
- `src/App.tsx`
- `src/styles/components.css`
- `src/styles/layout.css`
- `src/styles/theme.css`
- `tests/e2e/repository-panel.spec.ts`
- `tests/e2e/support/tauri.ts`（仅在场景 helper 需要时）

## Rollback Point

新组件、批量回调与测试同批落地。若组件提取影响原扫描/映射编辑行为，整体恢复仓库面板，不保留仅更新设置但未同步健康投影的半成品。
