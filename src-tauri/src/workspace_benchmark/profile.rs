use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const GIB: u64 = 1024 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProfileKind {
    Smoke,
    Standard,
    Large,
}

#[derive(Clone, Copy, Debug)]
pub struct ProfileSpec {
    pub name: &'static str,
    pub repository_count: usize,
    pub commit_count: usize,
    pub default_iterations: usize,
    pub thresholds: Thresholds,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Thresholds {
    pub first_scan_ms: u64,
    pub warm_scan_p95_ms: u64,
    pub extraction_p95_ms: u64,
    pub cancellation_ms: u64,
    pub peak_rss_bytes: Option<u64>,
}

#[derive(Debug)]
pub struct BenchmarkConfig {
    pub profile: ProfileKind,
    pub iterations: usize,
    pub output: Option<PathBuf>,
    pub fixture_dir: Option<PathBuf>,
    pub keep_fixture: bool,
    pub allow_regressions: bool,
}

pub enum ParseResult {
    Config(BenchmarkConfig),
    Help,
}

impl ProfileKind {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "smoke" => Ok(Self::Smoke),
            "standard" => Ok(Self::Standard),
            "large" => Ok(Self::Large),
            _ => Err(format!(
                "不支持的 benchmark profile：{value}，可选 smoke、standard、large"
            )),
        }
    }

    pub fn spec(self) -> ProfileSpec {
        match self {
            Self::Smoke => ProfileSpec {
                name: "smoke",
                repository_count: 5,
                commit_count: 500,
                default_iterations: 3,
                thresholds: thresholds(5_000, 3_000, 20_000, GIB),
            },
            Self::Standard => ProfileSpec {
                name: "standard",
                repository_count: 50,
                commit_count: 50_000,
                default_iterations: 3,
                thresholds: thresholds(15_000, 10_000, 90_000, 2 * GIB),
            },
            Self::Large => ProfileSpec {
                name: "large",
                repository_count: 200,
                commit_count: 50_000,
                default_iterations: 3,
                thresholds: thresholds(30_000, 20_000, 120_000, 2 * GIB),
            },
        }
    }
}

pub fn parse_args(args: &[String]) -> Result<ParseResult, String> {
    let mut profile = ProfileKind::Smoke;
    let mut iterations = None;
    let mut output = None;
    let mut fixture_dir = None;
    let mut keep_fixture = false;
    let mut allow_regressions = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "-h" | "--help" => return Ok(ParseResult::Help),
            "--profile" => {
                profile = ProfileKind::parse(next_value(args, &mut index, "--profile")?)?
            }
            "--iterations" => {
                iterations = Some(parse_iterations(next_value(
                    args,
                    &mut index,
                    "--iterations",
                )?)?)
            }
            "--output" => output = Some(PathBuf::from(next_value(args, &mut index, "--output")?)),
            "--fixture-dir" => {
                fixture_dir = Some(PathBuf::from(next_value(
                    args,
                    &mut index,
                    "--fixture-dir",
                )?))
            }
            "--keep-fixture" => keep_fixture = true,
            "--allow-regressions" => allow_regressions = true,
            value => return Err(format!("未知 benchmark 参数：{value}")),
        }
        index += 1;
    }

    Ok(ParseResult::Config(BenchmarkConfig {
        profile,
        iterations: iterations.unwrap_or(profile.spec().default_iterations),
        output,
        fixture_dir,
        keep_fixture,
        allow_regressions,
    }))
}

pub fn print_help() {
    eprintln!(
        "\
GitPulse large workspace benchmark

用法：cargo run --release --features workspace-benchmark --bin gitpulse-workspace-benchmark -- [OPTIONS]

OPTIONS:
  --profile <NAME>       smoke | standard | large（默认 smoke）
  --iterations <COUNT>   warm scan 与 extraction 次数，2 至 10
  --output <PATH>        同时把 JSON 结果写入文件
  --fixture-dir <PATH>   使用指定的受控 fixture 目录
  --keep-fixture         完成后保留 synthetic repositories
  --allow-regressions    超过阈值时仍返回退出码 0
  -h, --help             显示帮助"
    );
}

fn thresholds(first: u64, warm: u64, extraction: u64, rss: u64) -> Thresholds {
    Thresholds {
        first_scan_ms: first,
        warm_scan_p95_ms: warm,
        extraction_p95_ms: extraction,
        cancellation_ms: 250,
        peak_rss_bytes: Some(rss),
    }
}

fn next_value<'a>(args: &'a [String], index: &mut usize, name: &str) -> Result<&'a str, String> {
    *index += 1;
    args.get(*index)
        .map(String::as_str)
        .ok_or_else(|| format!("{name} 缺少参数值"))
}

fn parse_iterations(value: &str) -> Result<usize, String> {
    let parsed = value
        .parse::<usize>()
        .map_err(|_| "--iterations 必须是 2 至 10 的整数".to_string())?;
    if !(2..=10).contains(&parsed) {
        return Err("--iterations 必须是 2 至 10 的整数".to_string());
    }
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profiles_have_the_required_repository_and_commit_scale() {
        let smoke = ProfileKind::Smoke.spec();
        let standard = ProfileKind::Standard.spec();
        let large = ProfileKind::Large.spec();

        assert_eq!((5, 500), (smoke.repository_count, smoke.commit_count));
        assert_eq!(
            (50, 50_000),
            (standard.repository_count, standard.commit_count)
        );
        assert_eq!((200, 50_000), (large.repository_count, large.commit_count));
    }

    #[test]
    fn arguments_override_profile_iterations_and_output() {
        let args = strings(&[
            "--profile",
            "large",
            "--iterations",
            "4",
            "--output",
            "result.json",
            "--keep-fixture",
            "--allow-regressions",
        ]);
        let ParseResult::Config(config) = parse_args(&args).unwrap() else {
            panic!("expected config");
        };

        assert_eq!(ProfileKind::Large, config.profile);
        assert_eq!(4, config.iterations);
        assert_eq!(Some(PathBuf::from("result.json")), config.output);
        assert!(config.keep_fixture);
        assert!(config.allow_regressions);
    }

    #[test]
    fn arguments_reject_unknown_profiles_and_unsafe_iteration_counts() {
        assert!(parse_args(&strings(&["--profile", "huge"])).is_err());
        assert!(parse_args(&strings(&["--iterations", "1"])).is_err());
        assert!(parse_args(&strings(&["--iterations", "many"])).is_err());
    }

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }
}
