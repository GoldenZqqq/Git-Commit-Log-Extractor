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
    let mut seen = HashSet::new();
    items
        .iter()
        .filter(|item| seen.insert(item.title.as_str()))
        .cloned()
        .collect()
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
