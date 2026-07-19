use super::*;
use crate::models::RepoInfo;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn find_git_repos_detects_worktree_git_file() {
    let root = temp_root("worktree-git-file");
    let repo = root.join("repo");
    fs::create_dir_all(&repo).unwrap();
    fs::write(repo.join(".git"), "gitdir: ../.git/worktrees/repo\n").unwrap();

    let repos = find_git_repos(&[root.to_string_lossy().to_string()]).unwrap();

    assert_eq!(repos.len(), 1);
    assert_eq!(repos[0].name, "repo");
    assert_eq!(repos[0].branch, "unknown");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn find_git_repos_deduplicates_overlapping_roots() {
    let root = temp_root("dedupe-overlap");
    let repo = root.join("repo");
    fs::create_dir_all(repo.join(".git")).unwrap();

    let repos = find_git_repos(&[
        root.to_string_lossy().to_string(),
        repo.to_string_lossy().to_string(),
    ])
    .unwrap();

    assert_eq!(repos.len(), 1);
    assert_eq!(repos[0].name, "repo");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn scan_result_warns_for_invalid_root_and_keeps_valid_repos() {
    let root = temp_root("scan-warning-continue");
    let repo = root.join("repo");
    let missing = root.join("missing-root");
    fs::create_dir_all(repo.join(".git")).unwrap();
    let cancel_requested = AtomicBool::new(false);

    let result = find_git_repos_with_progress(
        &[
            missing.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
        ],
        &cancel_requested,
        |_| {},
    )
    .unwrap();

    assert_eq!(result.repos.len(), 1);
    assert_eq!(result.repos[0].name, "repo");
    assert!(result
        .warnings
        .iter()
        .any(|warning| warning.contains("missing-root") && warning.contains("规范化目录失败")));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn scan_result_warns_when_root_is_not_a_directory_and_keeps_valid_repos() {
    let root = temp_root("scan-read-dir-warning");
    let repo = root.join("repo");
    let file_root = root.join("not-a-directory");
    fs::create_dir_all(repo.join(".git")).unwrap();
    fs::write(&file_root, "not a directory").unwrap();
    let cancel_requested = AtomicBool::new(false);

    let result = find_git_repos_with_progress(
        &[
            file_root.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
        ],
        &cancel_requested,
        |_| {},
    )
    .unwrap();

    assert_eq!(result.repos.len(), 1);
    assert!(result
        .warnings
        .iter()
        .any(|warning| warning.contains("not-a-directory") && warning.contains("读取目录失败")));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn scan_result_warns_for_broken_directory_link_and_keeps_valid_repos() {
    let root = temp_root("scan-broken-link");
    let repo = root.join("repo");
    let broken_link = root.join("broken-link");
    fs::create_dir_all(repo.join(".git")).unwrap();
    #[cfg(unix)]
    let link_result = std::os::unix::fs::symlink(root.join("missing-target"), &broken_link);
    #[cfg(windows)]
    let link_result = std::os::windows::fs::symlink_dir(root.join("missing-target"), &broken_link);
    if link_result.is_err() {
        let _ = fs::remove_dir_all(root);
        return;
    }
    let cancel_requested = AtomicBool::new(false);

    let result = find_git_repos_with_progress(
        &[root.to_string_lossy().to_string()],
        &cancel_requested,
        |_| {},
    )
    .unwrap();

    assert_eq!(result.repos.len(), 1);
    assert!(result
        .warnings
        .iter()
        .any(|warning| warning.contains("broken-link") && warning.contains("失败")));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn scan_warnings_are_deduplicated_and_bounded() {
    let mut collector = ScanWarningCollector::default();
    let error = io::Error::from(io::ErrorKind::PermissionDenied);
    collector.push(Path::new("same-path"), "读取目录", &error);
    collector.push(Path::new("same-path"), "读取目录", &error);
    for index in 0..75 {
        collector.push(
            &PathBuf::from(format!("broken-{index}")),
            "读取目录",
            &error,
        );
    }

    assert_eq!(collector.seen.len(), MAX_SCAN_WARNING_DETAILS);

    let warnings = collector.finish();

    assert_eq!(warnings.len(), MAX_SCAN_WARNINGS);
    assert_eq!(
        warnings
            .iter()
            .filter(|warning| warning.contains("same-path"))
            .count(),
        1
    );
    assert!(warnings.last().unwrap().contains("另有 27 个路径问题"));
}

#[cfg(unix)]
#[test]
fn find_git_repos_stops_at_unix_directory_link_cycle() {
    use std::os::unix::fs::symlink;

    let root = temp_root("unix-link-cycle");
    let repo = root.join("repo");
    fs::create_dir_all(repo.join(".git")).unwrap();
    symlink(&root, root.join("loop")).unwrap();
    let cancel_requested = AtomicBool::new(false);
    let mut latest_progress = None;

    let result = find_git_repos_with_progress(
        &[root.to_string_lossy().to_string()],
        &cancel_requested,
        |progress| latest_progress = Some(progress),
    )
    .unwrap();

    assert_eq!(result.repos.len(), 1);
    assert!(result.warnings.is_empty());
    assert!(latest_progress.unwrap().scanned_dirs <= 2);

    let _ = fs::remove_dir_all(root);
}

#[cfg(windows)]
#[test]
fn find_git_repos_stops_at_windows_directory_link_cycle_when_available() {
    use std::os::windows::fs::symlink_dir;

    let root = temp_root("windows-link-cycle");
    let repo = root.join("repo");
    fs::create_dir_all(repo.join(".git")).unwrap();
    if symlink_dir(&root, root.join("loop")).is_err() {
        let _ = fs::remove_dir_all(root);
        return;
    }
    let cancel_requested = AtomicBool::new(false);
    let mut latest_progress = None;

    let result = find_git_repos_with_progress(
        &[root.to_string_lossy().to_string()],
        &cancel_requested,
        |progress| latest_progress = Some(progress),
    )
    .unwrap();

    assert_eq!(result.repos.len(), 1);
    assert!(result.warnings.is_empty());
    assert!(latest_progress.unwrap().scanned_dirs <= 2);

    let _ = fs::remove_dir_all(root);
}

#[test]
fn find_git_repos_with_progress_reports_scanned_dirs_and_found_repos() {
    let root = temp_root("scan-progress");
    let repo = root.join("repo");
    fs::create_dir_all(repo.join(".git")).unwrap();
    let cancel_requested = AtomicBool::new(false);
    let mut latest_progress = None;

    let result = find_git_repos_with_progress(
        &[root.to_string_lossy().to_string()],
        &cancel_requested,
        |progress| latest_progress = Some(progress),
    )
    .unwrap();

    assert_eq!(result.repos.len(), 1);
    assert!(result.warnings.is_empty());
    let progress = latest_progress.unwrap();
    assert!(progress.done);
    assert!(progress.scanned_dirs >= 1);
    assert_eq!(progress.found_repos, 1);

    let _ = fs::remove_dir_all(root);
}

#[test]
fn find_git_repos_with_progress_can_cancel_before_scanning() {
    let root = temp_root("scan-cancel");
    fs::create_dir_all(&root).unwrap();
    let cancel_requested = AtomicBool::new(true);

    let message = find_git_repos_with_progress(
        &[root.to_string_lossy().to_string()],
        &cancel_requested,
        |_| {},
    )
    .unwrap_err();

    assert_eq!(message, SCAN_CANCELLED_MESSAGE);

    let _ = fs::remove_dir_all(root);
}

#[test]
fn format_git_launch_error_explains_missing_git() {
    let message = format_git_launch_error(io::Error::from(io::ErrorKind::NotFound));

    assert!(message.contains("未找到 Git 命令"));
    assert!(message.contains("PATH"));
}

#[test]
fn strip_windows_verbatim_prefix_from_drive_path() {
    let path = strip_windows_verbatim_prefix("\\\\?\\C:\\workspace\\repo");

    assert_eq!(path, "C:\\workspace\\repo");
}

#[test]
fn strip_windows_verbatim_prefix_from_unc_path() {
    let path = strip_windows_verbatim_prefix("\\\\?\\UNC\\server\\share\\repo");

    assert_eq!(path, "\\\\server\\share\\repo");
}

#[test]
fn strip_windows_verbatim_prefix_keeps_regular_path() {
    let path = strip_windows_verbatim_prefix("C:\\workspace\\repo");

    assert_eq!(path, "C:\\workspace\\repo");
}

#[test]
fn parse_git_log_output_filters_merge_revert_and_bot_commits() {
    let repo = repo_info();
    let query = query(true, true, true, true);
    let output = [
        log_record(
            "normal",
            "parent",
            "refs/heads/main",
            "tester",
            "tester@example.com",
            "feat: keep",
        ),
        log_record(
            "merge",
            "parent-a parent-b",
            "refs/heads/main",
            "tester",
            "tester@example.com",
            "Merge branch 'feature'",
        ),
        log_record(
            "revert",
            "parent",
            "refs/heads/main",
            "tester",
            "tester@example.com",
            "Revert \"feat: old change\"",
        ),
        log_record(
            "bot",
            "parent",
            "refs/heads/main",
            "dependabot[bot]",
            "49699333+dependabot[bot]@users.noreply.github.com",
            "chore: bump dependency",
        ),
    ]
    .join("");

    let commits = parse_git_log_output(&repo, &output, &query);

    assert_eq!(commits.len(), 1);
    assert_eq!(commits[0].hash, "normal");
}

#[test]
fn parse_git_log_output_uses_source_ref_for_all_branch_attribution() {
    let repo = repo_info();
    let query = query(true, false, false, false);
    let output = log_record(
        "abc123",
        "parent",
        "refs/remotes/origin/feature/report",
        "tester",
        "tester@example.com",
        "feat: report",
    );

    let commits = parse_git_log_output(&repo, &output, &query);

    assert_eq!(commits[0].branch_name, "feature/report");
}

#[test]
fn parse_git_log_output_keeps_current_branch_without_all_branches() {
    let repo = repo_info();
    let query = query(false, false, false, false);
    let output = log_record(
        "abc123",
        "parent",
        "refs/heads/feature/report",
        "tester",
        "tester@example.com",
        "feat: report",
    );

    let commits = parse_git_log_output(&repo, &output, &query);

    assert_eq!(commits[0].branch_name, "main");
}

#[test]
fn build_log_args_uses_source_and_no_merges_for_all_branch_filters() {
    let query = query(true, true, false, false);

    let args = build_log_args(&query);

    assert!(args.contains(&"--all".to_string()));
    assert!(args.contains(&"--source".to_string()));
    assert!(args.contains(&"--no-merges".to_string()));
}

#[test]
fn build_log_args_emits_one_author_flag_per_comma_separated_author() {
    let query = GitCommitQuery {
        start_date: "2026-06-01",
        end_date: "2026-06-30",
        author: "Alice, Bob\tdave",
        extract_all_branches: false,
        exclude_merge_commits: true,
        exclude_revert_commits: true,
        exclude_bot_commits: true,
    };

    let args = build_log_args(&query);

    let author_flags: Vec<String> = args
        .iter()
        .filter(|arg| arg.starts_with("--author="))
        .cloned()
        .collect();
    assert_eq!(
        author_flags,
        vec![
            "--author=Alice".to_string(),
            "--author=Bob".to_string(),
            "--author=dave".to_string(),
        ]
    );
}

#[test]
fn build_log_args_omits_author_flag_when_author_blank_so_all_authors_match() {
    let query = GitCommitQuery {
        start_date: "2026-06-01",
        end_date: "2026-06-30",
        author: "  ,  ",
        extract_all_branches: false,
        exclude_merge_commits: true,
        exclude_revert_commits: true,
        exclude_bot_commits: true,
    };

    let args = build_log_args(&query);

    assert!(
        !args.iter().any(|arg| arg.starts_with("--author=")),
        "空白作者不应传入 --author=，留空意为不过滤作者"
    );
}

#[test]
fn split_authors_deduplicates_case_insensitively_and_preserves_order() {
    assert_eq!(
        split_authors("Alice, alice, BOB, bob"),
        vec!["Alice".to_string(), "BOB".to_string()]
    );
    assert_eq!(split_authors("  , "), Vec::<String>::new());
    assert_eq!(
        split_authors("张三 李四,王五"),
        vec!["张三".to_string(), "李四".to_string(), "王五".to_string()]
    );
}

#[test]
fn git_version_short_parses_major_minor_from_version_string() {
    assert_eq!(
        git_version_short("git version 2.45.1.windows.1"),
        Some((2, 45))
    );
    assert_eq!(git_version_short("git version 2.13.0"), Some((2, 13)));
    // 无法识别的形态不应误判，返回 None 让调用方退化为不校验。
    assert_eq!(git_version_short("unknown"), None);
    assert_eq!(git_version_short(""), None);
}

fn temp_root(label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("gitpulse-{label}-{}-{nanos}", std::process::id()))
}

fn repo_info() -> RepoInfo {
    RepoInfo {
        path: "repo-a".to_string(),
        name: "repo-a".to_string(),
        branch: "main".to_string(),
    }
}

fn query(
    extract_all_branches: bool,
    exclude_merge_commits: bool,
    exclude_revert_commits: bool,
    exclude_bot_commits: bool,
) -> GitCommitQuery<'static> {
    GitCommitQuery {
        start_date: "2026-06-01",
        end_date: "2026-06-30",
        author: "tester",
        extract_all_branches,
        exclude_merge_commits,
        exclude_revert_commits,
        exclude_bot_commits,
    }
}

fn log_record(
    hash: &str,
    parents: &str,
    source: &str,
    author: &str,
    email: &str,
    message: &str,
) -> String {
    format!(
            "\x1e{hash}\x1f{parents}\x1f{source}\x1f{author}\x1f{email}\x1f2026-06-10 10:00:00 +0800\x1f{message}"
        )
}

#[test]
fn test_parse_numstat_output() {
    let output =
        "\x1eabc123\n\n3\t1\tsrc/main.rs\n10\t5\tsrc/lib.rs\n\n\x1edef456\n\n1\t0\tREADME.md\n";
    let stats = parse_numstat_output(output);
    assert_eq!(stats.len(), 2);
    assert_eq!(stats.get("abc123"), Some(&(13, 6, 2)));
    assert_eq!(stats.get("def456"), Some(&(1, 0, 1)));
}

#[test]
fn test_parse_numstat_binary_files() {
    let output = "\x1eabc123\n\n-\t-\timage.png\n3\t1\tsrc/main.rs\n";
    let stats = parse_numstat_output(output);
    assert_eq!(stats.get("abc123"), Some(&(3, 1, 1)));
}

#[test]
fn test_parse_numstat_empty() {
    let stats = parse_numstat_output("");
    assert!(stats.is_empty());
}

#[test]
fn build_numstat_args_mirrors_log_args_filters() {
    let query = query(true, true, false, false);
    let args = build_numstat_args(&query);
    assert!(args.contains(&"--all".to_string()));
    assert!(args.contains(&"--no-merges".to_string()));
    assert!(args.contains(&"--numstat".to_string()));
    assert!(args.contains(&"--format=%x1e%H".to_string()));
    assert!(args.iter().any(|a| a.starts_with("--author=")));
}
