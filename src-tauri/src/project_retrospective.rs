use crate::models::CommitRecord;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

pub(crate) const MAX_PROJECT_EVIDENCE_IDS: usize = 20;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportHistoryProject {
    pub name: String,
    pub commit_count: u64,
    pub evidence_ids: Vec<String>,
}

pub(crate) fn summarize_projects<F>(
    commits: &[CommitRecord],
    project_name: F,
) -> Vec<ReportHistoryProject>
where
    F: Fn(&CommitRecord) -> String,
{
    let mut groups: BTreeMap<String, (u64, Vec<String>, HashSet<String>)> = BTreeMap::new();
    for commit in commits {
        let name = project_name(commit).trim().to_string();
        if name.is_empty() {
            continue;
        }
        let group = groups.entry(name).or_default();
        group.0 += 1;
        let evidence_id = short_evidence_id(&commit.hash);
        if group.1.len() < MAX_PROJECT_EVIDENCE_IDS && group.2.insert(evidence_id.clone()) {
            group.1.push(evidence_id);
        }
    }

    groups
        .into_iter()
        .map(
            |(name, (commit_count, evidence_ids, _))| ReportHistoryProject {
                name,
                commit_count,
                evidence_ids,
            },
        )
        .collect()
}

pub(crate) fn short_evidence_id(hash: &str) -> String {
    if hash.starts_with("commit-") {
        return hash.to_string();
    }
    hash.chars().take(7).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_evidence_id_preserves_redacted_aliases_and_trims_hashes() {
        assert_eq!("abc123d", short_evidence_id("abc123def456"));
        assert_eq!("commit-12", short_evidence_id("commit-12"));
    }

    #[test]
    fn summarize_projects_groups_counts_and_keeps_stable_evidence() {
        let commits = vec![
            commit("repo-a", "hash-a-123", "main"),
            commit("repo-a", "hash-a-123", "main"),
            commit("repo-b", "hash-b-456", "main"),
        ];

        let projects = summarize_projects(&commits, |commit| {
            format!("mapped-{}", commit.project_name.trim_start_matches("repo-"))
        });

        assert_eq!(2, projects.len());
        assert_eq!("mapped-a", projects[0].name);
        assert_eq!(2, projects[0].commit_count);
        assert_eq!(vec!["hash-a-"], projects[0].evidence_ids);
        assert_eq!("mapped-b", projects[1].name);
        assert_eq!(1, projects[1].commit_count);
        assert_eq!(vec!["hash-b-"], projects[1].evidence_ids);
    }

    #[test]
    fn summarize_projects_bounds_evidence_without_losing_commit_count() {
        let commits = (0..25)
            .map(|index| commit("repo", &format!("{index:07}-long-hash"), "main"))
            .collect::<Vec<_>>();

        let projects = summarize_projects(&commits, |_| "Project".to_string());

        assert_eq!(1, projects.len());
        assert_eq!(25, projects[0].commit_count);
        assert_eq!(MAX_PROJECT_EVIDENCE_IDS, projects[0].evidence_ids.len());
        assert_eq!("0000000", projects[0].evidence_ids[0]);
        assert_eq!("0000019", projects[0].evidence_ids[19]);
    }

    fn commit(project_name: &str, hash: &str, branch_name: &str) -> CommitRecord {
        CommitRecord {
            repo_path: project_name.to_string(),
            project_name: project_name.to_string(),
            branch_name: branch_name.to_string(),
            hash: hash.to_string(),
            author: "tester".to_string(),
            author_email: "tester@example.com".to_string(),
            date: "2026-07-16 10:00:00 +0800".to_string(),
            message: "feat: test".to_string(),
            additions: 0,
            deletions: 0,
            changed_files: 0,
        }
    }
}
