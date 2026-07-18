use crate::{
    docx,
    models::{
        CommitRecord, EvidenceLinkRule, ExtractResult, MonthlyReportResult, PeriodReportResult,
        RepoInfo, ReportFormatTemplates, ReportRedactionOptions, ReportRedactionRule, SubPeriod,
    },
    pdf,
    project_retrospective::{self, ReportHistoryProject},
};
use chrono::{Datelike, Duration, Local, NaiveDate};
use regex::Regex;
use std::borrow::Cow;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

pub struct ExtractReportFormat<'a> {
    pub start_date: &'a str,
    pub end_date: &'a str,
    pub author: &'a str,
    pub period_label: &'a str,
    pub report_kind: &'a str,
    pub evidence_link_rules: &'a [EvidenceLinkRule],
    pub templates: &'a ReportFormatTemplates,
}

const MAX_SUPPLEMENTAL_ITEMS: usize = 20;
const MAX_SUPPLEMENTAL_ITEM_CHARS: usize = 200;

pub fn append_supplemental_items(
    report_text: &str,
    items: &[String],
    redaction: &ReportRedactionOptions,
) -> Result<String, String> {
    let normalized = normalize_supplemental_items(items)?;
    if normalized.is_empty() {
        return Ok(report_text.to_string());
    }

    let lines = normalized
        .iter()
        .map(|item| format!("- {item}"))
        .collect::<Vec<_>>()
        .join("\n");
    let section = format!("## 用户补充事项（非 Git）\n\n{lines}");
    let section = if redaction.enabled {
        apply_redaction_rules_to_text(&section, &redaction.rules)
    } else {
        section
    };
    let base = report_text.trim();
    Ok(if base.is_empty() {
        section
    } else {
        format!("{base}\n\n{section}")
    })
}

fn normalize_supplemental_items(items: &[String]) -> Result<Vec<String>, String> {
    let normalized = items
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();
    if normalized.len() > MAX_SUPPLEMENTAL_ITEMS {
        return Err(format!("补充事项最多填写 {MAX_SUPPLEMENTAL_ITEMS} 项"));
    }
    if let Some(index) = normalized
        .iter()
        .position(|item| item.chars().count() > MAX_SUPPLEMENTAL_ITEM_CHARS)
    {
        return Err(format!(
            "第 {} 条补充事项不能超过 {MAX_SUPPLEMENTAL_ITEM_CHARS} 个字符",
            index + 1
        ));
    }
    Ok(normalized.into_iter().map(str::to_string).collect())
}

pub fn previous_month_range() -> (String, String, String) {
    let today = Local::now().date_naive();
    previous_month_range_from(today)
}

pub fn previous_month_range_from(today: NaiveDate) -> (String, String, String) {
    let first_this_month = today.with_day(1).unwrap();
    let last_previous_month = first_this_month - Duration::days(1);
    let first_previous_month = last_previous_month.with_day(1).unwrap();
    (
        first_previous_month.format("%Y-%m-%d").to_string(),
        last_previous_month.format("%Y-%m-%d").to_string(),
        first_previous_month.format("%Y-%m").to_string(),
    )
}

pub fn build_extract_result(
    repos: Vec<RepoInfo>,
    commits: Vec<CommitRecord>,
    warnings: Vec<String>,
    project_names: &HashMap<String, String>,
    show_project_and_branch: bool,
    commit_item_prefix_mode: &str,
    show_evidence_details: bool,
    detailed_output: bool,
    redaction: &ReportRedactionOptions,
    format: ExtractReportFormat,
) -> ExtractResult {
    if !redaction.enabled {
        let projects = build_report_history_projects(&commits, project_names, redaction);
        let summary_text = render_extract_report(
            &commits,
            project_names,
            show_project_and_branch,
            commit_item_prefix_mode,
            show_evidence_details,
            &format,
        );
        let detailed_text = if detailed_output {
            render_detailed_report(&summary_text, &commits)
        } else {
            String::new()
        };
        return ExtractResult {
            summary_text,
            detailed_text,
            repos,
            commits,
            projects,
            warnings,
        };
    }

    let prepared = prepare_report_input(
        &commits,
        project_names,
        format.evidence_link_rules,
        format.author,
        redaction,
    );
    let summary_text = render_extract_report_prepared(
        prepared.commits.as_ref(),
        prepared.project_names.as_ref(),
        show_project_and_branch,
        commit_item_prefix_mode,
        show_evidence_details,
        &format,
        prepared.evidence_link_rules.as_ref(),
        prepared.author.as_ref(),
        redaction,
    );
    let detailed_text = if detailed_output {
        render_detailed_report(&summary_text, prepared.commits.as_ref())
    } else {
        String::new()
    };
    let projects = project_retrospective::summarize_projects(prepared.commits.as_ref(), |commit| {
        monthly_project_name(prepared.project_names.as_ref(), commit)
    });
    ExtractResult {
        summary_text,
        detailed_text,
        repos,
        commits: prepared.commits.into_owned(),
        projects,
        warnings,
    }
}

pub fn build_report_history_projects(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    redaction: &ReportRedactionOptions,
) -> Vec<ReportHistoryProject> {
    let prepared = prepare_report_input(commits, project_names, &[], "", redaction);
    project_retrospective::summarize_projects(prepared.commits.as_ref(), |commit| {
        monthly_project_name(prepared.project_names.as_ref(), commit)
    })
}

pub fn render_summary_text(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    show_project_and_branch: bool,
    commit_item_prefix_mode: &str,
    show_evidence_details: bool,
    evidence_link_rules: &[EvidenceLinkRule],
) -> String {
    if commits.is_empty() {
        return "- 未检索到提交记录。".to_string();
    }
    let prefix_mode =
        CommitItemPrefixMode::from_settings(commit_item_prefix_mode, show_project_and_branch);
    commits
        .iter()
        .map(|commit| {
            render_summary_line(
                commit,
                project_names,
                prefix_mode,
                show_evidence_details,
                evidence_link_rules,
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn render_extract_report(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    show_project_and_branch: bool,
    commit_item_prefix_mode: &str,
    show_evidence_details: bool,
    format: &ExtractReportFormat,
) -> String {
    render_extract_report_prepared(
        commits,
        project_names,
        show_project_and_branch,
        commit_item_prefix_mode,
        show_evidence_details,
        format,
        format.evidence_link_rules,
        format.author,
        &ReportRedactionOptions::default(),
    )
}

fn render_extract_report_prepared(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    show_project_and_branch: bool,
    commit_item_prefix_mode: &str,
    show_evidence_details: bool,
    format: &ExtractReportFormat,
    evidence_link_rules: &[EvidenceLinkRule],
    author: &str,
    redaction: &ReportRedactionOptions,
) -> String {
    let kind = if format.report_kind == "custom" {
        "custom"
    } else {
        "daily"
    };
    let template = report_template_for(format.templates, kind);
    let period_label = resolve_period_label(
        kind,
        format.period_label,
        format.start_date,
        format.end_date,
    );
    let values = build_template_values(
        kind,
        commits,
        project_names,
        format.start_date,
        format.end_date,
        author,
        &period_label,
        show_project_and_branch,
        commit_item_prefix_mode,
        show_evidence_details,
        evidence_link_rules,
    );
    render_report_template_with_redaction(template, default_template_for(kind), &values, redaction)
}

pub fn render_monthly_report_with_template(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    start_date: &str,
    end_date: &str,
    author: &str,
    month_label: &str,
    show_evidence_details: bool,
    commit_item_prefix_mode: &str,
    evidence_link_rules: &[EvidenceLinkRule],
    template: &str,
) -> String {
    render_monthly_report_with_redaction(
        commits,
        project_names,
        start_date,
        end_date,
        author,
        month_label,
        show_evidence_details,
        commit_item_prefix_mode,
        evidence_link_rules,
        template,
        &ReportRedactionOptions::default(),
    )
}

pub fn render_monthly_report_with_redaction(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    start_date: &str,
    end_date: &str,
    author: &str,
    month_label: &str,
    show_evidence_details: bool,
    commit_item_prefix_mode: &str,
    evidence_link_rules: &[EvidenceLinkRule],
    template: &str,
    redaction: &ReportRedactionOptions,
) -> String {
    let prepared = prepare_report_input(
        commits,
        project_names,
        evidence_link_rules,
        author,
        redaction,
    );
    let period_label = resolve_period_label("monthly", month_label, start_date, end_date);
    let values = build_template_values(
        "monthly",
        prepared.commits.as_ref(),
        prepared.project_names.as_ref(),
        start_date,
        end_date,
        prepared.author.as_ref(),
        &period_label,
        false,
        commit_item_prefix_mode,
        show_evidence_details,
        prepared.evidence_link_rules.as_ref(),
    );
    render_report_template_with_redaction(
        template,
        default_template_for("monthly"),
        &values,
        redaction,
    )
}

pub fn render_weekly_report_with_template(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    start_date: &str,
    end_date: &str,
    author: &str,
    week_label: &str,
    show_evidence_details: bool,
    commit_item_prefix_mode: &str,
    evidence_link_rules: &[EvidenceLinkRule],
    template: &str,
) -> String {
    render_weekly_report_with_redaction(
        commits,
        project_names,
        start_date,
        end_date,
        author,
        week_label,
        show_evidence_details,
        commit_item_prefix_mode,
        evidence_link_rules,
        template,
        &ReportRedactionOptions::default(),
    )
}

pub fn render_weekly_report_with_redaction(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    start_date: &str,
    end_date: &str,
    author: &str,
    week_label: &str,
    show_evidence_details: bool,
    commit_item_prefix_mode: &str,
    evidence_link_rules: &[EvidenceLinkRule],
    template: &str,
    redaction: &ReportRedactionOptions,
) -> String {
    let prepared = prepare_report_input(
        commits,
        project_names,
        evidence_link_rules,
        author,
        redaction,
    );
    let period_label = resolve_period_label("weekly", week_label, start_date, end_date);
    let values = build_template_values(
        "weekly",
        prepared.commits.as_ref(),
        prepared.project_names.as_ref(),
        start_date,
        end_date,
        prepared.author.as_ref(),
        &period_label,
        false,
        commit_item_prefix_mode,
        show_evidence_details,
        prepared.evidence_link_rules.as_ref(),
    );
    render_report_template_with_redaction(
        template,
        default_template_for("weekly"),
        &values,
        redaction,
    )
}

pub fn save_report_file(
    output_dir: &str,
    file_name: &str,
    content: &str,
) -> Result<String, String> {
    let output_file = resolve_output_file(output_dir, file_name)?;
    fs::write(&output_file, content).map_err(|err| {
        format!(
            "写入报告失败：{}。请确认输出目录有写入权限：{}",
            err,
            output_dir.trim()
        )
    })?;
    Ok(output_file.to_string_lossy().to_string())
}

pub fn save_report_document(
    output_dir: &str,
    base_name: &str,
    content: &str,
    format: &str,
) -> Result<String, String> {
    let normalized = normalize_export_format(format)?;
    let file_name = format!("{}.{}", strip_known_report_extension(base_name), normalized);
    let output_file = resolve_output_file(output_dir, &file_name)?;
    let bytes = match normalized {
        "md" => return save_report_file(output_dir, &file_name, content),
        "docx" => docx::markdown_to_docx(content),
        "pdf" => pdf::markdown_to_pdf(content)?,
        _ => unreachable!("export format is normalized before writing"),
    };
    fs::write(&output_file, bytes).map_err(|err| {
        let label = match normalized {
            "docx" => "Word",
            "pdf" => "PDF",
            _ => "报告",
        };
        format!(
            "写入 {} 报告失败：{}。请确认输出目录有写入权限：{}",
            label,
            err,
            output_dir.trim()
        )
    })?;
    Ok(output_file.to_string_lossy().to_string())
}

fn resolve_output_file(output_dir: &str, file_name: &str) -> Result<PathBuf, String> {
    let dir = validate_output_directory(output_dir)?;

    let trimmed_name = file_name.trim();
    if trimmed_name.is_empty() {
        return Err("报告文件名不能为空".to_string());
    }

    Ok(dir.join(trimmed_name))
}

pub fn validate_output_directory(output_dir: &str) -> Result<PathBuf, String> {
    let trimmed_dir = output_dir.trim();
    if trimmed_dir.is_empty() {
        return Err("请先在设置中选择输出目录".to_string());
    }

    let dir = PathBuf::from(trimmed_dir);
    if !dir.exists() {
        return Err(format!(
            "输出目录不存在或当前无法访问：{}。请在设置中重新选择可用目录。",
            trimmed_dir
        ));
    }
    if !dir.is_dir() {
        return Err(format!(
            "输出路径不是文件夹：{}。请在设置中选择一个文件夹作为输出目录。",
            trimmed_dir
        ));
    }
    Ok(dir)
}

fn normalize_export_format(format: &str) -> Result<&'static str, String> {
    match format.trim().to_ascii_lowercase().as_str() {
        "markdown" | "md" => Ok("md"),
        "docx" | "word" => Ok("docx"),
        "pdf" => Ok("pdf"),
        other => Err(format!("暂不支持的导出格式：{}", other)),
    }
}

fn strip_known_report_extension(base_name: &str) -> String {
    let trimmed = base_name.trim();
    let lower = trimmed.to_ascii_lowercase();
    if lower.ends_with(".docx") {
        trimmed[..trimmed.len() - 5].to_string()
    } else if lower.ends_with(".pdf") {
        trimmed[..trimmed.len() - 4].to_string()
    } else if lower.ends_with(".md") {
        trimmed[..trimmed.len() - 3].to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn build_monthly_result(
    report_text: String,
    output_file: String,
    warnings: Vec<String>,
    dates: (String, String, String),
    project_count: usize,
    commit_count: usize,
) -> MonthlyReportResult {
    MonthlyReportResult {
        report_text,
        output_file,
        warnings,
        start_date: dates.0,
        end_date: dates.1,
        month_label: dates.2,
        project_count,
        commit_count,
    }
}

pub fn build_period_result(
    report_text: String,
    output_file: String,
    warnings: Vec<String>,
    dates: (String, String, String),
    report_kind: String,
    projects: Vec<ReportHistoryProject>,
    commit_count: usize,
) -> PeriodReportResult {
    let project_count = projects.len();
    PeriodReportResult {
        report_text,
        output_file,
        warnings,
        start_date: dates.0,
        end_date: dates.1,
        period_label: dates.2,
        report_kind,
        project_count,
        commit_count,
        projects,
    }
}

fn render_detailed_text(commits: &[CommitRecord]) -> String {
    commits
        .iter()
        .map(|commit| {
            format!(
                "Repository: {}\nHash: {}\nAuthor: {}\nDate: {}\nMessage: {}\n",
                commit.repo_path, commit.hash, commit.author, commit.date, commit.message
            )
        })
        .collect::<Vec<_>>()
        .join("\n========================================\n")
}

fn render_detailed_report(summary_text: &str, commits: &[CommitRecord]) -> String {
    let details = render_detailed_text(commits);
    if details.trim().is_empty() {
        summary_text.to_string()
    } else {
        format!("{}\n\n## 详细日志\n\n{}", summary_text.trim(), details)
    }
}

/// 映射名末尾可能带各种连接符（也可能不带）。统一在此规整：由系统补连接符，
/// 用户无需手动维护，同时兼容历史上已手动加了 "-" 的映射。
const TRAILING_CONNECTORS: [char; 8] = ['-', '_', '：', ':', '；', ';', '、', ' '];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommitItemPrefixMode {
    MappedProject,
    RepoBranchAndMapped,
    RepoBranch,
    None,
}

impl CommitItemPrefixMode {
    fn from_settings(value: &str, legacy_show_project_and_branch: bool) -> Self {
        match value.trim() {
            "mapped-project" => Self::MappedProject,
            "repo-branch-and-mapped" => Self::RepoBranchAndMapped,
            "repo-branch" => Self::RepoBranch,
            "none" => Self::None,
            "" if legacy_show_project_and_branch => Self::RepoBranchAndMapped,
            "" => Self::MappedProject,
            _ => Self::MappedProject,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProjectCommitItem {
    title: String,
    evidence: String,
    additions: u64,
    deletions: u64,
    changed_files: u32,
}

type ProjectGroups = BTreeMap<String, Vec<ProjectCommitItem>>;
type AuthorProjectGroups = BTreeMap<String, ProjectGroups>;

struct ReportTemplateValues {
    period_label: String,
    start_date: String,
    end_date: String,
    author: String,
    project_count: String,
    commit_count: String,
    project_sections: String,
    commit_items: String,
    summary: String,
    conclusion: String,
    next_steps: String,
    evidence: String,
    notes: String,
    additions: String,
    deletions: String,
    net_lines: String,
    changed_files: String,
}

struct PreparedReportInput<'a> {
    commits: Cow<'a, [CommitRecord]>,
    project_names: Cow<'a, HashMap<String, String>>,
    evidence_link_rules: Cow<'a, [EvidenceLinkRule]>,
    author: Cow<'a, str>,
}

fn build_template_values(
    kind: &str,
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    start_date: &str,
    end_date: &str,
    author: &str,
    period_label: &str,
    show_project_and_branch: bool,
    commit_item_prefix_mode: &str,
    show_evidence_details: bool,
    evidence_link_rules: &[EvidenceLinkRule],
) -> ReportTemplateValues {
    let groups = group_commits_by_project(commits, project_names, evidence_link_rules);
    let author_groups =
        group_commits_by_author_project(commits, project_names, evidence_link_rules);
    let group_by_author = should_group_by_author(author, &author_groups);
    let total_additions: u64 = commits.iter().map(|c| c.additions).sum();
    let total_deletions: u64 = commits.iter().map(|c| c.deletions).sum();
    let net_lines = total_additions as i64 - total_deletions as i64;
    let total_changed_files: u32 = commits.iter().map(|c| c.changed_files).sum();
    ReportTemplateValues {
        period_label: period_label.to_string(),
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        author: display_author(author),
        project_count: groups.len().to_string(),
        commit_count: commits.len().to_string(),
        project_sections: if group_by_author {
            lines_to_block(render_author_scoped_content(&author_groups, |groups| {
                render_actual_completion_content(groups, show_evidence_details)
            }))
        } else {
            lines_to_block(render_actual_completion_content(
                &groups,
                show_evidence_details,
            ))
        },
        commit_items: if group_by_author {
            render_author_commit_items(&author_groups, show_evidence_details)
        } else if should_render_structured_commit_items(
            commit_item_prefix_mode,
            show_project_and_branch,
            show_evidence_details,
        ) {
            render_summary_text(
                commits,
                project_names,
                show_project_and_branch,
                commit_item_prefix_mode,
                show_evidence_details,
                evidence_link_rules,
            )
        } else {
            render_flat_commit_items(commits)
        },
        summary: if group_by_author {
            lines_to_block(render_author_scoped_content(&author_groups, |groups| {
                render_summary_content(kind, groups)
            }))
        } else {
            lines_to_block(render_summary_content(kind, &groups))
        },
        conclusion: if group_by_author {
            lines_to_block(render_author_scoped_content(&author_groups, |groups| {
                render_conclusion_content(kind, groups)
            }))
        } else {
            lines_to_block(render_conclusion_content(kind, &groups))
        },
        next_steps: if group_by_author {
            lines_to_block(render_author_scoped_content(&author_groups, |groups| {
                render_next_steps_content(kind, groups)
            }))
        } else {
            lines_to_block(render_next_steps_content(kind, &groups))
        },
        evidence: if group_by_author {
            render_author_evidence_items(&author_groups)
        } else {
            render_evidence_items(commits, evidence_link_rules)
        },
        notes: report_note(kind).to_string(),
        additions: total_additions.to_string(),
        deletions: total_deletions.to_string(),
        net_lines: net_lines.to_string(),
        changed_files: total_changed_files.to_string(),
    }
}

fn render_report_template(
    template: &str,
    fallback_template: &str,
    values: &ReportTemplateValues,
) -> String {
    let source = if template.trim().is_empty() {
        fallback_template
    } else {
        template
    };
    let replacements = [
        ("{periodLabel}", values.period_label.as_str()),
        ("{startDate}", values.start_date.as_str()),
        ("{endDate}", values.end_date.as_str()),
        ("{author}", values.author.as_str()),
        ("{projectCount}", values.project_count.as_str()),
        ("{commitCount}", values.commit_count.as_str()),
        ("{projectSections}", values.project_sections.as_str()),
        ("{commitItems}", values.commit_items.as_str()),
        ("{summary}", values.summary.as_str()),
        ("{conclusion}", values.conclusion.as_str()),
        ("{nextSteps}", values.next_steps.as_str()),
        ("{evidence}", values.evidence.as_str()),
        ("{notes}", values.notes.as_str()),
        ("{additions}", values.additions.as_str()),
        ("{deletions}", values.deletions.as_str()),
        ("{netLines}", values.net_lines.as_str()),
        ("{changedFiles}", values.changed_files.as_str()),
    ];
    let mut output = source.to_string();
    for (token, value) in replacements {
        output = output.replace(token, value);
    }
    output.trim().to_string()
}

fn render_report_template_with_redaction(
    template: &str,
    fallback_template: &str,
    values: &ReportTemplateValues,
    redaction: &ReportRedactionOptions,
) -> String {
    let output = render_report_template(template, fallback_template, values);
    if redaction.enabled {
        apply_redaction_rules_to_text(&output, &redaction.rules)
    } else {
        output
    }
}

fn prepare_report_input<'a>(
    commits: &'a [CommitRecord],
    project_names: &'a HashMap<String, String>,
    evidence_link_rules: &'a [EvidenceLinkRule],
    author: &'a str,
    redaction: &ReportRedactionOptions,
) -> PreparedReportInput<'a> {
    if !redaction.enabled {
        return PreparedReportInput {
            commits: Cow::Borrowed(commits),
            project_names: Cow::Borrowed(project_names),
            evidence_link_rules: Cow::Borrowed(evidence_link_rules),
            author: Cow::Borrowed(author),
        };
    }

    let mut redactor = ReportRedactor::new(&redaction.rules);
    let redacted_commits = commits
        .iter()
        .map(|commit| redactor.redact_commit(commit))
        .collect::<Vec<_>>();

    PreparedReportInput {
        commits: Cow::Owned(redacted_commits),
        project_names: Cow::Owned(HashMap::new()),
        evidence_link_rules: Cow::Owned(Vec::new()),
        author: Cow::Owned(redact_author_scope(author)),
    }
}

struct ReportRedactor<'a> {
    rules: &'a [ReportRedactionRule],
    repo_aliases: HashMap<String, String>,
    branch_aliases: HashMap<String, String>,
    author_aliases: HashMap<String, String>,
    hash_aliases: HashMap<String, String>,
}

impl<'a> ReportRedactor<'a> {
    fn new(rules: &'a [ReportRedactionRule]) -> Self {
        Self {
            rules,
            repo_aliases: HashMap::new(),
            branch_aliases: HashMap::new(),
            author_aliases: HashMap::new(),
            hash_aliases: HashMap::new(),
        }
    }

    fn redact_commit(&mut self, commit: &CommitRecord) -> CommitRecord {
        let mut redacted = commit.clone();
        redacted.project_name = alias_for(&mut self.repo_aliases, &commit.project_name, "仓库");
        redacted.repo_path = redacted.project_name.clone();
        redacted.branch_name = alias_for(&mut self.branch_aliases, &commit.branch_name, "分支");
        let author_key = commit_author_key(commit);
        redacted.author = alias_for(&mut self.author_aliases, &author_key, "作者");
        redacted.author_email = String::new();
        redacted.hash = alias_for(&mut self.hash_aliases, &commit.hash, "commit-");
        redacted.message = apply_redaction_rules_to_text(&commit.message, self.rules);
        redacted
    }
}

fn alias_for(aliases: &mut HashMap<String, String>, value: &str, prefix: &str) -> String {
    let key = value.trim();
    if key.is_empty() {
        return format!("{}未知", prefix.trim_end_matches('-'));
    }
    if let Some(alias) = aliases.get(key) {
        return alias.clone();
    }
    let alias = format!("{}{}", prefix, aliases.len() + 1);
    aliases.insert(key.to_string(), alias.clone());
    alias
}

fn commit_author_key(commit: &CommitRecord) -> String {
    [commit.author.trim(), commit.author_email.trim()]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn redact_author_scope(author: &str) -> String {
    if author.trim().is_empty() {
        String::new()
    } else {
        "作者范围已脱敏".to_string()
    }
}

fn apply_redaction_rules_to_text(text: &str, rules: &[ReportRedactionRule]) -> String {
    rules.iter().fold(text.to_string(), |current, rule| {
        let find = rule.find.trim();
        if find.is_empty() {
            return current;
        }
        let replacement = if rule.replacement.trim().is_empty() {
            "***"
        } else {
            rule.replacement.trim()
        };
        current.replace(find, replacement)
    })
}

fn render_summary_content(
    kind: &str,
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
) -> Vec<String> {
    match kind {
        "monthly" => render_project_progress_content(groups),
        "weekly" => render_weekly_focus_content(groups),
        _ => render_generic_summary_content(kind, groups),
    }
}

fn render_conclusion_content(
    kind: &str,
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
) -> Vec<String> {
    if kind == "monthly" {
        return render_monthly_summary_content(groups);
    }
    if groups.is_empty() {
        return vec!["- 暂无可用于总结的提交记录。".to_string()];
    }
    vec![
        "- 整体来看，本周期工作以交付可验证事项为主，后续可结合测试、上线和业务反馈补充结果指标。"
            .to_string(),
    ]
}

fn render_next_steps_content(
    kind: &str,
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
) -> Vec<String> {
    if kind == "weekly" {
        return render_weekly_next_steps_content(groups);
    }
    if groups.is_empty() {
        return vec!["- 暂无基于提交记录推断的后续关注事项。".to_string()];
    }
    groups
        .iter()
        .map(|(project, items)| {
            format!(
                "- {}：建议继续围绕 {} 补充验证、发布或复盘记录。",
                project,
                join_focus_items(items)
            )
        })
        .collect()
}

fn render_generic_summary_content(
    kind: &str,
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
) -> Vec<String> {
    if groups.is_empty() {
        let label = if kind == "daily" {
            "今日"
        } else {
            "当前周期"
        };
        return vec![format!("- {}未检索到可用于生成报告的提交记录。", label)];
    }
    let total = groups
        .values()
        .map(|items| unique_items(items).len())
        .sum::<usize>();
    vec![format!(
        "- 本周期共推进 {} 项可追踪事项，主要集中在：{}。",
        total,
        groups
            .values()
            .flat_map(|items| unique_items(items))
            .take(3)
            .map(|item| item.title)
            .collect::<Vec<_>>()
            .join("；")
    )]
}

fn render_flat_commit_items(commits: &[CommitRecord]) -> String {
    if commits.is_empty() {
        return "- 未检索到提交记录。".to_string();
    }
    commits
        .iter()
        .map(|commit| format!("- {}", clean_commit_message(&commit.message)))
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_evidence_items(
    commits: &[CommitRecord],
    evidence_link_rules: &[EvidenceLinkRule],
) -> String {
    if commits.is_empty() {
        return "- 暂无提交证据。".to_string();
    }
    commits
        .iter()
        .map(|commit| {
            format!(
                "- {}\n{}",
                clean_commit_message(&commit.message),
                format_evidence_block(commit, evidence_link_rules)
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn lines_to_block(lines: Vec<String>) -> String {
    lines.join("\n").trim().to_string()
}

fn display_author(author: &str) -> String {
    if author.trim().is_empty() {
        "全部作者".to_string()
    } else {
        author.to_string()
    }
}

fn resolve_period_label(kind: &str, label: &str, start_date: &str, end_date: &str) -> String {
    let trimmed = label.trim();
    match kind {
        "weekly" => format_week_title(if trimmed.is_empty() {
            start_date
        } else {
            trimmed
        }),
        "monthly" => format_month_title(if trimmed.is_empty() {
            start_date
        } else {
            trimmed
        }),
        "custom" => {
            if trimmed.is_empty() {
                format!("{} 至 {}", start_date, end_date)
            } else {
                trimmed.to_string()
            }
        }
        _ => {
            if trimmed.is_empty() {
                start_date.to_string()
            } else {
                trimmed.to_string()
            }
        }
    }
}

fn report_template_for<'a>(templates: &'a ReportFormatTemplates, kind: &str) -> &'a str {
    match kind {
        "weekly" => &templates.weekly,
        "monthly" => &templates.monthly,
        "custom" => &templates.custom,
        _ => &templates.daily,
    }
}

fn default_template_for(kind: &str) -> &'static str {
    match kind {
        "weekly" => DEFAULT_WEEKLY_REPORT_TEMPLATE,
        "monthly" => DEFAULT_MONTHLY_REPORT_TEMPLATE,
        "custom" => DEFAULT_CUSTOM_REPORT_TEMPLATE,
        _ => DEFAULT_DAILY_REPORT_TEMPLATE,
    }
}

fn report_note(kind: &str) -> &'static str {
    match kind {
        "weekly" => "> 说明：本周报基于 Git 提交记录生成，建议结合测试、上线和业务反馈补充结果。",
        "monthly" => {
            "> 说明：本报告基于 Git 提交记录生成，业务指标和验收结论建议结合绩效口径补充。"
        }
        _ => "> 说明：本报告基于 Git 提交记录生成，建议结合实际交付和业务反馈补充。",
    }
}

const DEFAULT_DAILY_REPORT_TEMPLATE: &str = "{commitItems}";
const DEFAULT_WEEKLY_REPORT_TEMPLATE: &str = "# {periodLabel}工作周报\n\n- 统计周期：{startDate} 至 {endDate}\n- 作者：{author}\n- 项目数量：{projectCount}\n- 提交事项：{commitCount}\n\n## 一、本周重点\n\n{summary}\n\n## 二、实际完成情况\n\n{projectSections}\n\n## 三、下周关注\n\n{nextSteps}\n\n{notes}";
const DEFAULT_MONTHLY_REPORT_TEMPLATE: &str = "# {periodLabel}工作月报\n\n- 统计周期：{startDate} 至 {endDate}\n- 作者：{author}\n- 项目数量：{projectCount}\n- 提交事项：{commitCount}\n- 代码变更：+{additions} -{deletions}（净增 {netLines} 行）\n\n## 一、项目进度\n\n{summary}\n\n## 二、实际完成情况\n\n{projectSections}\n\n## 三、当月总结\n\n{conclusion}\n\n{notes}";
const DEFAULT_CUSTOM_REPORT_TEMPLATE: &str = "# {periodLabel}工作报告\n\n- 统计周期：{startDate} 至 {endDate}\n- 作者：{author}\n- 项目数量：{projectCount}\n- 提交事项：{commitCount}\n\n{projectSections}\n\n{evidence}";

fn render_summary_line(
    commit: &CommitRecord,
    project_names: &HashMap<String, String>,
    prefix_mode: CommitItemPrefixMode,
    show_evidence_details: bool,
    evidence_link_rules: &[EvidenceLinkRule],
) -> String {
    let prefix = commit_item_prefix(prefix_mode, project_names, commit);
    let message = clean_commit_message(&commit.message);
    let line = format!("{}{}", prefix, message);
    if show_evidence_details {
        format!(
            "{}\n{}",
            line,
            format_evidence_block(commit, evidence_link_rules)
        )
    } else {
        line
    }
}

fn should_render_structured_commit_items(
    commit_item_prefix_mode: &str,
    show_project_and_branch: bool,
    show_evidence_details: bool,
) -> bool {
    show_evidence_details
        || CommitItemPrefixMode::from_settings(commit_item_prefix_mode, show_project_and_branch)
            != CommitItemPrefixMode::None
}

fn commit_item_prefix(
    mode: CommitItemPrefixMode,
    project_names: &HashMap<String, String>,
    commit: &CommitRecord,
) -> String {
    let mapped_project = resolve_project_name(project_names, commit);
    let repo_branch = format!("{}({})", commit.project_name, commit.branch_name);
    match mode {
        CommitItemPrefixMode::MappedProject => display_prefix(&mapped_project),
        CommitItemPrefixMode::RepoBranchAndMapped => {
            format!(
                "{}{}",
                display_prefix(&repo_branch),
                display_prefix(&mapped_project)
            )
        }
        CommitItemPrefixMode::RepoBranch => display_prefix(&repo_branch),
        CommitItemPrefixMode::None => String::new(),
    }
}

/// 将映射名转成展示前缀：去掉末尾已有的连接符后统一补一个 " - "。
/// 未配置映射（名称为空）时返回空串，保持"仅展示提交内容"的既有行为。
fn display_prefix(display_name: &str) -> String {
    let trimmed = display_name.trim_end_matches(TRAILING_CONNECTORS);
    if trimmed.is_empty() {
        String::new()
    } else {
        format!("{} - ", trimmed)
    }
}

fn clean_commit_message(message: &str) -> String {
    // 部分编辑器/工具会在提交信息行首写入 BOM 或零宽字符（U+FEFF、U+200B~U+200D
    // 等）。它们不是 ASCII 空白，`trim()` 剥不掉，会顶在 `type:` 前面让前缀正则从
    // 行首匹配失败，导致 `feat:` 前缀残留进报告。这里先统一剥掉前导零宽字符。
    let message = message
        .trim_start_matches(|ch: char| ch == '\u{feff}' || ('\u{200b}'..='\u{200f}').contains(&ch));
    // 兼容 Conventional Commits 的 `type(scope):` 写法：scope 为可选括号段，
    // 与无 scope 的 `type:` 一并在此剥离，避免带 scope 的提交前缀残留进报告。
    let prefix = Regex::new(
        r"(?i)^(feat|fix|refactor|chore|docs|style|test|perf|ci|build|revert|init)(\([^)]*\))?:\s*",
    )
    .unwrap();
    let no_prefix = prefix.replace(message, "");
    let flattened = no_prefix.replace('"', "").replace("['']", "");
    let whitespace = Regex::new(r"\s+").unwrap().replace_all(&flattened, " ");
    Regex::new(r"\s+-\s+")
        .unwrap()
        .replace_all(whitespace.trim(), "；")
        .to_string()
}

fn resolve_project_name(project_names: &HashMap<String, String>, commit: &CommitRecord) -> String {
    let exact_key = format!("{}({})", commit.project_name, commit.branch_name);
    project_names
        .get(&exact_key)
        .or_else(|| project_names.get(&format!("{}(*)", commit.project_name)))
        .cloned()
        .unwrap_or_default()
}

fn group_commits_by_project(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    evidence_link_rules: &[EvidenceLinkRule],
) -> ProjectGroups {
    let mut groups = BTreeMap::new();
    for commit in commits {
        let name = monthly_project_name(project_names, commit);
        groups
            .entry(name)
            .or_insert_with(Vec::new)
            .push(ProjectCommitItem {
                title: clean_commit_message(&commit.message),
                evidence: format_evidence_text(commit, evidence_link_rules),
                additions: commit.additions,
                deletions: commit.deletions,
                changed_files: commit.changed_files,
            });
    }
    groups
}

fn group_commits_by_author_project(
    commits: &[CommitRecord],
    project_names: &HashMap<String, String>,
    evidence_link_rules: &[EvidenceLinkRule],
) -> AuthorProjectGroups {
    let mut author_groups = BTreeMap::new();
    for commit in commits {
        let author = display_commit_author(commit);
        let project = monthly_project_name(project_names, commit);
        author_groups
            .entry(author)
            .or_insert_with(BTreeMap::new)
            .entry(project)
            .or_insert_with(Vec::new)
            .push(ProjectCommitItem {
                title: clean_commit_message(&commit.message),
                evidence: format_evidence_text(commit, evidence_link_rules),
                additions: commit.additions,
                deletions: commit.deletions,
                changed_files: commit.changed_files,
            });
    }
    author_groups
}

fn should_group_by_author(author_filter: &str, author_groups: &AuthorProjectGroups) -> bool {
    author_groups.len() > 1 && author_filter_count(author_filter) != 1
}

fn author_filter_count(author_filter: &str) -> usize {
    author_filter
        .split(|ch: char| ch == ',' || ch.is_whitespace())
        .filter(|part| !part.trim().is_empty())
        .count()
}

fn display_commit_author(commit: &CommitRecord) -> String {
    let author = commit.author.trim();
    if !author.is_empty() {
        return author.to_string();
    }

    let email = commit.author_email.trim();
    if !email.is_empty() {
        return email.to_string();
    }

    "未知作者".to_string()
}

fn render_author_scoped_content<F>(author_groups: &AuthorProjectGroups, render: F) -> Vec<String>
where
    F: Fn(&ProjectGroups) -> Vec<String>,
{
    if author_groups.is_empty() {
        return render(&BTreeMap::new());
    }

    let mut lines = Vec::new();
    for (author, groups) in author_groups {
        lines.push(format!("### {}", author));
        lines.extend(demote_project_headings(render(groups)));
        lines.push(String::new());
    }
    lines
}

fn render_author_commit_items(
    author_groups: &AuthorProjectGroups,
    show_evidence_details: bool,
) -> String {
    if author_groups.is_empty() {
        return "- 未检索到提交记录。".to_string();
    }

    lines_to_block(render_author_project_items(
        author_groups,
        show_evidence_details,
    ))
}

fn render_author_evidence_items(author_groups: &AuthorProjectGroups) -> String {
    if author_groups.is_empty() {
        return "- 暂无提交证据。".to_string();
    }

    lines_to_block(render_author_project_items(author_groups, true))
}

fn render_author_project_items(
    author_groups: &AuthorProjectGroups,
    show_evidence_details: bool,
) -> Vec<String> {
    let mut lines = Vec::new();
    for (author, groups) in author_groups {
        lines.push(format!("### {}", author));
        for (project, items) in groups {
            lines.push(format!("#### {}", project));
            for item in unique_items(items) {
                lines.push(format!("- {}", item.title));
                if show_evidence_details {
                    lines.extend(render_evidence_block(&item.evidence));
                }
            }
            lines.push(String::new());
        }
    }
    lines
}

fn demote_project_headings(lines: Vec<String>) -> Vec<String> {
    lines
        .into_iter()
        .map(|line| {
            if let Some(rest) = line.strip_prefix("### ") {
                format!("#### {}", rest)
            } else {
                line
            }
        })
        .collect()
}

fn format_evidence_text(commit: &CommitRecord, evidence_link_rules: &[EvidenceLinkRule]) -> String {
    let mut lines = vec![format!(
        "来源：`{}` / `{}` / `{}` / `{}`",
        inline_code_text(&commit.project_name),
        inline_code_text(&commit.branch_name),
        inline_code_text(&short_date(&commit.date)),
        inline_code_text(&short_hash(&commit.hash))
    )];
    lines.push(format!(
        "原始：`{}`",
        inline_code_text(&compact_message(&commit.message))
    ));
    let references = format_evidence_references(&commit.message, evidence_link_rules);
    if !references.is_empty() {
        lines.push(format!("关联：{}", references.join("、")));
    }
    lines.join("\n")
}

fn format_evidence_block(
    commit: &CommitRecord,
    evidence_link_rules: &[EvidenceLinkRule],
) -> String {
    format_evidence_text(commit, evidence_link_rules)
        .lines()
        .map(|line| format!("  > {}", line))
        .collect::<Vec<_>>()
        .join("\n")
}

#[derive(Debug, Clone)]
struct EvidenceReference {
    label: String,
    prefix: String,
    id: String,
    key: String,
    position: usize,
}

fn format_evidence_references(
    message: &str,
    evidence_link_rules: &[EvidenceLinkRule],
) -> Vec<String> {
    extract_evidence_references(message)
        .iter()
        .map(|reference| render_evidence_reference(reference, evidence_link_rules))
        .collect()
}

fn extract_evidence_references(message: &str) -> Vec<EvidenceReference> {
    let compact = compact_message(message);
    let mut references = Vec::new();
    let mut seen = HashSet::new();

    let pr_pattern = Regex::new(r"(?i)\bPR\s*#(\d+)\b").unwrap();
    for captures in pr_pattern.captures_iter(&compact) {
        if let Some(id) = captures.get(1) {
            let position = captures
                .get(0)
                .map(|value| value.start())
                .unwrap_or(usize::MAX);
            push_evidence_reference(
                &mut references,
                &mut seen,
                "PR",
                id.as_str(),
                &format!("PR #{}", id.as_str()),
                &format!("PR-{}", id.as_str()),
                position,
            );
        }
    }

    let hash_pattern = Regex::new(r"#(\d+)\b").unwrap();
    for captures in hash_pattern.captures_iter(&compact) {
        let Some(reference_match) = captures.get(0) else {
            continue;
        };
        if hash_belongs_to_pr_reference(&compact, reference_match.start()) {
            continue;
        }
        if let Some(id) = captures.get(1) {
            push_evidence_reference(
                &mut references,
                &mut seen,
                "#",
                id.as_str(),
                &format!("#{}", id.as_str()),
                &format!("#{}", id.as_str()),
                reference_match.start(),
            );
        }
    }

    let key_pattern = Regex::new(r"\b([A-Z][A-Z0-9]{1,9})-(\d+)\b").unwrap();
    for captures in key_pattern.captures_iter(&compact) {
        let (Some(prefix), Some(id), Some(label)) =
            (captures.get(1), captures.get(2), captures.get(0))
        else {
            continue;
        };
        push_evidence_reference(
            &mut references,
            &mut seen,
            prefix.as_str(),
            id.as_str(),
            label.as_str(),
            label.as_str(),
            label.start(),
        );
    }

    references.sort_by_key(|reference| reference.position);
    references
}

fn push_evidence_reference(
    references: &mut Vec<EvidenceReference>,
    seen: &mut HashSet<String>,
    prefix: &str,
    id: &str,
    label: &str,
    key: &str,
    position: usize,
) {
    let dedupe_key = format!("{}:{}", prefix.to_ascii_uppercase(), id);
    if !seen.insert(dedupe_key) {
        return;
    }
    references.push(EvidenceReference {
        label: label.to_string(),
        prefix: prefix.to_string(),
        id: id.to_string(),
        key: key.to_string(),
        position,
    });
}

fn hash_belongs_to_pr_reference(message: &str, hash_start: usize) -> bool {
    message
        .get(..hash_start)
        .unwrap_or_default()
        .trim_end()
        .rsplit(|ch: char| !ch.is_ascii_alphanumeric())
        .find(|part| !part.is_empty())
        .is_some_and(|part| part.eq_ignore_ascii_case("PR"))
}

fn render_evidence_reference(
    reference: &EvidenceReference,
    evidence_link_rules: &[EvidenceLinkRule],
) -> String {
    let Some(rule) = evidence_link_rules
        .iter()
        .find(|rule| same_evidence_prefix(&rule.prefix, &reference.prefix))
    else {
        return reference.label.clone();
    };
    let url = build_evidence_reference_url(rule, reference);
    if url.is_empty() {
        reference.label.clone()
    } else {
        format!("[{}]({})", reference.label, url)
    }
}

fn same_evidence_prefix(left: &str, right: &str) -> bool {
    left.trim().eq_ignore_ascii_case(right.trim())
}

fn build_evidence_reference_url(rule: &EvidenceLinkRule, reference: &EvidenceReference) -> String {
    rule.url_template
        .trim()
        .replace("{id}", &reference.id)
        .replace("{key}", &reference.key)
        .replace("{prefix}", &reference.prefix)
}

fn short_date(date: &str) -> String {
    date.split_whitespace().next().unwrap_or(date).to_string()
}

fn short_hash(hash: &str) -> String {
    project_retrospective::short_evidence_id(hash)
}

fn compact_message(message: &str) -> String {
    Regex::new(r"\s+")
        .unwrap()
        .replace_all(message.trim(), " ")
        .to_string()
}

fn inline_code_text(value: &str) -> String {
    value.replace('`', "'")
}

fn monthly_project_name(project_names: &HashMap<String, String>, commit: &CommitRecord) -> String {
    let custom_name = resolve_project_name(project_names, commit);
    let trimmed = custom_name.trim_end_matches(TRAILING_CONNECTORS);
    if trimmed.is_empty() {
        format!("{}({})", commit.project_name, commit.branch_name)
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn batch_project_name(
    project_names: &HashMap<String, String>,
    commit: &CommitRecord,
) -> String {
    monthly_project_name(project_names, commit)
}

fn render_project_progress_content(
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
) -> Vec<String> {
    let mut lines = Vec::new();
    if groups.is_empty() {
        lines.push("- 本月未检索到可用于生成项目进度的提交记录。".to_string());
        lines.push("".to_string());
        return lines;
    }
    for (project, items) in groups {
        lines.push(format!("### {}", project));
        lines.push(format!(
            "- 本月共推进 {} 项可追踪事项，主要集中在：{}。",
            unique_items(items).len(),
            join_focus_items(items)
        ));
        lines.push(
            "- 当前进度：相关开发、修复或优化事项已有提交记录，可作为阶段性推进依据。".to_string(),
        );
        lines.push("".to_string());
    }
    lines
}

fn render_weekly_focus_content(groups: &BTreeMap<String, Vec<ProjectCommitItem>>) -> Vec<String> {
    let mut lines = Vec::new();
    if groups.is_empty() {
        lines.push("- 本周未检索到可用于生成周报的提交记录。".to_string());
        lines.push("".to_string());
        return lines;
    }
    for (project, items) in groups {
        lines.push(format!("### {}", project));
        lines.push(format!(
            "- 本周共完成 {} 项可追踪事项，重点包括：{}。",
            unique_items(items).len(),
            join_focus_items(items)
        ));
        lines.push(
            "- 当前状态：相关事项已有提交记录，可继续结合验证、联调或上线反馈确认结果。"
                .to_string(),
        );
        lines.push("".to_string());
    }
    lines
}

fn render_actual_completion_content(
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
    show_evidence_details: bool,
) -> Vec<String> {
    let mut lines = Vec::new();
    if groups.is_empty() {
        lines.push("- 未检索到可用于生成完成情况的提交记录。".to_string());
        lines.push("".to_string());
        return lines;
    }
    for (project, items) in groups {
        lines.push(format!("### {}", project));
        for item in unique_items(items) {
            lines.push(format!("- {}", item.title));
            if show_evidence_details {
                lines.extend(render_evidence_block(&item.evidence));
            }
        }
        let proj_add: u64 = items.iter().map(|i| i.additions).sum();
        let proj_del: u64 = items.iter().map(|i| i.deletions).sum();
        let proj_files: u32 = items.iter().map(|i| i.changed_files).sum();
        if proj_add + proj_del > 0 {
            let net = proj_add as i64 - proj_del as i64;
            lines.push(String::new());
            lines.push(format!(
                "\u{1f4ca} 变更统计：+{} -{}（净增 {} 行，涉及 {} 个文件）",
                proj_add, proj_del, net, proj_files
            ));
        }
        lines.push("".to_string());
    }
    lines
}

fn render_evidence_block(evidence: &str) -> Vec<String> {
    evidence
        .lines()
        .map(|line| format!("  > {}", line))
        .collect()
}

fn render_weekly_next_steps_content(
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
) -> Vec<String> {
    let mut lines = Vec::new();
    if groups.is_empty() {
        lines.push("- 暂无基于提交记录推断的下周关注事项。".to_string());
        lines.push("".to_string());
        return lines;
    }
    for (project, items) in groups {
        lines.push(format!(
            "- {}：建议围绕 {} 继续补充验证、发布或复盘记录。",
            project,
            join_focus_items(items)
        ));
    }
    lines.push("".to_string());
    lines
}

fn render_monthly_summary_content(
    groups: &BTreeMap<String, Vec<ProjectCommitItem>>,
) -> Vec<String> {
    let mut lines = Vec::new();
    if groups.is_empty() {
        lines.push("- 本月未检索到可用于生成总结的提交记录。".to_string());
        lines.push("".to_string());
        return lines;
    }
    for (project, items) in groups {
        let item_count = unique_items(items).len();
        lines.push(format!("### {}", project));
        lines.push(format!(
            "- 本月围绕 {} 完成了 {} 项开发记录，工作内容覆盖 {}。",
            project,
            item_count,
            join_focus_items(items)
        ));
        lines.push("- 整体来看，本月工作以交付可验证事项为主，后续可结合测试、上线和业务反馈补充结果指标。".to_string());
        lines.push("".to_string());
    }
    lines
}

fn unique_items(items: &[ProjectCommitItem]) -> Vec<ProjectCommitItem> {
    let mut result = Vec::new();
    for item in items {
        if !result
            .iter()
            .any(|current: &ProjectCommitItem| current.title == item.title)
        {
            result.push(item.clone());
        }
    }
    result
}

fn join_focus_items(items: &[ProjectCommitItem]) -> String {
    let unique = unique_items(items);
    let selected = unique
        .iter()
        .take(3)
        .map(|item| item.title.clone())
        .collect::<Vec<_>>();
    let suffix = if unique.len() > 3 { "等内容" } else { "" };
    format!("{}{}", selected.join("；"), suffix)
}

fn format_month_title(month_label: &str) -> String {
    let parts = month_label.split('-').collect::<Vec<_>>();
    if parts.len() != 2 {
        return month_label.to_string();
    }
    format!("{}年{}月", parts[0], parts[1].trim_start_matches('0'))
}

fn format_week_title(week_label: &str) -> String {
    if let Some((year, week)) = week_label.split_once("-W") {
        return format!("{}年第{}周", year, week.trim_start_matches('0'));
    }
    week_label.to_string()
}

const BATCH_MAX_PERIODS: usize = 365;

pub fn split_date_range(
    start: &str,
    end: &str,
    granularity: &str,
) -> Result<Vec<SubPeriod>, String> {
    let start_date = NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .map_err(|e| format!("起始日期格式错误：{e}"))?;
    let end_date =
        NaiveDate::parse_from_str(end, "%Y-%m-%d").map_err(|e| format!("结束日期格式错误：{e}"))?;
    if start_date > end_date {
        return Err("起始日期不能晚于结束日期".to_string());
    }

    let periods = match granularity {
        "daily" => split_daily(start_date, end_date),
        "weekly" => split_weekly(start_date, end_date),
        "monthly" => split_monthly(start_date, end_date),
        "custom" => vec![SubPeriod {
            start: start.to_string(),
            end: end.to_string(),
            label: format!("{start}~{end}"),
            report_kind: "custom".to_string(),
        }],
        _ => return Err(format!("不支持的拆分粒度：{granularity}")),
    };

    if periods.len() > BATCH_MAX_PERIODS {
        return Err(format!(
            "拆分后共 {} 份报告，超过上限 {BATCH_MAX_PERIODS}",
            periods.len()
        ));
    }
    Ok(periods)
}

fn split_daily(start: NaiveDate, end: NaiveDate) -> Vec<SubPeriod> {
    let mut periods = Vec::new();
    let mut day = start;
    while day <= end {
        let ds = day.format("%Y-%m-%d").to_string();
        periods.push(SubPeriod {
            start: ds.clone(),
            end: ds.clone(),
            label: ds,
            report_kind: "daily".to_string(),
        });
        day += Duration::days(1);
    }
    periods
}

fn split_weekly(start: NaiveDate, end: NaiveDate) -> Vec<SubPeriod> {
    let mut periods = Vec::new();
    let mut week_start = start;
    while week_start <= end {
        let week_end = {
            let days_to_sunday = 7 - week_start.weekday().num_days_from_monday() - 1;
            let natural_end = week_start + Duration::days(days_to_sunday as i64);
            if natural_end > end {
                end
            } else {
                natural_end
            }
        };
        let iso = week_start.iso_week();
        let label = format!("{}-W{:02}", iso.year(), iso.week());
        periods.push(SubPeriod {
            start: week_start.format("%Y-%m-%d").to_string(),
            end: week_end.format("%Y-%m-%d").to_string(),
            label,
            report_kind: "weekly".to_string(),
        });
        week_start = week_end + Duration::days(1);
    }
    periods
}

fn split_monthly(start: NaiveDate, end: NaiveDate) -> Vec<SubPeriod> {
    let mut periods = Vec::new();
    let mut month_start = start;
    while month_start <= end {
        let next_month = if month_start.month() == 12 {
            NaiveDate::from_ymd_opt(month_start.year() + 1, 1, 1)
        } else {
            NaiveDate::from_ymd_opt(month_start.year(), month_start.month() + 1, 1)
        }
        .unwrap();
        let natural_end = next_month - Duration::days(1);
        let month_end = if natural_end > end { end } else { natural_end };
        let label = month_start.format("%Y-%m").to_string();
        periods.push(SubPeriod {
            start: month_start.format("%Y-%m-%d").to_string(),
            end: month_end.format("%Y-%m-%d").to_string(),
            label,
            report_kind: "monthly".to_string(),
        });
        month_start = next_month;
    }
    periods
}

pub const DEFAULT_BATCH_FILE_NAME_TEMPLATE: &str = "{period}-{type}.{ext}";

#[derive(Clone, Copy)]
pub struct BatchFileNameContext<'a> {
    pub period: &'a SubPeriod,
    pub author: &'a str,
    pub project: &'a str,
}

pub fn normalize_batch_export_formats(formats: &[String]) -> Result<Vec<&'static str>, String> {
    let mut normalized = Vec::new();
    for format in formats {
        let extension = normalize_export_format(format)?;
        if !normalized.contains(&extension) {
            normalized.push(extension);
        }
    }
    if normalized.is_empty() {
        return Err("请至少选择一种导出格式".to_string());
    }
    Ok(normalized)
}

pub fn validate_batch_file_name_template(template: &str) -> Result<(), String> {
    let template = template.trim();
    if template.is_empty() {
        return Err("文件名模板不能为空".to_string());
    }
    if !template.ends_with(".{ext}") {
        return Err("文件名模板必须以 .{ext} 结尾".to_string());
    }
    for token in batch_template_tokens(template)? {
        if !is_supported_batch_file_name_token(token) {
            return Err(format!("文件名模板包含未知变量：{{{token}}}"));
        }
    }
    Ok(())
}

pub fn batch_file_name(
    template: &str,
    format: &str,
    context: BatchFileNameContext<'_>,
) -> Result<String, String> {
    validate_batch_file_name_template(template)?;
    let extension = normalize_export_format(format)?;
    let start = NaiveDate::parse_from_str(&context.period.start, "%Y-%m-%d")
        .map_err(|err| format!("批量报告开始日期格式错误：{err}"))?;
    let week = format!(
        "{}-W{:02}",
        start.iso_week().year(),
        start.iso_week().week()
    );
    let month = start.format("%Y-%m").to_string();
    let author = non_empty_or(context.author, "全部作者");
    let project = non_empty_or(context.project, "全部项目");
    let type_label = batch_report_type_label(&context.period.report_kind);
    let values = [
        ("period", context.period.label.as_str()),
        ("date", context.period.start.as_str()),
        ("week", week.as_str()),
        ("month", month.as_str()),
        ("startDate", context.period.start.as_str()),
        ("endDate", context.period.end.as_str()),
        ("author", author),
        ("project", project),
        ("type", type_label),
        ("ext", extension),
    ];
    let rendered = values
        .iter()
        .fold(template.trim().to_string(), |name, (token, value)| {
            name.replace(&format!("{{{token}}}"), value)
        });
    sanitize_batch_file_name(&rendered)
}

pub fn reserve_batch_file_name(
    output_dir: &str,
    candidate: &str,
    used_names: &mut HashSet<String>,
) -> String {
    let (stem, extension) = split_file_name(candidate);
    let directory = PathBuf::from(output_dir);
    let mut sequence = 1usize;
    loop {
        let file_name = if sequence == 1 {
            candidate.to_string()
        } else {
            format!("{stem}-{sequence}{extension}")
        };
        let key = file_name.to_lowercase();
        if !used_names.contains(&key) && !directory.join(&file_name).exists() {
            used_names.insert(key);
            return file_name;
        }
        sequence += 1;
    }
}

fn batch_template_tokens(template: &str) -> Result<Vec<&str>, String> {
    let mut remaining = template;
    let mut tokens = Vec::new();
    while let Some(start) = remaining.find('{') {
        if remaining[..start].contains('}') {
            return Err("文件名模板包含未配对的大括号".to_string());
        }
        let after_start = &remaining[start + 1..];
        let end = after_start
            .find('}')
            .ok_or_else(|| "文件名模板包含未配对的大括号".to_string())?;
        let token = &after_start[..end];
        if token.is_empty() || token.contains('{') {
            return Err("文件名模板包含无效变量".to_string());
        }
        tokens.push(token);
        remaining = &after_start[end + 1..];
    }
    if remaining.contains('}') {
        return Err("文件名模板包含未配对的大括号".to_string());
    }
    Ok(tokens)
}

fn is_supported_batch_file_name_token(token: &str) -> bool {
    matches!(
        token,
        "period"
            | "date"
            | "week"
            | "month"
            | "startDate"
            | "endDate"
            | "author"
            | "project"
            | "type"
            | "ext"
    )
}

fn batch_report_type_label(report_kind: &str) -> &'static str {
    match report_kind {
        "daily" => "日报",
        "weekly" => "周报",
        "monthly" => "月报",
        "custom" => "自定义报告",
        _ => "报告",
    }
}

fn non_empty_or<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    let value = value.trim();
    if value.is_empty() {
        fallback
    } else {
        value
    }
}

fn sanitize_batch_file_name(file_name: &str) -> Result<String, String> {
    let normalized: String = file_name
        .chars()
        .map(|character| {
            if character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
            {
                '_'
            } else {
                character
            }
        })
        .collect();
    let trimmed = normalized.trim().trim_end_matches([' ', '.']);
    if trimmed.is_empty() {
        return Err("文件名模板生成了空文件名".to_string());
    }
    let prefixed = if is_windows_reserved_file_name(trimmed) {
        format!("_{trimmed}")
    } else {
        trimmed.to_string()
    };
    Ok(prefixed)
}

fn is_windows_reserved_file_name(file_name: &str) -> bool {
    let stem = file_name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem[3..]
                .parse::<u8>()
                .is_ok_and(|number| (1..=9).contains(&number)))
}

fn split_file_name(file_name: &str) -> (&str, &str) {
    match file_name.rfind('.') {
        Some(index) if index > 0 => (&file_name[..index], &file_name[index..]),
        _ => (file_name, ""),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn previous_month_handles_year_boundary() {
        let date = NaiveDate::from_ymd_opt(2026, 1, 5).unwrap();
        let range = previous_month_range_from(date);
        assert_eq!(
            ("2025-12-01".into(), "2025-12-31".into(), "2025-12".into()),
            range
        );
    }

    #[test]
    fn save_report_file_rejects_missing_output_dir_with_actionable_message() {
        let missing = std::env::temp_dir().join("gitpulse-missing-output-dir-for-test");
        let _ = fs::remove_dir_all(&missing);

        let message =
            save_report_file(&missing.to_string_lossy(), "report.md", "content").unwrap_err();

        assert!(message.contains("输出目录不存在"));
        assert!(message.contains("重新选择"));
    }

    #[test]
    fn save_report_file_rejects_file_as_output_dir() {
        let path =
            std::env::temp_dir().join(format!("gitpulse-output-file-{}", std::process::id()));
        fs::write(&path, "not a dir").unwrap();

        let message =
            save_report_file(&path.to_string_lossy(), "report.md", "content").unwrap_err();

        assert!(message.contains("不是文件夹"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn save_report_document_writes_docx_package() {
        let dir = std::env::temp_dir().join(format!("gitpulse-docx-export-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let path = save_report_document(
            &dir.to_string_lossy(),
            "weekly_report_2026-W25",
            "# 周报\n\n- 完成 `DOCX` 导出",
            "docx",
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let text = String::from_utf8_lossy(&bytes);

        assert!(path.ends_with("weekly_report_2026-W25.docx"));
        assert_eq!(&bytes[0..2], b"PK");
        assert!(text.contains("word/document.xml"));
        assert!(text.contains("DOCX"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_report_document_preserves_markdown_export() {
        let dir = std::env::temp_dir().join(format!("gitpulse-md-export-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let path = save_report_document(&dir.to_string_lossy(), "daily.md", "content", "markdown")
            .unwrap();
        let content = fs::read_to_string(&path).unwrap();

        assert!(path.ends_with("daily.md"));
        assert_eq!("content", content);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_report_document_writes_pdf_file() {
        let dir = std::env::temp_dir().join(format!("gitpulse-pdf-export-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let path = save_report_document(
            &dir.to_string_lossy(),
            "weekly_report_2026-W25.md",
            "# Weekly Report\n\n- Export PDF",
            "pdf",
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();

        assert!(path.ends_with("weekly_report_2026-W25.pdf"));
        assert!(bytes.starts_with(b"%PDF"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn render_weekly_report_uses_project_mapping_and_week_title() {
        let commits = vec![commit("repo-a", "main", "feat: 添加周报功能")];
        let mut project_names = HashMap::new();
        project_names.insert("repo-a(*)".to_string(), "研发平台-".to_string());

        let report = render_weekly_report_with_template(
            &commits,
            &project_names,
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            false,
            "mapped-project",
            &[],
            default_template_for("weekly"),
        );

        assert!(report.contains("# 2026年第24周工作周报"));
        assert!(report.contains("### 研发平台"));
        assert!(report.contains("- 提交事项：1"));
        assert!(report.contains("添加周报功能"));
        assert!(report.contains("## 三、下周关注"));
    }

    #[test]
    fn render_reports_can_include_commit_evidence_details() {
        let commits = vec![commit("repo-a", "feature/report", "feat: 添加证据详情")];
        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            true,
            "mapped-project",
            &[],
            default_template_for("weekly"),
        );

        assert!(report.contains("- 添加证据详情"));
        assert!(report.contains("  > 来源：`repo-a` / `feature/report` / `2026-06-10` / `abc123d`"));
        assert!(report.contains("  > 原始：`feat: 添加证据详情`"));
    }

    #[test]
    fn render_reports_link_issue_references_in_evidence_details() {
        let commits = vec![commit(
            "repo-a",
            "feature/report",
            "feat: 对齐工单证据 #123 PR #456 JIRA-789 GH-321",
        )];
        let rules = vec![
            EvidenceLinkRule {
                prefix: "#".to_string(),
                url_template: "https://github.com/org/repo/issues/{id}".to_string(),
            },
            EvidenceLinkRule {
                prefix: "PR".to_string(),
                url_template: "https://github.com/org/repo/pull/{id}".to_string(),
            },
            EvidenceLinkRule {
                prefix: "JIRA".to_string(),
                url_template: "https://jira.example.com/browse/{key}".to_string(),
            },
            EvidenceLinkRule {
                prefix: "GH".to_string(),
                url_template: "https://github.com/org/repo/issues/{id}".to_string(),
            },
        ];

        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            true,
            "mapped-project",
            &rules,
            default_template_for("weekly"),
        );

        assert!(report.contains(
            "关联：[#123](https://github.com/org/repo/issues/123)、[PR #456](https://github.com/org/repo/pull/456)、[JIRA-789](https://jira.example.com/browse/JIRA-789)、[GH-321](https://github.com/org/repo/issues/321)"
        ));
    }

    #[test]
    fn render_weekly_report_redacts_traceable_evidence_details() {
        let commits = vec![commit(
            "private-api",
            "feature/customer-secret",
            "feat: 完成内部项目客户验收 #123",
        )];
        let mut project_names = HashMap::new();
        project_names.insert("private-api(*)".to_string(), "内部平台-".to_string());
        let evidence_link_rules = vec![EvidenceLinkRule {
            prefix: "#".to_string(),
            url_template: "https://jira.internal/browse/{id}".to_string(),
        }];
        let redaction = ReportRedactionOptions {
            enabled: true,
            rules: vec![
                ReportRedactionRule {
                    find: "内部项目".to_string(),
                    replacement: "项目A".to_string(),
                },
                ReportRedactionRule {
                    find: "客户".to_string(),
                    replacement: String::new(),
                },
            ],
        };

        let report = render_weekly_report_with_redaction(
            &commits,
            &project_names,
            "2026-06-08",
            "2026-06-14",
            "tester@example.com",
            "2026-W24",
            true,
            "mapped-project",
            &evidence_link_rules,
            default_template_for("weekly"),
            &redaction,
        );

        assert!(report.contains("来源：`仓库1` / `分支1` / `2026-06-10` / `commit-1`"));
        assert!(report.contains("项目A***验收"));
        assert!(report.contains("- 作者：作者范围已脱敏"));
        assert!(!report.contains("private-api"));
        assert!(!report.contains("feature/customer-secret"));
        assert!(!report.contains("abc123def"));
        assert!(!report.contains("tester@example.com"));
        assert!(!report.contains("https://jira.internal"));
        assert!(!report.contains("内部平台"));
        assert!(!report.contains("内部项目"));
    }

    #[test]
    fn report_history_projects_reuse_mapping_and_redact_before_persistence() {
        let mut commits = vec![
            commit("private-api", "main", "feat: exact mapping"),
            commit("private-api", "feature/report", "feat: wildcard mapping"),
        ];
        commits[0].hash = "abc123def".to_string();
        commits[1].hash = "def456abc".to_string();
        let project_names = HashMap::from([
            ("private-api(main)".to_string(), "核心平台-".to_string()),
            ("private-api(*)".to_string(), "内部平台_".to_string()),
        ]);

        let projects = build_report_history_projects(
            &commits,
            &project_names,
            &ReportRedactionOptions::default(),
        );
        assert_eq!(vec!["内部平台", "核心平台"], project_names_from(&projects));
        assert_eq!(vec!["def456a"], projects[0].evidence_ids);
        assert_eq!(vec!["abc123d"], projects[1].evidence_ids);

        let redacted = build_report_history_projects(
            &commits,
            &project_names,
            &ReportRedactionOptions {
                enabled: true,
                rules: Vec::new(),
            },
        );
        assert_eq!(
            vec!["仓库1(分支1)", "仓库1(分支2)"],
            project_names_from(&redacted)
        );
        assert_eq!(vec!["commit-1"], redacted[0].evidence_ids);
        assert_eq!(vec!["commit-2"], redacted[1].evidence_ids);
        assert!(!format!("{redacted:?}").contains("private-api"));
    }

    fn project_names_from(
        projects: &[crate::project_retrospective::ReportHistoryProject],
    ) -> Vec<&str> {
        projects
            .iter()
            .map(|project| project.name.as_str())
            .collect()
    }

    #[test]
    fn render_weekly_report_uses_custom_template_variables() {
        let commits = vec![
            commit("repo-a", "main", "feat: 添加格式模板"),
            commit("repo-b", "main", "fix: 修复模板预览"),
        ];
        let template =
            "# {periodLabel}\n项目 {projectCount} / 提交 {commitCount}\n\n{projectSections}";

        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            false,
            "mapped-project",
            &[],
            template,
        );

        assert!(report.contains("# 2026年第24周"));
        assert!(report.contains("项目 2 / 提交 2"));
        assert!(report.contains("### repo-a(main)"));
        assert!(report.contains("- 添加格式模板"));
        assert!(!report.contains("## 一、本周重点"));
    }

    #[test]
    fn render_weekly_report_groups_all_authors_by_author_then_project() {
        let commits = vec![
            commit_by_author("repo-a", "main", "feat: 完成团队周报", "Alice"),
            commit_by_author("repo-b", "main", "fix: 修复导出异常", "Bob"),
        ];

        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "",
            "2026-W24",
            false,
            "mapped-project",
            &[],
            default_template_for("weekly"),
        );

        assert!(report.contains("- 作者：全部作者"));
        assert!(report.contains("### Alice"));
        assert!(report.contains("#### repo-a(main)"));
        assert!(report.contains("- 完成团队周报"));
        assert!(report.contains("### Bob"));
        assert!(report.contains("#### repo-b(main)"));
        assert!(report.contains("- 修复导出异常"));
    }

    #[test]
    fn render_daily_report_groups_multi_author_commit_items() {
        let commits = vec![
            commit_by_author("repo-a", "main", "feat: 汇总前端日报", "Alice"),
            commit_by_author("repo-a", "main", "fix: 修复后端日报", "Bob"),
        ];
        let templates = ReportFormatTemplates::default();

        let report = render_extract_report(
            &commits,
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(report.contains("### Alice"));
        assert!(report.contains("#### repo-a(main)"));
        assert!(report.contains("- 汇总前端日报"));
        assert!(report.contains("### Bob"));
        assert!(report.contains("- 修复后端日报"));
    }

    #[test]
    fn render_extract_report_uses_daily_and_custom_templates_separately() {
        let commits = vec![commit("repo-a", "main", "feat: 接入自定义输出")];
        let templates = ReportFormatTemplates {
            daily: "日报 {periodLabel}\n{commitItems}".to_string(),
            custom: "自定义 {periodLabel}\n{projectCount}/{commitCount}\n{projectSections}"
                .to_string(),
            ..ReportFormatTemplates::default()
        };

        let daily = render_extract_report(
            &commits,
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );
        let custom = render_extract_report(
            &commits,
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-01",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "双周同步",
                report_kind: "custom",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(daily.contains("日报 2026-06-14"));
        assert!(daily.contains("接入自定义输出"));
        assert!(custom.contains("自定义 双周同步"));
        assert!(custom.contains("1/1"));
        assert!(custom.contains("### repo-a(main)"));
    }

    #[test]
    fn render_daily_commit_items_can_use_mapped_project_without_repo_branch() {
        let commits = vec![commit(
            "cse-frontend",
            "master",
            "feat: 接入注安题目纠错反馈模块",
        )];
        let mut project_names = HashMap::new();
        project_names.insert("cse-frontend(*)".to_string(), "柏科注安工程师".to_string());
        let templates = ReportFormatTemplates {
            daily: "{commitItems}".to_string(),
            ..ReportFormatTemplates::default()
        };

        let mapped_only = render_extract_report(
            &commits,
            &project_names,
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );
        let repo_and_mapped = render_extract_report(
            &commits,
            &project_names,
            true,
            "repo-branch-and-mapped",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(mapped_only.contains("柏科注安工程师 - 接入注安题目纠错反馈模块"));
        assert!(!mapped_only.contains("cse-frontend(master)"));
        assert!(repo_and_mapped
            .contains("cse-frontend(master) - 柏科注安工程师 - 接入注安题目纠错反馈模块"));
    }

    #[test]
    fn build_extract_result_keeps_template_when_detailed_output_is_enabled() {
        let commits = vec![commit("repo-a", "main", "feat: 保留详细日志")];
        let templates = ReportFormatTemplates {
            daily: "模板正文\n{commitItems}".to_string(),
            ..ReportFormatTemplates::default()
        };

        let result = build_extract_result(
            Vec::new(),
            commits,
            Vec::new(),
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            true,
            &ReportRedactionOptions::default(),
            ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(result.detailed_text.starts_with("模板正文"));
        assert!(result.detailed_text.contains("## 详细日志"));
        assert!(result.detailed_text.contains("Message: feat: 保留详细日志"));
    }

    #[test]
    fn clean_commit_message_strips_conventional_scope_prefix() {
        // 复现：带 scope 的 Conventional Commits 前缀应被整体剥离，
        // 不能让 `refactor(examuserprofile):` 之类残留进日报。
        assert_eq!(
            clean_commit_message("refactor(examuserprofile): 学习基础改用数据字典绑定"),
            "学习基础改用数据字典绑定"
        );
        // 无 scope 的既有行为保持不变（向后兼容）。
        assert_eq!(
            clean_commit_message("feat: 支持报告模板自定义输出"),
            "支持报告模板自定义输出"
        );
        // scope 大小写混合、含空格也一并处理。
        assert_eq!(
            clean_commit_message("fix(ExamUser): 修复字典绑定空指针"),
            "修复字典绑定空指针"
        );
    }

    #[test]
    fn clean_commit_message_strips_leading_bom_before_prefix() {
        // 复现：部分编辑器在提交信息行首写入 BOM（U+FEFF），顶在 `feat:` 前，
        // 使前缀正则从行首匹配失败，导致 `feat:` 残留进报告。剥掉后应正常清理。
        assert_eq!(
            clean_commit_message("\u{feff}feat: 优化课程包关联课程交互与抽屉面板展宽"),
            "优化课程包关联课程交互与抽屉面板展宽"
        );
        // 零宽空格（U+200B）等其他前导零宽字符同样处理。
        assert_eq!(
            clean_commit_message("\u{200b}fix(ExamUser): 修复字典绑定空指针"),
            "修复字典绑定空指针"
        );
    }

    fn commit(project_name: &str, branch_name: &str, message: &str) -> CommitRecord {
        commit_by_author(project_name, branch_name, message, "tester")
    }

    fn commit_by_author(
        project_name: &str,
        branch_name: &str,
        message: &str,
        author: &str,
    ) -> CommitRecord {
        CommitRecord {
            repo_path: project_name.to_string(),
            project_name: project_name.to_string(),
            branch_name: branch_name.to_string(),
            hash: "abc123def".to_string(),
            author: author.to_string(),
            author_email: format!("{}@example.com", author.to_lowercase()),
            date: "2026-06-10 10:00:00 +0800".to_string(),
            message: message.to_string(),
            additions: 0,
            deletions: 0,
            changed_files: 0,
        }
    }

    #[test]
    fn split_daily_single_day() {
        let periods = split_date_range("2026-07-01", "2026-07-01", "daily").unwrap();
        assert_eq!(periods.len(), 1);
        assert_eq!(periods[0].start, "2026-07-01");
        assert_eq!(periods[0].end, "2026-07-01");
        assert_eq!(periods[0].report_kind, "daily");
    }

    #[test]
    fn split_daily_week() {
        let periods = split_date_range("2026-07-01", "2026-07-07", "daily").unwrap();
        assert_eq!(periods.len(), 7);
        assert_eq!(periods[0].label, "2026-07-01");
        assert_eq!(periods[6].label, "2026-07-07");
    }

    #[test]
    fn split_custom_keeps_the_complete_selected_range() {
        let periods = split_date_range("2026-07-01", "2026-07-31", "custom").unwrap();

        assert_eq!(1, periods.len());
        assert_eq!("2026-07-01", periods[0].start);
        assert_eq!("2026-07-31", periods[0].end);
        assert_eq!("2026-07-01~2026-07-31", periods[0].label);
        assert_eq!("custom", periods[0].report_kind);
    }

    #[test]
    fn split_weekly_cross_month() {
        let periods = split_date_range("2026-06-25", "2026-07-15", "weekly").unwrap();
        assert!(periods.len() >= 3);
        assert_eq!(periods[0].report_kind, "weekly");
        assert!(periods[0].start <= periods[0].end);
        assert!(periods.last().unwrap().end == "2026-07-15");
    }

    #[test]
    fn split_monthly_cross_year() {
        let periods = split_date_range("2026-11-15", "2027-02-10", "monthly").unwrap();
        assert_eq!(periods.len(), 4);
        assert_eq!(periods[0].label, "2026-11");
        assert_eq!(periods[0].start, "2026-11-15");
        assert_eq!(periods[0].end, "2026-11-30");
        assert_eq!(periods[3].label, "2027-02");
        assert_eq!(periods[3].start, "2027-02-01");
        assert_eq!(periods[3].end, "2027-02-10");
    }

    #[test]
    fn split_rejects_start_after_end() {
        let result = split_date_range("2026-07-10", "2026-07-01", "daily");
        assert!(result.is_err());
    }

    #[test]
    fn split_rejects_too_many_periods() {
        let result = split_date_range("2024-01-01", "2026-12-31", "daily");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("超过上限"));
    }

    #[test]
    fn batch_file_name_formats_default_template() {
        let daily = SubPeriod {
            start: "2026-07-01".into(),
            end: "2026-07-01".into(),
            label: "2026-07-01".into(),
            report_kind: "daily".into(),
        };
        let context = BatchFileNameContext {
            period: &daily,
            author: "Alice",
            project: "全部项目",
        };
        assert_eq!(
            batch_file_name(DEFAULT_BATCH_FILE_NAME_TEMPLATE, "markdown", context).unwrap(),
            "2026-07-01-日报.md"
        );
        assert_eq!(
            batch_file_name(DEFAULT_BATCH_FILE_NAME_TEMPLATE, "docx", context).unwrap(),
            "2026-07-01-日报.docx"
        );

        let weekly = SubPeriod {
            start: "2026-06-29".into(),
            end: "2026-07-05".into(),
            label: "2026-W27".into(),
            report_kind: "weekly".into(),
        };
        assert_eq!(
            batch_file_name(
                DEFAULT_BATCH_FILE_NAME_TEMPLATE,
                "pdf",
                BatchFileNameContext {
                    period: &weekly,
                    author: "Alice",
                    project: "全部项目",
                },
            )
            .unwrap(),
            "2026-W27-周报.pdf"
        );

        let custom = SubPeriod {
            start: "2026-07-01".into(),
            end: "2026-07-31".into(),
            label: "2026-07-01~2026-07-31".into(),
            report_kind: "custom".into(),
        };
        assert_eq!(
            batch_file_name(
                DEFAULT_BATCH_FILE_NAME_TEMPLATE,
                "markdown",
                BatchFileNameContext {
                    period: &custom,
                    author: "Alice",
                    project: "全部项目",
                },
            )
            .unwrap(),
            "2026-07-01~2026-07-31-自定义报告.md"
        );
    }

    #[test]
    fn batch_file_name_renders_tokens_and_sanitizes_values() {
        let weekly = SubPeriod {
            start: "2026-06-29".into(),
            end: "2026-07-05".into(),
            label: "2026-W27".into(),
            report_kind: "weekly".into(),
        };
        let template = "{period}_{date}_{week}_{month}_{author}_{project}_{type}.{ext}";
        let name = batch_file_name(
            template,
            "pdf",
            BatchFileNameContext {
                period: &weekly,
                author: "Alice/研发:负责人",
                project: "平台|核心",
            },
        )
        .unwrap();

        assert_eq!(
            "2026-W27_2026-06-29_2026-W27_2026-06_Alice_研发_负责人_平台_核心_周报.pdf",
            name
        );
    }

    #[test]
    fn batch_file_name_rejects_invalid_templates() {
        let daily = SubPeriod {
            start: "2026-07-01".into(),
            end: "2026-07-01".into(),
            label: "2026-07-01".into(),
            report_kind: "daily".into(),
        };
        let context = BatchFileNameContext {
            period: &daily,
            author: "Alice",
            project: "全部项目",
        };

        assert!(
            batch_file_name("{period}-{unknown}.{ext}", "markdown", context)
                .unwrap_err()
                .contains("未知变量")
        );
        assert!(batch_file_name("{period}-{type}", "markdown", context)
            .unwrap_err()
            .contains("{ext}"));
    }

    #[test]
    fn normalize_batch_export_formats_requires_values_and_deduplicates() {
        assert!(normalize_batch_export_formats(&[]).is_err());
        assert_eq!(
            vec!["md", "pdf"],
            normalize_batch_export_formats(&[
                "markdown".to_string(),
                "pdf".to_string(),
                "md".to_string(),
            ])
            .unwrap()
        );
    }

    #[test]
    fn reserve_batch_file_name_avoids_existing_and_batch_collisions() {
        let dir = std::env::temp_dir().join(format!("gitpulse-batch-name-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("report.md"), "existing").unwrap();
        let mut used = HashSet::new();

        assert_eq!(
            "report-2.md",
            reserve_batch_file_name(&dir.to_string_lossy(), "report.md", &mut used)
        );
        assert_eq!(
            "report-3.md",
            reserve_batch_file_name(&dir.to_string_lossy(), "report.md", &mut used)
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn supplemental_items_append_user_facts_without_changing_existing_report() {
        let output = append_supplemental_items(
            "# 日报\n\n- 完成 Git 功能",
            &[
                "  参与支付联调并确认回退路径  ".to_string(),
                "".to_string(),
                "完成上线后验证".to_string(),
            ],
            &ReportRedactionOptions::default(),
        )
        .unwrap();

        assert!(output.starts_with("# 日报\n\n- 完成 Git 功能"));
        assert!(output.contains("## 用户补充事项（非 Git）"));
        assert!(output.contains("- 参与支付联调并确认回退路径"));
        assert!(output.contains("- 完成上线后验证"));
    }

    #[test]
    fn supplemental_items_apply_redaction_and_reject_oversized_payloads() {
        let redaction = ReportRedactionOptions {
            enabled: true,
            rules: vec![ReportRedactionRule {
                find: "内部项目".to_string(),
                replacement: "项目A".to_string(),
            }],
        };
        let output =
            append_supplemental_items("# 周报", &["参与内部项目联调".to_string()], &redaction)
                .unwrap();

        assert!(output.contains("参与项目A联调"));
        assert!(!output.contains("内部项目"));
        assert!(append_supplemental_items(
            "# 周报",
            &vec!["事项".to_string(); 21],
            &ReportRedactionOptions::default(),
        )
        .unwrap_err()
        .contains("最多"));
        assert!(append_supplemental_items(
            "# 周报",
            &["字".repeat(201)],
            &ReportRedactionOptions::default(),
        )
        .unwrap_err()
        .contains("200"));
    }
}
