use chrono::{Datelike, Duration, Local, NaiveDate};
use gitpulse_lib::commit_pipeline;
use gitpulse_lib::git_ops;
use gitpulse_lib::models::*;
use std::collections::{HashMap, HashSet};
use std::process;

struct CliArgs {
    report_type: String,
    authors: Vec<String>,
    dirs: Vec<String>,
    from: Option<String>,
    to: Option<String>,
    month: Option<String>,
    output: Option<String>,
    format: String,
    all_branches: bool,
    no_merge: bool,
    no_revert: bool,
    help: bool,
}

fn main() {
    let raw_args: Vec<String> = std::env::args().collect();

    if raw_args.len() < 2 || raw_args[1] == "-h" || raw_args[1] == "--help" {
        print_help();
        if raw_args.len() < 2 {
            process::exit(2);
        }
        return;
    }

    if raw_args[1] != "report" {
        eprintln!("未知命令：{}。使用 --help 查看用法。", raw_args[1]);
        process::exit(2);
    }

    let cli = match parse_args(&raw_args[2..]) {
        Ok(cli) => cli,
        Err(msg) => {
            eprintln!("参数错误：{}", msg);
            process::exit(2);
        }
    };

    if cli.help {
        print_help();
        return;
    }

    match run(&cli) {
        Ok(output) => {
            if let Some(ref path) = cli.output {
                if let Err(err) = std::fs::write(path, &output) {
                    eprintln!("写入文件失败：{}", err);
                    process::exit(1);
                }
                eprintln!("报告已写入：{}", path);
            } else {
                print!("{}", output);
            }
        }
        Err(msg) => {
            eprintln!("错误：{}", msg);
            process::exit(1);
        }
    }
}

fn parse_args(args: &[String]) -> Result<CliArgs, String> {
    let mut cli = CliArgs {
        report_type: "weekly".to_string(),
        authors: Vec::new(),
        dirs: Vec::new(),
        from: None,
        to: None,
        month: None,
        output: None,
        format: "markdown".to_string(),
        all_branches: false,
        no_merge: true,
        no_revert: true,
        help: false,
    };

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "-h" | "--help" => {
                cli.help = true;
                return Ok(cli);
            }
            "-t" | "--type" => {
                i += 1;
                cli.report_type = next_value(args, i, "--type")?;
            }
            "-a" | "--author" => {
                i += 1;
                cli.authors.push(next_value(args, i, "--author")?);
            }
            "-d" | "--dir" => {
                i += 1;
                cli.dirs.push(next_value(args, i, "--dir")?);
            }
            "--from" => {
                i += 1;
                cli.from = Some(next_value(args, i, "--from")?);
            }
            "--to" => {
                i += 1;
                cli.to = Some(next_value(args, i, "--to")?);
            }
            "--month" => {
                i += 1;
                cli.month = Some(next_value(args, i, "--month")?);
            }
            "-o" | "--output" => {
                i += 1;
                cli.output = Some(next_value(args, i, "--output")?);
            }
            "-f" | "--format" => {
                i += 1;
                cli.format = next_value(args, i, "--format")?;
            }
            "--all-branches" => cli.all_branches = true,
            "--no-merge" => cli.no_merge = true,
            "--no-revert" => cli.no_revert = true,
            other => return Err(format!("未知选项：{}", other)),
        }
        i += 1;
    }

    if !["daily", "weekly", "monthly", "custom"].contains(&cli.report_type.as_str()) {
        return Err(format!(
            "不支持的报告类型：{}。可选：daily, weekly, monthly, custom",
            cli.report_type
        ));
    }
    if !["markdown", "json"].contains(&cli.format.as_str()) {
        return Err(format!(
            "不支持的输出格式：{}。可选：markdown, json",
            cli.format
        ));
    }
    if cli.report_type == "custom" && (cli.from.is_none() || cli.to.is_none()) {
        return Err("custom 类型必须指定 --from 和 --to".to_string());
    }

    Ok(cli)
}

fn next_value(args: &[String], i: usize, flag: &str) -> Result<String, String> {
    args.get(i)
        .cloned()
        .ok_or_else(|| format!("{} 需要一个参数值", flag))
}

fn run(cli: &CliArgs) -> Result<String, String> {
    let (start_date, end_date, period_label) = compute_dates(cli)?;
    let dirs = resolve_dirs(cli);
    let author = resolve_author(cli);

    eprintln!("报告类型：{}", cli.report_type);
    eprintln!("统计周期：{} 至 {}", start_date, end_date);
    eprintln!("作者：{}", if author.is_empty() { "全部" } else { &author });
    eprintln!("工作区：{}", dirs.join(", "));

    if cli.format == "json" {
        generate_json_report(cli, &start_date, &end_date, &period_label, &dirs, &author)
    } else {
        generate_markdown_report(cli, &start_date, &end_date, &period_label, &dirs, &author)
    }
}

fn compute_dates(cli: &CliArgs) -> Result<(String, String, String), String> {
    match cli.report_type.as_str() {
        "daily" => {
            if let (Some(from), Some(to)) = (&cli.from, &cli.to) {
                Ok((from.clone(), to.clone(), from.clone()))
            } else {
                let today = Local::now().date_naive();
                let date = today.format("%Y-%m-%d").to_string();
                Ok((date.clone(), date.clone(), date))
            }
        }
        "weekly" => {
            if let (Some(from), Some(to)) = (&cli.from, &cli.to) {
                let label = week_label_from_date(from)?;
                Ok((from.clone(), to.clone(), label))
            } else {
                let today = Local::now().date_naive();
                let weekday = today.weekday().num_days_from_monday();
                let monday = today - Duration::days(weekday as i64);
                let iso_week = today.iso_week();
                let label = format!("{}-W{:02}", iso_week.year(), iso_week.week());
                Ok((
                    monday.format("%Y-%m-%d").to_string(),
                    today.format("%Y-%m-%d").to_string(),
                    label,
                ))
            }
        }
        "monthly" => {
            if let Some(month) = &cli.month {
                parse_month_range(month)
            } else if let (Some(from), Some(to)) = (&cli.from, &cli.to) {
                let label = if from.len() >= 7 {
                    from[..7].to_string()
                } else {
                    from.clone()
                };
                Ok((from.clone(), to.clone(), label))
            } else {
                Ok(gitpulse_lib::report::previous_month_range())
            }
        }
        "custom" => {
            let from = cli.from.as_ref().unwrap();
            let to = cli.to.as_ref().unwrap();
            let label = format!("{} ~ {}", from, to);
            Ok((from.clone(), to.clone(), label))
        }
        _ => unreachable!(),
    }
}

fn week_label_from_date(date_str: &str) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .map_err(|_| format!("日期格式错误：{}", date_str))?;
    let iso_week = date.iso_week();
    Ok(format!("{}-W{:02}", iso_week.year(), iso_week.week()))
}

fn parse_month_range(month: &str) -> Result<(String, String, String), String> {
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return Err(format!("--month 格式应为 YYYY-MM：{}", month));
    }
    let year: i32 = parts[0]
        .parse()
        .map_err(|_| format!("年份无效：{}", parts[0]))?;
    let mon: u32 = parts[1]
        .parse()
        .map_err(|_| format!("月份无效：{}", parts[1]))?;
    let first =
        NaiveDate::from_ymd_opt(year, mon, 1).ok_or_else(|| format!("日期无效：{}", month))?;
    let last = if mon == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap() - Duration::days(1)
    } else {
        NaiveDate::from_ymd_opt(year, mon + 1, 1).unwrap() - Duration::days(1)
    };
    Ok((
        first.format("%Y-%m-%d").to_string(),
        last.format("%Y-%m-%d").to_string(),
        format!("{}-{:02}", year, mon),
    ))
}

fn resolve_dirs(cli: &CliArgs) -> Vec<String> {
    if cli.dirs.is_empty() {
        vec![std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())]
    } else {
        cli.dirs.clone()
    }
}

fn resolve_author(cli: &CliArgs) -> String {
    if !cli.authors.is_empty() {
        cli.authors.join(",")
    } else {
        let identity = git_ops::git_identity();
        identity.user_name
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

fn build_extract_options(
    start_date: &str,
    end_date: &str,
    period_label: &str,
    report_kind: &str,
    dirs: &[String],
    author: &str,
    all_branches: bool,
    no_merge: bool,
    no_revert: bool,
) -> ExtractOptions {
    ExtractOptions {
        root_dirs: dirs.to_vec(),
        indexed_repos: Vec::new(),
        author: author.to_string(),
        author_display_name: String::new(),
        author_aliases: Vec::new(),
        supplemental_items: Vec::new(),
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        period_label: period_label.to_string(),
        report_kind: report_kind.to_string(),
        disabled_repos: Vec::new(),
        extract_all_branches: all_branches,
        exclude_merge_commits: no_merge,
        exclude_revert_commits: no_revert,
        exclude_bot_commits: true,
        detailed_output: false,
        show_project_and_branch: true,
        commit_item_prefix_mode: "mapped-project".to_string(),
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

fn progress_callback(progress: CommitExtractProgress) {
    if progress.done {
        eprintln!(
            "扫描完成：{} 个仓库，{} 条提交",
            progress.total_repos, progress.commit_count
        );
    }
}

fn generate_markdown_report(
    cli: &CliArgs,
    start_date: &str,
    end_date: &str,
    period_label: &str,
    dirs: &[String],
    author: &str,
) -> Result<String, String> {
    match cli.report_type.as_str() {
        "daily" | "custom" => {
            let report_kind = if cli.report_type == "custom" {
                "custom"
            } else {
                "daily"
            };
            let options = build_extract_options(
                start_date,
                end_date,
                period_label,
                report_kind,
                dirs,
                author,
                cli.all_branches,
                cli.no_merge,
                cli.no_revert,
            );
            let result = commit_pipeline::extract_commits_sync(options, progress_callback)?;
            print_warnings(&result.warnings);
            Ok(result.summary_text)
        }
        "weekly" | "monthly" => {
            let options = PeriodReportOptions {
                root_dirs: dirs.to_vec(),
                indexed_repos: Vec::new(),
                output_dir: String::new(),
                output_enabled: false,
                author: author.to_string(),
                author_display_name: String::new(),
                author_aliases: Vec::new(),
                supplemental_items: Vec::new(),
                start_date: start_date.to_string(),
                end_date: end_date.to_string(),
                period_label: period_label.to_string(),
                report_kind: cli.report_type.clone(),
                disabled_repos: Vec::new(),
                extract_all_branches: cli.all_branches,
                exclude_merge_commits: cli.no_merge,
                exclude_revert_commits: cli.no_revert,
                exclude_bot_commits: true,
                commit_item_prefix_mode: "mapped-project".to_string(),
                show_evidence_details: false,
                evidence_link_rules: Vec::new(),
                redaction: ReportRedactionOptions::default(),
                project_names: HashMap::new(),
                report_format_templates: ReportFormatTemplates::default(),
                refinement_instruction: String::new(),
                system_prompt: String::new(),
                ai: disabled_ai(),
            };
            let result = commit_pipeline::generate_period_report_sync(options, progress_callback)?;
            print_warnings(&result.warnings);
            Ok(result.report_text)
        }
        _ => unreachable!(),
    }
}

fn generate_json_report(
    cli: &CliArgs,
    start_date: &str,
    end_date: &str,
    period_label: &str,
    dirs: &[String],
    author: &str,
) -> Result<String, String> {
    let report_kind = match cli.report_type.as_str() {
        "custom" => "custom",
        other => other,
    };
    let options = build_extract_options(
        start_date,
        end_date,
        period_label,
        report_kind,
        dirs,
        author,
        cli.all_branches,
        cli.no_merge,
        cli.no_revert,
    );
    let result = commit_pipeline::extract_commits_sync(options, progress_callback)?;
    print_warnings(&result.warnings);

    let projects: HashSet<String> = result
        .commits
        .iter()
        .map(|c| format!("{}({})", c.project_name, c.branch_name))
        .collect();

    let commits_json: Vec<serde_json::Value> = result
        .commits
        .iter()
        .map(|c| {
            serde_json::json!({
                "hash": c.hash,
                "author": c.author,
                "author_email": c.author_email,
                "date": c.date,
                "message": c.message,
                "project": c.project_name,
                "branch": c.branch_name,
                "additions": c.additions,
                "deletions": c.deletions,
                "changed_files": c.changed_files,
            })
        })
        .collect();

    let report = serde_json::json!({
        "report_type": cli.report_type,
        "start_date": start_date,
        "end_date": end_date,
        "period_label": period_label,
        "project_count": projects.len(),
        "commit_count": result.commits.len(),
        "commits": commits_json,
    });

    serde_json::to_string_pretty(&report).map_err(|e| format!("JSON 序列化失败：{}", e))
}

fn print_warnings(warnings: &[String]) {
    for warning in warnings {
        eprintln!("警告：{}", warning);
    }
}

fn print_help() {
    eprintln!(
        "\
GitPulse CLI - 命令行报告生成工具

用法：gitpulse-cli report [OPTIONS]

OPTIONS:
  -t, --type <TYPE>        报告类型：daily | weekly | monthly | custom（默认 weekly）
  -a, --author <AUTHOR>    作者过滤（可多次指定，默认使用 Git 全局用户名）
  -d, --dir <DIR>          工作区根目录（可多次指定，默认当前目录）
  --from <DATE>            起始日期 (YYYY-MM-DD)
  --to <DATE>              结束日期 (YYYY-MM-DD)
  --month <YYYY-MM>        月份（monthly 类型时可用）
  -o, --output <PATH>      输出文件路径（默认 stdout）
  -f, --format <FORMAT>    输出格式：markdown | json（默认 markdown）
  --all-branches           搜索所有分支（默认仅当前分支）
  --no-merge               排除 merge 提交（默认已启用）
  --no-revert              排除 revert 提交（默认已启用）
  -h, --help               显示此帮助

示例：
  gitpulse-cli report --type weekly
  gitpulse-cli report --type monthly --month 2026-06
  gitpulse-cli report --type custom --from 2026-07-01 --to 2026-07-10
  gitpulse-cli report --type daily -a Alice -a Bob -d /path/to/workspace
  gitpulse-cli report --type weekly --format json -o report.json"
    );
}
