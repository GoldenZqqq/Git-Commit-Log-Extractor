#[path = "workspace_benchmark/fixture.rs"]
mod fixture;
#[path = "workspace_benchmark/metrics.rs"]
mod metrics;
#[path = "workspace_benchmark/profile.rs"]
mod profile;

use fixture::Fixture;
use gitpulse_lib::commit_pipeline;
use gitpulse_lib::git_ops;
use gitpulse_lib::models::{
    AiConfig, ExtractOptions, ProxyConfig, RepoInfo, ReportFormatTemplates, ReportRedactionOptions,
};
use metrics::{elapsed_ms, metric_stats, process_peak_rss_bytes, MetricStats};
use profile::{parse_args, BenchmarkConfig, ParseResult, ProfileSpec, Thresholds};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::{self, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

const SCHEMA_VERSION: u32 = 1;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BenchmarkReport {
    schema_version: u32,
    profile: ProfileReport,
    environment: EnvironmentReport,
    fixture: FixtureReport,
    measurements: Measurements,
    thresholds: Thresholds,
    failures: Vec<Failure>,
    passed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProfileReport {
    name: String,
    repository_count: usize,
    commit_count: usize,
    iterations: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EnvironmentReport {
    os: &'static str,
    arch: &'static str,
    cpu_count: usize,
    git_version: String,
    rust_version: Option<String>,
    gitpulse_version: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FixtureReport {
    path: String,
    bytes: u64,
    kept: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Measurements {
    generation_ms: u64,
    first_scan_ms: u64,
    first_scan_scanned_dirs: usize,
    warm_scan: MetricStats,
    extraction: ExtractionMeasurement,
    cancellation: CancellationMeasurement,
    process_peak_rss_bytes: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractionMeasurement {
    timing: MetricStats,
    commit_count: usize,
    warning_count: usize,
    concurrency: usize,
    summary_bytes: usize,
    detailed_bytes: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CancellationMeasurement {
    requested_at_scanned_dirs: usize,
    response_ms: u64,
    cancelled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Failure {
    code: String,
    message: String,
    actual: Option<u64>,
    limit: Option<u64>,
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let config = match parse_args(&args) {
        Ok(ParseResult::Config(config)) => config,
        Ok(ParseResult::Help) => {
            profile::print_help();
            return;
        }
        Err(error) => exit_with_error(&error),
    };
    if let Err(error) = run_and_write(config) {
        exit_with_error(&error);
    }
}

fn run_and_write(config: BenchmarkConfig) -> Result<(), String> {
    let (report, fixture) = run_benchmark(
        config.profile.spec(),
        config.iterations,
        config.fixture_dir.as_deref(),
        config.keep_fixture,
    )?;
    let json = serde_json::to_string_pretty(&report)
        .map_err(|error| format!("序列化 benchmark 结果失败：{error}"))?;
    if let Some(output) = &config.output {
        if !config.keep_fixture && output.starts_with(fixture.path()) {
            return Err("benchmark 输出文件不能位于即将清理的 fixture 目录内".to_string());
        }
        write_output(output, &json)?;
    }
    println!("{json}");
    let should_fail = !report.passed && !config.allow_regressions;
    drop(fixture);
    if should_fail {
        process::exit(1);
    }
    Ok(())
}

fn run_benchmark(
    spec: ProfileSpec,
    iterations: usize,
    requested_fixture: Option<&Path>,
    keep_fixture: bool,
) -> Result<(BenchmarkReport, Fixture), String> {
    let generation_started = Instant::now();
    let mut fixture = Fixture::create(spec, requested_fixture)?;
    let generation_ms = elapsed_ms(generation_started);
    if keep_fixture {
        fixture.keep();
    }
    let mut failures = Vec::new();
    let (repos, first_scan_ms, scanned_dirs) = measure_first_scan(fixture.path())?;
    check_count(
        "repositoryCount",
        repos.len(),
        spec.repository_count,
        &mut failures,
    );
    let warm_scan = measure_warm_scan(fixture.path(), iterations, spec, &mut failures)?;
    let extraction = measure_extraction(fixture.path(), &repos, iterations, spec, &mut failures)?;
    let cancellation = measure_cancellation(fixture.path(), spec.repository_count)?;
    if !cancellation.cancelled {
        failures.push(correctness_failure(
            "scanCancellation",
            "扫描未返回取消错误",
        ));
    }
    let fixture_bytes = fixture.size_bytes();
    let peak_rss = process_peak_rss_bytes();
    let measurements = Measurements {
        generation_ms,
        first_scan_ms,
        first_scan_scanned_dirs: scanned_dirs,
        warm_scan,
        extraction,
        cancellation,
        process_peak_rss_bytes: peak_rss,
    };
    append_threshold_failures(&measurements, spec.thresholds, &mut failures);
    let report = build_report(
        spec,
        iterations,
        &fixture,
        fixture_bytes,
        measurements,
        failures,
    );
    Ok((report, fixture))
}

fn measure_first_scan(root: &Path) -> Result<(Vec<RepoInfo>, u64, usize), String> {
    let cancel_requested = AtomicBool::new(false);
    let mut scanned_dirs = 0;
    let started_at = Instant::now();
    let result = git_ops::find_git_repos_with_progress(
        &[root.to_string_lossy().to_string()],
        &cancel_requested,
        |progress| scanned_dirs = progress.scanned_dirs,
    )?;
    Ok((result.repos, elapsed_ms(started_at), scanned_dirs))
}

fn measure_warm_scan(
    root: &Path,
    iterations: usize,
    spec: ProfileSpec,
    failures: &mut Vec<Failure>,
) -> Result<MetricStats, String> {
    let roots = [root.to_string_lossy().to_string()];
    let mut samples = Vec::with_capacity(iterations);
    for iteration in 0..iterations {
        let started_at = Instant::now();
        let repos = git_ops::find_git_repos(&roots)?;
        samples.push(elapsed_ms(started_at));
        check_count(
            &format!("warmScanRepositoryCount[{iteration}]"),
            repos.len(),
            spec.repository_count,
            failures,
        );
    }
    Ok(metric_stats(samples))
}

fn measure_extraction(
    root: &Path,
    repos: &[RepoInfo],
    iterations: usize,
    spec: ProfileSpec,
    failures: &mut Vec<Failure>,
) -> Result<ExtractionMeasurement, String> {
    let mut samples = Vec::with_capacity(iterations);
    let mut summary_bytes = 0;
    let mut detailed_bytes = 0;
    let mut warning_count = 0;
    let mut commit_count = 0;
    let mut concurrency = 0;
    for iteration in 0..iterations {
        let started_at = Instant::now();
        let result = commit_pipeline::extract_commits_sync(
            extraction_options(root, repos.to_vec()),
            |progress| concurrency = concurrency.max(progress.concurrency),
        )?;
        samples.push(elapsed_ms(started_at));
        commit_count = result.commits.len();
        warning_count = result.warnings.len();
        summary_bytes = result.summary_text.len();
        detailed_bytes = result.detailed_text.len();
        check_count(
            &format!("extractionCommitCount[{iteration}]"),
            commit_count,
            spec.commit_count,
            failures,
        );
    }
    Ok(ExtractionMeasurement {
        timing: metric_stats(samples),
        commit_count,
        warning_count,
        concurrency,
        summary_bytes,
        detailed_bytes,
    })
}

fn measure_cancellation(
    root: &Path,
    repository_count: usize,
) -> Result<CancellationMeasurement, String> {
    let cancel_requested = AtomicBool::new(false);
    let requested_at_dirs = (repository_count / 4).max(2);
    let mut requested_at = None;
    let result = git_ops::find_git_repos_with_progress(
        &[root.to_string_lossy().to_string()],
        &cancel_requested,
        |progress| {
            if requested_at.is_none() && progress.scanned_dirs >= requested_at_dirs {
                requested_at = Some(Instant::now());
                cancel_requested.store(true, Ordering::Relaxed);
            }
        },
    );
    let response_ms = requested_at.map(elapsed_ms).unwrap_or_default();
    let cancelled = result.is_err_and(|message| message.contains("取消"));
    Ok(CancellationMeasurement {
        requested_at_scanned_dirs: requested_at_dirs,
        response_ms,
        cancelled,
    })
}

fn extraction_options(root: &Path, repos: Vec<RepoInfo>) -> ExtractOptions {
    ExtractOptions {
        root_dirs: vec![root.to_string_lossy().to_string()],
        indexed_repos: repos,
        author: String::new(),
        author_display_name: "Benchmark User".to_string(),
        author_aliases: Vec::new(),
        supplemental_items: Vec::new(),
        start_date: "2024-01-01".to_string(),
        end_date: "2025-12-31".to_string(),
        period_label: "synthetic-benchmark".to_string(),
        report_kind: "custom".to_string(),
        disabled_repos: Vec::new(),
        extract_all_branches: false,
        exclude_merge_commits: true,
        exclude_revert_commits: true,
        exclude_bot_commits: true,
        detailed_output: false,
        show_project_and_branch: true,
        commit_item_prefix_mode: "repo-branch".to_string(),
        show_evidence_details: false,
        evidence_link_rules: Vec::new(),
        redaction: ReportRedactionOptions::default(),
        project_names: HashMap::new(),
        report_format_templates: ReportFormatTemplates::default(),
        refinement_instruction: String::new(),
        system_prompt: String::new(),
        ai: disabled_ai(),
    }
}

fn disabled_ai() -> AiConfig {
    AiConfig {
        enabled: false,
        provider: "openai-compatible".to_string(),
        base_url: String::new(),
        model: String::new(),
        api_key: String::new(),
        temperature: 0.2,
        timeout_seconds: 60,
        proxy: ProxyConfig::default(),
    }
}

fn build_report(
    spec: ProfileSpec,
    iterations: usize,
    fixture: &Fixture,
    fixture_bytes: u64,
    measurements: Measurements,
    failures: Vec<Failure>,
) -> BenchmarkReport {
    BenchmarkReport {
        schema_version: SCHEMA_VERSION,
        profile: ProfileReport {
            name: spec.name.to_string(),
            repository_count: spec.repository_count,
            commit_count: spec.commit_count,
            iterations,
        },
        environment: environment_report(),
        fixture: FixtureReport {
            path: fixture.path().to_string_lossy().to_string(),
            bytes: fixture_bytes,
            kept: fixture.is_kept(),
        },
        measurements,
        thresholds: spec.thresholds,
        passed: failures.is_empty(),
        failures,
    }
}

fn environment_report() -> EnvironmentReport {
    EnvironmentReport {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        cpu_count: std::thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(1),
        git_version: git_ops::git_version().unwrap_or_else(|error| error),
        rust_version: command_version("rustc"),
        gitpulse_version: env!("CARGO_PKG_VERSION"),
    }
}

fn append_threshold_failures(
    measurements: &Measurements,
    thresholds: Thresholds,
    failures: &mut Vec<Failure>,
) {
    check_limit(
        "firstScanMs",
        measurements.first_scan_ms,
        thresholds.first_scan_ms,
        failures,
    );
    check_limit(
        "warmScanP95Ms",
        measurements.warm_scan.p95_ms,
        thresholds.warm_scan_p95_ms,
        failures,
    );
    check_limit(
        "extractionP95Ms",
        measurements.extraction.timing.p95_ms,
        thresholds.extraction_p95_ms,
        failures,
    );
    check_limit(
        "cancellationMs",
        measurements.cancellation.response_ms,
        thresholds.cancellation_ms,
        failures,
    );
    if let (Some(actual), Some(limit)) = (
        measurements.process_peak_rss_bytes,
        thresholds.peak_rss_bytes,
    ) {
        check_limit("peakRssBytes", actual, limit, failures);
    }
}

fn check_count(code: &str, actual: usize, expected: usize, failures: &mut Vec<Failure>) {
    if actual == expected {
        return;
    }
    failures.push(Failure {
        code: code.to_string(),
        message: format!("correctness mismatch: expected {expected}, got {actual}"),
        actual: Some(actual as u64),
        limit: Some(expected as u64),
    });
}

fn check_limit(code: &str, actual: u64, limit: u64, failures: &mut Vec<Failure>) {
    if actual <= limit {
        return;
    }
    failures.push(Failure {
        code: code.to_string(),
        message: format!("performance threshold exceeded: {actual} > {limit}"),
        actual: Some(actual),
        limit: Some(limit),
    });
}

fn correctness_failure(code: &str, message: &str) -> Failure {
    Failure {
        code: code.to_string(),
        message: message.to_string(),
        actual: None,
        limit: None,
    }
}

fn write_output(path: &Path, json: &str) -> Result<(), String> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)
            .map_err(|error| format!("创建 benchmark 输出目录失败：{error}"))?;
    }
    fs::write(path, format!("{json}\n"))
        .map_err(|error| format!("写入 benchmark 结果失败：{error}"))
}

fn command_version(command: &str) -> Option<String> {
    let output = Command::new(command).arg("--version").output().ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn exit_with_error(message: &str) -> ! {
    eprintln!("benchmark error: {message}");
    process::exit(2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn threshold_failures_include_timing_and_memory_regressions() {
        let mut failures = Vec::new();
        let measurements = test_measurements(101, 201, 301, 401, Some(501));
        append_threshold_failures(
            &measurements,
            Thresholds {
                first_scan_ms: 100,
                warm_scan_p95_ms: 200,
                extraction_p95_ms: 300,
                cancellation_ms: 400,
                peak_rss_bytes: Some(500),
            },
            &mut failures,
        );

        assert_eq!(5, failures.len());
        assert_eq!("firstScanMs", failures[0].code);
        assert_eq!(Some(101), failures[0].actual);
    }

    #[test]
    fn tiny_benchmark_runs_scan_extraction_and_cancellation_end_to_end() {
        let spec = ProfileSpec {
            name: "test",
            repository_count: 2,
            commit_count: 6,
            default_iterations: 2,
            thresholds: Thresholds {
                first_scan_ms: u64::MAX,
                warm_scan_p95_ms: u64::MAX,
                extraction_p95_ms: u64::MAX,
                cancellation_ms: u64::MAX,
                peak_rss_bytes: None,
            },
        };
        let (report, fixture) = run_benchmark(spec, 2, None, false).unwrap();
        let fixture_path = fixture.path().to_path_buf();

        assert!(report.passed, "{:?}", failure_messages(&report.failures));
        assert_eq!(2, report.profile.repository_count);
        assert_eq!(6, report.measurements.extraction.commit_count);
        assert!(report.measurements.cancellation.cancelled);
        drop(fixture);
        assert!(!fixture_path.exists());
    }

    fn test_measurements(
        first: u64,
        warm: u64,
        extraction: u64,
        cancellation: u64,
        rss: Option<u64>,
    ) -> Measurements {
        Measurements {
            generation_ms: 1,
            first_scan_ms: first,
            first_scan_scanned_dirs: 1,
            warm_scan: metric_stats(vec![warm]),
            extraction: ExtractionMeasurement {
                timing: metric_stats(vec![extraction]),
                commit_count: 1,
                warning_count: 0,
                concurrency: 1,
                summary_bytes: 1,
                detailed_bytes: 0,
            },
            cancellation: CancellationMeasurement {
                requested_at_scanned_dirs: 1,
                response_ms: cancellation,
                cancelled: true,
            },
            process_peak_rss_bytes: rss,
        }
    }

    fn failure_messages(failures: &[Failure]) -> Vec<&str> {
        failures
            .iter()
            .map(|failure| failure.message.as_str())
            .collect()
    }
}
