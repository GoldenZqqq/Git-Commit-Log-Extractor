# 批量生成报告 — 实施计划

## Checklist

### Step 1: 数据结构 (models.rs)

- [x] 新增 `BatchReportOptions` 结构体
- [x] 新增 `BatchReportProgress` 结构体
- [x] 新增 `BatchReportResult` / `BatchFailure` 结构体
- [x] 新增 `SubPeriod` 结构体

**验证**: `cargo check` 通过

### Step 2: 日期拆分逻辑 (report.rs)

- [x] 实现 `split_date_range(start, end, granularity) -> Result<Vec<SubPeriod>, String>`
  - daily: NaiveDate 逐天迭代
  - weekly: 按 ISO week 拆分，首尾周截断
  - monthly: 按自然月拆分，首尾月截断
- [x] 实现 `batch_file_name(sub_period, format) -> String`
  - daily: `{date}-日报.{ext}`
  - weekly: `{year}-W{week}-周报.{ext}`
  - monthly: `{year}-{month}-月报.{ext}`
- [x] 上限校验：子周期数 > 365 时返回错误

**验证**: 为 `split_date_range` 写单元测试，覆盖：
- 单天范围
- 跨月周报拆分（首尾周截断）
- 跨年月报拆分
- 超过 365 份的拒绝
- start > end 的拒绝

### Step 3: 批量生成 Tauri command (lib.rs + commit_pipeline.rs)

- [x] 在 `commit_pipeline.rs` 新增 `batch_generate_reports_sync` 函数：
  - 调用 `split_date_range` 拆分子周期
  - 循环遍历每个子周期：
    - 构造对应的 `ExtractOptions` (daily) 或 `PeriodReportOptions` (weekly/monthly)
    - 调用现有 `extract_commits_sync` 或 `generate_period_report_sync`
    - 调用 `report::save_report_document` 导出文件
    - 成功/失败计数，emit 进度事件
    - 单份失败 catch 错误、记录、继续下一份
  - 返回 `BatchReportResult`
- [x] 在 `lib.rs` 新增 `#[tauri::command] batch_generate_reports`，桥接到 sync 函数
- [x] 在 `lib.rs` 的 `invoke_handler` 中注册新 command

**验证**: `cargo check` 通过；手动调用一次确认文件生成

### Step 4: 前端类型定义 (model.ts)

- [x] 新增 TypeScript 类型：`BatchReportOptions`, `BatchReportProgress`, `BatchReportResult`, `BatchFailure`
- [x] 新增 `SplitGranularity` 类型: `"daily" | "weekly" | "monthly" | "custom"`

**验证**: `npm run build` 无类型错误

### Step 5: BatchDialog 组件 (src/components/BatchDialog.tsx)

- [x] 创建模态对话框组件，包含：
  - 起止日期选择 (`<input type="date">`)
  - 拆分粒度下拉 (按天/按周/按月)
  - 导出格式下拉 (Markdown/Word/PDF)
  - 输出目录选择 (调用 `@tauri-apps/plugin-dialog` 的 `open` API)
  - "开始生成"按钮
- [x] 前端校验日期顺序、格式、模板和输出目录；后端限制最多 365 个实际输出文件
- [x] 调用 `invoke("batch_generate_reports", { options })` 发起批量生成
- [x] 监听 `"batch-report-progress"` 事件，显示进度条 + 当前生成项
- [x] 完成后显示成功/失败汇总 + "打开输出目录"按钮
- [x] 失败项展示错误原因

**验证**: `npm run dev` 后在 UI 中操作全流程

### Step 6: Workbench 入口 (src/components/Workbench.tsx)

- [x] 在报告类型 tab 栏或导出按钮区域旁新增"批量生成"按钮
- [x] 点击打开 `BatchDialog`
- [x] 将当前工作区的筛选条件（作者、仓库、分支设置等）透传给 BatchDialog

**验证**: `npm run dev` 确认入口可见且可打开

### Step 7: 端到端测试

- [x] 日期拆分单元测试覆盖多天日报与跨周范围
- [x] 周/月拆分单元测试覆盖跨月和跨年范围
- [x] Rust smoke 测试覆盖 Markdown、DOCX 与分组文件输出，PDF 由文档导出测试覆盖
- [x] 测试输出目录不存在时的错误提示
- [x] 测试无 commit 的周期生成空报告

## Rollback

所有新代码集中在：
- `models.rs`: 新增结构体（不影响已有）
- `report.rs`: 新增函数（不影响已有）
- `commit_pipeline.rs`: 新增函数（不影响已有）
- `lib.rs`: 新增一个 command + invoke_handler 注册
- `src/components/BatchDialog.tsx`: 新文件
- `src/components/Workbench.tsx`: 新增按钮入口
- `src/model.ts`: 新增类型

回滚方式：revert 单个 commit 即可，不影响现有任何功能。

## Phase 2A Checklist: Multi-Format and Naming Template

### Step 8: Cross-Layer Contract

- [x] Change frontend batch options from `exportFormat` to `exportFormats`
- [x] Change Rust `BatchReportOptions.export_format` to `export_formats`
- [x] Add `fileNameTemplate` / `file_name_template`
- [x] Validate at least one supported, deduplicated format

### Step 9: Safe File Naming

- [x] Render supported template variables in `report.rs`
- [x] Reject empty templates, unknown variables, and missing `{ext}`
- [x] Normalize invalid file-name characters without allowing path traversal
- [x] Add deterministic numeric suffixes for duplicate output names
- [x] Add Rust unit tests for defaults, variables, invalid templates, sanitizing, and collisions

### Step 10: Multi-Format Orchestration

- [x] Generate report content once per period
- [x] Save every selected format independently
- [x] Count progress and results by output file
- [x] Reject batches that would create more than 365 output files
- [x] Record generation and write failures with period and format context

### Step 11: Frontend UX

- [x] Replace the format select with accessible multi-select checkboxes
- [x] Add a file-name template input with compact supported-token text
- [x] Prevent generation when no format is selected
- [x] Reset new controls when reopening the dialog
- [x] Update completion copy to report generated files

### Step 12: Verification

- [x] Playwright asserts multiple formats and template are sent to Rust
- [x] Playwright asserts result totals are displayed as files
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `cd src-tauri && cargo check && cargo test`

## Phase 2B Checklist: Grouped Export

### Step 13: Group Contract

- [x] Add frontend `BatchGroupMode` and Rust `group_mode` with `all` default
- [x] Add an accessible three-mode grouping control to `BatchDialog`
- [x] Keep group-specific default file-name templates descriptive

### Step 14: Grouped Orchestration

- [x] Extract full-range commits once for group discovery, then once per period for report content
- [x] Derive author groups after alias normalization
- [x] Derive project groups through the shared project mapping resolver
- [x] Render every period/group intersection once and reuse content across formats
- [x] Count and cap `periods * groups * formats` output files

### Step 15: Verification

- [x] Rust tests cover group derivation, empty groups, filtering, and grouped smoke output
- [x] Playwright covers group selection, default template, and IPC payload
- [x] `npm run build` and `npm run test:e2e`（20 passed）
- [x] `cd src-tauri && cargo check && cargo test`（98 passed）

### Step 16: Custom Range

- [x] Add `custom` to the frontend split options and IPC type
- [x] Split a custom range into one `SubPeriod` and render with the existing custom template
- [x] Cover custom splitting, payload, type token, and output naming in tests

### Step 17: Batch Dialog Layout Polish

- [x] Give the export-format field more horizontal space without widening the dialog
- [x] Allocate format option widths by label length and keep narrow-window stacking
- [x] Add a Playwright regression assertion that the Markdown label is not clipped

### Step 18: Copyable File Name Tokens

- [x] Render every supported template variable as a keyboard-accessible button
- [x] Copy the complete token to the clipboard and reuse the global success/error toast
- [x] Verify all 10 tokens, clipboard content, and success feedback in Playwright
