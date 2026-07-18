use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const STORE_VERSION: u32 = 1;
const DEFAULT_HISTORY_LIMIT: usize = 120;
const MAX_STORE_BYTES: u64 = 32 * 1024 * 1024;
const PRIMARY_FILE_NAME: &str = "report-history.json";
const BACKUP_FILE_NAME: &str = "report-history.json.bak";
const TEMP_FILE_NAME: &str = "report-history.json.tmp";
const BACKUP_TEMP_FILE_NAME: &str = "report-history.json.bak.tmp";
const CLEAR_ROLLBACK_FILE_NAME: &str = "report-history.json.clear-rollback";

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportHistoryRange {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportHistoryEntry {
    pub id: String,
    pub mode: String,
    pub title: String,
    pub range: ReportHistoryRange,
    pub period_label: String,
    pub generated_at: String,
    pub repo_count: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_count: Option<u64>,
    pub commit_count: u64,
    pub ai_enhanced: bool,
    pub output_file: String,
    pub report_text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supplemental_items: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub projects: Option<Vec<crate::project_retrospective::ReportHistoryProject>>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportHistoryLoadResult {
    pub entries: Vec<ReportHistoryEntry>,
    pub migration_complete: bool,
    pub recovered_from_backup: bool,
    pub warning: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct ReportHistoryEnvelope {
    version: u32,
    entries: Vec<ReportHistoryEntry>,
}

struct StorePaths {
    directory: PathBuf,
    primary: PathBuf,
    backup: PathBuf,
    temporary: PathBuf,
    backup_temporary: PathBuf,
    clear_rollback: PathBuf,
}

impl StorePaths {
    fn new(directory: &Path) -> Self {
        Self {
            directory: directory.to_path_buf(),
            primary: directory.join(PRIMARY_FILE_NAME),
            backup: directory.join(BACKUP_FILE_NAME),
            temporary: directory.join(TEMP_FILE_NAME),
            backup_temporary: directory.join(BACKUP_TEMP_FILE_NAME),
            clear_rollback: directory.join(CLEAR_ROLLBACK_FILE_NAME),
        }
    }
}

pub fn load(
    directory: &Path,
    legacy_entries: Option<Vec<ReportHistoryEntry>>,
    limit: usize,
) -> Result<ReportHistoryLoadResult, String> {
    let paths = StorePaths::new(directory);
    let mut warnings = Vec::new();
    recover_interrupted_clear(&paths, &mut warnings)?;
    match read_store(&paths.primary, limit) {
        Ok(Some(entries)) => {
            return Ok(load_result(
                entries,
                legacy_entries.is_some(),
                false,
                warnings,
            ))
        }
        Ok(None) => {}
        Err(error) => isolate_problem_file(&paths.primary, &paths.directory, error, &mut warnings),
    }

    if let Some(entries) = recover_backup(&paths, limit, &mut warnings)? {
        return Ok(load_result(
            entries,
            legacy_entries.is_some(),
            true,
            warnings,
        ));
    }

    let Some(legacy_entries) = legacy_entries else {
        return Ok(load_result(Vec::new(), false, false, warnings));
    };
    if paths.primary.exists() {
        return Err(join_warning(
            &warnings,
            "旧报告历史迁移失败：无法替换损坏的主文件",
        ));
    }
    let entries = save(directory, legacy_entries, limit)?;
    Ok(load_result(entries, true, false, warnings))
}

pub fn save(
    directory: &Path,
    entries: Vec<ReportHistoryEntry>,
    limit: usize,
) -> Result<Vec<ReportHistoryEntry>, String> {
    let entries = normalize_entries(entries, limit);
    let paths = StorePaths::new(directory);
    write_store(&paths, &entries)?;
    Ok(entries)
}

pub fn clear(directory: &Path) -> Result<(), String> {
    let paths = StorePaths::new(directory);
    fs::create_dir_all(&paths.directory)
        .map_err(|error| format!("创建报告历史目录失败：{error}"))?;
    prepare_clear(&paths)?;
    if let Err(error) = remove_if_exists(&paths.clear_rollback) {
        cleanup_clear_temps(&paths);
        return Err(error);
    }
    let had_primary = paths.primary.exists();
    if let Err(error) = begin_clear(&paths, had_primary) {
        rollback_clear(&paths, had_primary);
        return Err(error);
    }
    if let Err(error) = remove_if_exists(&paths.clear_rollback) {
        rollback_clear(&paths, had_primary);
        return Err(error);
    }
    Ok(())
}

fn prepare_clear(paths: &StorePaths) -> Result<(), String> {
    write_snapshot(&paths.temporary, &[])?;
    if let Err(error) = write_snapshot(&paths.backup_temporary, &[]) {
        let _ = remove_if_exists(&paths.temporary);
        return Err(error);
    }
    Ok(())
}

fn begin_clear(paths: &StorePaths, had_primary: bool) -> Result<(), String> {
    if had_primary {
        fs::rename(&paths.primary, &paths.clear_rollback)
            .map_err(|error| format!("准备清空报告历史失败：{error}"))?;
    }
    remove_if_exists(&paths.backup)?;
    fs::rename(&paths.backup_temporary, &paths.backup)
        .map_err(|error| format!("刷新报告历史备份失败：{error}"))?;
    fs::rename(&paths.temporary, &paths.primary)
        .map_err(|error| format!("清空报告历史主文件失败：{error}"))
}

fn rollback_clear(paths: &StorePaths, had_primary: bool) {
    cleanup_clear_temps(paths);
    if had_primary && paths.clear_rollback.exists() {
        let _ = remove_if_exists(&paths.primary);
        let _ = fs::rename(&paths.clear_rollback, &paths.primary);
    }
}

fn cleanup_clear_temps(paths: &StorePaths) {
    let _ = remove_if_exists(&paths.temporary);
    let _ = remove_if_exists(&paths.backup_temporary);
}

fn recover_interrupted_clear(paths: &StorePaths, warnings: &mut Vec<String>) -> Result<(), String> {
    if !paths.clear_rollback.exists() {
        return Ok(());
    }
    if paths.primary.exists() {
        remove_if_exists(&paths.clear_rollback)?;
        return Ok(());
    }
    fs::rename(&paths.clear_rollback, &paths.primary)
        .map_err(|error| format!("恢复未完成的报告历史清空操作失败：{error}"))?;
    warnings.push("检测到未完成的报告历史清空操作，已保留原记录".to_string());
    Ok(())
}

fn recover_backup(
    paths: &StorePaths,
    limit: usize,
    warnings: &mut Vec<String>,
) -> Result<Option<Vec<ReportHistoryEntry>>, String> {
    let entries = match read_store(&paths.backup, limit) {
        Ok(entries) => entries,
        Err(error) => {
            isolate_problem_file(&paths.backup, &paths.directory, error, warnings);
            None
        }
    };
    let Some(entries) = entries else {
        return Ok(None);
    };
    warnings.push("报告历史主文件不可用，已从备份恢复".to_string());
    if !paths.primary.exists() {
        write_store(paths, &entries)?;
    }
    Ok(Some(entries))
}

fn read_store(path: &Path, limit: usize) -> Result<Option<Vec<ReportHistoryEntry>>, String> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("读取报告历史文件信息失败：{error}")),
    };
    if metadata.len() > MAX_STORE_BYTES {
        return Err("报告历史文件超过 32 MiB，已拒绝加载".to_string());
    }
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) => return Err(format!("读取报告历史文件失败：{error}")),
    };
    let envelope: ReportHistoryEnvelope =
        serde_json::from_str(&text).map_err(|error| format!("解析报告历史文件失败：{error}"))?;
    if envelope.version != STORE_VERSION {
        return Err(format!("不支持的报告历史文件版本：{}", envelope.version));
    }
    Ok(Some(normalize_entries(envelope.entries, limit)))
}

fn write_store(paths: &StorePaths, entries: &[ReportHistoryEntry]) -> Result<(), String> {
    fs::create_dir_all(&paths.directory)
        .map_err(|error| format!("创建报告历史目录失败：{error}"))?;
    write_snapshot(&paths.temporary, entries)?;
    let had_primary = paths.primary.exists();
    if let Err(error) = rotate_primary(paths, had_primary) {
        let _ = remove_if_exists(&paths.temporary);
        return Err(error);
    }
    if let Err(error) = fs::rename(&paths.temporary, &paths.primary) {
        restore_primary(paths, had_primary);
        return Err(format!("替换报告历史文件失败：{error}"));
    }
    Ok(())
}

fn rotate_primary(paths: &StorePaths, had_primary: bool) -> Result<(), String> {
    if !had_primary {
        return Ok(());
    }
    remove_if_exists(&paths.backup)?;
    fs::rename(&paths.primary, &paths.backup)
        .map_err(|error| format!("备份报告历史文件失败：{error}"))
}

fn restore_primary(paths: &StorePaths, had_primary: bool) {
    let _ = remove_if_exists(&paths.temporary);
    if had_primary && paths.backup.exists() && !paths.primary.exists() {
        let _ = fs::rename(&paths.backup, &paths.primary);
    }
}

fn write_snapshot(path: &Path, entries: &[ReportHistoryEntry]) -> Result<(), String> {
    let envelope = ReportHistoryEnvelope {
        version: STORE_VERSION,
        entries: entries.to_vec(),
    };
    let bytes = serde_json::to_vec_pretty(&envelope)
        .map_err(|error| format!("序列化报告历史失败：{error}"))?;
    if bytes.len() as u64 > MAX_STORE_BYTES {
        return Err("报告历史文件不能超过 32 MiB，请缩短单份报告或减少历史条数".to_string());
    }
    let mut file = File::create(path).map_err(|error| format!("写入报告历史失败：{error}"))?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("写入报告历史失败：{error}"))
}

fn isolate_problem_file(path: &Path, directory: &Path, error: String, warnings: &mut Vec<String>) {
    if !path.exists() {
        warnings.push(error);
        return;
    }
    let corrupt_path = directory.join(format!("report-history.corrupt-{}.json", unix_millis()));
    match fs::rename(path, corrupt_path) {
        Ok(()) => warnings.push(format!("{error}，损坏文件已隔离")),
        Err(rename_error) => warnings.push(format!("{error}，隔离失败：{rename_error}")),
    }
}

fn normalize_entries(entries: Vec<ReportHistoryEntry>, limit: usize) -> Vec<ReportHistoryEntry> {
    let mut ids = HashSet::new();
    entries
        .into_iter()
        .filter(is_valid_entry)
        .filter(|entry| ids.insert(entry.id.clone()))
        .take(normalize_limit(limit))
        .collect()
}

fn is_valid_entry(entry: &ReportHistoryEntry) -> bool {
    !entry.id.trim().is_empty()
        && matches!(
            entry.mode.as_str(),
            "summary" | "weekly" | "custom" | "monthly"
        )
        && !entry.title.trim().is_empty()
        && !entry.generated_at.trim().is_empty()
        && entry.projects.as_ref().is_none_or(|projects| {
            projects.iter().all(|project| {
                !project.name.trim().is_empty()
                    && project.evidence_ids.len()
                        <= crate::project_retrospective::MAX_PROJECT_EVIDENCE_IDS
                    && project
                        .evidence_ids
                        .iter()
                        .all(|evidence_id| !evidence_id.trim().is_empty())
            })
        })
}

fn normalize_limit(limit: usize) -> usize {
    match limit {
        30 | 60 | 120 | 200 => limit,
        _ => DEFAULT_HISTORY_LIMIT,
    }
}

fn load_result(
    entries: Vec<ReportHistoryEntry>,
    migration_complete: bool,
    recovered_from_backup: bool,
    warnings: Vec<String>,
) -> ReportHistoryLoadResult {
    ReportHistoryLoadResult {
        entries,
        migration_complete,
        recovered_from_backup,
        warning: (!warnings.is_empty()).then(|| warnings.join("；")),
    }
}

fn join_warning(warnings: &[String], message: &str) -> String {
    if warnings.is_empty() {
        message.to_string()
    } else {
        format!("{}；{message}", warnings.join("；"))
    }
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("清理报告历史文件失败：{error}")),
    }
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn round_trip_trims_and_deduplicates_entries() {
        let root = temp_root("round-trip");
        let mut entries: Vec<_> = (0..31).map(sample_entry).collect();
        entries.insert(1, sample_entry(0));

        let saved = save(&root, entries, 30).unwrap();
        let loaded = load(&root, None, 30).unwrap();

        assert_eq!(30, saved.len());
        assert_eq!(saved, loaded.entries);
        assert_eq!("history-0", loaded.entries[0].id);
        assert_eq!("history-29", loaded.entries[29].id);
        cleanup(&root);
    }

    #[test]
    fn migration_is_idempotent_when_primary_store_exists() {
        let root = temp_root("migration");
        let first = sample_entry(1);
        let replacement = sample_entry(2);

        let migrated = load(&root, Some(vec![first.clone()]), 120).unwrap();
        let restarted = load(&root, Some(vec![replacement]), 120).unwrap();

        assert!(migrated.migration_complete);
        assert!(restarted.migration_complete);
        assert_eq!(vec![first], restarted.entries);
        cleanup(&root);
    }

    #[test]
    fn corrupt_primary_is_isolated_and_recovers_backup() {
        let root = temp_root("recovery");
        let original = sample_entry(3);
        save(&root, vec![original.clone()], 120).unwrap();
        save(&root, vec![sample_entry(4)], 120).unwrap();
        fs::write(root.join("report-history.json"), "not json").unwrap();

        let loaded = load(&root, None, 120).unwrap();

        assert!(loaded.recovered_from_backup);
        assert_eq!(vec![original], loaded.entries);
        assert!(loaded.warning.unwrap().contains("备份"));
        assert_eq!(1, corrupt_files(&root).len());
        cleanup(&root);
    }

    #[test]
    fn unsupported_store_without_backup_is_isolated_and_starts_empty() {
        let root = temp_root("unsupported-version");
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join(PRIMARY_FILE_NAME),
            r#"{"version":99,"entries":[]}"#,
        )
        .unwrap();

        let loaded = load(&root, None, 120).unwrap();

        assert!(loaded.entries.is_empty());
        assert!(loaded.warning.unwrap().contains("不支持"));
        assert_eq!(1, corrupt_files(&root).len());
        cleanup(&root);
    }

    #[test]
    fn clear_prevents_backup_from_restoring_old_entries() {
        let root = temp_root("clear");
        save(&root, vec![sample_entry(5)], 120).unwrap();
        clear(&root).unwrap();
        fs::write(root.join("report-history.json"), "not json").unwrap();

        let loaded = load(&root, None, 120).unwrap();

        assert!(loaded.recovered_from_backup);
        assert!(loaded.entries.is_empty());
        cleanup(&root);
    }

    #[test]
    fn clear_failure_restores_the_original_primary_store() {
        let root = temp_root("clear-rollback");
        let original = sample_entry(6);
        save(&root, vec![original.clone()], 120).unwrap();
        fs::create_dir_all(root.join(BACKUP_FILE_NAME)).unwrap();

        assert!(clear(&root).is_err());
        let loaded = load(&root, None, 120).unwrap();

        assert_eq!(vec![original], loaded.entries);
        cleanup(&root);
    }

    #[test]
    fn interrupted_clear_restores_the_rollback_store() {
        let root = temp_root("clear-interrupted");
        let original = sample_entry(7);
        save(&root, vec![original.clone()], 120).unwrap();
        fs::rename(
            root.join(PRIMARY_FILE_NAME),
            root.join(CLEAR_ROLLBACK_FILE_NAME),
        )
        .unwrap();

        let loaded = load(&root, None, 120).unwrap();

        assert_eq!(vec![original], loaded.entries);
        assert!(loaded.warning.unwrap().contains("未完成的报告历史清空"));
        cleanup(&root);
    }

    #[test]
    fn oversized_save_keeps_the_previous_primary_store() {
        let root = temp_root("oversized-save");
        let original = sample_entry(8);
        save(&root, vec![original.clone()], 120).unwrap();
        let mut oversized = sample_entry(9);
        oversized.report_text = "x".repeat(MAX_STORE_BYTES as usize);

        let error = save(&root, vec![oversized], 120).unwrap_err();
        let loaded = load(&root, None, 120).unwrap();

        assert!(error.contains("32 MiB"));
        assert_eq!(vec![original], loaded.entries);
        cleanup(&root);
    }

    #[test]
    fn oversized_primary_is_isolated_and_recovers_backup() {
        let root = temp_root("oversized-primary");
        let original = sample_entry(10);
        save(&root, vec![original.clone()], 120).unwrap();
        save(&root, vec![sample_entry(11)], 120).unwrap();
        fs::write(
            root.join(PRIMARY_FILE_NAME),
            vec![b'x'; MAX_STORE_BYTES as usize + 1],
        )
        .unwrap();

        let loaded = load(&root, None, 120).unwrap();

        assert!(loaded.recovered_from_backup);
        assert_eq!(vec![original], loaded.entries);
        assert!(loaded.warning.unwrap().contains("32 MiB"));
        assert_eq!(1, corrupt_files(&root).len());
        cleanup(&root);
    }

    #[test]
    fn temporary_write_failure_keeps_the_previous_primary_store() {
        let root = temp_root("temporary-write-failure");
        let original = sample_entry(12);
        save(&root, vec![original.clone()], 120).unwrap();
        fs::create_dir(root.join(TEMP_FILE_NAME)).unwrap();

        assert!(save(&root, vec![sample_entry(13)], 120).is_err());
        let loaded = load(&root, None, 120).unwrap();

        assert_eq!(vec![original], loaded.entries);
        cleanup(&root);
    }

    #[test]
    fn round_trip_preserves_optional_structured_projects() {
        let root = temp_root("structured-projects");
        let mut entry = sample_entry(14);
        entry.projects = Some(vec![crate::project_retrospective::ReportHistoryProject {
            name: "研发平台".to_string(),
            commit_count: 2,
            evidence_ids: vec!["abc123d".to_string(), "def456a".to_string()],
        }]);

        save(&root, vec![entry.clone()], 120).unwrap();
        let loaded = load(&root, None, 120).unwrap();

        assert_eq!(vec![entry], loaded.entries);
        cleanup(&root);
    }

    fn sample_entry(index: usize) -> ReportHistoryEntry {
        ReportHistoryEntry {
            id: format!("history-{index}"),
            mode: "summary".to_string(),
            title: format!("报告 {index}"),
            range: ReportHistoryRange {
                start_date: "2026-07-01".to_string(),
                end_date: "2026-07-01".to_string(),
            },
            period_label: "2026-07-01".to_string(),
            generated_at: "2026-07-01T08:00:00.000Z".to_string(),
            repo_count: 1,
            project_count: Some(1),
            commit_count: index as u64,
            ai_enhanced: false,
            output_file: String::new(),
            report_text: format!("report {index}"),
            supplemental_items: None,
            projects: None,
        }
    }

    fn corrupt_files(root: &Path) -> Vec<PathBuf> {
        fs::read_dir(root)
            .unwrap()
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.to_string_lossy().contains(".corrupt-"))
            .collect()
    }

    fn temp_root(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("gitpulse-report-history-{label}-{stamp}"))
    }

    fn cleanup(root: &Path) {
        let _ = fs::remove_dir_all(root);
    }
}
