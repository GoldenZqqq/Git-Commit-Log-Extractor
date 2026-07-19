use crate::{docx, pdf};
use std::fs;
use std::path::PathBuf;

pub fn save_report_file(
    output_dir: &str,
    file_name: &str,
    content: &str,
) -> Result<String, String> {
    let output_file = resolve_output_file(output_dir, file_name)?;
    fs::write(&output_file, content).map_err(|err| {
        format!(
            "写入报告失败：{}。请确认输出目录有写入权限：{}",
            err,
            output_dir.trim()
        )
    })?;
    Ok(output_file.to_string_lossy().to_string())
}

pub fn save_report_document(
    output_dir: &str,
    base_name: &str,
    content: &str,
    format: &str,
) -> Result<String, String> {
    let normalized = normalize_export_format(format)?;
    let file_name = format!("{}.{}", strip_known_report_extension(base_name), normalized);
    let output_file = resolve_output_file(output_dir, &file_name)?;
    let bytes = match normalized {
        "md" => return save_report_file(output_dir, &file_name, content),
        "docx" => docx::markdown_to_docx(content),
        "pdf" => pdf::markdown_to_pdf(content)?,
        _ => unreachable!("export format is normalized before writing"),
    };
    fs::write(&output_file, bytes).map_err(|err| {
        let label = match normalized {
            "docx" => "Word",
            "pdf" => "PDF",
            _ => "报告",
        };
        format!(
            "写入 {} 报告失败：{}。请确认输出目录有写入权限：{}",
            label,
            err,
            output_dir.trim()
        )
    })?;
    Ok(output_file.to_string_lossy().to_string())
}

fn resolve_output_file(output_dir: &str, file_name: &str) -> Result<PathBuf, String> {
    let dir = validate_output_directory(output_dir)?;

    let trimmed_name = file_name.trim();
    if trimmed_name.is_empty() {
        return Err("报告文件名不能为空".to_string());
    }

    Ok(dir.join(trimmed_name))
}

pub fn validate_output_directory(output_dir: &str) -> Result<PathBuf, String> {
    let trimmed_dir = output_dir.trim();
    if trimmed_dir.is_empty() {
        return Err("请先在设置中选择输出目录".to_string());
    }

    let dir = PathBuf::from(trimmed_dir);
    if !dir.exists() {
        return Err(format!(
            "输出目录不存在或当前无法访问：{}。请在设置中重新选择可用目录。",
            trimmed_dir
        ));
    }
    if !dir.is_dir() {
        return Err(format!(
            "输出路径不是文件夹：{}。请在设置中选择一个文件夹作为输出目录。",
            trimmed_dir
        ));
    }
    Ok(dir)
}

pub(super) fn normalize_export_format(format: &str) -> Result<&'static str, String> {
    match format.trim().to_ascii_lowercase().as_str() {
        "markdown" | "md" => Ok("md"),
        "docx" | "word" => Ok("docx"),
        "pdf" => Ok("pdf"),
        other => Err(format!("暂不支持的导出格式：{}", other)),
    }
}

fn strip_known_report_extension(base_name: &str) -> String {
    let trimmed = base_name.trim();
    let lower = trimmed.to_ascii_lowercase();
    if lower.ends_with(".docx") {
        trimmed[..trimmed.len() - 5].to_string()
    } else if lower.ends_with(".pdf") {
        trimmed[..trimmed.len() - 4].to_string()
    } else if lower.ends_with(".md") {
        trimmed[..trimmed.len() - 3].to_string()
    } else {
        trimmed.to_string()
    }
}
