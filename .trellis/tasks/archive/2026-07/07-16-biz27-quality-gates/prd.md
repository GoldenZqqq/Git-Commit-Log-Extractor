# BIZ-27 增加桌面质量门禁

## Goal

在现有跨平台 CI 上补齐稳定的可访问性、窄屏/高缩放和真实 Tauri WebView smoke 门禁，防止桌面主路径回归。

## Background

- `.github/workflows/ci.yml` 当前把 mocked Playwright、构建和 Rust check/test 放在同一矩阵 job 中，没有显式的 a11y/响应式测试集，也没有真实桌面启动步骤。
- BIZ-21 已提供 `@axe-core/playwright` 与 `tests/e2e/accessibility.spec.ts`；BIZ-23 已提供 `tests/e2e/responsive-hardening.spec.ts` 和三个 viewport 截图/布局断言。
- Tauri Windows WebView 可通过 `tauri-driver` 驱动已构建的 `src-tauri/target/debug/gitpulse.exe`；Linux CI 继续执行 browser mocked e2e + Rust，不假装提供无桌面 WebView smoke。
- `src-tauri/tauri.conf.json` 仍将窗口 `minWidth`/`minHeight` 限制为 980/720，需与 BIZ-23 的 320px/小高度契约对齐。

## Requirements

- R1：CI 明确分离 browser mocked e2e、a11y/responsive 专项、构建/Rust 检查和 Windows 真实 Tauri smoke。
- R2：a11y/responsive 专项使用现有专用 Playwright 集，严重 axe 违规、320/640/1280 viewport 溢出和关键 bounding-box 失败必须阻断 CI。
- R3：Windows smoke 构建真实 debug Tauri 二进制，启动 WebView，验证工作台可见，并通过 WebDriver 异步脚本调用 `get_git_identity` 完成本地命令往返。
- R4：Windows smoke 不访问外部 AI、GitHub API 或远程 Git；WebDriver/EdgeDriver 仅作为 CI 环境依赖。
- R5：失败时分别上传 Playwright `test-results`/`playwright-report` 与 Tauri smoke 的 driver 日志、应用日志和截图；成功路径不上传无关大文件。
- R6：本地提供 browser 专项和 Tauri smoke 等价命令；贡献文档记录 Windows smoke 前置条件及 Linux/macOS 策略。
- R7：Tauri 实际窗口最小尺寸与响应式契约一致，允许 320×420 及以上窗口并依赖内容滚动完成主路径。

## Acceptance Criteria

- [x] AC1：CI 能捕获 serious/critical a11y 违规、320/640/1280 响应式回归和 Tauri 启动/命令往返失败。
- [x] AC2：Windows 至少运行真实 Tauri smoke；Linux/macOS 的 browser mocked + Rust 策略在贡献文档中明确。
- [x] AC3：a11y/responsive 或 smoke 失败时上传对应截图、trace、driver/app 日志；成功时不依赖外部 AI 或 GitHub 网络。
- [x] AC4：本地存在 `test:e2e:a11y`、`test:e2e:responsive`、`build:tauri:smoke`、`test:tauri-smoke` 等价命令，并写入贡献文档。
- [x] AC5：Tauri `minWidth`/`minHeight` 与 320px/小高度响应式测试契约一致，前端构建、全量 Playwright、Rust check/test 和 diff check 通过。

## Out of Scope

- 不把真实 WebView smoke 强行扩展到没有稳定 Tauri driver 的 Linux/macOS runner。
- 不在 CI smoke 中调用 AI、更新器、GitHub 网络或用户真实凭据。
- 不替换现有 browser mock 体系，不引入 WebDriver 客户端大型框架；使用脚本内最小 HTTP 协议客户端。
