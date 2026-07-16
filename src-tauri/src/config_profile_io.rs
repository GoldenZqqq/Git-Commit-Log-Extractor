use std::fs;
use std::path::Path;

const MAX_TEXT_FILE_BYTES: u64 = 2 * 1024 * 1024;

pub fn read_text_file(path: &str) -> Result<String, String> {
    let path = validated_path(path)?;
    let metadata = fs::metadata(path).map_err(|error| format!("读取配置方案失败：{error}"))?;
    if !metadata.is_file() {
        return Err("配置方案路径不是文件".to_string());
    }
    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err("配置方案不能超过 2 MiB".to_string());
    }
    let bytes = fs::read(path).map_err(|error| format!("读取配置方案失败：{error}"))?;
    String::from_utf8(bytes).map_err(|_| "配置方案必须使用 UTF-8 编码".to_string())
}

pub fn write_text_file(path: &str, content: &str) -> Result<(), String> {
    let path = validated_path(path)?;
    if content.len() as u64 > MAX_TEXT_FILE_BYTES {
        return Err("配置方案不能超过 2 MiB".to_string());
    }
    let parent = path
        .parent()
        .filter(|parent| parent.is_dir())
        .ok_or_else(|| "配置方案保存目录不存在".to_string())?;
    if parent.as_os_str().is_empty() {
        return Err("配置方案保存目录无效".to_string());
    }
    fs::write(path, content.as_bytes()).map_err(|error| format!("保存配置方案失败：{error}"))
}

fn validated_path(path: &str) -> Result<&Path, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("配置方案路径不能为空".to_string());
    }
    Ok(Path::new(trimmed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn text_file_round_trip_preserves_utf8() {
        let root = temp_root("round-trip");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("profile.json");

        write_text_file(path.to_str().unwrap(), "{\"name\":\"配置\"}\n").unwrap();

        assert_eq!(
            "{\"name\":\"配置\"}\n",
            read_text_file(path.to_str().unwrap()).unwrap()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn oversized_read_and_write_are_rejected() {
        let root = temp_root("oversized");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("profile.json");
        let oversized = vec![b'x'; MAX_TEXT_FILE_BYTES as usize + 1];
        fs::write(&path, &oversized).unwrap();

        assert!(read_text_file(path.to_str().unwrap())
            .unwrap_err()
            .contains("2 MiB"));
        assert!(
            write_text_file(path.to_str().unwrap(), &"x".repeat(oversized.len()))
                .unwrap_err()
                .contains("2 MiB")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_utf8_is_rejected() {
        let root = temp_root("invalid-utf8");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("profile.json");
        fs::write(&path, [0xff, 0xfe]).unwrap();

        assert!(read_text_file(path.to_str().unwrap())
            .unwrap_err()
            .contains("UTF-8"));
        fs::remove_dir_all(root).unwrap();
    }

    fn temp_root(label: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "gitpulse-config-profile-{label}-{}-{nonce}",
            std::process::id()
        ))
    }
}
