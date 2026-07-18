# BIZ-12 AI 润色对照与事实提示 — 实施计划

## Risk Level

Level 2。改变 AI 成功后的核心数据流和历史/导出时机，采用 TDD，优先证明“确认前零副作用”。

## Checklist

1. **红灯与 mock 场景**
   - [x] 新增 `tests/e2e/ai-polish-review.spec.ts`，覆盖确认前不覆盖/不保存、接受、放弃、失败与 `Esc`。
   - [x] 用含新增指标、强结论、删除证据行的 AI 结果验证风险提示是启发式且不改文本。

2. **diff 与风险 helper**
   - [x] 新增 `src/reportDiff.ts`：行级 LCS、超限降级、改动统计和风险检测。
   - [x] 保持函数 ≤ 50 行、计算单元有上限、输出稳定并保留空行。

3. **App 确认态数据流**
   - [x] 在 `src/model.ts` 定义 `ReportPolishReview`。
   - [x] AI 成功只创建 review；失败保留原稿且不创建 review。
   - [x] 接受后才可选导出、更新对应预览和历史；放弃不产生副作用。

4. **内联对照 UI**
   - [x] 新增 `ReportPolishReviewPanel`，包含双栏快照、统一 diff、统计、风险提示和接受/保留操作。
   - [x] 对照出现时聚焦，支持 `Esc`，对照未决时锁住会使快照失效的报告操作。
   - [x] 在 `preview.css` 补齐明暗主题、滚动、行号和语义色。

5. **验证与收口**
   - [x] 定向 Playwright 转绿，确认接受/放弃/失败/键盘路径。
   - [x] `npm run build`、`npm run test:e2e`。
   - [x] `cargo check`、`cargo test`、`cargo fmt -- --check`。
   - [x] `git diff --check`、字段/历史写入审计、浅色/深色截图核验。
   - [x] 更新规范、路线图和验收，归档并形成独立本地提交；不推送。

## Verification Record

- Frontend build: passed.
- Playwright: 31/31 passed; BIZ-12 targeted tests 5/5 passed.
- Rust: `cargo check` passed, 101/101 tests passed, fmt check passed.
- Static audit: diff check passed; temporary screenshot/debug/type-bypass search clean.
- Visual audit: reordered inline review checked in light and dark themes.

## Expected Files

- `src/reportDiff.ts`
- `src/model.ts`
- `src/App.tsx`
- `src/components/ReportPolishReviewPanel.tsx`
- `src/components/Workbench.tsx`
- `src/styles/preview.css`
- `tests/e2e/ai-polish-review.spec.ts`
- `tests/e2e/support/tauri.ts`（仅在 mock 需要补充时）

## Rollback Point

review state、UI 和接受逻辑必须同批落地；若确认态导致历史/导出回归，整体恢复为旧即时应用路径，不保留半套状态。
