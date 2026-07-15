# BIZ-13 增加工作区健康视图 — 实施计划

## Risk Level

Level 2。新增跨层诊断命令与主工作台视图，并修改仓库缓存写入语义；采用 TDD，优先证明状态分类和修复同步。

## Checklist

1. **红灯与契约测试**
   - [x] 新增 Rust 健康分类测试：空、健康、缺失、非目录/非 Git、不可访问分类、分支未知/变化。
   - [x] 新增 Playwright 空工作区、全健康、部分失效与修复同步测试，并确认旧 UI/命令失败。

2. **Rust 健康检查**
   - [x] 在 `models.rs` 定义 options/result/status enums，字段 camelCase、枚举 snake_case。
   - [x] 新增 `workspace_health.rs`，本地检查根目录/仓库/分支，不读取 commit。
   - [x] `lib.rs` 用 blocking command 暴露检查；设置诊断复用仓库路径 helper。

3. **Frontend state and view**
   - [x] 在 `model.ts` 镜像类型，调整 cache helper 以区分扫描写入和保留时间的索引更新。
   - [x] 新增 `useWorkspaceHealth`，接入 App 扫描、启停与移除数据流。
   - [x] 新增 `WorkspaceHealthView` 与样式，接入第三个顶层 tab、加载/错误/空态和操作。

4. **验证与收口**
   - [x] 定向 Rust/Playwright 转绿并做浅色/深色视觉核验。
   - [x] `npm run build`、`npm run test:e2e`。
   - [x] `cargo check`、`cargo test`、`cargo fmt -- --check`。
   - [x] `git diff --check`、跨层字段/缓存时间/修复同步审计、规范更新。
   - [x] 更新路线图与验收，归档并独立本地提交；不推送。

## Expected Files

- `src-tauri/src/workspace_health.rs`
- `src-tauri/src/models.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/diagnostics/checks.rs`
- `src/model.ts`
- `src/hooks/useWorkspaceHealth.ts`
- `src/components/WorkspaceHealthView.tsx`
- `src/components/WorkspaceHealthView.css`
- `src/components/Workbench.tsx`
- `src/App.tsx`
- `tests/e2e/workspace-health.spec.ts`
- `tests/e2e/support/tauri.ts`

## Rollback Point

命令、hook、视图与缓存 helper 必须同批落地；若修复动作与 App 仓库状态分叉，整体恢复而不保留孤立健康 tab。
