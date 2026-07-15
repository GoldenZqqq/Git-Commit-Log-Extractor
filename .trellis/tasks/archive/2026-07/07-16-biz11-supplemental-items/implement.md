# BIZ-11 补充非 Git 工作事项 — 实施计划

## Risk Level

Level 2（新功能、跨 React/IPC/Rust/历史行为），采用测试先行：先写解析/渲染/历史兼容断言，再实现数据流。

## Checklist

1. **补充事项领域 helper 与前端测试**
   - [x] 新增 `src/supplementalItems.ts`：20 项、每项 200 字限制，解析、格式化和 period key。
   - [x] 为解析、空白过滤、边界错误与不同周期 key 增加单元或可执行 smoke 覆盖。

2. **Rust IPC 与渲染测试**
   - [x] `ExtractOptions`、`PeriodReportOptions`、`MonthlyReportOptions` 增加默认空数组字段。
   - [x] 先增加 Rust 测试：无事项输出不变；有事项追加标准区块；统计不变；脱敏规则作用于补充事项；超限报中文错误。
   - [x] 在日报/自定义/周报/月报管线 AI 之前调用统一追加函数。

3. **历史与生成数据流**
   - [x] `ReportHistoryEntry` 兼容可选 `supplementalItems`，类型守卫验证字符串数组。
   - [x] builders 接收显式补充事项并发送 camelCase payload。
   - [x] App 按 mode + period 管理草稿；生成、历史写入、打开、重新生成完整透传。
   - [x] AI 润色 builder 在存在补充事项时加入事实保留指令。

4. **Workbench UI**
   - [x] 新增 `SupplementalItemsEditor`，采用内联渐进展开结构。
   - [x] 补充明暗色、focus、disabled、计数与限制错误样式。
   - [x] 不扩张现有 `Workbench.tsx` 中的业务逻辑。

5. **自动化验证**
   - [x] Playwright：填写事项 → 生成日报 → payload/预览/历史均保留。
   - [x] Playwright：打开历史并重新生成继续携带事项。
   - [x] Playwright：切换周期不串数据，旧历史可加载。
   - [x] `npm run build`。
   - [x] `npm run test:e2e`（至少先定向，再全量）。
   - [x] `cd src-tauri; cargo check; cargo test`。
   - [x] `git diff --check` 与跨层字段名审计。

## Verification Record

- `npm run build`：通过。
- `npm run test:e2e -- tests/e2e/supplemental-items.spec.ts --workers=1`：2/2 通过。
- `npm run test:e2e`：22/22 通过。
- `cargo check`：通过。
- `cargo test`：101/101 通过。
- `cargo fmt -- --check`、`git diff --check`：通过。
- 明暗主题展开态已进行截图核验；深色编辑器表面改为主题 token 后复验通过。

## Expected Files

- `src/supplementalItems.ts`
- `src/components/SupplementalItemsEditor.tsx`
- `src/styles/preview.css`
- `src/App.tsx`
- `src/model.ts`
- `src-tauri/src/models.rs`
- `src-tauri/src/report.rs`
- `src-tauri/src/commit_pipeline.rs`
- `tests/e2e/workbench.spec.ts` 或独立补充事项 spec

## Commit / Archive

验证通过后，将功能代码、测试、路线图状态与该任务归档路径一起形成一个本地提交；不推送。
