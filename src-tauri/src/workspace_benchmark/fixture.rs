use crate::profile::ProfileSpec;
use std::fs;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

const MARKER_FILE: &str = ".gitpulse-benchmark-fixture";
const MARKER_VALUE: &str = "gitpulse-workspace-benchmark-v1";
const BASE_TIMESTAMP: i64 = 1_704_067_200;

pub struct Fixture {
    path: PathBuf,
    keep: bool,
}

impl Fixture {
    pub fn create(spec: ProfileSpec, requested_path: Option<&Path>) -> Result<Self, String> {
        let path = requested_path
            .map(Path::to_path_buf)
            .unwrap_or_else(|| temp_path(spec.name));
        prepare_directory(&path, spec.name)?;
        if let Err(error) = generate_repositories(&path, spec) {
            let _ = cleanup_controlled(&path);
            return Err(error);
        }
        Ok(Self { path, keep: false })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn keep(&mut self) {
        self.keep = true;
    }

    pub fn is_kept(&self) -> bool {
        self.keep
    }

    pub fn size_bytes(&self) -> u64 {
        WalkDir::new(&self.path)
            .into_iter()
            .filter_map(Result::ok)
            .filter_map(|entry| entry.metadata().ok())
            .filter(|metadata| metadata.is_file())
            .map(|metadata| metadata.len())
            .sum()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        if !self.keep {
            let _ = cleanup_controlled(&self.path);
        }
    }
}

pub fn cleanup_controlled(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    validate_marker(path)?;
    fs::remove_dir_all(path).map_err(|error| format!("清理 benchmark fixture 失败：{error}"))
}

fn prepare_directory(path: &Path, profile: &str) -> Result<(), String> {
    if path.exists() && !directory_is_empty(path)? {
        cleanup_controlled(path)?;
    }
    fs::create_dir_all(path).map_err(|error| format!("创建 benchmark fixture 失败：{error}"))?;
    let marker = format!("{MARKER_VALUE}\nprofile={profile}\n");
    fs::write(path.join(MARKER_FILE), marker)
        .map_err(|error| format!("写入 benchmark marker 失败：{error}"))
}

fn directory_is_empty(path: &Path) -> Result<bool, String> {
    if !path.is_dir() {
        return Ok(false);
    }
    fs::read_dir(path)
        .map_err(|error| format!("读取 benchmark fixture 目录失败：{error}"))
        .map(|mut entries| entries.next().is_none())
}

fn validate_marker(path: &Path) -> Result<(), String> {
    let marker_path = path.join(MARKER_FILE);
    let marker = fs::read_to_string(&marker_path).map_err(|_| {
        format!(
            "拒绝清理未受 GitPulse marker 保护的目录：{}",
            path.display()
        )
    })?;
    if !marker.lines().any(|line| line == MARKER_VALUE) {
        return Err(format!("benchmark marker 无效：{}", marker_path.display()));
    }
    Ok(())
}

fn generate_repositories(root: &Path, spec: ProfileSpec) -> Result<(), String> {
    for repo_index in 0..spec.repository_count {
        let repo = root.join(format!("repo-{repo_index:03}"));
        fs::create_dir_all(&repo)
            .map_err(|error| format!("创建 synthetic repository 失败：{error}"))?;
        run_git(&repo, &["init", "--quiet", "--initial-branch=main"])?;
        let commit_count = commits_for_repo(spec, repo_index);
        fast_import(&repo, repo_index, commit_count)?;
        run_git(&repo, &["reset", "--quiet", "--hard", "main"])?;
    }
    Ok(())
}

fn commits_for_repo(spec: ProfileSpec, repo_index: usize) -> usize {
    let base = spec.commit_count / spec.repository_count;
    base + usize::from(repo_index < spec.commit_count % spec.repository_count)
}

fn fast_import(repo: &Path, repo_index: usize, commit_count: usize) -> Result<(), String> {
    let mut child = Command::new("git")
        .args(["fast-import", "--quiet"])
        .current_dir(repo)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("启动 git fast-import 失败：{error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "无法写入 git fast-import".to_string())?;
    let write_result = write_import_stream(stdin, repo_index, commit_count);
    let output = child
        .wait_with_output()
        .map_err(|error| format!("等待 git fast-import 失败：{error}"))?;
    write_result?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "git fast-import 失败：{}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

fn write_import_stream(
    stdin: impl Write,
    repo_index: usize,
    commit_count: usize,
) -> Result<(), String> {
    let mut writer = BufWriter::new(stdin);
    let mut previous_commit = None;
    for commit_index in 0..commit_count {
        let blob_mark = commit_index * 2 + 1;
        let commit_mark = blob_mark + 1;
        write_blob(&mut writer, blob_mark, repo_index, commit_index)?;
        write_commit(
            &mut writer,
            commit_mark,
            previous_commit,
            repo_index,
            commit_index,
        )?;
        previous_commit = Some(commit_mark);
    }
    writer
        .write_all(b"done\n")
        .and_then(|_| writer.flush())
        .map_err(|error| format!("写入 git fast-import 流失败：{error}"))
}

fn write_blob(
    writer: &mut impl Write,
    mark: usize,
    repo_index: usize,
    commit_index: usize,
) -> Result<(), String> {
    let content = format!("repository={repo_index}\ncommit={commit_index}\n");
    write!(
        writer,
        "blob\nmark :{mark}\ndata {}\n{content}\n",
        content.len()
    )
    .map_err(|error| format!("写入 synthetic blob 失败：{error}"))
}

fn write_commit(
    writer: &mut impl Write,
    mark: usize,
    parent: Option<usize>,
    repo_index: usize,
    commit_index: usize,
) -> Result<(), String> {
    let timestamp = BASE_TIMESTAMP + (repo_index * 100_000 + commit_index) as i64;
    let message = format!("feat: benchmark repo {repo_index} commit {commit_index}");
    write!(
        writer,
        "commit refs/heads/main\nmark :{mark}\nauthor Benchmark User <benchmark@example.test> {timestamp} +0000\ncommitter Benchmark User <benchmark@example.test> {timestamp} +0000\n"
    )
    .map_err(|error| format!("写入 synthetic commit 失败：{error}"))?;
    write!(writer, "data {}\n{message}\n", message.len(),)
        .map_err(|error| format!("写入 synthetic commit data 失败：{error}"))?;
    if let Some(parent) = parent {
        writeln!(writer, "from :{parent}")
            .map_err(|error| format!("写入 synthetic parent 失败：{error}"))?;
    }
    writeln!(writer, "M 100644 :{} benchmark.txt", mark - 1)
        .map_err(|error| format!("写入 synthetic file update 失败：{error}"))
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|error| format!("启动 Git 命令失败：{error}"))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }
    Err(format!(
        "Git 命令失败（git {}）：{}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

fn temp_path(profile: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!(
        "gitpulse-workspace-benchmark-{profile}-{}-{nanos}",
        std::process::id()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile::Thresholds;

    #[test]
    fn commit_distribution_preserves_the_exact_total() {
        let spec = test_spec(4, 11);
        let counts: Vec<usize> = (0..4).map(|index| commits_for_repo(spec, index)).collect();

        assert_eq!(vec![3, 3, 3, 2], counts);
        assert_eq!(11, counts.iter().sum::<usize>());
    }

    #[test]
    fn cleanup_refuses_directories_without_the_benchmark_marker() {
        let root = temp_path("unsafe-cleanup");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("user-data.txt"), "keep").unwrap();

        let error = cleanup_controlled(&root).unwrap_err();

        assert!(error.contains("拒绝清理"));
        assert!(root.join("user-data.txt").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preparation_can_take_over_an_empty_requested_directory() {
        let root = temp_path("empty-requested-directory");
        fs::create_dir_all(&root).unwrap();

        prepare_directory(&root, "test").unwrap();

        validate_marker(&root).unwrap();
        cleanup_controlled(&root).unwrap();
        assert!(!root.exists());
    }

    #[test]
    fn tiny_fixture_contains_the_requested_repositories_and_commits() {
        let fixture = Fixture::create(test_spec(2, 6), None).unwrap();
        let repositories = fs::read_dir(fixture.path())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.path().join(".git").is_dir())
            .count();
        let commits = run_git(
            &fixture.path().join("repo-000"),
            &["rev-list", "--count", "HEAD"],
        )
        .unwrap();

        assert_eq!(2, repositories);
        assert_eq!("3", commits);
    }

    fn test_spec(repository_count: usize, commit_count: usize) -> ProfileSpec {
        ProfileSpec {
            name: "test",
            repository_count,
            commit_count,
            default_iterations: 2,
            thresholds: Thresholds {
                first_scan_ms: u64::MAX,
                warm_scan_p95_ms: u64::MAX,
                extraction_p95_ms: u64::MAX,
                cancellation_ms: u64::MAX,
                peak_rss_bytes: None,
            },
        }
    }
}
