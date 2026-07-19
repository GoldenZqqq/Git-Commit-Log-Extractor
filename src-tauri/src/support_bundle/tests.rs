use super::*;
use crate::models::{
    DiagnosticItem, DiagnosticResult, DiagnosticSeverity, RepoInfo, SupportBundleEventInput,
    SupportBundlePrivacyContext, WorkspaceHealthOptions,
};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const WINDOWS_ROOT: &str = r"C:\Users\Alice\Secret Workspace";
const UNIX_ROOT: &str = "/home/alice/secret workspace";
const REPO_NAME: &str = "private-payroll-api";
const BRANCH_NAME: &str = "feature/customer-acme";
const DISABLED_REPO: &str = "archived-private-ops";
const AUTHOR: &str = "Alice Zhang";
const EMAIL: &str = "alice@example.test";
const API_KEY: &str = "sk-super-secret-key-123456";
const BEARER: &str = "eyJheader123456.payload123456.signature123456";
const PROXY_PASSWORD: &str = "proxy-secret-987";
const OAUTH_TOKEN: &str = "gho_privateoauth123456789";
const UNKNOWN_WINDOWS_PATH: &str = r"D:\Customers\Acme\private.txt";
const UNKNOWN_UNIX_PATH: &str = "/srv/customers/acme/private.txt";

#[test]
fn preview_redacts_sensitive_values_from_every_surface() {
    let preview = preview(sensitive_options()).unwrap();
    let all_output = format!(
        "{}\n{}\n{}",
        preview.issue_title,
        preview.issue_body,
        preview
            .entries
            .iter()
            .map(|entry| entry.content.as_str())
            .collect::<Vec<_>>()
            .join("\n")
    );

    for secret in [
        WINDOWS_ROOT,
        UNIX_ROOT,
        REPO_NAME,
        BRANCH_NAME,
        DISABLED_REPO,
        AUTHOR,
        EMAIL,
        API_KEY,
        BEARER,
        PROXY_PASSWORD,
        OAUTH_TOKEN,
        UNKNOWN_WINDOWS_PATH,
        UNKNOWN_UNIX_PATH,
        "proxy-user",
    ] {
        assert!(!all_output.contains(secret), "leaked secret: {secret}");
    }
    assert!(all_output.contains("<redacted>"));
    assert!(!preview.issue_body.contains("recent failure"));
}

#[test]
fn preview_has_versioned_fixed_entries_and_recomputed_counts() {
    let mut options = base_options();
    options.diagnostics = Some(DiagnosticResult {
        items: vec![
            diagnostic("git", DiagnosticSeverity::Ok, "Git 可用"),
            diagnostic("output", DiagnosticSeverity::Warning, "输出待配置"),
            diagnostic("workspace", DiagnosticSeverity::Error, "工作区失败"),
        ],
        ok_count: 99,
        warning_count: 99,
        error_count: 99,
    });
    let preview = preview(options).unwrap();

    assert_eq!(1, preview.schema_version);
    assert_eq!(
        vec!["summary.md", "diagnostics.json", "recent-events.log"],
        preview
            .entries
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>()
    );
    let json = entry_content(&preview, "diagnostics.json");
    assert!(json.contains(r#""okCount": 1"#));
    assert!(json.contains(r#""warningCount": 1"#));
    assert!(json.contains(r#""errorCount": 1"#));
    assert!(preview.suggested_file_name.ends_with(".zip"));
    assert!(!preview.excluded_data.is_empty());
}

#[test]
fn preview_bounds_recent_events_and_each_message() {
    let mut options = base_options();
    options.recent_events = (0..60)
        .map(|index| SupportBundleEventInput {
            occurred_at: format!("2026-07-18T12:{index:02}:00Z"),
            level: "info".to_string(),
            message: format!("event-{index}-{}", "x".repeat(2_000)),
        })
        .collect();

    let preview = preview(options).unwrap();
    let events = entry_content(&preview, "recent-events.log");

    assert!(!events.contains("event-0-"));
    assert!(events.contains("event-59-"));
    assert_eq!(50, events.lines().count());
    assert!(events.lines().all(|line| line.chars().count() <= 620));
}

#[test]
fn preview_prevents_event_line_injection_and_normalizes_unknown_levels() {
    let mut options = base_options();
    options.recent_events = vec![SupportBundleEventInput {
        occurred_at: "2026-07-18T12:00:00Z\n[fake]".to_string(),
        level: "critical".to_string(),
        message: "first line\n[2026] [ERROR] injected".to_string(),
    }];

    let preview = preview(options).unwrap();
    let events = entry_content(&preview, "recent-events.log");

    assert_eq!(1, events.lines().count());
    assert!(events.contains("[INFO] first line [2026] [ERROR] injected"));
}

#[test]
fn preview_survives_missing_diagnostics_without_network() {
    let mut options = base_options();
    options.diagnostics = None;
    options.diagnostic_error = "network unavailable".to_string();

    let preview = preview(options).unwrap();

    assert!(entry_content(&preview, "summary.md").contains("network unavailable"));
    assert_eq!(3, preview.entries.len());
}

#[test]
fn export_writes_a_bounded_zip_with_only_fixed_entries() {
    let root = temp_root("write");
    fs::create_dir_all(&root).unwrap();
    let output = root.join("gitpulse-support.zip");

    let result = export(&output, sensitive_options()).unwrap();
    let bytes = fs::read(&output).unwrap();

    assert_eq!(bytes.len(), result.bytes);
    assert!(bytes.starts_with(b"PK\x03\x04"));
    assert!(bytes.len() < 512 * 1024);
    let archive = String::from_utf8_lossy(&bytes);
    for name in ["summary.md", "diagnostics.json", "recent-events.log"] {
        assert!(archive.contains(name));
    }
    assert!(!archive.contains(API_KEY));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn export_rejects_non_zip_paths_and_missing_parents() {
    let root = temp_root("validation");
    fs::create_dir_all(&root).unwrap();

    let extension_error = export(&root.join("support.txt"), base_options()).unwrap_err();
    let parent_error =
        export(&root.join("missing").join("support.zip"), base_options()).unwrap_err();

    assert!(extension_error.contains(".zip"));
    assert!(parent_error.contains("目录"));
    let _ = fs::remove_dir_all(root);
}

fn sensitive_options() -> SupportBundleOptions {
    let mut options = base_options();
    let message = format!(
        "author={AUTHOR}; repo={REPO_NAME}; branch={BRANCH_NAME}; disabled={DISABLED_REPO}; path={WINDOWS_ROOT}; unix={UNIX_ROOT}; email={EMAIL}; api_key={API_KEY}; Bearer {BEARER}; password={PROXY_PASSWORD}; oauth={OAUTH_TOKEN}; other={UNKNOWN_WINDOWS_PATH}; unix_other={UNKNOWN_UNIX_PATH}"
    );
    options.diagnostics = Some(DiagnosticResult {
        items: vec![diagnostic("sensitive", DiagnosticSeverity::Error, &message)],
        ok_count: 0,
        warning_count: 0,
        error_count: 1,
    });
    options.recent_events = vec![SupportBundleEventInput {
        occurred_at: "2026-07-18T12:00:00Z".to_string(),
        level: "error".to_string(),
        message: format!("recent failure at {UNIX_ROOT}: token={BEARER}"),
    }];
    options.privacy = SupportBundlePrivacyContext {
        author: AUTHOR.to_string(),
        output_dir: UNIX_ROOT.to_string(),
        ai_base_url: "https://private-ai.example.test/v1".to_string(),
        proxy_url: "http://proxy.internal.test:7890".to_string(),
        proxy_username: "proxy-user".to_string(),
    };
    options
}

fn base_options() -> SupportBundleOptions {
    SupportBundleOptions {
        diagnostics: Some(DiagnosticResult {
            items: vec![],
            ok_count: 0,
            warning_count: 0,
            error_count: 0,
        }),
        diagnostic_error: String::new(),
        workspace: WorkspaceHealthOptions {
            root_dirs: vec![WINDOWS_ROOT.to_string(), UNIX_ROOT.to_string()],
            indexed_repos: vec![RepoInfo {
                path: format!(r"{WINDOWS_ROOT}\{REPO_NAME}"),
                name: REPO_NAME.to_string(),
                branch: BRANCH_NAME.to_string(),
            }],
            disabled_repos: vec![DISABLED_REPO.to_string()],
        },
        recent_events: vec![],
        privacy: SupportBundlePrivacyContext::default(),
    }
}

fn diagnostic(id: &str, severity: DiagnosticSeverity, message: &str) -> DiagnosticItem {
    DiagnosticItem {
        id: id.to_string(),
        label: id.to_string(),
        severity,
        message: message.to_string(),
        action: String::new(),
    }
}

fn entry_content<'a>(preview: &'a SupportBundlePreview, name: &str) -> &'a str {
    preview
        .entries
        .iter()
        .find(|entry| entry.name == name)
        .map(|entry| entry.content.as_str())
        .expect("preview entry should exist")
}

fn temp_root(label: &str) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "gitpulse-support-{label}-{}-{stamp}",
        std::process::id()
    ))
}
