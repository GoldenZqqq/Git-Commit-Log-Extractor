use super::command;
use crate::models::{RepoInfo, RepoScanProgress, RepoScanResult};
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

pub(super) const SCAN_CANCELLED_MESSAGE: &str = "仓库扫描已取消";
pub(super) const MAX_SCAN_WARNINGS: usize = 50;
pub(super) const MAX_SCAN_WARNING_DETAILS: usize = MAX_SCAN_WARNINGS - 1;

pub fn find_git_repos(root_dirs: &[String]) -> Result<Vec<RepoInfo>, String> {
    let cancel_requested = AtomicBool::new(false);
    find_git_repos_with_progress(root_dirs, &cancel_requested, |_| {}).map(|result| result.repos)
}

pub fn find_git_repos_with_progress<F>(
    root_dirs: &[String],
    cancel_requested: &AtomicBool,
    mut on_progress: F,
) -> Result<RepoScanResult, String>
where
    F: FnMut(RepoScanProgress),
{
    command::ensure_git_available()?;
    let mut scanner = RepoScanner::new(cancel_requested, &mut on_progress);
    for root_dir in root_dirs {
        scanner.scan_root(Path::new(root_dir))?;
    }
    Ok(scanner.finish())
}

#[derive(Default)]
pub(super) struct ScanWarningCollector {
    pub(super) details: Vec<String>,
    pub(super) seen: HashSet<String>,
    pub(super) omitted: usize,
}

impl ScanWarningCollector {
    pub(super) fn push(&mut self, path: &Path, operation: &str, error: &io::Error) {
        let message = format!(
            "扫描已跳过“{}”：{}失败（{}）",
            display_path(path),
            operation,
            error
        );
        if self.seen.contains(&message) {
            return;
        }
        if self.details.len() < MAX_SCAN_WARNING_DETAILS {
            self.seen.insert(message.clone());
            self.details.push(message);
        } else {
            self.omitted += 1;
        }
    }

    pub(super) fn finish(mut self) -> Vec<String> {
        if self.omitted > 0 {
            self.details.push(format!(
                "另有 {} 个路径问题未逐条显示，请检查工作区目录权限与链接目标。",
                self.omitted
            ));
        }
        self.details
    }
}

struct RepoScanner<'a, F>
where
    F: FnMut(RepoScanProgress),
{
    cancel_requested: &'a AtomicBool,
    on_progress: &'a mut F,
    visited_dirs: HashSet<PathBuf>,
    seen_repo_paths: HashSet<String>,
    repos: Vec<RepoInfo>,
    warnings: ScanWarningCollector,
    scanned_dirs: usize,
}

impl<'a, F> RepoScanner<'a, F>
where
    F: FnMut(RepoScanProgress),
{
    fn new(cancel_requested: &'a AtomicBool, on_progress: &'a mut F) -> Self {
        Self {
            cancel_requested,
            on_progress,
            visited_dirs: HashSet::new(),
            seen_repo_paths: HashSet::new(),
            repos: Vec::new(),
            warnings: ScanWarningCollector::default(),
            scanned_dirs: 0,
        }
    }

    fn scan_root(&mut self, root: &Path) -> Result<(), String> {
        check_scan_cancelled(self.cancel_requested)?;
        self.visit_dir(root, &display_path(root))
    }

    fn visit_dir(&mut self, dir: &Path, root_dir: &str) -> Result<(), String> {
        check_scan_cancelled(self.cancel_requested)?;
        let Some(canonical_dir) = self.canonicalize_dir(dir) else {
            return Ok(());
        };
        if !self.visited_dirs.insert(canonical_dir.clone()) {
            return Ok(());
        }
        self.scanned_dirs += 1;
        self.emit_current_progress(root_dir, &canonical_dir);
        if is_git_repo_dir(&canonical_dir) {
            self.record_repo(root_dir, &canonical_dir);
            return Ok(());
        }
        let entries = match fs::read_dir(&canonical_dir) {
            Ok(entries) => entries,
            Err(error) => {
                self.warnings.push(&canonical_dir, "读取目录", &error);
                return Ok(());
            }
        };
        for entry in entries {
            self.visit_entry(&canonical_dir, root_dir, entry)?;
        }
        Ok(())
    }

    fn visit_entry(
        &mut self,
        parent: &Path,
        root_dir: &str,
        entry: io::Result<fs::DirEntry>,
    ) -> Result<(), String> {
        check_scan_cancelled(self.cancel_requested)?;
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                self.warnings.push(parent, "读取目录项", &error);
                return Ok(());
            }
        };
        let path = entry.path();
        if !should_visit_dir(&path) {
            return Ok(());
        }
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                self.warnings.push(&path, "读取目录项类型", &error);
                return Ok(());
            }
        };
        if file_type.is_dir() {
            return self.visit_dir(&path, root_dir);
        }
        if !file_type.is_symlink() {
            return Ok(());
        }
        match fs::metadata(&path) {
            Ok(metadata) if metadata.is_dir() => self.visit_dir(&path, root_dir),
            Ok(_) => Ok(()),
            Err(error) => {
                self.warnings.push(&path, "读取链接目标", &error);
                Ok(())
            }
        }
    }

    fn canonicalize_dir(&mut self, path: &Path) -> Option<PathBuf> {
        match fs::canonicalize(path) {
            Ok(canonical) => Some(canonical),
            Err(error) => {
                self.warnings.push(path, "规范化目录", &error);
                None
            }
        }
    }

    fn record_repo(&mut self, root_dir: &str, dir: &Path) {
        let repo = build_repo_info(dir);
        if self.seen_repo_paths.insert(repo.path.clone()) {
            self.repos.push(repo);
        }
        self.emit_current_progress(root_dir, dir);
    }

    fn emit_current_progress(&mut self, root_dir: &str, path: &Path) {
        emit_scan_progress(
            self.on_progress,
            RepoScanProgress {
                root_dir: root_dir.to_string(),
                current_path: display_path(path),
                scanned_dirs: self.scanned_dirs,
                found_repos: self.repos.len(),
                done: false,
                cancelled: false,
            },
        );
    }

    fn finish(mut self) -> RepoScanResult {
        self.repos.sort_by(|left, right| {
            left.name
                .to_lowercase()
                .cmp(&right.name.to_lowercase())
                .then_with(|| left.path.cmp(&right.path))
        });
        emit_scan_progress(
            self.on_progress,
            RepoScanProgress {
                root_dir: String::new(),
                current_path: String::new(),
                scanned_dirs: self.scanned_dirs,
                found_repos: self.repos.len(),
                done: true,
                cancelled: false,
            },
        );
        RepoScanResult {
            repos: self.repos,
            warnings: self.warnings.finish(),
        }
    }
}

fn check_scan_cancelled(cancel_requested: &AtomicBool) -> Result<(), String> {
    if cancel_requested.load(Ordering::Relaxed) {
        return Err(SCAN_CANCELLED_MESSAGE.to_string());
    }
    Ok(())
}

fn emit_scan_progress<F>(on_progress: &mut F, progress: RepoScanProgress)
where
    F: FnMut(RepoScanProgress),
{
    on_progress(progress);
}

fn build_repo_info(dir: &Path) -> RepoInfo {
    let path = fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf());
    RepoInfo {
        path: display_path(&path),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        branch: command::current_branch(&path),
    }
}

fn display_path(path: &Path) -> String {
    strip_windows_verbatim_prefix(&path.to_string_lossy())
}

pub(super) fn strip_windows_verbatim_prefix(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("\\\\?\\UNC\\") {
        return format!("\\\\{rest}");
    }
    if let Some(rest) = path.strip_prefix("\\\\?\\") {
        return rest.to_string();
    }
    path.to_string()
}

fn is_git_repo_dir(dir: &Path) -> bool {
    let marker = dir.join(".git");
    marker.is_dir() || marker.is_file()
}

fn should_visit_dir(path: &Path) -> bool {
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    !matches!(
        name.as_ref(),
        ".git" | "node_modules" | "target" | "dist" | ".venv" | "__pycache__"
    )
}
