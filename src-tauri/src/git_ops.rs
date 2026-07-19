mod command;
mod commits;
mod scan;

#[cfg(test)]
mod tests;

pub use command::{current_branch, git_identity, git_version, git_version_short};
pub(crate) use commits::split_authors;
pub use commits::{get_commit_dates, get_commit_timestamps, get_git_commits, GitCommitQuery};
pub use scan::{find_git_repos, find_git_repos_with_progress};

#[cfg(test)]
use command::format_git_launch_error;
#[cfg(test)]
use commits::{build_log_args, build_numstat_args, parse_git_log_output, parse_numstat_output};
#[cfg(test)]
use scan::{
    strip_windows_verbatim_prefix, ScanWarningCollector, MAX_SCAN_WARNINGS,
    MAX_SCAN_WARNING_DETAILS, SCAN_CANCELLED_MESSAGE,
};
