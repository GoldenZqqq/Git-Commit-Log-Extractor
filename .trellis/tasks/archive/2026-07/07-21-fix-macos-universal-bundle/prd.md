# 修复 macOS universal 打包

## Goal

修复 Tauri macOS universal bundle 因自动发现 `gitpulse-workspace-benchmark` 辅助 binary 而失败的问题，让开发工具不再被默认桌面安装包收集，同时保留 benchmark 的独立测试与运行能力。

## Background

- v0.6.0 的 macOS workflow 已成功编译主应用，但在 bundle 阶段失败：universal target 中不存在 `gitpulse-workspace-benchmark`。
- Cargo 当前自动发现 `src-tauri/src/bin/gitpulse-workspace-benchmark.rs`，而只有 `gitpulse-cli` 使用了 `required-features` 隔离。
- 旧版本曾用 `cli` feature 解决同类 Tauri bundler 问题，说明该项目已采用 feature-gated developer binary 模式。
- `v0.6.0` tag 已发布且不可移动；修复代码不能回写到旧 tag。修复后需要通过后续版本流程补发 macOS 包。

## Requirements

- R1：为 workspace benchmark 增加独立的 opt-in Cargo feature，并显式声明 bin 的 `required-features`，默认 Tauri build 不再要求该 binary。
- R2：benchmark 的测试、运行命令和文档必须显式启用该 feature，不能因为隔离而静默减少质量覆盖。
- R3：主线 CI 和本地 `verify:release` 必须继续执行 benchmark 测试；默认桌面构建不应把 benchmark 纳入 bundle。
- R4：不移动、重写或向 `v0.6.0` tag 上传由新代码构建的资产；修复合入 `main` 后通过正常 patch 流程发布 `v0.6.1`。
- R5：保持 benchmark 的现有 CLI 参数、JSON schema、fixture 清理和性能阈值行为不变。
- R6：v0.6.1 的 CHANGELOG 和 Release Notes 必须明确说明 macOS universal 打包恢复与 benchmark 工具隔离，不混入无关功能。

## Acceptance Criteria

- [x] AC1：`cargo metadata --no-deps` 显示 `gitpulse-workspace-benchmark` 需要专用 feature，且默认 Tauri build 不再复制该 binary。
- [x] AC2：`cargo test`、benchmark 专项测试和 benchmark smoke 命令均通过，且 benchmark 测试数量没有被静默删减。
- [x] AC3：`npm run verify:release`、主线 CI 配置和相关文档使用一致的 feature-gated benchmark 命令。
- [x] AC4：Tauri 默认桌面构建不再尝试复制 benchmark binary；macOS release workflow 的 bundle 配置保持可执行并具备资产存在性检查。
- [x] AC5：Rust fmt/check、前端必要构建、发布治理测试和 `git diff --check` 通过。
- [x] AC6：发布治理 spec 记录该 binary 隔离约束和后续版本补发策略。
- [x] AC7：`v0.6.1` Release 正式发布，Windows、Linux 和 macOS universal 资产完整，tag 指向通过 exact-SHA CI 的 `main` 提交。

## Out Of Scope

- 不修改 `v0.6.0` tag 或已发布资产；缺失的 macOS 包通过 `v0.6.1` 提供。
- 不在本任务中新增产品功能或重构 benchmark 内部实现。
- 不把 macOS 签名、公证或 updater 支持扩展到本任务。

## Release Evidence

- 发布提交与 tag：`981c199d1bf38f44cb6070165a511dde802f8fb1` / `v0.6.1`。
- exact-SHA 主线 CI：`29809882184`，结论 `success`。
- macOS/Linux workflow：`29810386771`，结论 `success`。
- GitHub Release：https://github.com/GoldenZqqq/GitPulse/releases/tag/v0.6.1
- 已核验资产：`GitPulse_0.6.1_x64-setup.exe`、`.exe.sig`、`gitpulse-latest.json`、`GitPulse_0.6.1_amd64.AppImage`、`GitPulse_0.6.1_universal.app.zip`、`GitPulse_0.6.1_universal.dmg`。
