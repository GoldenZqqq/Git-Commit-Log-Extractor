use super::command;
use crate::models::{CommitRecord, RepoInfo};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

pub struct GitCommitQuery<'a> {
    pub start_date: &'a str,
    pub end_date: &'a str,
    pub author: &'a str,
    pub extract_all_branches: bool,
    pub exclude_merge_commits: bool,
    pub exclude_revert_commits: bool,
    pub exclude_bot_commits: bool,
}

pub fn get_git_commits(
    repo: &RepoInfo,
    query: &GitCommitQuery,
) -> Result<Vec<CommitRecord>, String> {
    command::ensure_git_available()?;
    let repo_path = PathBuf::from(&repo.path);
    let args = build_log_args(query);
    let borrowed_args: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = command::run_git(&repo_path, &borrowed_args)?;
    let mut records = parse_git_log_output(repo, &output, query);

    let numstat_args = build_numstat_args(query);
    let borrowed_numstat: Vec<&str> = numstat_args.iter().map(String::as_str).collect();
    if let Ok(numstat_output) = command::run_git(&repo_path, &borrowed_numstat) {
        let stats = parse_numstat_output(&numstat_output);
        for record in &mut records {
            if let Some(&(a, d, f)) = stats.get(&record.hash) {
                record.additions = a;
                record.deletions = d;
                record.changed_files = f;
            }
        }
    }

    Ok(records)
}

pub fn get_commit_dates(
    repo: &RepoInfo,
    start_date: &str,
    end_date: &str,
    author: &str,
    all_branches: bool,
) -> Result<Vec<(String, String)>, String> {
    let repo_path = PathBuf::from(&repo.path);
    let mut args = vec!["log".to_string()];
    if all_branches {
        args.push("--all".to_string());
    }
    args.extend([
        format!("--since={} 00:00:00", start_date),
        format!("--until={} 23:59:59", end_date),
        "--format=%H %ad".to_string(),
        "--date=short".to_string(),
    ]);
    for a in split_authors(author) {
        args.push(format!("--author={}", a));
    }
    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = command::run_git(&repo_path, &borrowed)?;
    let mut result = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((hash, date)) = line.split_once(' ') {
            result.push((hash.to_string(), date.to_string()));
        }
    }
    Ok(result)
}

pub fn get_commit_timestamps(
    repo: &RepoInfo,
    start_date: &str,
    end_date: &str,
    author: &str,
    all_branches: bool,
) -> Result<Vec<(String, String)>, String> {
    let repo_path = PathBuf::from(&repo.path);
    let mut args = vec!["log".to_string()];
    if all_branches {
        args.push("--all".to_string());
    }
    args.extend([
        format!("--since={} 00:00:00", start_date),
        format!("--until={} 23:59:59", end_date),
        "--format=%H %aI".to_string(),
    ]);
    for a in split_authors(author) {
        args.push(format!("--author={}", a));
    }
    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = command::run_git(&repo_path, &borrowed)?;
    let mut result = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((hash, timestamp)) = line.split_once(' ') {
            result.push((hash.to_string(), timestamp.to_string()));
        }
    }
    Ok(result)
}

pub(super) fn build_log_args(query: &GitCommitQuery) -> Vec<String> {
    let mut args = vec!["log".to_string()];
    if query.extract_all_branches {
        args.push("--all".to_string());
        args.push("--source".to_string());
    }
    if query.exclude_merge_commits {
        args.push("--no-merges".to_string());
    }
    args.extend([
        format!("--since={} 00:00:00", query.start_date),
        format!("--until={} 23:59:59", query.end_date),
        "--pretty=format:%x1e%H%x1f%P%x1f%S%x1f%an%x1f%ae%x1f%ad%x1f%B".to_string(),
        "--date=iso".to_string(),
    ]);
    // 多作者/留空语义：author 字符串按逗号或空白拆分，每个非空作者推一个
    // `--author=`（git 对多个 `--author=` 取 OR 匹配）。全空时不传任何
    // `--author=`，等同不过滤作者——既支持团队周报聚合，也避免旧逻辑下
    // 留空 author 被当成"匹配空"而得到空报告的隐患。
    for author in split_authors(query.author) {
        args.push(format!("--author={}", author));
    }
    args
}

/// 按逗号或任意空白拆分作者输入，去空白、去重、保留出现顺序。
/// 输入全空白时返回空 Vec，调用方据此决定是否跳过 `--author=`。
pub(crate) fn split_authors(author: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for part in author.split(|ch: char| ch == ',' || ch.is_whitespace()) {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if seen.insert(part.to_lowercase()) {
            result.push(part.to_string());
        }
    }
    result
}

pub(super) fn build_numstat_args(query: &GitCommitQuery) -> Vec<String> {
    let mut args = vec!["log".to_string()];
    if query.extract_all_branches {
        args.push("--all".to_string());
    }
    if query.exclude_merge_commits {
        args.push("--no-merges".to_string());
    }
    args.extend([
        format!("--since={} 00:00:00", query.start_date),
        format!("--until={} 23:59:59", query.end_date),
        "--format=%x1e%H".to_string(),
        "--numstat".to_string(),
    ]);
    for author in split_authors(query.author) {
        args.push(format!("--author={}", author));
    }
    args
}

pub(super) fn parse_numstat_output(output: &str) -> HashMap<String, (u64, u64, u32)> {
    let mut result = HashMap::new();
    for record in output.split('\x1e') {
        let record = record.trim();
        if record.is_empty() {
            continue;
        }
        let mut lines = record.lines();
        let Some(hash_line) = lines.next() else {
            continue;
        };
        let hash = hash_line.trim().to_string();
        if hash.is_empty() {
            continue;
        }
        let mut additions: u64 = 0;
        let mut deletions: u64 = 0;
        let mut changed_files: u32 = 0;
        for line in lines {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let parts: Vec<&str> = line.splitn(3, '\t').collect();
            if parts.len() < 3 {
                continue;
            }
            if parts[0] == "-" && parts[1] == "-" {
                continue;
            }
            if let (Ok(a), Ok(d)) = (parts[0].parse::<u64>(), parts[1].parse::<u64>()) {
                additions += a;
                deletions += d;
                changed_files += 1;
            }
        }
        result.insert(hash, (additions, deletions, changed_files));
    }
    result
}

pub(super) fn parse_git_log_output(
    repo: &RepoInfo,
    output: &str,
    query: &GitCommitQuery,
) -> Vec<CommitRecord> {
    output
        .split('\x1e')
        .filter_map(|record| parse_commit_record(repo, record, query))
        .collect()
}

fn parse_commit_record(
    repo: &RepoInfo,
    record: &str,
    query: &GitCommitQuery,
) -> Option<CommitRecord> {
    let record = record.trim();
    if record.is_empty() {
        return None;
    }

    let parts: Vec<&str> = record.splitn(7, '\x1f').collect();
    if parts.len() != 7 {
        return None;
    }
    let parent_count = parts[1].split_whitespace().count();
    let message = parts[6].trim();
    let author = parts[3].trim();
    let author_email = parts[4].trim();

    if query.exclude_merge_commits && parent_count > 1 {
        return None;
    }
    if query.exclude_revert_commits && is_revert_commit(message) {
        return None;
    }
    if query.exclude_bot_commits && is_bot_author(author, author_email) {
        return None;
    }

    Some(CommitRecord {
        repo_path: repo.path.clone(),
        project_name: repo.name.clone(),
        branch_name: branch_name_from_source(repo, parts[2], query.extract_all_branches),
        hash: parts[0].trim().to_string(),
        author: author.to_string(),
        author_email: author_email.to_string(),
        date: parts[5].trim().to_string(),
        message: message.to_string(),
        additions: 0,
        deletions: 0,
        changed_files: 0,
    })
}

fn branch_name_from_source(repo: &RepoInfo, source: &str, extract_all_branches: bool) -> String {
    if !extract_all_branches {
        return repo.branch.clone();
    }
    normalize_source_ref(source).unwrap_or_else(|| repo.branch.clone())
}

fn normalize_source_ref(source: &str) -> Option<String> {
    let trimmed = source.trim();
    if trimmed.is_empty() {
        return None;
    }
    let without_prefix = trimmed
        .strip_prefix("refs/heads/")
        .or_else(|| trimmed.strip_prefix("refs/remotes/"))
        .unwrap_or(trimmed);
    let without_remote = without_prefix
        .strip_prefix("origin/")
        .unwrap_or(without_prefix);
    if without_remote == "HEAD" || without_remote.ends_with("/HEAD") {
        return None;
    }
    Some(without_remote.to_string())
}

fn is_revert_commit(message: &str) -> bool {
    let subject = message.lines().next().unwrap_or_default().trim();
    let subject_lower = subject.to_lowercase();
    subject_lower == "revert"
        || subject_lower.starts_with("revert ")
        || subject_lower.starts_with("revert:")
        || subject_lower.starts_with("revert(")
        || message.contains("This reverts commit")
}

fn is_bot_author(name: &str, email: &str) -> bool {
    let name = name.trim().to_lowercase();
    let email = email.trim().to_lowercase();
    name.contains("[bot]")
        || email.contains("[bot]")
        || name == "github-actions"
        || name == "dependabot"
        || name.ends_with(" bot")
        || email.starts_with("dependabot")
        || email.starts_with("github-actions")
        || email.contains("bot@")
}
