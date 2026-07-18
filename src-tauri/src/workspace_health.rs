use crate::{
    git_ops,
    models::{
        RepoInfo, WorkspaceHealthOptions, WorkspaceHealthResult, WorkspaceRepoHealth,
        WorkspaceRepoStatus, WorkspaceRootHealth, WorkspaceRootStatus,
    },
};
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::Path;

struct RepoHealthState {
    status: WorkspaceRepoStatus,
    detail: String,
    current_branch: String,
    disabled: bool,
}

pub fn inspect(options: WorkspaceHealthOptions) -> WorkspaceHealthResult {
    let disabled_paths = options.disabled_repos.into_iter().collect::<HashSet<_>>();
    let roots = options
        .root_dirs
        .iter()
        .map(|path| inspect_root(path))
        .collect();
    let repos = options
        .indexed_repos
        .iter()
        .map(|repo| inspect_repo(repo, &disabled_paths))
        .collect();
    WorkspaceHealthResult { roots, repos }
}

pub(crate) fn repo_path_is_valid(repo: &RepoInfo) -> bool {
    let path = Path::new(repo.path.trim());
    matches!(fs::metadata(path), Ok(metadata) if metadata.is_dir())
        && matches!(git_marker_is_valid(path), Ok(true))
}

fn inspect_root(path: &str) -> WorkspaceRootHealth {
    let trimmed = path.trim();
    match fs::metadata(trimmed) {
        Ok(metadata) if metadata.is_dir() => {
            root_health(trimmed, WorkspaceRootStatus::Healthy, "目录可访问")
        }
        Ok(_) => root_health(
            trimmed,
            WorkspaceRootStatus::NotDirectory,
            "路径存在，但不是文件夹",
        ),
        Err(error) => root_health(
            trimmed,
            root_status_from_error(&error),
            &root_error_detail(&error),
        ),
    }
}

fn inspect_repo(repo: &RepoInfo, disabled_paths: &HashSet<String>) -> WorkspaceRepoHealth {
    let path = Path::new(repo.path.trim());
    let disabled = disabled_paths.contains(&repo.path);
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_dir() => inspect_git_repo(repo, path, disabled),
        Ok(_) => repo_health(
            repo,
            RepoHealthState {
                status: WorkspaceRepoStatus::NotGit,
                detail: "路径存在，但不是 Git 仓库目录".to_string(),
                current_branch: String::new(),
                disabled,
            },
        ),
        Err(error) => repo_health(
            repo,
            RepoHealthState {
                status: repo_status_from_error(&error),
                detail: repo_error_detail(&error),
                current_branch: String::new(),
                disabled,
            },
        ),
    }
}

fn inspect_git_repo(repo: &RepoInfo, path: &Path, disabled: bool) -> WorkspaceRepoHealth {
    match git_marker_is_valid(path) {
        Ok(true) => inspect_repo_branch(repo, disabled),
        Ok(false) => repo_health(
            repo,
            RepoHealthState {
                status: WorkspaceRepoStatus::NotGit,
                detail: "目录存在，但不再包含 .git 标记".to_string(),
                current_branch: String::new(),
                disabled,
            },
        ),
        Err(error) => repo_health(
            repo,
            RepoHealthState {
                status: WorkspaceRepoStatus::Inaccessible,
                detail: format!("无法读取 .git 标记：{error}"),
                current_branch: String::new(),
                disabled,
            },
        ),
    }
}

fn inspect_repo_branch(repo: &RepoInfo, disabled: bool) -> WorkspaceRepoHealth {
    let current_branch = git_ops::current_branch(Path::new(&repo.path));
    if current_branch.trim().is_empty() || current_branch == "unknown" {
        return repo_health(
            repo,
            RepoHealthState {
                status: WorkspaceRepoStatus::BranchUnknown,
                detail: "路径与 Git 标记有效，但无法读取当前分支".to_string(),
                current_branch: String::new(),
                disabled,
            },
        );
    }
    if current_branch != repo.branch {
        let detail = format!("索引分支为 {}，当前分支为 {}", repo.branch, current_branch);
        return repo_health(
            repo,
            RepoHealthState {
                status: WorkspaceRepoStatus::BranchChanged,
                detail,
                current_branch,
                disabled,
            },
        );
    }
    repo_health(
        repo,
        RepoHealthState {
            status: WorkspaceRepoStatus::Healthy,
            detail: "路径、Git 标记与分支状态正常".to_string(),
            current_branch,
            disabled,
        },
    )
}

fn git_marker_is_valid(repo_path: &Path) -> Result<bool, io::Error> {
    match fs::metadata(repo_path.join(".git")) {
        Ok(metadata) => Ok(metadata.is_dir() || metadata.is_file()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

fn root_status_from_error(error: &io::Error) -> WorkspaceRootStatus {
    if error.kind() == io::ErrorKind::NotFound {
        WorkspaceRootStatus::Missing
    } else {
        WorkspaceRootStatus::Inaccessible
    }
}

fn repo_status_from_error(error: &io::Error) -> WorkspaceRepoStatus {
    if error.kind() == io::ErrorKind::NotFound {
        WorkspaceRepoStatus::Missing
    } else {
        WorkspaceRepoStatus::Inaccessible
    }
}

fn root_error_detail(error: &io::Error) -> String {
    if error.kind() == io::ErrorKind::NotFound {
        "目录已移动、删除或未挂载".to_string()
    } else {
        format!("目录当前无法访问：{error}")
    }
}

fn repo_error_detail(error: &io::Error) -> String {
    if error.kind() == io::ErrorKind::NotFound {
        "仓库目录已移动或删除".to_string()
    } else {
        format!("仓库目录当前无法访问：{error}")
    }
}

fn root_health(path: &str, status: WorkspaceRootStatus, detail: &str) -> WorkspaceRootHealth {
    WorkspaceRootHealth {
        path: path.to_string(),
        status,
        detail: detail.to_string(),
    }
}

fn repo_health(repo: &RepoInfo, state: RepoHealthState) -> WorkspaceRepoHealth {
    WorkspaceRepoHealth {
        path: repo.path.clone(),
        name: repo.name.clone(),
        cached_branch: repo.branch.clone(),
        current_branch: state.current_branch,
        status: state.status,
        detail: state.detail,
        disabled: state.disabled,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        RepoInfo, WorkspaceHealthOptions, WorkspaceRepoStatus, WorkspaceRootStatus,
    };
    use std::fs;
    use std::io;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn inspects_empty_and_invalid_workspace_roots() {
        let root = temp_root("workspace-health-roots");
        let file_root = root.join("not-a-directory");
        let missing_root = root.join("missing");
        fs::create_dir_all(&root).unwrap();
        fs::write(&file_root, "file").unwrap();

        let result = inspect(WorkspaceHealthOptions {
            root_dirs: vec![
                root.to_string_lossy().to_string(),
                file_root.to_string_lossy().to_string(),
                missing_root.to_string_lossy().to_string(),
            ],
            indexed_repos: vec![],
            disabled_repos: vec![],
        });

        assert_eq!(result.roots[0].status, WorkspaceRootStatus::Healthy);
        assert_eq!(result.roots[1].status, WorkspaceRootStatus::NotDirectory);
        assert_eq!(result.roots[2].status, WorkspaceRootStatus::Missing);
        assert!(result.repos.is_empty());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn distinguishes_missing_non_git_and_unknown_branch_repositories() {
        let root = temp_root("workspace-health-invalid-repos");
        let non_git = root.join("non-git");
        let unknown_branch = root.join("unknown-branch");
        fs::create_dir_all(&non_git).unwrap();
        fs::create_dir_all(unknown_branch.join(".git")).unwrap();

        let result = inspect(WorkspaceHealthOptions {
            root_dirs: vec![root.to_string_lossy().to_string()],
            indexed_repos: vec![
                repo(root.join("missing"), "missing", "main"),
                repo(non_git, "non-git", "main"),
                repo(unknown_branch, "unknown-branch", "main"),
            ],
            disabled_repos: vec![],
        });

        assert_eq!(result.repos[0].status, WorkspaceRepoStatus::Missing);
        assert_eq!(result.repos[1].status, WorkspaceRepoStatus::NotGit);
        assert_eq!(result.repos[2].status, WorkspaceRepoStatus::BranchUnknown);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn reports_healthy_changed_and_disabled_repository_state() {
        let root = temp_root("workspace-health-branches");
        let repo_path = root.join("repo");
        create_committed_repo(&repo_path);
        let path = repo_path.to_string_lossy().to_string();

        let healthy = inspect(WorkspaceHealthOptions {
            root_dirs: vec![root.to_string_lossy().to_string()],
            indexed_repos: vec![repo(repo_path.clone(), "repo", "main")],
            disabled_repos: vec![path.clone()],
        });
        let changed = inspect(WorkspaceHealthOptions {
            root_dirs: vec![root.to_string_lossy().to_string()],
            indexed_repos: vec![repo(repo_path, "repo", "legacy")],
            disabled_repos: vec![],
        });

        assert_eq!(healthy.repos[0].status, WorkspaceRepoStatus::Healthy);
        assert!(healthy.repos[0].disabled);
        assert_eq!(healthy.repos[0].current_branch, "main");
        assert_eq!(changed.repos[0].status, WorkspaceRepoStatus::BranchChanged);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn classifies_permission_denied_as_inaccessible() {
        let error = io::Error::from(io::ErrorKind::PermissionDenied);

        assert_eq!(
            root_status_from_error(&error),
            WorkspaceRootStatus::Inaccessible
        );
        assert_eq!(
            repo_status_from_error(&error),
            WorkspaceRepoStatus::Inaccessible
        );
    }

    fn repo(path: PathBuf, name: &str, branch: &str) -> RepoInfo {
        RepoInfo {
            path: path.to_string_lossy().to_string(),
            name: name.to_string(),
            branch: branch.to_string(),
        }
    }

    fn create_committed_repo(path: &Path) {
        fs::create_dir_all(path).unwrap();
        run_git(path, &["init", "-b", "main"]);
        run_git(path, &["config", "user.name", "GitPulse Test"]);
        run_git(path, &["config", "user.email", "gitpulse@example.test"]);
        fs::write(path.join("README.md"), "health test").unwrap();
        run_git(path, &["add", "README.md"]);
        run_git(path, &["commit", "-m", "initial"]);
    }

    fn run_git(path: &Path, args: &[&str]) {
        let status = Command::new("git")
            .current_dir(path)
            .args(args)
            .status()
            .unwrap();
        assert!(status.success(), "git {} failed", args.join(" "));
    }

    fn temp_root(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("gitpulse-{label}-{}-{stamp}", std::process::id()))
    }
}
