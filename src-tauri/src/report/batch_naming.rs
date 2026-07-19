use crate::models::SubPeriod;
use chrono::{Datelike, NaiveDate};
use std::collections::HashSet;
use std::path::PathBuf;

pub const DEFAULT_BATCH_FILE_NAME_TEMPLATE: &str = "{period}-{type}.{ext}";

#[derive(Clone, Copy)]
pub struct BatchFileNameContext<'a> {
    pub period: &'a SubPeriod,
    pub author: &'a str,
    pub project: &'a str,
}

pub fn normalize_batch_export_formats(formats: &[String]) -> Result<Vec<&'static str>, String> {
    let mut normalized = Vec::new();
    for format in formats {
        let extension = super::normalize_export_format(format)?;
        if !normalized.contains(&extension) {
            normalized.push(extension);
        }
    }
    if normalized.is_empty() {
        return Err("请至少选择一种导出格式".to_string());
    }
    Ok(normalized)
}

pub fn validate_batch_file_name_template(template: &str) -> Result<(), String> {
    let template = template.trim();
    if template.is_empty() {
        return Err("文件名模板不能为空".to_string());
    }
    if !template.ends_with(".{ext}") {
        return Err("文件名模板必须以 .{ext} 结尾".to_string());
    }
    for token in batch_template_tokens(template)? {
        if !is_supported_batch_file_name_token(token) {
            return Err(format!("文件名模板包含未知变量：{{{token}}}"));
        }
    }
    Ok(())
}

pub fn batch_file_name(
    template: &str,
    format: &str,
    context: BatchFileNameContext<'_>,
) -> Result<String, String> {
    validate_batch_file_name_template(template)?;
    let extension = super::normalize_export_format(format)?;
    let start = NaiveDate::parse_from_str(&context.period.start, "%Y-%m-%d")
        .map_err(|err| format!("批量报告开始日期格式错误：{err}"))?;
    let week = format!(
        "{}-W{:02}",
        start.iso_week().year(),
        start.iso_week().week()
    );
    let month = start.format("%Y-%m").to_string();
    let author = non_empty_or(context.author, "全部作者");
    let project = non_empty_or(context.project, "全部项目");
    let type_label = batch_report_type_label(&context.period.report_kind);
    let values = [
        ("period", context.period.label.as_str()),
        ("date", context.period.start.as_str()),
        ("week", week.as_str()),
        ("month", month.as_str()),
        ("startDate", context.period.start.as_str()),
        ("endDate", context.period.end.as_str()),
        ("author", author),
        ("project", project),
        ("type", type_label),
        ("ext", extension),
    ];
    let rendered = values
        .iter()
        .fold(template.trim().to_string(), |name, (token, value)| {
            name.replace(&format!("{{{token}}}"), value)
        });
    sanitize_batch_file_name(&rendered)
}

pub fn reserve_batch_file_name(
    output_dir: &str,
    candidate: &str,
    used_names: &mut HashSet<String>,
) -> String {
    let (stem, extension) = split_file_name(candidate);
    let directory = PathBuf::from(output_dir);
    let mut sequence = 1usize;
    loop {
        let file_name = if sequence == 1 {
            candidate.to_string()
        } else {
            format!("{stem}-{sequence}{extension}")
        };
        let key = file_name.to_lowercase();
        if !used_names.contains(&key) && !directory.join(&file_name).exists() {
            used_names.insert(key);
            return file_name;
        }
        sequence += 1;
    }
}

fn batch_template_tokens(template: &str) -> Result<Vec<&str>, String> {
    let mut remaining = template;
    let mut tokens = Vec::new();
    while let Some(start) = remaining.find('{') {
        if remaining[..start].contains('}') {
            return Err("文件名模板包含未配对的大括号".to_string());
        }
        let after_start = &remaining[start + 1..];
        let end = after_start
            .find('}')
            .ok_or_else(|| "文件名模板包含未配对的大括号".to_string())?;
        let token = &after_start[..end];
        if token.is_empty() || token.contains('{') {
            return Err("文件名模板包含无效变量".to_string());
        }
        tokens.push(token);
        remaining = &after_start[end + 1..];
    }
    if remaining.contains('}') {
        return Err("文件名模板包含未配对的大括号".to_string());
    }
    Ok(tokens)
}

fn is_supported_batch_file_name_token(token: &str) -> bool {
    matches!(
        token,
        "period"
            | "date"
            | "week"
            | "month"
            | "startDate"
            | "endDate"
            | "author"
            | "project"
            | "type"
            | "ext"
    )
}

fn batch_report_type_label(report_kind: &str) -> &'static str {
    match report_kind {
        "daily" => "日报",
        "weekly" => "周报",
        "monthly" => "月报",
        "custom" => "自定义报告",
        _ => "报告",
    }
}

fn non_empty_or<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    let value = value.trim();
    if value.is_empty() {
        fallback
    } else {
        value
    }
}

fn sanitize_batch_file_name(file_name: &str) -> Result<String, String> {
    let normalized: String = file_name
        .chars()
        .map(|character| {
            if character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
            {
                '_'
            } else {
                character
            }
        })
        .collect();
    let trimmed = normalized.trim().trim_end_matches([' ', '.']);
    if trimmed.is_empty() {
        return Err("文件名模板生成了空文件名".to_string());
    }
    let prefixed = if is_windows_reserved_file_name(trimmed) {
        format!("_{trimmed}")
    } else {
        trimmed.to_string()
    };
    Ok(prefixed)
}

fn is_windows_reserved_file_name(file_name: &str) -> bool {
    let stem = file_name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem[3..]
                .parse::<u8>()
                .is_ok_and(|number| (1..=9).contains(&number)))
}

fn split_file_name(file_name: &str) -> (&str, &str) {
    match file_name.rfind('.') {
        Some(index) if index > 0 => (&file_name[..index], &file_name[index..]),
        _ => (file_name, ""),
    }
}
