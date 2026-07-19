use crate::models::GitIdentity;
use std::io;
use std::path::Path;
use std::process::Command;

pub fn git_identity() -> GitIdentity {
    GitIdentity {
        user_name: run_git_config("user.name"),
        user_email: run_git_config("user.email"),
    }
}

pub fn current_branch(repo_path: &Path) -> String {
    run_git(repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|text| text.trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

pub fn git_version() -> Result<String, String> {
    git_command()
        .arg("--version")
        .output()
        .map_err(format_git_launch_error)
        .and_then(|output| {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
                Err(if detail.is_empty() {
                    "Git 命令不可用，请确认已安装 Git 并能在终端执行 git --version。".to_string()
                } else {
                    detail
                })
            }
        })
}

/// 从 `git --version` 输出里解析出主、次版本号。
/// 输入形如 `git version 2.45.1.windows.1`，返回 `Some((2, 45))`；
/// 无法识别时返回 `None`，调用方据此退化为不校验。
pub fn git_version_short(version: &str) -> Option<(u32, u32)> {
    let mut parts = version.split_whitespace();
    let _ = parts.next(); // "git"
    let _ = parts.next(); // "version"
    let version_token = parts.next()?;
    let mut numbers = version_token.split('.');
    let major = numbers.next()?.parse::<u32>().ok()?;
    let minor = numbers.next()?.parse::<u32>().ok()?;
    Some((major, minor))
}

/// 创建 git 子进程命令。Windows 上设置 CREATE_NO_WINDOW，避免生产包（GUI 子系统、无控制台）
/// 每调用一次 git 就弹出一个一闪而过的 cmd/终端窗口——有多少仓库就弹多少次。
/// 开发环境因为应用挂在控制台上、子进程复用它，所以看不到这个问题。
pub(crate) fn git_command() -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new("git");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    command
}

pub(crate) fn ensure_git_available() -> Result<(), String> {
    git_version().map(|_| ())
}

pub(crate) fn run_git(repo_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = git_command()
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(format_git_launch_error)?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if detail.is_empty() {
            format!("Git 命令执行失败：git {}", args.join(" "))
        } else {
            detail
        })
    }
}

pub(crate) fn format_git_launch_error(error: io::Error) -> String {
    if error.kind() == io::ErrorKind::NotFound {
        return "未找到 Git 命令，请先安装 Git 并确认 git 已加入 PATH。安装后重新打开 GitPulse。"
            .to_string();
    }
    format!("启动 Git 命令失败：{error}")
}

pub(crate) fn run_git_config(key: &str) -> String {
    git_command()
        .args(["config", "--global", key])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_default()
}
