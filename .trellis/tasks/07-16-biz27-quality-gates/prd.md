# BIZ-27 增加桌面质量门禁

## Goal

在现有跨平台 CI 上补齐稳定的可访问性、窄屏/高缩放和真实 Tauri smoke 门禁，防止桌面主路径回归。

## Requirements

- Playwright 增加 axe 级 a11y 门禁和窄屏/高缩放项目或测试集。
- 增加真实 Tauri WebView smoke，至少验证应用启动、工作台可见和一个本地命令往返。
- CI 区分纯浏览器 mocked e2e 与真实桌面 smoke，并上传失败产物。
- 门禁运行时间与跨平台稳定性可接受，易波动外部网络不进入硬门禁。

## Acceptance Criteria

- [ ] CI 能捕获严重 a11y 违规、窄屏布局回归和 Tauri 启动失败。
- [ ] Windows 至少运行真实 Tauri smoke；其他平台策略有明确记录。
- [ ] 失败时上传截图/trace/日志，成功时不依赖外部 AI 或 GitHub 网络。
- [ ] 本地有等价命令并写入贡献文档。

## Evidence

- `.github/workflows/ci.yml` 已运行前端 smoke、Playwright、build、cargo check/test，但没有 a11y、窄屏或真实 Tauri 运行门禁。

## Dependency

- 最后实施，以吸收 BIZ-21 与 BIZ-23 形成的测试基线。
