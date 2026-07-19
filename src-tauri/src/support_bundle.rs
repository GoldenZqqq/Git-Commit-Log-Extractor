mod sanitize;

use crate::models::{
    DiagnosticItem, DiagnosticResult, DiagnosticSeverity, SupportBundleEntryPreview,
    SupportBundleEventInput, SupportBundleExportResult, SupportBundleOptions, SupportBundlePreview,
    WorkspaceRepoStatus, WorkspaceRootStatus,
};
use crate::support_bundle::sanitize::Sanitizer;
use crate::zip_store::{write_zip, StoredFile};
use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::time::Instant;

const SCHEMA_VERSION: u32 = 1;
const MAX_EVENTS: usize = 50;
const MAX_EVENT_CHARS: usize = 500;
const MAX_DIAGNOSTIC_CHARS: usize = 1_000;
const MAX_ENTRY_BYTES: usize = 128 * 1024;
const MAX_ARCHIVE_BYTES: usize = 512 * 1024;
const ENTRY_NAMES: [&str; 3] = ["summary.md", "diagnostics.json", "recent-events.log"];
const EXCLUDED_DATA: [&str; 8] = [
    "API Key、OAuth token 与代理密码",
    "绝对路径、仓库名称与分支名称",
    "原始 commit 内容与 Git 历史",
    "报告草稿与报告历史",
    "项目映射与作者身份",
    "安全凭据库内容",
    "操作系统日志",
    "自动上传或遥测数据",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BundleDocument {
    schema_version: u32,
    generated_at: String,
    application: ApplicationSummary,
    git_version: String,
    diagnostics: DiagnosticSummary,
    workspace: WorkspaceSummary,
    timings: TimingSummary,
    recent_event_count: usize,
    excluded_data: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplicationSummary {
    version: &'static str,
    os: &'static str,
    arch: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticSummary {
    items: Vec<SafeDiagnosticItem>,
    ok_count: usize,
    warning_count: usize,
    error_count: usize,
    failure: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SafeDiagnosticItem {
    id: String,
    label: String,
    severity: &'static str,
    message: String,
    action: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSummary {
    root_status_counts: BTreeMap<&'static str, usize>,
    repository_status_counts: BTreeMap<&'static str, usize>,
    disabled_repository_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TimingSummary {
    workspace_health_ms: u64,
    snapshot_build_ms: u64,
}

struct SafeEvent {
    occurred_at: String,
    level: &'static str,
    message: String,
}

pub fn preview(options: SupportBundleOptions) -> Result<SupportBundlePreview, String> {
    build_preview(options)
}

pub fn export(
    path: &Path,
    options: SupportBundleOptions,
) -> Result<SupportBundleExportResult, String> {
    validate_output_path(path)?;
    let preview = build_preview(options)?;
    let files = preview
        .entries
        .iter()
        .map(|entry| StoredFile {
            name: entry.name.clone(),
            bytes: entry.content.as_bytes().to_vec(),
        })
        .collect::<Vec<_>>();
    let archive = write_zip(&files);
    if archive.len() > MAX_ARCHIVE_BYTES {
        return Err(format!(
            "支持包超过 {} KiB 安全上限，未写入文件",
            MAX_ARCHIVE_BYTES / 1024
        ));
    }
    fs::write(path, &archive).map_err(|error| format!("保存支持包失败：{error}"))?;
    Ok(SupportBundleExportResult {
        output_file: path.to_string_lossy().to_string(),
        bytes: archive.len(),
    })
}

fn build_preview(options: SupportBundleOptions) -> Result<SupportBundlePreview, String> {
    let started_at = Instant::now();
    let sanitizer = Sanitizer::new(collect_private_values(&options));
    let workspace_started_at = Instant::now();
    let health = crate::workspace_health::inspect(options.workspace.clone());
    let workspace_health_ms = elapsed_ms(workspace_started_at);
    let diagnostics = safe_diagnostics(options.diagnostics, &options.diagnostic_error, &sanitizer);
    let workspace = summarize_workspace(&health);
    let events = safe_events(options.recent_events, &sanitizer);
    let generated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    let excluded_data = EXCLUDED_DATA
        .iter()
        .map(|value| (*value).to_string())
        .collect();
    let timings = TimingSummary {
        workspace_health_ms,
        snapshot_build_ms: elapsed_ms(started_at),
    };
    let document = BundleDocument {
        schema_version: SCHEMA_VERSION,
        generated_at: generated_at.clone(),
        application: ApplicationSummary {
            version: env!("CARGO_PKG_VERSION"),
            os: std::env::consts::OS,
            arch: std::env::consts::ARCH,
        },
        git_version: sanitizer.sanitize(
            &crate::git_ops::git_version().unwrap_or_else(|error| error),
            MAX_DIAGNOSTIC_CHARS,
        ),
        diagnostics,
        workspace,
        timings,
        recent_event_count: events.len(),
        excluded_data,
    };
    let entries = build_entries(&document, &events, &sanitizer)?;
    Ok(SupportBundlePreview {
        schema_version: SCHEMA_VERSION,
        generated_at,
        suggested_file_name: format!(
            "gitpulse-support-{}.zip",
            Utc::now().format("%Y%m%d-%H%M%S")
        ),
        entries,
        excluded_data: document.excluded_data.clone(),
        issue_title: format!(
            "GitPulse 支持请求 · v{} · {}",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS
        ),
        issue_body: render_issue_body(&document),
    })
}

fn safe_diagnostics(
    diagnostics: Option<DiagnosticResult>,
    diagnostic_error: &str,
    sanitizer: &Sanitizer,
) -> DiagnosticSummary {
    let diagnostics_missing = diagnostics.is_none();
    let items = diagnostics
        .map(|result| result.items)
        .unwrap_or_default()
        .into_iter()
        .map(|item| safe_diagnostic(item, sanitizer))
        .collect::<Vec<_>>();
    let ok_count = count_diagnostics(&items, "ok");
    let warning_count = count_diagnostics(&items, "warning");
    let error_count = count_diagnostics(&items, "error");
    let failure = sanitizer
        .sanitize(diagnostic_error, MAX_DIAGNOSTIC_CHARS)
        .trim()
        .to_string();
    let failure = if failure.is_empty() && diagnostics_missing {
        "诊断结果未提供".to_string()
    } else {
        failure
    };
    DiagnosticSummary {
        items,
        ok_count,
        warning_count,
        error_count,
        failure: (!failure.is_empty()).then_some(failure),
    }
}

fn safe_diagnostic(item: DiagnosticItem, sanitizer: &Sanitizer) -> SafeDiagnosticItem {
    SafeDiagnosticItem {
        id: sanitizer.sanitize(&item.id, 80),
        label: sanitizer.sanitize(&item.label, 120),
        severity: severity_name(&item.severity),
        message: sanitizer.sanitize(&item.message, MAX_DIAGNOSTIC_CHARS),
        action: sanitizer.sanitize(&item.action, MAX_DIAGNOSTIC_CHARS),
    }
}

fn safe_events(events: Vec<SupportBundleEventInput>, sanitizer: &Sanitizer) -> Vec<SafeEvent> {
    let mut bounded = events
        .into_iter()
        .rev()
        .take(MAX_EVENTS)
        .map(|event| SafeEvent {
            occurred_at: sanitizer.sanitize_line(&event.occurred_at, 64),
            level: event_level(&event.level),
            message: sanitizer.sanitize_line(&event.message, MAX_EVENT_CHARS),
        })
        .collect::<Vec<_>>();
    bounded.reverse();
    bounded
}

fn build_entries(
    document: &BundleDocument,
    events: &[SafeEvent],
    sanitizer: &Sanitizer,
) -> Result<Vec<SupportBundleEntryPreview>, String> {
    let json = serde_json::to_string_pretty(document)
        .map_err(|error| format!("序列化支持包诊断数据失败：{error}"))?;
    let contents = [
        (
            ENTRY_NAMES[0],
            "版本、平台、聚合状态与失败摘要",
            render_summary(document),
        ),
        (ENTRY_NAMES[1], "机器可读的脱敏诊断与健康计数", json),
        (
            ENTRY_NAMES[2],
            "当前会话最近的脱敏应用事件",
            render_events(events),
        ),
    ];
    let mut total_bytes = 0;
    let mut entries = Vec::with_capacity(contents.len());
    for (name, description, content) in contents {
        let content = sanitizer.sanitize(&content, MAX_ENTRY_BYTES);
        let bytes = content.len();
        if bytes > MAX_ENTRY_BYTES {
            return Err(format!("支持包条目 {name} 超过安全上限"));
        }
        total_bytes += bytes;
        entries.push(SupportBundleEntryPreview {
            name: name.to_string(),
            description: description.to_string(),
            content,
            bytes,
        });
    }
    if total_bytes > MAX_ARCHIVE_BYTES / 2 {
        return Err("支持包预览内容超过安全上限".to_string());
    }
    Ok(entries)
}

fn render_summary(document: &BundleDocument) -> String {
    let failures = failure_lines(document);
    let failure_text = if failures.is_empty() {
        "- 未记录异常步骤".to_string()
    } else {
        failures
            .iter()
            .map(|failure| format!("- {failure}"))
            .collect::<Vec<_>>()
            .join("\n")
    };
    format!(
        "# GitPulse 支持摘要\n\n- Schema：{}\n- 生成时间：{}\n- GitPulse：v{}\n- 平台：{} / {}\n- Git：{}\n- 诊断：{} 异常 / {} 提醒 / {} 正常\n- 工作区目录：{}\n- Repository Index：{}\n- 工作区健康检查：{} ms\n- 快照构建：{} ms\n\n## 最近异常\n\n{}\n\n## 明确排除\n\n{}\n",
        document.schema_version,
        document.generated_at,
        document.application.version,
        document.application.os,
        document.application.arch,
        document.git_version,
        document.diagnostics.error_count,
        document.diagnostics.warning_count,
        document.diagnostics.ok_count,
        count_total(&document.workspace.root_status_counts),
        count_total(&document.workspace.repository_status_counts),
        document.timings.workspace_health_ms,
        document.timings.snapshot_build_ms,
        failure_text,
        document
            .excluded_data
            .iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
    )
}

fn render_events(events: &[SafeEvent]) -> String {
    if events.is_empty() {
        return "当前会话没有可导出的应用事件。\n".to_string();
    }
    events
        .iter()
        .map(|event| {
            format!(
                "[{}] [{}] {}",
                event.occurred_at,
                event.level.to_ascii_uppercase(),
                event.message
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}

fn render_issue_body(document: &BundleDocument) -> String {
    format!(
        "## Environment\n- GitPulse: v{}\n- Platform: {} / {}\n- Git: {}\n\n## Safe summary\n- Diagnostics: {} errors, {} warnings, {} ok\n- Workspace directories: {}\n- Repository index entries: {}\n- Disabled repositories: {}\n\nA redacted Support Bundle can be attached manually after review. GitPulse did not upload or attach any local file.\n",
        document.application.version,
        document.application.os,
        document.application.arch,
        document.git_version,
        document.diagnostics.error_count,
        document.diagnostics.warning_count,
        document.diagnostics.ok_count,
        count_total(&document.workspace.root_status_counts),
        count_total(&document.workspace.repository_status_counts),
        document.workspace.disabled_repository_count,
    )
}

fn failure_lines(document: &BundleDocument) -> Vec<String> {
    let mut failures = Vec::new();
    if let Some(failure) = &document.diagnostics.failure {
        failures.push(format!("诊断执行：{failure}"));
    }
    failures.extend(
        document
            .diagnostics
            .items
            .iter()
            .filter(|item| item.severity == "error")
            .map(|item| format!("{}：{}", item.label, item.message))
            .take(5usize.saturating_sub(failures.len())),
    );
    failures
}

fn summarize_workspace(health: &crate::models::WorkspaceHealthResult) -> WorkspaceSummary {
    let mut root_status_counts = root_count_map();
    let mut repository_status_counts = repository_count_map();
    for root in &health.roots {
        *root_status_counts
            .entry(root_status_name(root.status))
            .or_default() += 1;
    }
    for repo in &health.repos {
        *repository_status_counts
            .entry(repository_status_name(repo.status))
            .or_default() += 1;
    }
    WorkspaceSummary {
        root_status_counts,
        repository_status_counts,
        disabled_repository_count: health.repos.iter().filter(|repo| repo.disabled).count(),
    }
}

fn collect_private_values(options: &SupportBundleOptions) -> Vec<String> {
    let mut values = Vec::new();
    values.extend(options.workspace.root_dirs.iter().cloned());
    values.extend(options.workspace.disabled_repos.iter().cloned());
    for repo in &options.workspace.indexed_repos {
        values.extend([repo.path.clone(), repo.name.clone(), repo.branch.clone()]);
    }
    values.extend([
        options.privacy.author.clone(),
        options.privacy.output_dir.clone(),
        options.privacy.ai_base_url.clone(),
        options.privacy.proxy_url.clone(),
        options.privacy.proxy_username.clone(),
    ]);
    values.extend(
        options
            .privacy
            .author
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned),
    );
    values
}

fn validate_output_path(path: &Path) -> Result<(), String> {
    let extension = path.extension().and_then(|value| value.to_str());
    if !extension.is_some_and(|value| value.eq_ignore_ascii_case("zip")) {
        return Err("支持包文件名必须使用 .zip 扩展名".to_string());
    }
    if path.is_dir() {
        return Err("支持包输出路径不能是目录".to_string());
    }
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        if !parent.is_dir() {
            return Err("支持包输出目录不存在或不可访问".to_string());
        }
    }
    Ok(())
}

fn root_count_map() -> BTreeMap<&'static str, usize> {
    ["healthy", "missing", "inaccessible", "notDirectory"]
        .into_iter()
        .map(|key| (key, 0))
        .collect()
}

fn repository_count_map() -> BTreeMap<&'static str, usize> {
    [
        "healthy",
        "missing",
        "inaccessible",
        "notGit",
        "branchUnknown",
        "branchChanged",
    ]
    .into_iter()
    .map(|key| (key, 0))
    .collect()
}

fn root_status_name(status: WorkspaceRootStatus) -> &'static str {
    match status {
        WorkspaceRootStatus::Healthy => "healthy",
        WorkspaceRootStatus::Missing => "missing",
        WorkspaceRootStatus::Inaccessible => "inaccessible",
        WorkspaceRootStatus::NotDirectory => "notDirectory",
    }
}

fn repository_status_name(status: WorkspaceRepoStatus) -> &'static str {
    match status {
        WorkspaceRepoStatus::Healthy => "healthy",
        WorkspaceRepoStatus::Missing => "missing",
        WorkspaceRepoStatus::Inaccessible => "inaccessible",
        WorkspaceRepoStatus::NotGit => "notGit",
        WorkspaceRepoStatus::BranchUnknown => "branchUnknown",
        WorkspaceRepoStatus::BranchChanged => "branchChanged",
    }
}

fn count_diagnostics(items: &[SafeDiagnosticItem], severity: &str) -> usize {
    items
        .iter()
        .filter(|item| item.severity == severity)
        .count()
}

fn count_total(counts: &BTreeMap<&'static str, usize>) -> usize {
    counts.values().sum()
}

fn severity_name(severity: &DiagnosticSeverity) -> &'static str {
    match severity {
        DiagnosticSeverity::Ok => "ok",
        DiagnosticSeverity::Warning => "warning",
        DiagnosticSeverity::Error => "error",
    }
}

fn event_level(level: &str) -> &'static str {
    match level.trim().to_ascii_lowercase().as_str() {
        "success" => "success",
        "warning" => "warning",
        "error" => "error",
        _ => "info",
    }
}

fn elapsed_ms(started_at: Instant) -> u64 {
    started_at
        .elapsed()
        .as_millis()
        .max(1)
        .min(u64::MAX as u128) as u64
}

#[cfg(test)]
#[path = "support_bundle/tests.rs"]
mod tests;
