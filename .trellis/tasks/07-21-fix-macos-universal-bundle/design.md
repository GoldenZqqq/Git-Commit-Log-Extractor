# macOS Universal Bundle 修复设计

## Root Cause

Cargo 自动发现 `src-tauri/src/bin/gitpulse-workspace-benchmark.rs`。Tauri bundle 会读取 Cargo binary targets，并在 macOS universal bundle 阶段尝试复制所有默认可用 binary；主应用被构建为 universal binary，但开发专用 benchmark 没有对应 universal 产物，因此 bundle 失败。

项目已有 `gitpulse-cli` 的同类解决模式：显式 `[[bin]]` 配置并使用 `required-features`，使开发工具只在显式启用 feature 时参与 Cargo target 选择。

## Boundaries

- `src-tauri/Cargo.toml`：新增 `workspace-benchmark` feature，并将 benchmark bin 改为显式、feature-gated target；入口和支持模块目录全部移出 Cargo 自动发现的 `src/bin`。
- benchmark 调用入口：命令增加 `--features workspace-benchmark`。
- `.github/workflows/ci.yml` 与 `scripts/verify-release.mjs`：默认 Rust 测试之后显式运行 benchmark bin 测试，保持原有 11 项覆盖。
- `tests/scripts/release-governance.test.mjs`：通过 `cargo metadata` 验证 benchmark target 的 required feature，并验证 CI/发布校验没有遗漏专项测试。
- `.trellis/spec/tauri-rust/workspace-benchmark.md`、release governance spec 和相关维护文档同步命令及 bundle 约束。

## Cargo Contract

```toml
[features]
cli = []
workspace-benchmark = []

[[bin]]
name = "gitpulse-workspace-benchmark"
path = "src/workspace_benchmark_cli.rs"
required-features = ["workspace-benchmark"]
```

默认 `cargo check`、`cargo test` 和 `tauri build` 不启用 benchmark target。专项验证显式运行：

```text
cargo test --features workspace-benchmark --bin gitpulse-workspace-benchmark
cargo run --release --features workspace-benchmark --bin gitpulse-workspace-benchmark -- --profile smoke
```

## Release Flow

1. 在 `main` 提交并推送修复，等待 exact-SHA 主线 CI。
2. 生成并审阅 v0.6.1 patch Release Notes，执行完整 release verification 和 patch dry-run。
3. 通过 `npm run release:win:patch` 发布 Windows 资产和 `v0.6.1` tag。
4. 标签触发 macOS/Linux workflow；等待两端成功并验证 `.app.zip` 或 `.dmg`、`.AppImage` 与 Windows updater 资产。
5. `v0.6.0` 保持不变，不移动 tag、不覆盖旧资产。

## Compatibility And Risk

- benchmark 参数、输出 schema 和实现不变，仅调用时需要显式 feature。
- 默认 `cargo test` 会跳过 feature-gated benchmark target，因此 CI 和 `verify:release` 必须增加专项测试步骤；回归测试负责锁定这一约束。
- 本机 Windows 无法证明 macOS universal linker/bundle 完整成功，最终验收以 v0.6.1 tag workflow 的 macOS runner 为准。
- 若 v0.6.1 macOS build 仍失败，保留已发布资产并停止任务收口；不移动 tag，按日志修复后发布新的 patch 版本。

## Rollback

- 发布前失败：不发布，修复或回退当前 task commit。
- 版本提交后、tag 前失败：使用仓库 `release:win:current` 恢复。
- tag 后 macOS 失败：不得改写 tag；修复后发布新的 patch 版本。
