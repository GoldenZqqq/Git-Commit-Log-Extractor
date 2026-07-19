# 前端超大模块拆分实施计划

## Ordered Checklist

- [x] 记录基线：文件行数、`npm run build`、a11y/responsive、全量 E2E 和当前 Tauri smoke CI SHA。
- [x] 新增 `src/model/` 领域模块，先迁移纯类型、日期和 support-bundle 类型；保持 `src/model.ts` barrel 导出完全兼容。
- [x] 迁移设置持久化、仓库缓存/映射、报告历史和 report-options builder；为 barrel 兼容和关键 builder 增加 TypeScript 定向测试。
- [x] 拆分 Workbench 的 header、report canvas、controls、assist rail、history panel 和 event log；每批后运行 workbench/repository/history E2E。
- [x] 拆分 SettingsDialog 的 tab navigation、workspace、AI、mapping、general、diagnostics；保留 modal/popover focus contract 并运行 settings/config/diagnostics/support E2E。
- [x] 提取 App 的设置状态、报告生成、导出、secure settings sync 和 dialog orchestration hooks；确认 task activity 和 support event 只记录一次。
- [x] 执行跨层审查：旧 import、IPC builder、localStorage key、secure-store calls、错误文案、循环依赖和文件行数。
- [ ] 运行完整门禁：`npm run build`、a11y、responsive、全量 E2E、`cargo fmt --all -- --check`、`cargo check`、`cargo test`、真实 Tauri smoke 和 `git diff --check`。本机 cargo 不可用，前端门禁和 `git diff --check` 已通过，Rust/Windows smoke 交由 exact-SHA CI。
9. [ ] 提交独立功能 commit，push 并等待 exact-SHA CI；若 CI 暴露跨环境布局/启动问题，单独修复并重新验证。
10. [ ] 勾选 AC、记录 journal、归档任务、push 归档提交，并将父路线推进至 6/8。

## Validation Commands

```bash
wc -l src/App.tsx src/components/Workbench.tsx src/components/SettingsDialog.tsx src/model.ts
npm run build
npm run test:e2e:a11y
npm run test:e2e:responsive
npm run test:e2e
cd src-tauri
cargo fmt --all -- --check
cargo check
cargo test
cd ..
git diff --check
```

Release evidence must include the exact functional SHA passing repository CI, including Windows WebView smoke. No benchmark threshold changes are expected because this task only moves frontend boundaries; if Rust or IPC code changes, stop and create a separate integration check before continuing.

## Risk Files

- `src/App.tsx`
- `src/components/Workbench.tsx`
- `src/components/SettingsDialog.tsx`
- `src/model.ts`
- `src/model/*`
- `src/hooks/*`
- `tests/e2e/workbench.spec.ts`
- `tests/e2e/settings-migration.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/responsive-hardening.spec.ts`

## Rollback Points

- Rollback 1: remove only model domain files and restore the barrel if type/import checks fail.
- Rollback 2: revert Workbench extraction without touching Settings or App.
- Rollback 3: revert Settings extraction without touching Workbench or model.
- Rollback 4: revert App hook extraction; no IPC or persisted data migration is allowed in this task.
