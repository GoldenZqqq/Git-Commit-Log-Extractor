# 批量生成报告 — 技术设计

## Architecture Overview

批量生成是一个编排层，不改动现有报告生成的核心逻辑。它在外层将一个大时间范围拆成 N 个子周期，逐个调用现有流程，逐个导出文件。

```
┌─────────────────────────────────────────────┐
│  BatchDialog (React)                        │
│  配置: 时间范围 / 粒度 / 格式 / 输出目录      │
│  显示: 进度条 + 成功/失败汇总                 │
└──────────────┬──────────────────────────────┘
               │ invoke("batch_generate_reports", opts)
               ▼
┌─────────────────────────────────────────────┐
│  batch_generate_reports (Tauri command)      │
│  1. split_date_range → Vec<(start, end)>    │
│  2. for each sub-period:                    │
│     a. collect_commits (existing)           │
│     b. render report  (existing)            │
│     c. save_report_document (existing)      │
│     d. emit "batch-report-progress" event   │
│  3. return BatchResult                      │
└─────────────────────────────────────────────┘
```

## New Data Structures (models.rs)

```rust
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchReportOptions {
    // 复用现有筛选条件
    pub root_dirs: Vec<String>,
    pub indexed_repos: Vec<RepoInfo>,
    pub author: String,
    pub author_display_name: String,
    pub author_aliases: Vec<AuthorAliasGroup>,
    pub disabled_repos: Vec<String>,
    pub extract_all_branches: bool,
    pub exclude_merge_commits: bool,
    pub exclude_revert_commits: bool,
    pub exclude_bot_commits: bool,
    pub commit_item_prefix_mode: String,
    pub show_evidence_details: bool,
    pub evidence_link_rules: Vec<EvidenceLinkRule>,
    pub redaction: ReportRedactionOptions,
    pub project_names: HashMap<String, String>,
    pub report_format_templates: ReportFormatTemplates,

    // 批量专属
    pub range_start: String,         // "2026-07-01"
    pub range_end: String,           // "2026-07-31"
    pub split_granularity: String,   // "daily" | "weekly" | "monthly"
    pub export_format: String,       // "markdown" | "docx" | "pdf"
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchReportProgress {
    pub total: usize,
    pub completed: usize,
    pub current_label: String,   // "2026-07-01 日报"
    pub succeeded: usize,
    pub failed: usize,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchReportResult {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub failures: Vec<BatchFailure>,
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFailure {
    pub label: String,
    pub error: String,
}
```

## Date Splitting Logic (report.rs)

新增函数 `split_date_range(start, end, granularity) -> Vec<SubPeriod>`：

- **daily**: 逐天生成 `[day, day]` 对，跳过实际无 commit 的天可选（MVP 不跳，全部生成）
- **weekly**: 按 ISO 周拆分，首/末周可能不满 7 天，用实际起止日期截断
- **monthly**: 按自然月拆分，首/末月可能不满，用实际起止日期截断

```rust
pub struct SubPeriod {
    pub start: String,
    pub end: String,
    pub label: String,       // "2026-07-01" / "2026-W28" / "2026-07"
    pub report_kind: String, // "daily" / "weekly" / "monthly"
}
```

## File Naming

MVP 使用固定规则，不支持自定义模板：
- daily: `2026-07-01-日报.md`
- weekly: `2026-W28-周报.docx`
- monthly: `2026-07-月报.pdf`

函数 `batch_file_name(sub_period, format) -> String`。

## Progress Event

事件通道: `"batch-report-progress"`

每生成完一份报告（无论成功/失败）发一次。前端监听此事件更新进度条。与现有 `commit-extract-progress` 互不干扰。

## Frontend Component

新增 `BatchDialog.tsx`，作为模态对话框从 Workbench 的入口按钮打开：

- 时间范围选择（两个 date input）
- 拆分粒度下拉（按天/按周/按月）
- 导出格式下拉（Markdown/Word/PDF）
- 输出目录选择（调用 Tauri dialog API）
- 开始生成按钮
- 进度条 + 当前生成项标签
- 完成后：成功 N 份 / 失败 M 份 + 打开输出目录按钮

## Boundary & Compatibility

- 不修改任何现有 Tauri command 的签名
- 不修改 `commit_pipeline`、`report`、`git_ops` 的公开 API
- 批量命令内部直接调用 `commit_pipeline` 的 sync 函数和 `report::save_report_document`
- 上限为 365 个实际输出文件；后端按 `子周期数 * 分组数 * 格式数` 校验，前端日期范围校验只作快速反馈

## Phase 2A: Multi-Format Export and File Name Templates

### Data Contract

`BatchReportOptions` replaces the scalar `export_format` with:

```rust
pub export_formats: Vec<String>,
pub file_name_template: String,
```

The frontend sends camelCase `exportFormats` and `fileNameTemplate`. At least one unique supported format is required.

### Processing Flow

```text
periods -> generate content once per period -> each selected format
        -> render safe unique file name -> save document -> emit file progress
```

Generation failures count once for every selected format because none of those files can be produced. Write failures affect only the failed format and do not stop later formats or periods.

### File Name Template Contract

- Default: `{period}-{type}.{ext}`.
- Supported variables: `{period}`, `{date}`, `{week}`, `{month}`, `{startDate}`, `{endDate}`, `{author}`, `{project}`, `{type}`, `{ext}`.
- `{author}` / `{project}` use the active group name, or the current display author / `全部项目` in aggregate mode.
- `{ext}` is required so simultaneous formats cannot silently target the same name.
- Unknown variables and empty templates return Chinese validation errors before generation starts.
- Windows-invalid characters, control characters, trailing dots, and trailing spaces are normalized by Rust.
- Duplicate names inside one batch receive a numeric suffix before the extension instead of overwriting a previous output.

### Progress Contract

`total`, `completed`, `succeeded`, and `failed` count output files, not logical periods. For three periods and two formats, `total == 6`.
The backend rejects a batch when `periods * groups * formats > 365`, so grouping or selecting multiple formats cannot bypass the safety limit.

### Compatibility

- Existing default behavior remains one Markdown file per period.
- The IPC shape changes together in `src/model.ts` and `src-tauri/src/models.rs`; batch options are ephemeral and are not persisted.
- Existing single-report export APIs and file naming remain unchanged.

## Phase 2B: Author and Project Grouping

### Data Contract

`BatchReportOptions` adds `group_mode`, sent by the frontend as `groupMode`:

```text
all | author | project
```

Missing values default to `all`, preserving existing batch behavior.

### Processing Flow

```text
collect full-range commits for group discovery
  -> apply existing author aliases and derive stable groups
  -> each period: run the existing Git date query once
  -> each group: filter period commits and render content once
  -> selected formats: name, reserve, save, emit progress
```

- Author groups use alias-normalized `CommitRecord.author` values.
- Project groups use the shared report project-name resolver, including branch-specific mappings and `仓库(分支)` fallback.
- The group set is stable for the whole run. Empty period/group intersections still render an empty report so archival matrices remain complete.
- `all` always has one group, including a range with no commits. `author` and `project` reject a range with no discoverable groups.
- File-name context uses the active author/project group; inactive dimensions keep `全部作者` / `全部项目` semantics.
- The safety total is `period count * group count * normalized format count`, capped at 365 before files are written.

### Compatibility and Trade-offs

- Group discovery adds one full-range extraction; each period then performs one existing Git date query, regardless of group or format count.
- Period extraction remains Git-owned instead of repartitioning by displayed author date, preserving parity with single-report generation.
- Report rendering continues to use the existing daily, weekly, monthly, redaction, evidence, and template functions.
- The default `all` mode remains payload-compatible through a Rust serde default and a frontend default.

## Phase 2C: Custom Range

- `splitGranularity = custom` produces exactly one `SubPeriod` spanning the selected start and end dates.
- Its period label is `{startDate}~{endDate}`, report kind is `custom`, and the existing custom report template renders the content.
- File naming uses the same tokens and collision handling; `{type}` resolves to `自定义报告`.
- Daily, weekly, and monthly splitting remain unchanged.

## UI Layout Polish

- Keep the batch dialog at its compact desktop width instead of widening the whole surface for one long format label.
- The split/export row allocates more width to export formats, and format choices use content-aware columns so `Markdown` remains fully visible.
- Existing narrow-window behavior still stacks the row into one column.
- File-name variables render as keyboard-accessible token buttons; clicking copies the complete token, including braces.
- Copy success and failure reuse the global app message host so feedback stays consistent with report-copy actions.
