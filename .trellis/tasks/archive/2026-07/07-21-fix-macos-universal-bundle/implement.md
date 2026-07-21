# 执行计划

## Implementation

- [x] 在 `src-tauri/Cargo.toml` 中显式 feature-gate `gitpulse-workspace-benchmark`。
- [x] 更新 benchmark 帮助文本、性能基线、workspace benchmark spec 的调用命令。
- [x] 在 CI 和 `verify:release` 中增加显式 benchmark bin 测试步骤。
- [x] 增加发布治理回归测试，验证 Cargo metadata 和质量门禁中的 benchmark feature 契约。
- [x] 更新 release governance spec，替换临时风险说明为已实施的约束。

## Validation

- [x] `cargo metadata --format-version 1 --no-deps` 验证 benchmark required feature。
- [x] `cargo fmt --all -- --check`、`cargo check`、`cargo test`。
- [x] `cargo test --features workspace-benchmark --bin gitpulse-workspace-benchmark`。
- [x] benchmark smoke 使用 feature-gated 命令通过。
- [x] `npm run test:release-governance`、`npm run build`、`npm run test:e2e`、`git diff --check`。
- [x] Windows 默认 Tauri bundle 成功且安装脚本不包含 benchmark binary。

## Publish v0.6.1

- [x] 提交并推送修复，等待该 SHA 主线 CI 成功。
- [x] 更新 CHANGELOG，生成并审阅 v0.6.1 Release Notes。
- [x] 运行 `npm run verify:release` 和 `npm run release:win:patch -- --dry-run`。
- [x] 运行 `npm run release:win:patch`；若版本提交已存在但 tag 尚未创建，使用 `release:win:current` 恢复。
- [x] 等待 v0.6.1 macOS/Linux workflow 完成，验证 Windows、Linux、macOS 资产和 latest manifest。

## Closeout

- [x] 记录发布 SHA、CI、Release URL、资产与任何残余风险。
- [x] 更新 specs，提交任务记录，归档 Trellis 任务并记录会话日志。

## Rollback Points

- Cargo metadata 或专项 benchmark 测试不符合预期：停止，不进入发布。
- 默认 Tauri bundle 仍包含 benchmark：停止，重新检查 target/feature 配置。
- exact-SHA CI、签名或 draft 上传失败：遵循 release governance 恢复路径，不手工补 tag。
- macOS tag workflow 失败：不移动 v0.6.1 tag，按新 patch 修复。
