# BIZ-27 技术设计

## CI Job Boundaries

1. `desktop-checks` 保留 Windows/Linux 矩阵，运行 frontend smoke、mocked Playwright 全集、build、Rust check/test 和 diff check。
2. 在同一 browser job 中增加命名清晰的 `a11y + responsive` 专项步骤，显式消费 BIZ-21/BIZ-23 测试集；失败产物沿用现有 Playwright artifact 上传。
3. 新增独立 `tauri-smoke-windows` job，仅 Windows runner 执行 `npm run build:tauri:smoke`、`tauri-driver` 和 smoke 脚本；独立上传 `artifacts/tauri-smoke`。

## Tauri Smoke Protocol

`scripts/tauri-smoke.mjs [binary]` 使用 Node 内置 `fetch` 调用 WebDriver HTTP API：

- 启动 `tauri-driver --port <port>`，等待 `/status`。
- POST `/session`，能力为 `tauri:options.application = <absolute debug exe>`。
- 轮询同步脚本，必要时点击首次启动的“暂时跳过，稍后在设置中配置”，直到工作台标题出现。
- 用 `/execute/sync` 读取 `h2` 工作台标题，用 `/execute/async` 调用 `window.__TAURI_INTERNALS__.invoke("get_git_identity")`，断言返回对象。
- 失败保存 `/session/{id}/screenshot` 到 artifact 目录、driver stdout/stderr 和结构化 summary；finally 删除 session 并结束 driver。

非 Windows 本地执行打印 skip 原因并返回 0；CI 只在 Windows job 调用该命令，Linux/macOS 策略由文档声明。

## Window Contract

`src-tauri/tauri.conf.json` 的 `minWidth: 320`、`minHeight: 420` 与 BIZ-23 viewport 契约保持一致；不改变默认 1180×900 桌面尺寸。

## Dependency and Network Boundary

- `@axe-core/playwright` 已是 devDependency，不增加生产依赖。
- `tauri-driver` 作为 Windows CI 工具安装，EdgeDriver 仅连接本地 WebView；测试脚本不访问外部 URL、AI、GitHub 或远程 Git。
- smoke debug 构建设置 `VITE_TAURI_SMOKE=1`，只关闭启动时 updater 检查；常规构建和手动更新能力不变。
- CI 依赖下载属于 runner setup，不属于 smoke 运行时硬门禁业务依赖。
