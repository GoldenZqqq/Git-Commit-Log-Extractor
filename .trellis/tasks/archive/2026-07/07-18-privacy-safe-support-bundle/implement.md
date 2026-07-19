# 隐私安全支持诊断包实施计划

1. [x] 完成 PRD 收敛、跨层 payload、固定条目、脱敏矩阵、预览确认和失败行为设计并激活任务。
2. [x] 先增加 Rust 失败测试：敏感值/路径全覆盖、健康计数、事件边界、固定 schema/条目、`.zip` 校验与离线写入。
3. [x] 在独立 `support_bundle.rs` 实现有界快照、集中脱敏、summary/JSON/event log、Issue 摘要和 ZIP 导出；保持 `lib.rs` 为薄命令。
4. [x] 增加 TypeScript 镜像模型与 `useSupportEvents` 当前会话 ring；只记录非 loading 高层消息，不持久化。
5. [x] 实现诊断页支持包入口与预览弹层：逐项内容、排除项、显式确认、保存、复制安全摘要和打开 Issue。
6. [x] 扩展 Tauri Playwright mock 与 E2E，覆盖预览确认、保存/取消/失败、剪贴板、Issue URL 无敏感值和离线行为。
7. [x] 补弹层焦点/Escape/axe 断言与 320px、小高度响应式检查，验证 light/dark 内容不溢出。
8. [x] 新增支持包 code-spec 并更新 Rust/frontend 索引，记录强制脱敏与禁止自动上传契约。
9. [x] 运行定向测试、全量 Rust/build/E2E、三个现有 benchmark profile、真实 WebView CI 与 `git diff --check`。
10. [x] 勾选 AC，记录功能提交与 exact-SHA CI，归档任务、journal、push 并更新父路线到 5/8。

## Validation Commands

```bash
cd src-tauri
cargo fmt --all -- --check
cargo test support_bundle
cargo check
cargo test
cd ..
npm run build
npm run test:e2e:a11y
npm run test:e2e:responsive
npm run test:e2e
git diff --check
```

Release evidence also requires the exact functional SHA to pass the repository CI, including real Windows Tauri WebView smoke. The existing workspace benchmark profiles are rerun after the new snapshot path because the task touches diagnostics and shared Rust models, but thresholds are not changed here.

## Risk Files

- `src-tauri/src/support_bundle.rs`
- `src-tauri/src/models.rs`
- `src-tauri/src/lib.rs`
- `src/hooks/useSupportEvents.ts`
- `src/components/SupportBundleSection.tsx`
- `src/components/SettingsDialog.tsx`
- `src/App.tsx`
- `src/model.ts`
- `src/styles/dialogs.css`
- `src/styles/theme.css`
- `tests/e2e/support/tauri.ts`
- `tests/e2e/support-bundle.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/responsive-hardening.spec.ts`

## Rollback Points

- 先完成纯 Rust builder 与恶意输入测试，再注册 Tauri command，避免 UI 建在未证明的隐私边界上。
- 事件 ring 单独验证“不持久化、最多 50、忽略 loading”后再接入 `App.tsx`。
- UI 首先只接 preview，确认预览与脱敏一致后再开放本地 export 和 Issue 入口。
- 任一敏感值测试失败都视为阻断，不通过隐藏字段、放宽断言或只在前端过滤来规避。
