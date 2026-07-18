# 大规模工作区基准实施计划

1. [ ] 收敛 profile、指标、结果 schema、安全清理和回归阈值设计并激活任务。
2. [ ] 先为 profile 规模、nearest-rank P50/P95、阈值判断、参数错误和 marker 清理保护增加 Rust 测试。
3. [ ] 实现流式 `git fast-import` synthetic fixture，校验 5/50/200 仓库与精确总提交数，保持完全离线。
4. [ ] 实现 benchmark runner：first-pass/warm scan、完整 extraction、扫描取消、RSS、磁盘与输出规模采集。
5. [ ] 实现 versioned JSON 输出、`--output`、`--keep-fixture`、`--iterations` 与失败后先落盘再非零退出。
6. [ ] 运行 smoke 后执行 standard/large 实测，依据真实数据确认保守阈值；阻断问题直接修复或创建后续 Trellis 任务。
7. [ ] 新增性能基线 code-spec 与 `docs/performance-baseline.md`，记录环境、口径、实测结果、阈值和复测命令。
8. [ ] 运行定向 Rust 测试、三个 profile、全量 build/E2E/Rust/真实 WebView CI 与 `git diff --check`。
9. [ ] 勾选 AC、记录功能提交与 exact-SHA CI 证据，归档任务并独立 push。

## Validation Commands

```bash
cd src-tauri
cargo fmt -- --check
cargo test --bin gitpulse-workspace-benchmark
cargo run --release --bin gitpulse-workspace-benchmark -- --profile smoke --output ../artifacts/benchmarks/smoke.json
cargo run --release --bin gitpulse-workspace-benchmark -- --profile standard --output ../artifacts/benchmarks/standard.json
cargo run --release --bin gitpulse-workspace-benchmark -- --profile large --output ../artifacts/benchmarks/large.json
cargo check
cargo test
cd ..
npm run build
npm run test:e2e
git diff --check
```

## Risk Files

- `src-tauri/src/bin/gitpulse-workspace-benchmark.rs`
- `src-tauri/src/bin/workspace_benchmark/*.rs`
- `.trellis/spec/tauri-rust/index.md`
- `.trellis/spec/tauri-rust/workspace-benchmark.md`
- `docs/performance-baseline.md`

## Rollback Points

- fixture 生成后先用 Git 原生命令核验小 profile，再接入业务扫描与提取。
- runner 每增加一个阶段都先保持 JSON schema 可序列化，避免最后才发现机器结果无法落盘。
- standard/large 超阈值时保留结果文件，区分 correctness failure、环境噪声与真实业务回归后再调整。
