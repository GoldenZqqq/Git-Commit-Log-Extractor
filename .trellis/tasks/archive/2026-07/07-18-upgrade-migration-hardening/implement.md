# 升级迁移与恢复实施计划

1. [x] 固化 v0.5.1 设置快照、secure migration、历史容量和配置方案兼容契约并激活任务。
2. [x] 扩展 Playwright Tauri 场景，可注入当前/旧/迁移备份设置原文与 secure-store 写入失败。
3. [x] 先增加设置迁移 E2E：缺省字段、错误类型、损坏当前设置回退、raw key 失败保留和下次成功清理。
4. [x] 重构 `loadSettingsState` 候选解析/备份/严格归一化，并让 App 只在普通设置与 secure migration 均成功后 finalize。
5. [x] 增加配置方案兼容测试，证明 env 引用、secure flags、本地路径和当前设置在失败/merge/replace 后保持正确。
6. [x] 为报告历史增加 32 MiB 读写边界；补 Rust 超限 primary/backup、超限 save 保留旧数据和 temp 写失败恢复测试。
7. [x] 扩充报告历史 E2E 的无效数组、重复迁移和错误提示证据，保持现有 migrationComplete 删除门禁。
8. [x] 更新 settings/report-history code-spec，运行定向测试、全量 build/E2E、Rust CI、Tauri smoke 和 `git diff --check`。
9. [x] 勾选 AC、记录提交/CI 证据，归档任务并独立 push。

## Validation Commands

```bash
npm run build
npm run test:e2e -- tests/e2e/settings-migration.spec.ts tests/e2e/report-history-storage.spec.ts tests/e2e/config-profile.spec.ts
npm run test:e2e
cd src-tauri && cargo fmt -- --check && cargo test report_history && cargo check && cargo test
git diff --check
```

## Verification Evidence

- 功能提交：`3b933a3242b44ebf2a511e1fb2f7a7f49241c9a9`（`fix: 加固升级迁移与恢复`）。
- 本地：`npm run build` 通过；设置/历史/配置方案定向 E2E `17 passed`；全量 E2E `73 passed`；`git diff --check` 通过。
- 主线 CI：run `29646920080`，head SHA 精确匹配功能提交，结论 `success`。
- CI 门禁：Linux/Windows frontend build、Rust format/check/test、全量 mocked E2E 和 Windows 真实 Tauri WebView smoke 全部通过。
- 非阻塞注解：Actions v4 的 Node 20 runtime 弃用提示沿用前序任务结论，留待独立依赖升级处理。

## Risk Files

- `src/model.ts`
- `src/App.tsx`
- `src/hooks/useReportHistoryStorage.ts`
- `src-tauri/src/report_history.rs`
- `tests/e2e/support/tauri.ts`
- `tests/e2e/settings-migration.spec.ts`
- `tests/e2e/report-history-storage.spec.ts`
- `tests/e2e/config-profile.spec.ts`
