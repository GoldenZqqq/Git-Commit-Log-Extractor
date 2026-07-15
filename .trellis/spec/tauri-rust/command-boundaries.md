# Command Boundaries

> How Rust modules and Tauri commands are divided.

## Module Ownership

- `src-tauri/src/lib.rs`: command registration and thin async wrappers; use `spawn_blocking` for blocking local work.
- `src-tauri/src/models.rs`: serde request/response models shared with the frontend; use camelCase serde names.
- `src-tauri/src/git_ops.rs`: Git command execution, repository discovery, author filtering, branch attribution, and scan progress.
- `src-tauri/src/commit_pipeline.rs`: local report orchestration, commit collection, progress aggregation, AI fallback, and save decisions.
- `src-tauri/src/report.rs`: report text rendering and document/file output.
- `src-tauri/src/network.rs`: shared outbound HTTP client construction, app-level proxy support, proxy candidate scan, and proxy connection tests.
- `src-tauri/src/ai.rs` and `codex_oauth.rs`: optional polishing/model integration.
- `src-tauri/src/secure_store.rs`: OS-backed credential storage for secrets and login state.

## Boundary Rules

- React invokes named Tauri commands; it does not run Git or filesystem logic directly.
- `lib.rs` should not accumulate business logic. Add or extend a domain module, then expose a small command wrapper.
- Long-running Git/report tasks should use progress callbacks bridged to Tauri events.
- A single invalid repository root should not break a whole scan when skipping is reasonable.
- AI polishing failure should become a warning and preserve the local report draft/template.

## Payload Rules

- Rust structs exposed to the frontend use `#[serde(rename_all = "camelCase")]`.
- When adding a field, update Rust model defaults/serde behavior and frontend builders in `src/model.ts`.
- Keep option names tied to product language: report period, author scope, project name mapping, evidence detail, export format.

## Scenario: Cycle-Safe Repository Scan Results

### 1. Scope / Trigger

- Trigger: any Tauri or Rust path recursively discovers Git repositories from one or more user-selected roots.
- Applies to `scan_repos`, `git_ops::find_git_repos_with_progress`, and the frontend `RepoScanResult` mirror.
- The scanner may follow directory links, so loop prevention and partial-failure reporting are part of the command contract, not optional UI polish.

### 2. Signatures

```rust
pub struct RepoScanResult {
    pub repos: Vec<RepoInfo>,
    pub warnings: Vec<String>,
}

pub fn find_git_repos_with_progress<F>(
    root_dirs: &[String],
    cancel_requested: &AtomicBool,
    on_progress: F,
) -> Result<RepoScanResult, String>
where
    F: FnMut(RepoScanProgress);

async fn scan_repos(
    app: AppHandle,
    state: State<'_, RepoScanState>,
    root_dirs: Vec<String>,
) -> Result<RepoScanResult, String>;
```

TypeScript mirrors the camelCase response exactly:

```ts
type RepoScanResult = { repos: RepoInfo[]; warnings: string[] };
```

### 3. Contracts

- One `RepoScanner` instance owns all roots in a scan and shares a canonical `HashSet<PathBuf>` across them.
- A directory is canonicalized before progress counting, repository detection, or recursion. The same physical directory is visited at most once even through overlapping roots, symlinks, or Windows junctions.
- Resolvable directory links are followed; file links are ignored; broken link targets become warnings.
- Repository paths use canonical display paths, remain stably sorted, and are deduplicated before returning.
- `RepoScanProgress` fields and the cancellation event remain compatible. The final progress event uses the returned repository count.
- Warning output contains at most 49 unique details plus one omission summary. The collector must not retain an unbounded set after the detail cap.
- React saves `result.repos` to the existing cache and shows `result.warnings`; warning data is not persisted in the repository cache by this contract.

### 4. Validation & Error Matrix

- Git executable missing/unusable -> return a hard Chinese `Err`; do not emit a successful result.
- Cancellation flag set -> return `仓库扫描已取消`; `lib.rs` emits the existing cancelled progress event.
- Root/child canonicalize failure -> append `规范化目录失败` warning and continue.
- `read_dir` failure (including a file passed as a root) -> append `读取目录失败` warning and continue other roots.
- Directory entry or file-type read failure -> append the matching operation warning and continue.
- Broken symlink/junction target metadata -> append `读取链接目标失败` warning and continue.
- Canonical identity already visited -> skip silently; this is normal deduplication, not a warning.
- More than 49 unique path failures -> keep the first 49 details and add one `另有 N 个路径问题未逐条显示` summary.

### 5. Good/Base/Bad Cases

- Good: root A contains a repository and a link back to A; scanning returns the repository once, finishes with two or fewer visited directories, and reports no error.
- Base: ordinary roots without links preserve the previous repository list, ordering, progress, and cache behavior.
- Good partial failure: one missing root and one valid root return the valid repository plus a Chinese warning.
- Bad: deduplicating repositories only after recursion; a directory loop may run until path-length or stack failure before the result is deduplicated.
- Bad: storing every warning string in a `seen` set after the visible warning cap; the UI is bounded while memory remains unbounded.

### 6. Tests Required

- Rust tests for invalid roots, deterministic `read_dir` failure, broken directory links, warning dedupe/cap, overlapping roots, progress, and cancellation.
- Unix symlink-cycle test and Windows conditional directory-symlink cycle test; the Windows test may return early only when the OS refuses link creation.
- Playwright must assert a scan can update valid repositories while displaying returned warning detail and warning status.
- Run `npm run build`, `npm run test:e2e`, `cargo check`, `cargo test`, and `cargo fmt -- --check` after changing this contract.

### 7. Wrong vs Correct

#### Wrong

```rust
if path.is_dir() {
    visit_dir(&path)?; // Follows aliases before any physical-directory dedupe.
}
```

#### Correct

```rust
let Some(canonical_dir) = self.canonicalize_dir(dir) else {
    return Ok(());
};
if !self.visited_dirs.insert(canonical_dir.clone()) {
    return Ok(());
}
self.scanned_dirs += 1;
self.emit_current_progress(root_dir, &canonical_dir);
```

## Scenario: App-Level Outbound Proxy

### 1. Scope / Trigger

- Trigger: any GitPulse-owned outbound HTTP request that may need to reach external APIs, including AI providers, ChatGPT Codex OAuth, model listing, GitHub diagnostics, or future network diagnostics.
- The proxy is application-level only: it must not modify OS proxy settings, local Git scanning, local filesystem work, or Tauri updater internals.

### 2. Signatures

- `network::client(timeout: Duration, proxy: &ProxyConfig) -> Result<reqwest::blocking::Client, String>`
- Tauri commands:
  - `scan_proxy_candidates() -> Result<Vec<ProxyCandidate>, String>`
  - `test_proxy_connection(config: ProxyConfig) -> Result<ProxyTestResult, String>`
  - `get_secure_proxy_password() -> Result<Option<String>, String>`
  - `set_secure_proxy_password(password: String) -> Result<(), String>`
  - `clear_secure_proxy_password() -> Result<(), String>`

### 3. Contracts

- `ProxyConfig` uses camelCase over IPC:
  - `mode`: `"off" | "custom"`
  - `url`: proxy URL, currently `http://`, `https://`, or `socks5://`
  - `username`: optional proxy username
  - `password`: optional in-memory proxy password
  - `passwordSaved`: whether Rust may load the password from OS secure storage when `password` is empty
- `ProxyCandidate` response fields:
  - `url`: candidate proxy URL
  - `label`: Chinese UI label
- `ProxyTestResult` response fields:
  - `ok`: whether the test endpoint returned success
  - `message`: Chinese status/error detail
  - `latencyMs`: elapsed milliseconds

### 4. Validation & Error Matrix

- `mode != "custom"` -> no proxy is attached.
- `mode == "custom"` with empty `url` during normal requests -> no proxy is attached; connection test should return `请先填写代理地址`.
- Unsupported URL scheme -> return `代理地址仅支持 http://、https:// 或 socks5://`.
- `username` present, `password` empty, `passwordSaved == true`, secure store missing -> return a Chinese error asking the user to re-enter the proxy password.
- Network request failure -> return the underlying request error wrapped in a Chinese context at the call site when possible.

### 5. Good/Base/Bad Cases

- Good: AI/model/OAuth/diagnostic calls build their `reqwest` client through `network::client(timeout, &proxy)`.
- Base: proxy mode `off` preserves direct connection behavior.
- Bad: a module calls `Client::builder().build()` directly for an external API and silently bypasses the app proxy.

### 6. Tests Required

- Unit tests for accepted and rejected proxy URL schemes.
- Existing AI, diagnostics, and report tests must construct `ProxyConfig::default()` when they instantiate `AiConfig` or `DiagnosticOptions`.
- Frontend `npm run build` must pass to prove `src/model.ts` proxy payload mirrors `models.rs`.
- Rust `cargo check` and `cargo test` must pass after adding or changing proxy-aware network calls.

### 7. Wrong vs Correct

#### Wrong

```rust
let client = reqwest::blocking::Client::builder()
    .timeout(Duration::from_secs(30))
    .build()?;
```

#### Correct

```rust
let client = crate::network::client(Duration::from_secs(30), &config.proxy)?;
```

## Scenario: Report Redaction Options

### 1. Scope / Trigger

- Trigger: any report generation command that can include sensitive local Git context in report text or evidence detail.
- Applies to `extract_commits`, `generate_monthly_report`, and `generate_period_report` payloads.
- The redaction feature is report-rendering scope only: it must not change Git extraction, author matching, repository discovery, or saved credential handling.

### 2. Signatures

- Rust models:
  - `ReportRedactionOptions { enabled: bool, rules: Vec<ReportRedactionRule> }`
  - `ReportRedactionRule { find: String, replacement: String }`
- Frontend builders:
  - `buildExtractOptions(...).redaction`
  - `buildMonthlyOptions(...).redaction`
  - `buildPeriodReportOptions(...).redaction`
- Report rendering:
  - Redaction is applied inside `report.rs` before template values are rendered.

### 3. Contracts

- IPC uses camelCase:
  - `redaction.enabled`: whether report-time redaction is active.
  - `redaction.rules[].find`: literal sensitive text to replace.
  - `redaction.rules[].replacement`: literal replacement; empty replacement becomes `***`.
- When `enabled == false`, report output must remain compatible with the existing templates and evidence detail behavior.
- When `enabled == true`, report rendering must:
  - alias repository/project names to stable per-report names such as `仓库1`;
  - alias branch names to stable per-report names such as `分支1`;
  - alias authors to stable per-report names such as `作者1`;
  - alias commit hashes to stable per-report names such as `commit-1`;
  - suppress generated evidence-link URLs by rendering without evidence link rules;
  - apply custom literal replacements to report text.
- Dates remain unchanged so users can still verify the report period.

### 4. Validation & Error Matrix

- Missing `redaction` field -> Rust serde default disables redaction.
- Empty or missing `rules` -> automatic aliasing still applies when `enabled == true`.
- Empty `find` -> frontend parser skips the rule.
- Duplicate `find` -> frontend parser keeps the first rule.
- Empty replacement -> frontend and Rust both treat it as `***`.

### 5. Good/Base/Bad Cases

- Good: weekly report with evidence detail and redaction enabled shows `来源：仓库1 / 分支1 / 日期 / commit-1`, while hiding raw repository, branch, author email, hash, and generated URLs.
- Base: redaction disabled preserves existing report text and evidence links.
- Bad: frontend adds a redaction setting but does not include it in every report option builder, causing daily/custom/monthly/weekly paths to diverge.

### 6. Tests Required

- Rust report unit test asserting redacted weekly evidence keeps traceability and removes raw repository, branch, author email, hash, mapped project name, and generated URL.
- Existing report rendering tests must continue passing with redaction disabled.
- Playwright workbench test asserting weekly generation payload includes `redaction.enabled` and parsed custom rules.
- `npm run build`, `cd src-tauri && cargo check`, and `cd src-tauri && cargo test` must pass after payload changes.

### 7. Wrong vs Correct

#### Wrong

```typescript
return {
  showEvidenceDetails: settings.showEvidenceDetails,
  // Missing redaction: weekly reports silently expose raw evidence detail.
};
```

#### Correct

```typescript
return {
  showEvidenceDetails: settings.showEvidenceDetails,
  redaction: buildReportRedactionOptions(settings),
};
```

## Scenario: Open a User-Selected Output Directory

### 1. Scope / Trigger

- Trigger: a frontend action must open a report output directory selected at runtime.
- Tauri opener permissions have two gates: command permission and path scope. `opener:allow-open-path` alone does not allow arbitrary user-selected paths.

### 2. Signatures

- Frontend: `invoke<void>("open_output_directory", { path })`
- Tauri command: `fn open_output_directory(app: AppHandle, path: String) -> Result<(), String>`
- Validation owner: `report::validate_output_directory(output_dir: &str) -> Result<PathBuf, String>`

### 3. Contracts

- `path` is trimmed and must resolve to an existing directory.
- The Rust command opens only directories through `OpenerExt::open_path`; it must not accept files or an `openWith` program.
- Frontend code must not request `opener:allow-open-path` with a full-filesystem wildcard to support runtime-selected output paths.
- Rust errors are returned to the dialog and displayed in Chinese.

### 4. Validation & Error Matrix

- Empty path -> `请先在设置中选择输出目录`.
- Missing/inaccessible path -> `输出目录不存在或当前无法访问`.
- Existing file path -> `输出路径不是文件夹`.
- Existing directory + opener failure -> `打开输出目录失败：<cause>`.
- Existing directory + opener success -> return `Ok(())`.

### 5. Good/Base/Bad Cases

- Good: the user selects `C:\\Users\\name\\Desktop`; the frontend invokes the app command and Rust validates then opens Explorer.
- Base: the generated batch result returns the selected path unchanged and the completion button opens that path.
- Bad: granting `{ "path": "**" }` to frontend `open_path`; a compromised WebView could request arbitrary files or executables.

### 6. Tests Required

- Rust tests must keep rejecting missing directories and file paths through the shared validator.
- Playwright must assert the completion action invokes `open_output_directory` with `BatchReportResult.outputDir`.
- Run `npm run build`, `cd src-tauri && cargo check`, and `cd src-tauri && cargo test`.

### 7. Wrong vs Correct

#### Wrong

```typescript
await openPath(result.outputDir); // Requires a static path scope or unsafe wildcard.
```

#### Correct

```typescript
await invoke("open_output_directory", { path: result.outputDir });
```

## Scenario: Batch Multi-Format Export and File Naming

### 1. Scope / Trigger

- Trigger: one logical batch period must produce one or more file formats with a user-configurable file name.
- Applies only to `batch_generate_reports`; single-report export commands keep their existing scalar format contract.

### 2. Signatures

- Frontend builder: `buildBatchReportOptions(..., exportFormats: ReportExportFormat[], fileNameTemplate: string, ...)`.
- Rust payload: `BatchReportOptions { export_formats: Vec<String>, file_name_template: String, ... }`.
- Naming: `report::batch_file_name(template, format, BatchFileNameContext) -> Result<String, String>`.
- Collision handling: `report::reserve_batch_file_name(output_dir, candidate, used_names) -> String`.

### 3. Contracts

- `exportFormats` contains at least one of `markdown`, `docx`, or `pdf`; Rust normalizes aliases and preserves first-seen order while removing duplicates.
- Report content is generated once per logical period, then reused for every selected format.
- Default template is `{period}-{type}.{ext}`.
- Supported tokens are `{period}`, `{date}`, `{week}`, `{month}`, `{startDate}`, `{endDate}`, `{author}`, `{project}`, `{type}`, and `{ext}`.
- `{ext}` must be the final template token. Rust sanitizes control characters and Windows-invalid file-name characters.
- Progress and result totals count attempted output files. `3 periods * 2 formats == 6 total`.
- A batch may attempt at most 365 output files, calculated as `period count * group count * normalized format count` after group discovery and before report file writes.
- Existing files and duplicate names in the same run receive `-2`, `-3`, and later suffixes before the extension.

### 4. Validation & Error Matrix

- Empty `exportFormats` -> `请至少选择一种导出格式`.
- Unsupported format -> `暂不支持的导出格式`.
- Empty template -> `文件名模板不能为空`.
- Template not ending in `.{ext}` -> `文件名模板必须以 .{ext} 结尾`.
- Unknown or unmatched token -> actionable Chinese template error before Git extraction starts.
- More than 365 output files -> reject the entire batch after group discovery and before period rendering or file writes.
- One format write failure -> record that file failure and continue later formats and periods.
- Period generation failure -> record one failure for each selected format because none of its files can be produced.

### 5. Good/Base/Bad Cases

- Good: two periods with Markdown and Word generate content twice and write four files with `total == 4`.
- Base: default options select Markdown only and preserve the MVP file names.
- Bad: regenerate content inside the format loop; this repeats Git scans and can make formats contain different report content.
- Bad: write a rendered name directly without sanitizing or reserving it; templates could traverse paths or overwrite files.

### 6. Tests Required

- Rust unit tests cover format normalization, every token family, invalid templates, sanitizing, and collision suffixes.
- Rust smoke test uses a temporary Git repository and asserts multiple real output formats plus file-based progress totals.
- Playwright asserts multi-select validation and the exact `exportFormats` / `fileNameTemplate` IPC payload.
- Run `npm run build`, `npm run test:e2e`, `cd src-tauri && cargo check`, and `cd src-tauri && cargo test`.

### 7. Wrong vs Correct

#### Wrong

```rust
for format in &options.export_formats {
    let content = generate_single_report(&options, period)?;
    save_report_document(&options.output_dir, "report", &content, format)?;
}
```

#### Correct

```rust
let content = generate_single_report(&options, period)?;
for format in &formats {
    let candidate = report::batch_file_name(&options.file_name_template, format, context)?;
    let file_name = report::reserve_batch_file_name(
        &options.output_dir,
        &candidate,
        &mut used_names,
    );
report::save_report_document(&options.output_dir, &file_name, &content, format)?;
}
```

### 8. Grouping Extension

- `groupMode` / `group_mode` accepts `all`, `author`, or `project`; missing values default to `all`.
- Author grouping happens after the existing author-alias normalization.
- Project grouping must reuse the report module's project mapping resolver and its `仓库(分支)` fallback.
- Group identities are derived once from commits across the full requested range, then reused for every period.
- Empty period/group intersections generate empty reports; an entirely empty author/project grouping request returns a Chinese validation error.
- Grouped totals and the 365-file limit use `period count * group count * normalized format count`.
- `splitGranularity = custom` creates one custom report period covering the full selected date range and reuses the existing custom report template.
- Rust regression coverage must include group derivation, empty group rejection, grouped real-file output, custom-range splitting, and output totals.
- Playwright must cover group selection, group-specific default templates, custom granularity, and the exact camelCase IPC payload.

## Scenario: Period-Scoped Non-Git Supplemental Facts

### 1. Scope / Trigger

- Trigger: a daily, weekly, monthly, or custom report must include user-provided work facts that do not have a Git commit.
- These facts belong to one report mode and date range. They are report content, not commit evidence, workspace settings, or batch-report defaults.

### 2. Signatures

- Frontend builders accept a final `supplementalItems: string[] = []` argument:
  - `buildExtractOptions(...)`
  - `buildMonthlyOptions(...)`
  - `buildPeriodReportOptions(...)`
- History: `ReportHistoryEntry.supplementalItems?: string[]`.
- Rust request models expose `#[serde(default)] supplemental_items: Vec<String>` on `ExtractOptions`, `MonthlyReportOptions`, and `PeriodReportOptions`.
- Rendering boundary: `report::append_supplemental_items(report_text, items, redaction) -> Result<String, String>`.

### 3. Contracts

- IPC uses camelCase `supplementalItems`; at most 20 non-empty items are accepted and each item may contain at most 200 Unicode characters.
- The frontend draft key is `PreviewMode + startDate + endDate`; changing mode or period must not copy facts into another report.
- Rust appends a standard `## 用户补充事项（非 Git）` section after template rendering and before optional AI enhancement. This ordering keeps local output and AI-failure fallback truthful.
- Supplemental facts must not change commit count, project count, line statistics, evidence links, or repository grouping.
- When report redaction is enabled, custom literal replacement rules also apply to the appended section.
- Batch reports do not accept supplemental facts because one batch spans several independently attributable periods.
- Missing history fields and missing IPC fields normalize to an empty list for backward compatibility.

### 4. Validation & Error Matrix

- Missing field or empty list -> preserve the previous report output byte-for-byte.
- Blank lines/items -> trim and ignore them.
- More than 20 normalized items -> `补充事项最多填写 20 项`.
- Item longer than 200 Unicode characters -> `第 N 条补充事项不能超过 200 个字符`.
- Old history without `supplementalItems` -> load the record and restore an empty draft.
- Persisted `supplementalItems` containing non-string values -> reject it through the report-history type guard instead of casting raw JSON.

### 5. Good/Base/Bad Cases

- Good: a weekly report appends meeting and rollout-verification facts, sends the resulting report to AI with a fact-preservation instruction, and saves the original item array in history.
- Base: no supplemental facts keeps existing templates, statistics, and exports unchanged.
- Bad: add supplemental text to commit arrays or evidence sections; this inflates statistics and falsely presents user statements as Git evidence.
- Bad: reuse one global draft across report modes or periods; facts then leak into the wrong report.

### 6. Tests Required

- Rust unit tests assert normalized rendering, redaction, item-count rejection, and character-limit rejection.
- A period pipeline smoke test asserts the appended section while `commit_count` remains derived only from Git commits.
- Playwright asserts all four report-mode payloads, preview/history round-trip, period isolation, AI fact instruction, invalid-input blocking, and draft clearing.
- Run `npm run build`, `npm run test:e2e`, `cd src-tauri && cargo check`, and `cd src-tauri && cargo test`.

### 7. Wrong vs Correct

#### Wrong

```rust
commits.push(CommitRecord::from_user_note(item));
```

#### Correct

```rust
report_text = report::append_supplemental_items(
    &report_text,
    &options.supplemental_items,
    &options.redaction,
)?;
report_text = apply_ai_to_period_report(
    report_text,
    &options,
    &dates,
    &report_author,
    &mut warnings,
);
```
