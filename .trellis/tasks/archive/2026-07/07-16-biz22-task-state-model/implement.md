# BIZ-22 拆分任务忙碌状态 — 实施计划

## Risk Level

Level 2。任务改变跨多个前端组件的异步交互与防重行为，采用 TDD：先用可控挂起命令写出失败的 Playwright 状态断言，再实现任务模型。

## Checklist

1. **可控异步测试基建与红灯**
   - [x] 扩展 `tests/e2e/support/tauri.ts`，支持挂起/释放指定 mock 命令。
   - [x] 新增 `tests/e2e/task-state.spec.ts`，先覆盖生成、AI、导出三种进行中状态并确认旧 `isBusy` 行为失败。

2. **任务状态模型**
   - [x] 新增 `src/hooks/useTaskActivity.ts`：任务类型、活动文案、冲突矩阵、同步启动守卫和安全释放。
   - [x] 为冲突规则提供单一 helper，避免 App 与 Workbench 各自维护条件。

3. **App 编排迁移**
   - [x] 将扫描、四种报告生成、AI、导出和复制映射到明确任务类型。
   - [x] 用活动任务派生扫描状态，移除全局 `isBusy` 与重复 `isRepoScanning` state。
   - [x] `runTask` 在 invoke 前验证冲突并在 finally 释放自己的任务槽位。

4. **Workbench 任务局部 UI**
   - [x] 仅生成任务替换预览；AI/导出/扫描/复制保留 Markdown。
   - [x] 生成、AI、导出和复制按钮显示各自 loading/disabled 状态。
   - [x] 重扫/取消、历史重跑、日历生成、补充事项和空状态按钮使用冲突 helper。
   - [x] 设置、历史打开与无关导航不再受轻量任务全局禁用。

5. **验证与收口**
   - [x] 定向 Playwright task-state 用例转绿。
   - [x] `npm run build`、`npm run test:e2e`。
   - [x] `cargo check`、`cargo test`，确认纯前端变更未破坏桌面集成。
   - [x] `git diff --check`、跨组件 `isBusy` 审计与明暗主题视觉检查。
   - [x] 更新路线图、规范与任务验收后归档，形成独立本地提交；不推送。

## Verification Record

- 红灯：旧全局 `isBusy` 下，AI 与导出期间原稿不可见；三条状态测试按预期失败。
- `npm run test:e2e -- tests/e2e/task-state.spec.ts --workers=1`：4/4 通过。
- `npm run build`：通过。
- `npm run test:e2e`：26/26 通过。
- `cargo check`、`cargo fmt -- --check`：通过。
- `cargo test`：101/101 通过。
- `git diff --check`：通过。
- 浅色润色态、深色导出态截图已人工核验通过。

## Expected Files

- `src/hooks/useTaskActivity.ts`
- `src/App.tsx`
- `src/components/Workbench.tsx`
- `src/components/InsightsView.tsx`
- `src/components/ReportCalendar.tsx`
- `tests/e2e/support/tauri.ts`
- `tests/e2e/task-state.spec.ts`

## Rollback Point

任务状态 helper 与 UI 迁移应在同一提交中落地；如冲突矩阵导致回归，先恢复旧 `isBusy` 接线，不修改 Rust 或数据模型。
