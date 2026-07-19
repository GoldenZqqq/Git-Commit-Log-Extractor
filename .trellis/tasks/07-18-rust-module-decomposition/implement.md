# Rust 超大模块拆分实施计划

## Ordered Checklist

- [x] 记录 `report.rs`、`git_ops.rs` 行数、公开符号、调用面和完整质量基线。
- [x] 拆分 `git_ops` facade、扫描器、提交查询/解析和 Git command adapter，保持现有测试与 benchmark 调用路径。
- [x] 拆分 report 的日期范围、文件导出和批量命名模块，保持公开 re-export 与错误文本。
- [x] 拆分 report 的提取结果、模板核心、提交条目、证据和周期内容模块，收窄内部可见性。
- [x] 将原模块测试迁到独立测试模块，确认生产模块与新增核心文件均不超过 600 行。
- [x] 审查 command/API、serde、用户文案、报告快照、Git args、Windows flags、扫描取消/循环保护和依赖方向。
- [ ] 运行 Rust fmt/check/test、benchmark smoke、frontend build/E2E、真实 Windows Tauri smoke 与 `git diff --check`。本地 Rust/CLI/benchmark、frontend build/E2E、frontend smoke、release governance 与 diff check 已通过；真实 Windows Tauri smoke 待 exact-SHA CI。
- [ ] 提交、push 并等待 exact-SHA CI；失败只修复本任务引入的问题并重新取证。
- [ ] 勾选 AC、更新 Rust spec、记录 journal、归档任务并将父路线推进至 7/8。

## Validation Commands

```bash
wc -l src-tauri/src/report.rs src-tauri/src/report/*.rs src-tauri/src/git_ops.rs src-tauri/src/git_ops/*.rs
cd src-tauri
cargo fmt --all -- --check
cargo check
cargo test
cargo test --bin gitpulse-workspace-benchmark
cargo run --release --bin gitpulse-workspace-benchmark -- --profile smoke --output ../artifacts/benchmarks/rust-module-decomposition-smoke.json
cd ..
npm run build
npm run test:e2e
git diff --check
```

## Risk Files

- `src-tauri/src/report.rs`
- `src-tauri/src/report/*`
- `src-tauri/src/git_ops.rs`
- `src-tauri/src/git_ops/*`
- `src-tauri/src/commit_pipeline.rs`
- `src-tauri/src/cli.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/bin/gitpulse-workspace-benchmark.rs`

## Rollback Points

- Rollback 1：恢复 `git_ops.rs` 单文件，不触碰 report 拆分。
- Rollback 2：恢复 report 日期/导出/命名逻辑，不触碰模板核心。
- Rollback 3：恢复 report 模板/条目/证据移动，保留已通过的低耦合拆分。
- Rollback 4：若 exact-SHA CI 暴露平台差异，只回退对应批次，不改变 contract 或测试阈值。
