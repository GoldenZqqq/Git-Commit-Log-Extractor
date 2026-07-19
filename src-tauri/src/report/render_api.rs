use crate::{
    models::{
        CommitRecord, EvidenceLinkRule, ExtractResult, MonthlyReportResult, PeriodReportResult,
        RepoInfo, ReportFormatTemplates, ReportRedactionOptions, ReportRedactionRule,
    },
    project_retrospective::{self, ReportHistoryProject},
};
use regex::Regex;
use std::borrow::Cow;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::OnceLock;

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
