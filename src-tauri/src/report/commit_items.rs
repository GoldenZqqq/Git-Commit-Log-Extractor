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
    let no_prefix = commit_prefix_regex().replace(message, "");
    let flattened = no_prefix.replace('"', "").replace("['']", "");
    let whitespace = whitespace_regex().replace_all(&flattened, " ");
    separator_regex()
        .replace_all(whitespace.trim(), "；")
        .to_string()
}

fn commit_prefix_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r"(?i)^(feat|fix|refactor|chore|docs|style|test|perf|ci|build|revert|init)(\([^)]*\))?:\s*",
        )
        .expect("commit prefix regex must be valid")
    })
}

fn whitespace_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"\s+").expect("whitespace regex must be valid"))
}

fn separator_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"\s+-\s+").expect("separator regex must be valid"))
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
