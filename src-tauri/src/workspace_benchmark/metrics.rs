use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::fs;
use std::time::{Duration, Instant};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricStats {
    pub samples_ms: Vec<u64>,
    pub p50_ms: u64,
    pub p95_ms: u64,
}

pub fn metric_stats(samples_ms: Vec<u64>) -> MetricStats {
    let mut sorted = samples_ms.clone();
    sorted.sort_unstable();
    MetricStats {
        samples_ms,
        p50_ms: nearest_rank(&sorted, 50),
        p95_ms: nearest_rank(&sorted, 95),
    }
}

pub fn elapsed_ms(started_at: Instant) -> u64 {
    duration_ms(started_at.elapsed())
}

pub fn duration_ms(duration: Duration) -> u64 {
    duration.as_millis().max(1).min(u64::MAX as u128) as u64
}

#[cfg(target_os = "linux")]
pub fn process_peak_rss_bytes() -> Option<u64> {
    let status = fs::read_to_string("/proc/self/status").ok()?;
    let value = status
        .lines()
        .find_map(|line| line.strip_prefix("VmHWM:"))?;
    let kib = value.split_whitespace().next()?.parse::<u64>().ok()?;
    kib.checked_mul(1024)
}

#[cfg(target_os = "windows")]
pub fn process_peak_rss_bytes() -> Option<u64> {
    use std::process::Command;

    let command = format!("(Get-Process -Id {}).PeakWorkingSet64", std::process::id());
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &command])
        .output()
        .ok()?;
    output.status.success().then_some(())?;
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<u64>()
        .ok()
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub fn process_peak_rss_bytes() -> Option<u64> {
    None
}

fn nearest_rank(sorted: &[u64], percentile: usize) -> u64 {
    if sorted.is_empty() {
        return 0;
    }
    let rank = (percentile * sorted.len()).div_ceil(100);
    sorted[rank.saturating_sub(1)]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nearest_rank_reports_stable_p50_and_p95() {
        let stats = metric_stats(vec![90, 10, 30, 50, 70]);

        assert_eq!(50, stats.p50_ms);
        assert_eq!(90, stats.p95_ms);
        assert_eq!(vec![90, 10, 30, 50, 70], stats.samples_ms);
    }

    #[test]
    fn sub_millisecond_durations_are_reported_as_one_millisecond() {
        assert_eq!(1, duration_ms(Duration::from_nanos(1)));
        assert_eq!(2, duration_ms(Duration::from_millis(2)));
    }
}
