# BIZ-27 实施计划

1. 更新 BIZ-27 规划工件并激活任务；确认 BIZ-21/BIZ-23 测试文件与 axe devDependency 已在当前分支。
2. 新增 `scripts/tauri-smoke.mjs` 最小 WebDriver 客户端，支持 Windows 真机、首次引导跳过、标题检查、本地 `get_git_identity` 往返、日志/截图和清理。
3. 增加 `package.json` 本地专项命令；调整 Tauri 最小窗口尺寸；扩充 `CONTRIBUTING.md` 的 CI/平台策略和本地 smoke 前置条件。
4. 修改 `.github/workflows/ci.yml`：显式 a11y/responsive step、独立 Windows smoke job、EdgeDriver/tauri-driver setup、失败 artifact 上传。
5. 执行 `npm run build`、`npm run test:e2e`、`npm run test:e2e:a11y`、`npm run test:e2e:responsive`、`cargo fmt -- --check`、`cargo check`、`cargo test`、`git diff --check`；Windows driver 缺失时至少执行脚本 dry-run/type syntax 并明确记录。
6. 用 `trellis-check` 做 CI/跨层一致性检查，勾选验收、归档并创建独立提交 `feat: 补齐桌面质量门禁`。

## Verification Evidence

- `node --check scripts/tauri-smoke.mjs` 与 `scripts/build-tauri-smoke.mjs` 通过。
- `npm run build` 通过。
- `npm run test:e2e:a11y`：3/3 通过。
- `npm run test:e2e:responsive`：3/3 通过，覆盖 320x900、640x450、1280x480。
- `npm run test:e2e`：66/66 通过。
- `cargo fmt -- --check`、`cargo check` 通过；`cargo test`：125/125 通过。
- `npm run build:tauri:smoke` 构建真实 debug 应用成功。
- 匹配 EdgeDriver + `tauri-driver 2.0.6` 的真实 WebView smoke 通过：首次引导跳过、工作台标题、`get_git_identity` IPC 往返和进程清理均成功。
- CI workflow 通过 YAML 解析，`git diff --check` 通过。

## Risk Files

- `.github/workflows/ci.yml`：矩阵、artifact 条件和 Windows 工具安装。
- `scripts/tauri-smoke.mjs`：WebDriver 协议、异步脚本和进程清理。
- `src-tauri/tauri.conf.json`：实际桌面窗口尺寸契约。
- `package.json` / `CONTRIBUTING.md`：本地命令和维护者说明。

## Validation Commands

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
npm run build
npm run test:e2e:a11y
npm run test:e2e:responsive
npm run test:e2e
cd src-tauri
cargo fmt -- --check
cargo check
cargo test
```
