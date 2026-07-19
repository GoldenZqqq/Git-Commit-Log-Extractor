use crate::models::SubPeriod;
use chrono::{Datelike, Duration, Local, NaiveDate};

pub fn previous_month_range() -> (String, String, String) {
    let today = Local::now().date_naive();
    previous_month_range_from(today)
}

pub fn previous_month_range_from(today: NaiveDate) -> (String, String, String) {
    let first_this_month = today.with_day(1).unwrap();
    let last_previous_month = first_this_month - Duration::days(1);
    let first_previous_month = last_previous_month.with_day(1).unwrap();
    (
        first_previous_month.format("%Y-%m-%d").to_string(),
        last_previous_month.format("%Y-%m-%d").to_string(),
        first_previous_month.format("%Y-%m").to_string(),
    )
}

const BATCH_MAX_PERIODS: usize = 365;

pub fn split_date_range(
    start: &str,
    end: &str,
    granularity: &str,
) -> Result<Vec<SubPeriod>, String> {
    let start_date = NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .map_err(|e| format!("起始日期格式错误：{e}"))?;
    let end_date =
        NaiveDate::parse_from_str(end, "%Y-%m-%d").map_err(|e| format!("结束日期格式错误：{e}"))?;
    if start_date > end_date {
        return Err("起始日期不能晚于结束日期".to_string());
    }

    let periods = match granularity {
        "daily" => split_daily(start_date, end_date),
        "weekly" => split_weekly(start_date, end_date),
        "monthly" => split_monthly(start_date, end_date),
        "custom" => vec![SubPeriod {
            start: start.to_string(),
            end: end.to_string(),
            label: format!("{start}~{end}"),
            report_kind: "custom".to_string(),
        }],
        _ => return Err(format!("不支持的拆分粒度：{granularity}")),
    };

    if periods.len() > BATCH_MAX_PERIODS {
        return Err(format!(
            "拆分后共 {} 份报告，超过上限 {BATCH_MAX_PERIODS}",
            periods.len()
        ));
    }
    Ok(periods)
}

fn split_daily(start: NaiveDate, end: NaiveDate) -> Vec<SubPeriod> {
    let mut periods = Vec::new();
    let mut day = start;
    while day <= end {
        let ds = day.format("%Y-%m-%d").to_string();
        periods.push(SubPeriod {
            start: ds.clone(),
            end: ds.clone(),
            label: ds,
            report_kind: "daily".to_string(),
        });
        day += Duration::days(1);
    }
    periods
}

fn split_weekly(start: NaiveDate, end: NaiveDate) -> Vec<SubPeriod> {
    let mut periods = Vec::new();
    let mut week_start = start;
    while week_start <= end {
        let week_end = {
            let days_to_sunday = 7 - week_start.weekday().num_days_from_monday() - 1;
            let natural_end = week_start + Duration::days(days_to_sunday as i64);
            if natural_end > end {
                end
            } else {
                natural_end
            }
        };
        let iso = week_start.iso_week();
        let label = format!("{}-W{:02}", iso.year(), iso.week());
        periods.push(SubPeriod {
            start: week_start.format("%Y-%m-%d").to_string(),
            end: week_end.format("%Y-%m-%d").to_string(),
            label,
            report_kind: "weekly".to_string(),
        });
        week_start = week_end + Duration::days(1);
    }
    periods
}

fn split_monthly(start: NaiveDate, end: NaiveDate) -> Vec<SubPeriod> {
    let mut periods = Vec::new();
    let mut month_start = start;
    while month_start <= end {
        let next_month = if month_start.month() == 12 {
            NaiveDate::from_ymd_opt(month_start.year() + 1, 1, 1)
        } else {
            NaiveDate::from_ymd_opt(month_start.year(), month_start.month() + 1, 1)
        }
        .unwrap();
        let natural_end = next_month - Duration::days(1);
        let month_end = if natural_end > end { end } else { natural_end };
        let label = month_start.format("%Y-%m").to_string();
        periods.push(SubPeriod {
            start: month_start.format("%Y-%m-%d").to_string(),
            end: month_end.format("%Y-%m-%d").to_string(),
            label,
            report_kind: "monthly".to_string(),
        });
        month_start = next_month;
    }
    periods
}
